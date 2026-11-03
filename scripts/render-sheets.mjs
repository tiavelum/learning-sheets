#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { serialize, serializeOuter } from "parse5";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";
import { fontFile } from "./font-files.mjs";
import {
  attribute,
  fontRequests,
  fontStylesheets,
  isFile,
  isFontLink,
  isRuntimeScript,
  listSheetFolders,
  pagesInPrintOrder,
  readCanvas,
  readPage,
  staticProblems,
} from "./sheet-files.mjs";

const REPOSITORY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// The pages are served from this origin, which no network resolves, so a
// request to anything else is one the renderer did not serve itself.
const ORIGIN = "https://sheet.invalid";
const FONT_PATH = "/fonts/";
const FALLBACK_PATH = "/fallback/";
const NODE_MODULES = path.join(REPOSITORY, "node_modules");
// Chromium cannot capture a screenshot much wider than this.
const MAX_PNG_WIDTH = 16384;
// Chromium names a font even for a character that draws nothing, such as U+200B.
const DRAWS_NOTHING = /^[\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}]*$/u;
// The computed properties that choose the font of a text, and whether it is drawn.
const FONT_PROPERTIES = [
  "font-family",
  "font-style",
  "font-weight",
  "font-stretch",
  "font-variant-caps",
  "visibility",
];
// The packages that draw what no font of a page holds, each as a family of its
// own, in the order a font-family list names them, so that a character two of
// them hold, such as "✓", is drawn from the first.
const FALLBACK_PACKAGES = [
  { name: "@fontsource/noto-sans-symbols-2", family: "Fallback Noto Sans Symbols 2" },
  { name: "@fontsource/noto-sans-math", family: "Fallback Noto Sans Math" },
  { name: "@fontsource/noto-emoji", family: "Fallback Noto Emoji" },
];
// General punctuation, superscripts and subscripts, combining marks for
// symbols, letterlike symbols, number forms, arrows, mathematical signs,
// technical symbols, enclosed numbers, box drawing, shapes, symbols,
// dingbats and emoji. Each fallback face takes the characters of its file
// within this range, not the range its package declares: Noto Sans Math
// declares only Latin although its file holds the arrows and signs, and
// Noto Sans Symbols 2 declares Greek, which stays with a page's fonts.
const FALLBACK_RANGE = [
  [0x2000, 0x209f],
  [0x20d0, 0x20ff],
  [0x2100, 0x2bff],
  [0x1f000, 0x1fbff],
];

export class RenderError extends Error {}

export function pageHtml(text, board, nodeModules = NODE_MODULES) {
  const page = readPage(text);
  if (!page.xdc) throw new RenderError("holds no <x-dc> element");
  const problems = staticProblems(text, page);
  if (problems.length > 0) throw new RenderError(`is not static: ${problems.join("; ")}`);
  const { requests, problems: fontProblems } = fontRequests(page);
  if (fontProblems.length > 0) throw new RenderError(fontProblems.join("; "));

  const fonts = new Map();
  const links = [];
  for (const request of requests) {
    const { sheets, problems: missing } = fontStylesheets(request, nodeModules);
    if (missing.length > 0) throw new RenderError(missing.join("; "));
    for (const sheet of sheets) {
      if (!fonts.has(sheet)) links.push(`<link rel="stylesheet" href="${FONT_PATH}${sheet}">`);
      fonts.set(sheet, request.family);
    }
  }

  const helmet = page.helmet
    ? page.helmet.childNodes
        .filter((node) => !(node.nodeName === "link" && isFontLink(node, page)))
        .filter((node) => !(node.nodeName === "script" && isRuntimeScript(node, page)))
        .map((node) => serializeOuter(node))
        .join("")
    : "";
  if (page.helmet) {
    page.xdc.childNodes = page.xdc.childNodes.filter((node) => node !== page.helmet);
  }
  const body = serialize(page.xdc);
  const title = page.head?.childNodes.find((node) => node.nodeName === "title");
  const lang = attribute(page.html, "lang");
  const frame = `@page{size:${board.w}px ${board.h}px;margin:0}html,body{margin:0;padding:0}`;
  const html = [
    "<!doctype html>",
    `<html${lang ? ` lang="${lang.replaceAll('"', "&quot;")}"` : ""}>`,
    '<head><meta charset="utf-8">',
    title ? serializeOuter(title) : "",
    `<style>${fallbackFaces()}</style>`,
    ...links,
    helmet,
    `<style>${frame}</style>`,
    "</head>",
    `<body>${body}</body>`,
    "</html>",
  ].join("\n");
  return { html, fonts };
}

