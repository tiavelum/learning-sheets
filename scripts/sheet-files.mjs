// What the check and the renderer both need to know about a sheet folder:
// its name rule, its front matter, its canvas index and its page files, as
// sheets/README.md states them.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse as parseHtml } from "parse5";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";

export const PAPER_SIZES = {
  a4: { w: 794, h: 1123 },
  letter: { w: 816, h: 1056 },
};

export const FRONT_MATTER_FIELDS = [
  "title",
  "topic",
  "tags",
  "language",
  "paper",
  "made",
  "skill",
  "artifact",
  "artifact_version",
];

export const ROOT_FILES = ["README.md", "LICENSE"];

const GOOGLE_FONTS_CSS2 = "https://fonts.googleapis.com/css2?";
const PRECONNECT_HOSTS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];
const SUPPORT_SCRIPT = "./support.js";
const RUNTIME_SCRIPT_TYPE = "text/x-dc";

/** The folder name a title gives, in the form of NAM-2. */
export function nameFromTitle(title) {
  return title
    .normalize("NFC")
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "")
    .join("-");
}

/** Whether a name has the form of NAM-2: lowercase words joined by single hyphens. */
export function isNam2(name) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

/**
 * The entries directly below a folder, as names, with folders marked by a
 * trailing slash. In a git work tree it lists what git would commit, so files
 * that .gitignore leaves out, such as .DS_Store, are not taken for content.
 */
export function listEntries(dir) {
  const fromGit = listEntriesFromGit(dir);
  if (fromGit) return fromGit;
  return readdirSync(dir, { withFileTypes: true })
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
    .sort();
}

function listEntriesFromGit(dir) {
  let output;
  try {
    output = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "."],
      { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    return null;
  }
  const entries = new Set();
  for (const file of output.split("\0")) {
    if (file === "" || !existsSync(path.join(dir, file))) continue;
    const slash = file.indexOf("/");
    entries.add(slash === -1 ? file : `${file.slice(0, slash + 1)}`);
  }
  return [...entries].sort();
}

/** The sheet folders of a sheets root, by name; an absent root holds none. */
export function listSheetFolders(root) {
  if (!existsSync(root)) return [];
  return listEntries(root)
    .filter((entry) => entry.endsWith("/"))
    .map((entry) => entry.slice(0, -1));
}

/**
 * The front matter of a sheet README as its fields, with every problem of
 * form found while reading it. Values must be YAML strings in double quotes,
 * since an unquoted `made` reads as a date and `language: no` as a boolean.
 */
export function readFrontMatter(text) {
  const problems = [];
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) {
    return {
      fields: null,
      body: text,
      problems: ["has no YAML front matter between two --- lines at its start"],
    };
  }
  const body = text.slice(match[0].length);
  const doc = parseDocument(match[1]);
  if (doc.errors.length > 0) {
    return {
      fields: null,
      body,
      problems: doc.errors.map(
        (error) => `front matter is not valid YAML: ${error.message.split("\n")[0]}`,
      ),
    };
  }
  const map = doc.contents;
  if (!isMap(map)) {
    return { fields: null, body, problems: ["front matter is not a YAML mapping"] };
  }
  const fields = {};
  const keys = [];
  for (const pair of map.items) {
    const key = String(pair.key?.value);
    keys.push(key);
    const node = pair.value;
    if (key === "tags") {
      if (!isSeq(node)) {
        problems.push('front matter: "tags" is not a list');
        continue;
      }
      fields.tags = [];
      for (const item of node.items) {
        if (!isScalar(item) || item.type !== "QUOTE_DOUBLE") {
          problems.push(
            `front matter: the tag ${JSON.stringify(isScalar(item) ? String(item.value) : String(item))} is not a string in double quotes`,
          );
        }
        fields.tags.push(isScalar(item) ? String(item.value) : "");
      }
      continue;
    }
    if (!isScalar(node) || node.type !== "QUOTE_DOUBLE") {
      problems.push(`front matter: "${key}" is not a string in double quotes`);
      fields[key] = isScalar(node) && node.value !== null ? String(node.value) : "";
      continue;
    }
    fields[key] = node.value;
  }
  const missing = FRONT_MATTER_FIELDS.filter((field) => !keys.includes(field));
  const extra = keys.filter((key) => !FRONT_MATTER_FIELDS.includes(key));
  for (const field of missing) problems.push(`front matter: "${field}" is missing`);
  for (const key of extra) problems.push(`front matter: "${key}" is not a field of a sheet`);
  if (missing.length === 0 && extra.length === 0) {
    const order = keys.join(", ");
    if (order !== FRONT_MATTER_FIELDS.join(", ")) {
      problems.push(
        `front matter: fields stand in the order ${order}, not ${FRONT_MATTER_FIELDS.join(", ")}`,
      );
    }
  }
  return { fields, body, problems };
}

