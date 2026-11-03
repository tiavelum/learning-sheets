#!/usr/bin/env node
// Builds the browse page: the page of site/ with the catalog of every sheet
// put into it, catalog.json beside it, and a PNG of each sheet's first page.

import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { RenderError, renderSheets } from "./render-sheets.mjs";
import { FRONT_MATTER_FIELDS, listSheetFolders, readFrontMatter } from "./sheet-files.mjs";

const REPOSITORY_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE_DIR = path.join(REPOSITORY_DIR, "site");
export const REPOSITORY = "tiavelum/learning-sheets";
const GITHUB = `https://github.com/${REPOSITORY}`;
const API = "https://api.github.com";
/** The width of the image of page one, twice the width the page shows it at. */
export const IMAGE_WIDTH = 240;
const IMAGES = "images";
// The page's script reads the catalog from this element, so that the page
// also works when opened as a file, where a browser does not fetch JSON.
const CATALOG_SLOT = /<script id="catalog" type="application\/json">\s*<\/script>/;

export class BuildError extends Error {}

/**
 * What the latest release of the repository holds, read from the REST API:
 * `found` with its tag, its page and the names of its assets, `none` where
 * the repository has no release, or `unreachable` with the reason.
 */
export async function latestRelease({
  fetch = globalThis.fetch,
  token = process.env.GITHUB_TOKEN,
  repository = REPOSITORY,
} = {}) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "learning-sheets-build-site",
    "x-github-api-version": "2022-11-28",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API}/repos/${repository}/releases/latest`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return { state: "unreachable", reason: error.cause?.code ?? error.message };
  }
  if (response.status === 404) return { state: "none" };
  if (!response.ok) return { state: "unreachable", reason: `HTTP ${response.status}` };
  let release;
  try {
    release = await response.json();
  } catch (error) {
    return { state: "unreachable", reason: `the answer is not JSON: ${error.message}` };
  }
  return {
    state: "found",
    tag: release.tag_name,
    url: release.html_url,
    assets: (release.assets ?? []).map((asset) => asset.name),
  };
}

/** The sheet folders of a root with their front matter, and every problem that keeps one from being read. */
export function readSheets(root) {
  const sheets = [];
  const problems = [];
  for (const name of listSheetFolders(root)) {
    const file = path.join(root, name, "README.md");
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      problems.push(`${file}: cannot be read`);
      continue;
    }
    const { fields, problems: found } = readFrontMatter(text);
    if (found.length > 0) problems.push(...found.map((problem) => `${file}: ${problem}`));
    else sheets.push({ name, fields });
  }
  return { sheets, problems };
}

/** The folder on GitHub that holds a root's sheets, as a path in the repository. */
function rootInRepository(root) {
  const relative = path.relative(REPOSITORY_DIR, path.resolve(root));
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return "sheets";
  return relative.split(path.sep).join("/");
}

/** The catalog of the page and of catalog.json: each sheet's folder name, front matter and links. */
export function catalogOf(sheets, release, root) {
  const assets = release.state === "found" ? release.assets : [];
  const folder = rootInRepository(root);
  return {
    repository: GITHUB,
    release: release.state === "found" ? { tag: release.tag, url: release.url } : null,
    sheets: sheets.map(({ name, fields }) => ({
      name,
      ...Object.fromEntries(FRONT_MATTER_FIELDS.map((field) => [field, fields[field]])),
      source: `${GITHUB}/tree/main/${folder}/${name}`,
      pdf: assets.includes(`${name}.pdf`) ? `${GITHUB}/releases/latest/download/${name}.pdf` : null,
      image: `${IMAGES}/${name}.png`,
    })),
  };
}

/** The page of site/ with the catalog put into it, written so that no "<" closes its script. */
export function pageWithCatalog(html, catalog) {
  if (!CATALOG_SLOT.test(html)) {
    throw new BuildError(
      'site/index.html holds no empty <script id="catalog" type="application/json">',
    );
  }
  const json = JSON.stringify(catalog).replaceAll("<", "\\u003c");
  return html.replace(
    CATALOG_SLOT,
    () => `<script id="catalog" type="application/json">${json}</script>`,
  );
}

function releaseLine(release, sheets) {
  if (release.state === "none") return "no release yet: every sheet shows as not released yet";
  if (release.state === "unreachable") {
    return `the latest release could not be read (${release.reason}): every sheet shows as not released yet`;
  }
  const held = sheets.filter((sheet) => sheet.pdf !== null).length;
  return `the latest release ${release.tag} holds the PDF of ${held} of ${sheets.length} sheet${sheets.length === 1 ? "" : "s"}`;
}

/**
 * Builds the page into `out` and returns what it printed, line by line; a
 * sheet that cannot be read or rendered, or a release that cannot be read
 * where `requireRelease` asks for it, throws a BuildError and writes no page.
 */
export async function buildSite({
  root = "sheets",
  out = "build/site",
  fetch,
  token,
  requireRelease = false,
  site = SITE_DIR,
} = {}) {
  const lines = [];
  const release = await latestRelease({ fetch, token });
  if (release.state === "unreachable" && requireRelease) {
    throw new BuildError(`the latest release could not be read (${release.reason})`);
  }
  const { sheets, problems } = readSheets(root);
  if (problems.length > 0) {
    throw new BuildError([...problems, "npm run check names every problem"].join("\n"));
  }
  const catalog = catalogOf(sheets, release, root);

  const images = new Map();
  if (sheets.length > 0) {
    const rendered = mkdtempSync(path.join(tmpdir(), "build-site-"));
    try {
      const results = await renderSheets({
        root,
        out: rendered,
        names: sheets.map((sheet) => sheet.name),
        pngWidth: IMAGE_WIDTH,
      });
      const failed = results.filter((result) => result.error);
      if (failed.length > 0) throw new BuildError(failed.map((result) => result.error).join("\n"));
      for (const { name } of results) {
        images.set(name, readFileSync(path.join(rendered, `${name}.png`)));
      }
    } catch (error) {
      if (error instanceof RenderError) throw new BuildError(error.message);
      throw error;
    } finally {
      rmSync(rendered, { recursive: true, force: true });
    }
  }

  mkdirSync(out, { recursive: true });
  for (const file of readdirSync(site)) {
    if (file === "index.html") {
      const html = readFileSync(path.join(site, file), "utf8");
      writeFileSync(path.join(out, file), pageWithCatalog(html, catalog));
    } else {
      copyFileSync(path.join(site, file), path.join(out, file));
    }
  }
  writeFileSync(path.join(out, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  // The images of sheets removed since the last build would be published too.
  rmSync(path.join(out, IMAGES), { recursive: true, force: true });
  mkdirSync(path.join(out, IMAGES));
  for (const [name, png] of images) {
    const file = path.join(out, IMAGES, `${name}.png`);
    writeFileSync(file, png);
    lines.push(`${file}: page one at ${IMAGE_WIDTH} px`);
  }
  lines.push(releaseLine(release, catalog.sheets));
  lines.push(
    `${catalog.sheets.length} sheet${catalog.sheets.length === 1 ? "" : "s"} built into ${out}`,
  );
  return { catalog, release, lines };
}

async function main() {
  const usage =
    "usage: build-site.mjs [--root <folder>] [--out <folder>] [--require-release-lookup]";
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        root: { type: "string", default: "sheets" },
        out: { type: "string", default: "build/site" },
        "require-release-lookup": { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    console.error(`${error.message}; ${usage}`);
    process.exitCode = 2;
    return;
  }
  try {
    const { lines } = await buildSite({
      root: values.root,
      out: values.out,
      requireRelease: values["require-release-lookup"],
    });
    for (const line of lines) console.log(line);
  } catch (error) {
    if (!(error instanceof BuildError)) throw error;
    console.error(error.message);
    console.error(`no page built into ${values.out}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