// A variable package names its family "<family> Variable", while the page asks for "<family>".
function fontCss(file, family) {
  const css = readFileSync(file, "utf8");
  return css.replace(/font-family:\s*'([^']+) Variable';/g, `font-family: '${family}';`);
}

// Each fallback file joins its family once upright and once italic, at every
// weight and width, so that Chromium draws its regular glyphs in bold,
// italic or condensed text as they are, rather than emboldened or slanted.
// A face's unicode-range holds only what its file holds, so Chromium goes on
// to the next fallback family for a character the file lacks.
function fallbackFaces() {
  return fallbackFiles()
    .filter(({ range }) => range !== "")
    .flatMap(({ family, file, range }) =>
      ["normal", "italic"].map(
        (style) =>
          `@font-face{font-family:'${family}';font-style:${style};font-weight:1 1000;font-stretch:50% 200%;src:url(${FALLBACK_PATH}${file}) format('woff2');unicode-range:${range};}`,
      ),
    )
    .join("\n");
}

let fallbackFileList;
// The files of each package's regular weight, in the order of FALLBACK_PACKAGES,
// each with its family, its PostScript name and the code points of
// FALLBACK_RANGE it holds.
function fallbackFiles() {
  if (fallbackFileList) return fallbackFileList;
  const files = [];
  for (const { name, family } of FALLBACK_PACKAGES) {
    const css = path.join(NODE_MODULES, name, "400.css");
    if (!isFile(css)) {
      throw new RenderError(`the fallback font package ${name} is not installed; run npm ci`);
    }
    for (const [, file] of readFileSync(css, "utf8").matchAll(
      /url\(\.\/(files\/[^)]+\.woff2)\)/g,
    )) {
      const font = fontFile(path.join(NODE_MODULES, name, file));
      const codes = [...font.characters]
        .filter((code) => FALLBACK_RANGE.some(([low, high]) => code >= low && code <= high))
        .sort((a, b) => a - b);
      files.push({
        family,
        file: `${name}/${file}`,
        name: font.name,
        codes,
        range: unicodeRange(codes),
      });
    }
  }
  fallbackFileList = files;
  return files;
}

// The sorted code points as a unicode-range of runs, such as U+2190-2199,U+21D2.
function unicodeRange(codes) {
  const runs = [];
  for (const code of codes) {
    const run = runs.at(-1);
    if (run && code === run[1] + 1) run[1] = code;
    else runs.push([code, code]);
  }
  const hex = (code) => code.toString(16).toUpperCase().padStart(4, "0");
  return runs
    .map(([low, high]) => (low === high ? `U+${hex(low)}` : `U+${hex(low)}-${hex(high)}`))
    .join(",");
}