/** The canvas index of a sheet, or the problem that keeps it from being read. */
export function readCanvas(file) {
  let canvas;
  try {
    canvas = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return { canvas: null, problem: `is not valid JSON: ${error.message}` };
  }
  if (!canvas || typeof canvas !== "object" || Array.isArray(canvas)) {
    return { canvas: null, problem: "is not a JSON object" };
  }
  return { canvas, problem: null };
}

/**
 * The board file names of a canvas in print order: the reading order of
 * their frames, top to bottom by `y`, then left to right by `x`.
 */
export function pagesInPrintOrder(canvas) {
  const boards = canvas.boards ?? {};
  return Object.keys(boards).sort((a, b) => boards[a].y - boards[b].y || boards[a].x - boards[b].x);
}

/** A page file parsed into the parts the check and the renderer look at. */
export function readPage(text) {
  const document = parseHtml(text);
  const html = childElements(document).find((node) => node.nodeName === "html");
  const head = childElements(html).find((node) => node.nodeName === "head");
  const body = childElements(html).find((node) => node.nodeName === "body");
  const xdc = findElements(body, (node) => node.nodeName === "x-dc")[0] ?? null;
  const helmet = xdc
    ? (childElements(xdc).find((node) => node.nodeName === "helmet") ?? null)
    : null;
  return { document, html, head, body, xdc, helmet };
}

export function childElements(node) {
  return (node?.childNodes ?? []).filter((child) => child.tagName !== undefined);
}

export function findElements(node, test) {
  const found = [];
  const walk = (current) => {
    for (const child of current?.childNodes ?? []) {
      if (child.tagName !== undefined && test(child)) found.push(child);
      walk(child.tagName === "template" ? child.content : child);
    }
  };
  walk(node);
  return found;
}

export function attribute(element, name) {
  return element.attrs?.find((attr) => attr.name === name)?.value;
}

function isInside(element, ancestor) {
  for (let node = element.parentNode; node; node = node.parentNode) {
    if (node === ancestor) return true;
  }
  return false;
}

/** Whether a script element is the canvas runtime that a page may carry. */
export function isRuntimeScript(element, page) {
  if (attribute(element, "type") === RUNTIME_SCRIPT_TYPE) return true;
  return attribute(element, "src") === SUPPORT_SCRIPT && element.parentNode === page.head;
}

/** Whether a link element is one a page may carry: the Google Fonts css2 stylesheet or its preconnects. */
export function isFontLink(element, page) {
  if (!page.helmet || !isInside(element, page.helmet)) return false;
  const rel = (attribute(element, "rel") ?? "").toLowerCase().split(/\s+/);
  const href = attribute(element, "href") ?? "";
  if (rel.includes("stylesheet")) return href.startsWith(GOOGLE_FONTS_CSS2);
  if (rel.length === 1 && rel[0] === "preconnect") {
    return PRECONNECT_HOSTS.includes(href.replace(/\/$/, ""));
  }
  return false;
}

export function isFontStylesheet(element, page) {
  const rel = (attribute(element, "rel") ?? "").toLowerCase().split(/\s+/);
  return rel.includes("stylesheet") && isFontLink(element, page);
}

const LOADING_ATTRIBUTES = ["src", "srcset", "poster", "data", "background", "lowsrc"];
const HREF_LOADERS = ["image", "use", "feimage", "script", "base"];
const EMBEDDING_ELEMENTS = ["iframe", "object", "embed", "frame", "frameset", "portal"];

