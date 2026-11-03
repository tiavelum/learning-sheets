#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { serialize, serializeOuter } from "parse5";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";
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
// The packages that draw what no font of a page holds, in the order Chromium
// tries them: of the faces of one family whose unicode-range holds a
// character, it tries the one defined last first, and goes on to the one
// defined before it where that file lacks the glyph.
const FALLBACK_PACKAGES = [
  "@fontsource/noto-sans-symbols-2",
  "@fontsource/noto-sans-math",
  "@fontsource/noto-emoji",
];
// Superscripts and subscripts, letterlike symbols and number forms, arrows,
// mathematical signs, technical symbols, enclosed numbers, box drawing,
// shapes, symbols, dingbats and emoji. The ranges are the fallback's own,
// since a package declares the ranges of its subsets, and Noto Sans Math
// declares only Latin although its file holds the arrows and signs.
const FALLBACK_RANGES = [
  [0x2070, 0x209f],
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
  const fallback = fallbackFaces(fonts, nodeModules);
  const html = [
    "<!doctype html>",
    `<html${lang ? ` lang="${lang.replaceAll('"', "&quot;")}"` : ""}>`,
    '<head><meta charset="utf-8">',
    title ? serializeOuter(title) : "",
    ...links,
    fallback ? `<style>${fallback}</style>` : "",
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

// A page's font-family lists end in system fonts, so the fallback joins every
// family the page loads, as further faces of it with the same descriptors.
// Its range leaves out every character that a face of the page declares,
// so that a character a family of the page holds is drawn as without it.
export function fallbackFaces(fonts, nodeModules = NODE_MODULES) {
  const faces = [...fonts].flatMap(([sheet, family]) =>
    fontFaces(fontCss(path.join(nodeModules, sheet), family)),
  );
  const declared = faces.map((face) => face["unicode-range"] ?? "U+0-10FFFF").join(",");
  const range = formatRanges(subtractRanges(FALLBACK_RANGES, parseRanges(declared)));
  if (range === "") return "";
  const descriptors = new Map();
  for (const face of faces) {
    const kept = ["font-family", "font-style", "font-weight", "font-stretch"]
      .filter((name) => face[name] !== undefined)
      .map((name) => `${name}:${face[name]};`)
      .join("");
    descriptors.set(kept, kept);
  }
  const files = [...fallbackFiles()].reverse();
  return [...descriptors.keys()]
    .flatMap((kept) =>
      files.map(
        (file) =>
          `@font-face{${kept}src:url(${FALLBACK_PATH}${file}) format('woff2');unicode-range:${range};}`,
      ),
    )
    .join("\n");
}

let fallbackFileList;
// The files of each package's regular weight, in the order of FALLBACK_PACKAGES.
function fallbackFiles() {
  if (fallbackFileList) return fallbackFileList;
  const files = [];
  for (const name of FALLBACK_PACKAGES) {
    const css = path.join(NODE_MODULES, name, "400.css");
    if (!isFile(css)) {
      throw new RenderError(`the fallback font package ${name} is not installed; run npm ci`);
    }
    for (const [, file] of readFileSync(css, "utf8").matchAll(
      /url\(\.\/(files\/[^)]+\.woff2)\)/g,
    )) {
      files.push(`${name}/${file}`);
    }
  }
  fallbackFileList = files;
  return files;
}

function fontFaces(css) {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) =>
    Object.fromEntries(
      [...body.matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
        name,
        value.trim(),
      ]),
    ),
  );
}

function parseRanges(text) {
  return text
    .split(",")
    .map((part) => part.trim().replace(/^U\+/i, ""))
    .filter((part) => part !== "")
    .map((part) => {
      const [start, end = start] = part.includes("?")
        ? [part.replaceAll("?", "0"), part.replaceAll("?", "F")]
        : part.split("-");
      return [Number.parseInt(start, 16), Number.parseInt(end, 16)];
    });
}

function subtractRanges(ranges, taken) {
  let left = ranges;
  for (const [start, end] of taken) {
    left = left.flatMap(([from, to]) => {
      if (end < from || start > to) return [[from, to]];
      return [
        [from, start - 1],
        [end + 1, to],
      ].filter(([a, b]) => a <= b);
    });
  }
  return left;
}

function formatRanges(ranges) {
  const hex = (point) => point.toString(16).toUpperCase().padStart(4, "0");
  return ranges
    .map(([start, end]) => (start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`))
    .join(",");
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
        if (fallbackFiles().includes(relative)) {
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
    const failedFonts = await page.evaluate(async () => {
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
    // After the PDF, since it adds elements to the page to test each character.
    const characters = await uncoveredCharacters(page);
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

// Chromium reports, for each text and pseudo-element it lays out, the fonts it
// drew it with, and whether each is a web font, which here only Fontsource is.
async function uncoveredCharacters(page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    await session.send("DOM.getDocument", { depth: -1 });
    const fontsOf = async (nodeId) =>
      (await session.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
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
      if (fonts.every((font) => font.isCustomFont)) continue;
      // The text holds a character from a system font; each character of it is
      // drawn alone, with the same font properties, to find which.
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
        const alone = await fontsOf(nodeId);
        if (alone.some((font) => !font.isCustomFont)) found.add(graphemes[Number(probe.name)]);
      }
    }
    return [...found].sort(byCodePoints).map(characterName);
  } finally {
    await session.detach();
  }
}

// Runs in the page on the element that holds the text: appends each character
// in an element of its own that takes the text's font properties.
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