// Runs in the page before it is measured and printed. The fallback families
// join each element's computed font-family list right after the last family
// of the list that the page loads, so that a character any family of the
// list that the page loads holds is drawn from that family, as without the
// fallback, and one that none of them holds is drawn from the fallback
// rather than from a font of the machine that a later name of the list, such
// as Arial or sans-serif, stands for; a list that names no family the page
// loads takes them at its end. Every list is read before any is set, since a
// set list is inherited, and a pseudo-element whose list then still lacks the
// fallback, because the page sets it apart, gets a rule of its own.
function addFallbackToLists({ loaded, fallback }) {
  const names = new Set(loaded.map((family) => family.toLowerCase()));
  const withFallback = (list) => {
    const parts = list
      .match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,]+/g)
      .map((part) => part.trim());
    const bare = parts.map((part) => part.replace(/^["']|["']$/g, "").toLowerCase());
    const at = bare.findLastIndex((name) => names.has(name)) + 1 || parts.length;
    return [
      ...parts.slice(0, at),
      ...fallback.map((family) => `"${family}"`),
      ...parts.slice(at),
    ].join(", ");
  };
  const pseudos = ["::before", "::after", "::marker", "::first-letter", "::first-line"];
  const elements = [...document.querySelectorAll("*")].map((element) => ({
    element,
    lists: [null, ...pseudos].map((pseudo) => getComputedStyle(element, pseudo).fontFamily),
  }));
  for (const { element, lists } of elements) {
    element.style.setProperty("font-family", withFallback(lists[0]), "important");
  }
  const rules = [];
  for (const [index, { element, lists }] of elements.entries()) {
    for (const [at, pseudo] of pseudos.entries()) {
      const wanted = withFallback(lists[at + 1]);
      if (getComputedStyle(element, pseudo).fontFamily === wanted) continue;
      element.setAttribute("data-fallback-font", String(index));
      rules.push(`[data-fallback-font="${index}"]${pseudo}{font-family:${wanted} !important}`);
    }
  }
  if (rules.length > 0) {
    const style = document.createElement("style");
    style.textContent = rules.join("\n");
    document.head.append(style);
  }
}

// The code points that each font the renderer serves can draw, by the
// PostScript name Chromium reports for it: of each face of the page's
// stylesheets, those its file holds within its unicode-range, and of each
// fallback face, those its file holds within FALLBACK_RANGE.
function drawableByFont(fonts, nodeModules) {
  const drawable = new Map();
  const add = (name, codes) => {
    if (!drawable.has(name)) drawable.set(name, new Set());
    for (const code of codes) drawable.get(name).add(code);
  };
  for (const sheet of fonts.keys()) {
    const css = readFileSync(path.join(nodeModules, sheet), "utf8");
    for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const file = body.match(/url\(\.\/([^)]+\.woff2)\)/)?.[1];
      if (!file) continue;
      const ranges = unicodeRanges(body.match(/unicode-range:\s*([^;]+);/)?.[1]);
      let font;
      try {
        font = fontFile(path.join(nodeModules, path.dirname(sheet), file));
      } catch {
        // A file Chromium can load but this cannot read counts as holding
        // nothing, so what the page draws with it is named in a warning.
        continue;
      }
      add(
        font.name,
        [...font.characters].filter((code) =>
          ranges.some(([low, high]) => code >= low && code <= high),
        ),
      );
    }
  }
  for (const { name, codes } of fallbackFiles()) add(name, codes);
  return drawable;
}

// A unicode-range descriptor as ranges of code points; no descriptor is every code point.
function unicodeRanges(descriptor) {
  if (!descriptor) return [[0, 0x10ffff]];
  return descriptor.split(",").map((part) => {
    const [low, high = low] = part.trim().replace(/^U\+/i, "").split("-");
    return [
      Number.parseInt(low.replaceAll("?", "0"), 16),
      Number.parseInt(high.replaceAll("?", "F"), 16),
    ];
  });
}

const CONTENT_TYPES = {
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

async function overflow(page, board) {
  return page.evaluate(({ w, h }) => {
    const roots = [...document.body.children].filter(
      (element) => getComputedStyle(element).display !== "none",
    );
    if (roots.length === 0) return null;
    let top = 0;
    let left = 0;
    let bottom = 0;
    let right = 0;
    const take = (rect) => {
      if (rect.width === 0 && rect.height === 0) return;
      top = Math.min(top, rect.top);
      left = Math.min(left, rect.left);
      bottom = Math.max(bottom, rect.bottom);
      right = Math.max(right, rect.right);
    };
    // What a descendant of the root draws outside an element that clips it
    // is not seen, so only the clipping element's box counts for it.
    const clips = (element) => {
      const style = getComputedStyle(element);
      return style.overflowX !== "visible" || style.overflowY !== "visible";
    };
    const walk = (element, clipped) => {
      if (!clipped) take(element.getBoundingClientRect());
      const clipsChildren = clipped || (!roots.includes(element) && clips(element));
      if (clipsChildren || element instanceof SVGElement) return;
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) take(rect);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          walk(node, clipsChildren);
        }
      }
    };
    for (const root of roots) walk(root, false);
    const past = {
      bottom: Math.ceil(bottom - h),
      right: Math.ceil(right - w),
      top: Math.ceil(-top),
      left: Math.ceil(-left),
    };
    const sides = Object.entries(past).filter(([, px]) => px > 0);
    return sides;
  }, board);
}

