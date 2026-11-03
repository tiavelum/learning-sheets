#!/usr/bin/env node
// Renders each sheet of a sheets root to one PDF, and optionally a PNG of its
// first page, from its canvas files and the Fontsource fonts in node_modules.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const NODE_MODULES = path.join(REPOSITORY, "node_modules");

export class RenderError extends Error {}

/**
 * The HTML that prints one page: the helmet in the head, the content of
 * <x-dc> as the body, the canvas runtime and the Google Fonts links dropped,
 * the Fontsource stylesheets linked instead and @page set to the frame.
 */
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
    ...links,
    helmet,
    `<style>${frame}</style>`,
    "</head>",
    `<body>${body}</body>`,
    "</html>",
  ].join("\n");
  return { html, fonts };
}

/**
 * The stylesheet of a Fontsource package as the page loads it: a variable
 * package names its family "<family> Variable", so the family the page asks
 * for is put in its place.
 */
function fontCss(file, family) {
  const css = readFileSync(file, "utf8");
  return css.replace(/font-family:\s*'([^']+) Variable';/g, `font-family: '${family}';`);
}

const CONTENT_TYPES = {
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

/** How far a page's content runs past its frame, in px, and where. */
async function overflow(page, board) {
  return page.evaluate(({ w, h }) => {
    const root = document.body.firstElementChild;
    if (!root) return null;
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
      const clipsChildren = clipped || (element !== root && clips(element));
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
    walk(root, false);
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

/** Renders one sheet folder to <out>/<name>.pdf and, with pngWidth, <out>/<name>.png. */
export async function renderSheet(browser, root, name, out, { pngWidth, nodeModules } = {}) {
  const projectDir = path.join(root, name, "project");
  const { canvas, problem } = readCanvas(path.join(projectDir, "canvas.json"));
  if (problem) throw new RenderError(`${path.join(projectDir, "canvas.json")}: ${problem}`);
  const pages = pagesInPrintOrder(canvas);
  if (pages.length === 0)
    throw new RenderError(`${path.join(projectDir, "canvas.json")}: "boards" holds no page`);
  const merged = await PDFDocument.create();
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
    const pdf = await printPage(browser, html, fonts, board, file, {
      png: index === 0 && pngWidth ? path.join(out, `${name}.png`) : null,
      pngWidth,
      nodeModules: nodeModules ?? NODE_MODULES,
    });
    const printed = await PDFDocument.load(pdf);
    if (printed.getPageCount() !== 1) {
      throw new RenderError(`${file}: printed to ${printed.getPageCount()} pages, not one`);
    }
    const [copied] = await merged.copyPages(printed, [0]);
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
  return { pdf: target, pages: pages.length };
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
    if (blocked.length > 0) {
      throw new RenderError(
        `${file}: requested ${[...new Set(blocked)].join(", ")}, which a page may not load`,
      );
    }
    return pdf;
  } finally {
    await context.close();
  }
}

/** Launches Chrome from CHROME_PATH where it is set, else Playwright's Chromium. */
export function launchBrowser() {
  const executablePath = process.env.CHROME_PATH || undefined;
  return chromium.launch({ executablePath });
}

/** Renders the named sheets of a root, or all of them, and returns what each gave. */
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
  const browser = await launchBrowser();
  try {
    for (const name of selected) {
      try {
        results.push({
          name,
          ...(await renderSheet(browser, root, name, out, { pngWidth, nodeModules })),
        });
      } catch (error) {
        if (!(error instanceof RenderError)) throw error;
        results.push({ name, error: error.message });
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string", default: "sheets" },
      out: { type: "string", default: "build" },
      "png-width": { type: "string" },
    },
  });
  let pngWidth;
  if (values["png-width"] !== undefined) {
    pngWidth = Number(values["png-width"]);
    if (!Number.isInteger(pngWidth) || pngWidth < 1) {
      console.error(`--png-width must be a whole number of px, not ${values["png-width"]}`);
      process.exitCode = 1;
      return;
    }
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
  }
  const failed = results.filter((result) => result.error).length;
  if (failed > 0) process.exitCode = 1;
  console.log(
    `${results.length - failed} of ${results.length} sheet${results.length === 1 ? "" : "s"} rendered to ${values.out}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