function loadsSomething(url) {
  const value = url.trim();
  return value !== "" && !value.startsWith("#") && !/^data:/i.test(value);
}

function cssLoads(css) {
  const loads = [];
  for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    if (loadsSomething(match[2])) loads.push(match[2]);
  }
  for (const match of css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/gi)) {
    loads.push(match[1]);
  }
  return loads;
}

/**
 * Every problem that keeps a page from being static: a hole, a repeat, a
 * branch or a child component, an uploaded asset, a script other than the
 * canvas runtime, and anything else it would load over the network.
 */
export function staticProblems(text, page) {
  const problems = [];
  if (text.includes("{{")) problems.push("holds a hole {{…}}");
  for (const tag of ["sc-for", "sc-if", "dc-import"]) {
    if (findElements(page.document, (node) => node.nodeName === tag).length > 0) {
      problems.push(`holds <${tag}>`);
    }
  }
  if (text.includes("/_blob/")) problems.push("loads an uploaded asset (/_blob/…)");
  for (const script of findElements(page.document, (node) => node.nodeName === "script")) {
    if (!isRuntimeScript(script, page)) {
      const src = attribute(script, "src");
      problems.push(
        src ? `loads the script ${src}` : "holds a script other than the canvas runtime",
      );
    }
  }
  const elements = findElements(page.document, () => true);
  for (const element of elements) {
    const name = element.nodeName;
    if (name === "script") continue;
    if (EMBEDDING_ELEMENTS.includes(name)) problems.push(`holds <${name}>`);
    if (name === "link") {
      if (!isFontLink(element, page)) {
        problems.push(
          `loads ${attribute(element, "href") ?? "a <link> without href"} through <link>; a page links only the Google Fonts css2 stylesheet and its preconnects, in <helmet>`,
        );
      }
      continue;
    }
    if (name === "meta" && (attribute(element, "http-equiv") ?? "").toLowerCase() === "refresh") {
      problems.push('holds <meta http-equiv="refresh">');
    }
    for (const attr of element.attrs ?? []) {
      const attrName = attr.name.toLowerCase();
      if (LOADING_ATTRIBUTES.includes(attrName) && loadsSomething(attr.value)) {
        problems.push(`loads ${attr.value} through the ${attrName} of <${name}>`);
      }
      if (
        (attrName === "href" || attrName === "xlink:href") &&
        HREF_LOADERS.includes(name.toLowerCase()) &&
        loadsSomething(attr.value)
      ) {
        problems.push(`loads ${attr.value} through the ${attrName} of <${name}>`);
      }
      if (attrName === "style") {
        for (const url of cssLoads(attr.value)) problems.push(`loads ${url} from an inline style`);
      }
    }
    if (name === "style") {
      const css = element.childNodes.map((child) => child.value ?? "").join("");
      for (const url of cssLoads(css)) problems.push(`loads ${url} from a <style>`);
    }
  }
  return problems;
}

/**
 * The font requests of a page's Google Fonts css2 stylesheets: per family,
 * the axes and the tuples it asks for, and whether only a variable font can
 * serve it, as an axis other than ital and wght or a range requires.
 */
export function fontRequests(page) {
  const requests = [];
  const problems = [];
  for (const link of findElements(page.document, (node) => node.nodeName === "link")) {
    if (!isFontStylesheet(link, page)) continue;
    const href = attribute(link, "href");
    for (const spec of new URL(href).searchParams.getAll("family")) {
      const request = parseFamily(spec);
      if (request) requests.push(request);
      else
        problems.push(
          `requests the font family ${JSON.stringify(spec)} in a form that cannot be read`,
        );
    }
  }
  return { requests, problems };
}

function parseFamily(spec) {
  const colon = spec.indexOf(":");
  const family = (colon === -1 ? spec : spec.slice(0, colon)).trim();
  if (family === "") return null;
  if (colon === -1) {
    return { family, axes: ["wght"], tuples: [["400"]], variable: false };
  }
  const [axisList, tupleList] = spec.slice(colon + 1).split("@");
  if (!tupleList) return null;
  const axes = axisList.split(",").map((axis) => axis.trim());
  const tuples = tupleList.split(";").map((tuple) => tuple.split(",").map((value) => value.trim()));
  if (axes.some((axis) => axis === "") || tuples.some((tuple) => tuple.length !== axes.length)) {
    return null;
  }
  const variable =
    axes.some((axis) => axis !== "ital" && axis !== "wght") ||
    tuples.some((tuple) => tuple.some((value) => value.includes("..")));
  return { family, axes, tuples, variable };
}