export async function renderSheet(browser, root, name, out, { pngWidth, nodeModules } = {}) {
  const projectDir = path.join(root, name, "project");
  const { canvas, problem } = readCanvas(path.join(projectDir, "canvas.json"));
  if (problem) throw new RenderError(`${path.join(projectDir, "canvas.json")}: ${problem}`);
  const pages = pagesInPrintOrder(canvas);
  if (pages.length === 0)
    throw new RenderError(`${path.join(projectDir, "canvas.json")}: "boards" holds no page`);
  const merged = await PDFDocument.create();
  const uncovered = [];
  for (const [index, key] of pages.entries()) {
    const file = path.join(projectDir, key);
    const board = canvas.boards[key];
    let html;
    let fonts;
    try {
      ({ html, fonts } = pageHtml(readFileSync(file, "utf8"), board, nodeModules));
    } catch (error) {
      if (error instanceof RenderError) throw new RenderError(`${file}: ${error.message}`);
      throw error;
    }
    const { pdf, characters } = await printPage(browser, html, fonts, board, file, {
      png: index === 0 && pngWidth ? path.join(out, `${name}.png`) : null,
      pngWidth,
      nodeModules: nodeModules ?? NODE_MODULES,
    });
    for (const character of characters) {
      uncovered.push(
        `${file}: draws ${character} in a font neither the page nor the fallback loads`,
      );
    }
    const printed = await PDFDocument.load(pdf);
    if (printed.getPageCount() !== 1) {
      throw new RenderError(`${file}: printed to ${printed.getPageCount()} pages, not one`);
    }
    const [copied] = await merged.copyPages(printed, [0]);
    // Chrome rounds the paper to its own units; the page takes the frame's width again.
    const { height } = copied.getSize();
    copied.setMediaBox(0, 0, board.w * 0.75, height);
    copied.setCropBox(0, 0, board.w * 0.75, height);
    merged.addPage(copied);
  }
  merged.setTitle(canvas.title ?? name);
  merged.setCreator("learning-sheets render-sheets.mjs");
  merged.setProducer("pdf-lib");
  // A fixed date keeps the PDF of unchanged files the same from run to run.
  merged.setCreationDate(new Date(0));
  merged.setModificationDate(new Date(0));
  const target = path.join(out, `${name}.pdf`);
  writeFileSync(target, await merged.save());
  // A character that neither the page's fonts nor the fallback hold still
  // prints, in a font of the machine, so it warns rather than fails the sheet.
  return { pdf: target, pages: pages.length, warnings: uncovered };
}

async function printPage(browser, html, fonts, board, file, { png, pngWidth, nodeModules }) {
  const context = await browser.newContext({
    viewport: { width: board.w, height: board.h },
    deviceScaleFactor: png ? pngWidth / board.w : 1,
    serviceWorkers: "block",
  });
  const blocked = [];
  try {
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== ORIGIN) {
        blocked.push(route.request().url());
        return route.abort("blockedbyclient");
      }
      if (url.pathname === "/") {
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      }
      if (url.pathname.startsWith(FALLBACK_PATH)) {
        const relative = decodeURIComponent(url.pathname.slice(FALLBACK_PATH.length));
        if (fallbackFiles().some((fallback) => fallback.file === relative)) {
          return route.fulfill({
            status: 200,
            contentType: "font/woff2",
            body: readFileSync(path.join(NODE_MODULES, relative)),
          });
        }
      }
      if (url.pathname.startsWith(FONT_PATH)) {
        const relative = decodeURIComponent(url.pathname.slice(FONT_PATH.length));
        const local = path.join(nodeModules, relative);
        const inside = local.startsWith(nodeModules + path.sep) && !relative.includes("..");
        const sheet = relative.endsWith(".css") ? fonts.get(relative) : undefined;
        if (inside && isFile(local) && (sheet !== undefined || !relative.endsWith(".css"))) {
          const body = sheet !== undefined ? fontCss(local, sheet) : readFileSync(local);
          return route.fulfill({
            status: 200,
            contentType: CONTENT_TYPES[path.extname(local)],
            body,
          });
        }
      }
      blocked.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
    await page.evaluate(addFallbackToLists, {
      loaded: [...new Set(fonts.values())],
      fallback: FALLBACK_PACKAGES.map(({ family }) => family),
    });
    const failedFonts = await page.evaluate(async () => {
      // A layout, which loads the fallback files that the lists now reach.
      document.body.getBoundingClientRect();
      await document.fonts.ready;
      return [...document.fonts]
        .filter((face) => face.status === "error")
        .map((face) => `${face.family} ${face.weight} ${face.style}`);
    });
    if (blocked.length > 0) {
      throw new RenderError(
        `${file}: requested ${[...new Set(blocked)].join(", ")}, which a page may not load`,
      );
    }
    if (failedFonts.length > 0)
      throw new RenderError(`${file}: the fonts ${failedFonts.join(", ")} did not load`);
    const past = await overflow(page, board);
    if (past === null) throw new RenderError(`${file}: has no content to print`);
    if (past.length > 0) {
      const where = past.map(([side, px]) => `${px} px at the ${side}`).join(", ");
      throw new RenderError(
        `${file}: the content runs past the ${board.w} × ${board.h} px frame by ${where}`,
      );
    }
    if (png) {
      await page.screenshot({ path: png, clip: { x: 0, y: 0, width: board.w, height: board.h } });
    }
    const pdf = await page.pdf({
      width: `${board.w}px`,
      height: `${board.h}px`,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    // After the PDF, since the probe adds elements to the page.
    const characters = await uncoveredCharacters(page, drawableByFont(fonts, nodeModules));
    if (blocked.length > 0) {
      throw new RenderError(
        `${file}: requested ${[...new Set(blocked)].join(", ")}, which a page may not load`,
      );
    }
    return { pdf, characters };
  } finally {
    await context.close();
  }
}

// Only Chromium knows which font drew a character, once the cascade, the
// font-family list and each @font-face unicode-range have run, and it reports
// fonts per text. A character is covered where every font it reports for it
// is one the renderer served and one of them can draw each of its code
// points. A font Chromium did not download is one of the machine; and where
// no font at all holds a character, Chromium draws the empty glyph of the
// list's first font and reports that font, which may be one the renderer
// served, so its file is what tells whether it drew the character.
async function uncoveredCharacters(page, drawable) {
  const covered = (fonts, text) =>
    fonts.every((font) => font.isCustomFont) &&
    [...text]
      .filter((character) => !DRAWS_NOTHING.test(character))
      .every((character) =>
        fonts.some((font) => drawable.get(font.postScriptName)?.has(character.codePointAt(0))),
      );
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    await session.send("DOM.getDocument", { depth: -1 });
    // The protocol documents the call for an element; Chromium also takes a
    // text node, and a Chromium that refused it would name the call here.
    const fontsOf = async (nodeId) => {
      try {
        return (await session.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
      } catch (error) {
        throw new RenderError(
          `this Chromium cannot say which fonts drew a text (CSS.getPlatformFontsForNode: ${error.message.split("\n")[0]})`,
        );
      }
    };
    const { documents, strings } = await session.send("DOMSnapshot.captureSnapshot", {
      computedStyles: FONT_PROPERTIES,
    });
    const [{ nodes, layout }] = documents;
    const texts = [];
    for (const [entry, index] of layout.nodeIndex.entries()) {
      const text = layout.text[entry] >= 0 ? strings[layout.text[entry]] : "";
      if (DRAWS_NOTHING.test(text)) continue;
      const style = Object.fromEntries(
        FONT_PROPERTIES.map((property, at) => [property, strings[layout.styles[entry][at]]]),
      );
      if (style.visibility !== "visible") continue;
      texts.push({ index, text, style });
    }
    const { nodeIds } = await session.send("DOM.pushNodesByBackendIdsToFrontend", {
      backendNodeIds: texts.map(({ index }) => nodes.backendNodeId[index]),
    });
    const found = new Set();
    for (const [at, { index, text, style }] of texts.entries()) {
      const fonts = await fontsOf(nodeIds[at]);
      // A text with no font named is not painted (a closed <details>), so it counts as covered.
      if (fonts.length === 0 || covered(fonts, text)) continue;
      // Chromium reports fonts per text, not per character, so a text that is
      // not covered is drawn again one character at a time to find which.
      const graphemes = [...new Set(graphemesOf(text))].filter((g) => !DRAWS_NOTHING.test(g));
      const parent = nodes.backendNodeId[nodes.parentIndex[index]];
      const { object } = await session.send("DOM.resolveNode", { backendNodeId: parent });
      const { result } = await session.send("Runtime.callFunctionOn", {
        objectId: object.objectId,
        functionDeclaration: DRAW_ALONE,
        arguments: [{ value: graphemes }, { value: style }],
        awaitPromise: true,
      });
      const { result: probes } = await session.send("Runtime.getProperties", {
        objectId: result.objectId,
        ownProperties: true,
      });
      for (const probe of probes.filter((property) => /^\d+$/.test(property.name))) {
        const { nodeId } = await session.send("DOM.requestNode", {
          objectId: probe.value.objectId,
        });
        const grapheme = graphemes[Number(probe.name)];
        const alone = await fontsOf(nodeId);
        if (alone.length > 0 && !covered(alone, grapheme)) found.add(grapheme);
      }
    }
    return [...found].sort(byCodePoints).map(characterName);
  } finally {
    await session.detach();
  }
}

// Runs in the page, on the element that holds the text: an element of its own
// per character, with the text's font properties, gets fonts of its own.
const DRAW_ALONE = `async function (graphemes, style) {
  const svg = this.namespaceURI === "http://www.w3.org/2000/svg";
  const probes = graphemes.map((grapheme) => {
    const probe = svg
      ? document.createElementNS(this.namespaceURI, "tspan")
      : document.createElement("span");
    for (const [property, value] of Object.entries(style)) probe.style.setProperty(property, value);
    probe.style.setProperty("display", "inline");
    probe.style.setProperty("text-transform", "none");
    probe.style.setProperty("white-space", "pre");
    probe.textContent = grapheme;
    this.append(probe);
    return probe;
  });
  for (const probe of probes) probe.getBoundingClientRect();
  await document.fonts.ready;
  return probes;
}`;

function graphemesOf(text) {
  return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)].map(
    ({ segment }) => segment,
  );
}