/** The Fontsource package that serves a font request. */
export function fontPackage(request) {
  const id = request.family.toLowerCase().trim().replace(/\s+/g, "-");
  return request.variable ? `@fontsource-variable/${id}` : `@fontsource/${id}`;
}

/**
 * The Fontsource stylesheets, as paths below node_modules, that serve one font
 * request, and every problem that keeps the installed package from serving it:
 * a package that is missing, or a weight, style or axis it does not hold.
 */
export function fontStylesheets(request, nodeModules) {
  const name = fontPackage(request);
  const dir = path.join(nodeModules, name);
  const metadataFile = path.join(dir, "metadata.json");
  if (!isFile(metadataFile)) {
    return {
      sheets: [],
      problems: [
        `requests the font family ${request.family}, whose package ${name} is not installed; add it: npm install --save-exact ${name}`,
      ],
    };
  }
  const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
  const italIndex = request.axes.indexOf("ital");
  const wghtIndex = request.axes.indexOf("wght");
  const problems = [];
  const files = [];
  const want = (file, what) => {
    if (isFile(path.join(dir, file))) files.push(`${name}/${file}`);
    else problems.push(`requests ${request.family} ${what}, which ${name} does not hold`);
  };
  const styleOf = (tuple) => (italIndex !== -1 && tuple[italIndex] === "1" ? "italic" : "normal");
  for (const tuple of request.tuples) {
    if (!(metadata.styles ?? []).includes(styleOf(tuple))) {
      problems.push(`requests ${request.family} in ${styleOf(tuple)}, which ${name} does not hold`);
    }
  }
  if (request.variable) {
    const axes = metadata.variable ?? {};
    for (const [index, axis] of request.axes.entries()) {
      if (axis === "ital") continue;
      if (!axes[axis]) {
        problems.push(
          `requests ${request.family} with the axis ${axis}, which ${name} does not hold`,
        );
        continue;
      }
      for (const tuple of request.tuples) {
        for (const value of tuple[index].split("..").map(Number)) {
          if (!(value >= Number(axes[axis].min) && value <= Number(axes[axis].max))) {
            problems.push(
              `requests ${request.family} at ${axis} ${tuple[index]}, outside the ${axes[axis].min}..${axes[axis].max} of ${name}`,
            );
          }
        }
      }
    }
    const extra = request.axes.filter((axis) => axis !== "ital" && axis !== "wght");
    const base =
      extra.length === 1 && isFile(path.join(dir, `${extra[0]}.css`)) ? extra[0] : "standard";
    const chosen = extra.length === 0 ? "wght" : base;
    for (const style of new Set(request.tuples.map(styleOf))) {
      want(
        `${chosen}${style === "italic" ? "-italic" : ""}.css`,
        `with the axes ${request.axes.join(",")} in ${style}`,
      );
    }
  } else {
    for (const tuple of request.tuples) {
      const weight = wghtIndex === -1 ? "400" : tuple[wghtIndex];
      if (!(metadata.weights ?? []).map(String).includes(weight)) {
        problems.push(
          `requests ${request.family} at weight ${weight}, which ${name} does not hold`,
        );
        continue;
      }
      const italic = styleOf(tuple) === "italic";
      want(
        `${weight}${italic ? "-italic" : ""}.css`,
        `at weight ${weight}${italic ? " in italic" : ""}`,
      );
    }
  }
  return { sheets: [...new Set(files)], problems: [...new Set(problems)] };
}

/** The paper size of a front matter value, or undefined for another value. */
export function paperSize(paper) {
  return Object.hasOwn(PAPER_SIZES, paper) ? PAPER_SIZES[paper] : undefined;
}

export function isFile(file) {
  return existsSync(file) && statSync(file).isFile();
}