function byCodePoints(a, b) {
  const [x, y] = [a, b].map((text) => [...text].map((c) => c.codePointAt(0)));
  for (let at = 0; at < Math.min(x.length, y.length); at++) {
    if (x[at] !== y[at]) return x[at] - y[at];
  }
  return x.length - y.length;
}

function characterName(grapheme) {
  const points = [...grapheme].map(
    (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
  );
  return `${points.join(" ")} ${grapheme}`;
}

// A Claude cloud workspace cannot download Playwright's Chromium but has a Chrome.
export function launchBrowser() {
  const executablePath = process.env.CHROME_PATH || undefined;
  return chromium.launch({ executablePath });
}

export async function renderSheets({
  root = "sheets",
  out = "build",
  names = [],
  pngWidth,
  nodeModules,
} = {}) {
  const available = listSheetFolders(root);
  const unknown = names.filter((name) => !available.includes(name));
  if (unknown.length > 0) throw new RenderError(`${root} holds no sheet ${unknown.join(", ")}`);
  const selected = names.length > 0 ? names : available;
  mkdirSync(out, { recursive: true });
  const results = [];
  if (selected.length === 0) return results;
  let browser;
  try {
    browser = await launchBrowser();
  } catch (error) {
    throw new RenderError(
      `no browser: run npx playwright install chromium or set CHROME_PATH (${error.message.split("\n")[0]})`,
    );
  }
  try {
    for (const name of selected) {
      try {
        results.push({
          name,
          ...(await renderSheet(browser, root, name, out, { pngWidth, nodeModules })),
        });
      } catch (error) {
        if (!(error instanceof RenderError)) throw error;
        // What an earlier run or the failed one wrote would pass for this sheet's output.
        rmSync(path.join(out, `${name}.pdf`), { force: true });
        rmSync(path.join(out, `${name}.png`), { force: true });
        results.push({ name, error: error.message });
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function main() {
  const usage =
    "usage: render-sheets.mjs [--root <folder>] [--out <folder>] [--png-width <px>] [<name> ...]";
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        root: { type: "string", default: "sheets" },
        out: { type: "string", default: "build" },
        "png-width": { type: "string" },
      },
    }));
  } catch (error) {
    console.error(`${error.message}; ${usage}`);
    process.exitCode = 2;
    return;
  }
  let pngWidth;
  if (values["png-width"] !== undefined) {
    pngWidth = Number(values["png-width"]);
    if (!Number.isInteger(pngWidth) || pngWidth < 1 || pngWidth > MAX_PNG_WIDTH) {
      console.error(
        `--png-width must be a whole number of px from 1 to ${MAX_PNG_WIDTH}, not ${values["png-width"]}; ${usage}`,
      );
      process.exitCode = 2;
      return;
    }
  }
  // A mistyped root would otherwise pass as a root that holds no sheet.
  if (!existsSync(values.root) || !statSync(values.root).isDirectory()) {
    console.error(`${values.root} is not a folder; ${usage}`);
    process.exitCode = 2;
    return;
  }
  let results;
  try {
    results = await renderSheets({
      root: values.root,
      out: values.out,
      names: positionals,
      pngWidth,
    });
  } catch (error) {
    if (!(error instanceof RenderError)) throw error;
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  for (const result of results) {
    if (result.error) console.error(result.error);
    else console.log(`${result.pdf}: ${result.pages} page${result.pages === 1 ? "" : "s"}`);
    for (const warning of result.warnings ?? []) console.error(warning);
  }
  const failed = results.filter((result) => result.error).length;
  if (failed > 0) process.exitCode = 1;
  console.log(
    `${results.length - failed} of ${results.length} sheet${results.length === 1 ? "" : "s"} rendered to ${values.out}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
