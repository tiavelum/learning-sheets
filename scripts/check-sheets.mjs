#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  fontPackage,
  fontRequests,
  fontStylesheets,
  isFile,
  isNam2,
  listEntries,
  listSheetFolders,
  PAPER_SIZES,
  pagesInPrintOrder,
  paperSize,
  ROOT_FILES,
  readCanvas,
  readFrontMatter,
  readPage,
  staticProblems,
} from "./sheet-files.mjs";

const REPOSITORY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NODE_MODULES = path.join(REPOSITORY, "node_modules");
const PAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.dc\.html$/;
const FIRST_PAGE = "Main.dc.html";
const LEARNING_SHEET = /(^|-)learning-sheets?(-|$)/;

export function checkSheets(
  root,
  { packageFile = path.join(REPOSITORY, "package.json"), nodeModules = NODE_MODULES } = {},
) {
  const violations = [];
  const report = (file, problem) => violations.push(`${file}: ${problem}`);
  if (!existsSync(root)) return { violations, sheets: [] };

  for (const entry of listEntries(root)) {
    if (!entry.endsWith("/") && !ROOT_FILES.includes(entry)) {
      report(
        path.join(root, entry),
        `is not a sheet folder; beside the sheet folders the root holds only ${ROOT_FILES.join(" and ")}`,
      );
    }
  }

  const dependencies = readDependencies(packageFile);
  const sheets = listSheetFolders(root);
  for (const name of sheets) checkSheet(root, name, { dependencies, nodeModules }, report);
  return { violations, sheets };
}

function readDependencies(packageFile) {
  const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
  return new Set(Object.keys(manifest.dependencies ?? {}));
}

function checkSheet(root, name, fonts, report) {
  const folder = path.join(root, name);
  if (!isNam2(name)) {
    report(
      folder,
      "the folder name is not lowercase words of a-z and 0-9 joined by single hyphens (NAM-2)",
    );
  }
  const entries = listEntries(folder);
  for (const entry of entries) {
    if (entry !== "README.md" && entry !== "project/") {
      report(
        path.join(folder, entry),
        "is not part of a sheet; a sheet folder holds exactly README.md and project/",
      );
    }
  }
  const readmeFile = path.join(folder, "README.md");
  const fields = isFile(readmeFile) ? checkReadme(readmeFile, name, report) : undefined;
  if (!isFile(readmeFile)) report(readmeFile, "is missing");
  const projectDir = path.join(folder, "project");
  if (!entries.includes("project/")) {
    report(projectDir, "is missing");
    return;
  }
  checkProject(projectDir, fields, fonts, report);
}

function checkReadme(file, name, report) {
  const text = readFileSync(file, "utf8");
  const { fields, body, problems } = readFrontMatter(text);
  for (const problem of problems) report(file, problem);
  if (fields) checkFields(file, name, fields, report);
  checkBody(file, body, report);
  return fields ?? undefined;
}

const ONE_LINE_FIELDS = [
  "title",
  "topic",
  "language",
  "paper",
  "created",
  "last_modified",
  "skill_version",
  "artifact",
  "artifact_version",
];

function checkFields(file, name, fields, report) {
  for (const field of ONE_LINE_FIELDS) {
    const value = fields[field];
    if (value === undefined) continue;
    if (value.trim() === "") report(file, `front matter: "${field}" is empty`);
    else if (/[\r\n]/.test(value)) report(file, `front matter: "${field}" is not on one line`);
  }
  const { title, topic, tags, language, paper, artifact } = fields;
  const { created, last_modified: lastModified, skill_version: skillVersion } = fields;
  if (title !== undefined && title.trim() !== "") {
    if (!isNam2(title)) {
      report(
        file,
        `front matter: the title ${JSON.stringify(title)} is not a sheet's name, lowercase words of a-z and 0-9 joined by single hyphens (Folder name, NAM-2)`,
      );
    } else if (LEARNING_SHEET.test(title)) {
      report(
        file,
        `front matter: the title ${JSON.stringify(title)} holds the words "learning sheet", which a sheet's name leaves out (Folder name)`,
      );
    } else if (title !== name) {
      report(file, `the folder name ${name} is not the title, ${title}`);
    }
  }
  if (topic?.endsWith(".")) report(file, 'front matter: "topic" ends with a period');
  if (tags !== undefined) {
    if (tags.length === 0) report(file, 'front matter: "tags" holds no tag');
    const seen = new Set();
    for (const tag of tags) {
      if (!isNam2(tag))
        report(file, `front matter: the tag ${JSON.stringify(tag)} is not in the form of NAM-2`);
      if (seen.has(tag)) report(file, `front matter: the tag ${JSON.stringify(tag)} stands twice`);
      seen.add(tag);
    }
  }
  if (language !== undefined && !isLanguageTag(language)) {
    report(
      file,
      `front matter: "language" ${JSON.stringify(language)} is not a BCP 47 language tag`,
    );
  }
  if (paper !== undefined && paperSize(paper) === undefined) {
    report(
      file,
      `front matter: "paper" is ${JSON.stringify(paper)}, not ${Object.keys(PAPER_SIZES).join(" or ")}`,
    );
  }
  for (const [field, value] of [
    ["created", created],
    ["last_modified", lastModified],
  ]) {
    if (value !== undefined && !isDate(value)) {
      report(
        file,
        `front matter: "${field}" ${JSON.stringify(value)} is not a date in the form YYYY-MM-DD`,
      );
    }
  }
  // Dates of one form compare as text in the order of time.
  if (isDate(created ?? "") && isDate(lastModified ?? "") && lastModified < created) {
    report(
      file,
      `front matter: "last_modified" ${lastModified} is before "created" ${created}; a sheet's latest version is not handed over before its first`,
    );
  }
  if (skillVersion !== undefined && !/^tiavelum\/claude-setup@[0-9a-f]{7,}$/.test(skillVersion)) {
    report(
      file,
      `front matter: "skill_version" ${JSON.stringify(skillVersion)} is not tiavelum/claude-setup@ and a commit hash of at least 7 lowercase hexadecimal characters`,
    );
  }
  if (
    artifact !== undefined &&
    !/^https:\/\/claude\.ai\/artifact\/[A-Za-z0-9_-]+$/.test(artifact)
  ) {
    report(
      file,
      `front matter: "artifact" ${JSON.stringify(artifact)} is not https://claude.ai/artifact/ and the canvas's id`,
    );
  }
}

function isLanguageTag(tag) {
  if (!/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(tag)) return false;
  try {
    return Intl.getCanonicalLocales(tag).length === 1;
  } catch {
    return false;
  }
}

function isDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

// A full stop after one of these ends no sentence, though a capital or a digit follows it.
const ABBREVIATION = /^(?:Dr|Mr|Mrs|Ms|Prof|St|vs|e\.g|i\.e|etc|z\.B)\.$/i;

function sentenceCount(paragraph) {
  // "z. B." is one abbreviation, though a space and a capital stand inside it.
  const text = paragraph.replace(/(?<![\p{L}\p{N}])z\. B\./gu, "z.B.");
  let count = 1;
  for (const match of text.matchAll(/(\S+[.!?])["'”’)\]]*\s+(?=["'“‘([]*[\p{Lu}\p{N}])/gu)) {
    if (!ABBREVIATION.test(match[1].replace(/^["'“‘([]+/u, ""))) count++;
  }
  return count;
}

const REQUEST_HEADING = "## Request";
// What starts a line that is not prose: a heading, a fence, a list item, a quote or a table.
const NOT_PROSE = /^(#|```|~~~|[-*+] |\d+[.)] |>|\|)/;

function checkBody(file, body, report) {
  const lines = body.split("\n");
  let index = 0;
  const skipBlank = () => {
    while (index < lines.length && lines[index].trim() === "") index++;
  };
  skipBlank();
  if (lines[index] !== REQUEST_HEADING) {
    report(
      file,
      lines.includes(REQUEST_HEADING)
        ? `holds text between the front matter and "${REQUEST_HEADING}", the README's only section`
        : `has no heading "${REQUEST_HEADING}" below the front matter`,
    );
    return;
  }
  index++;
  skipBlank();
  const paragraph = [];
  while (index < lines.length && lines[index].trim() !== "") {
    paragraph.push(lines[index].trim());
    index++;
  }
  const request = paragraph.join(" ");
  if (request === "") {
    report(file, `has no request below "${REQUEST_HEADING}"`);
    return;
  }
  if (paragraph.some((line) => NOT_PROSE.test(line))) {
    report(file, `the request below "${REQUEST_HEADING}" is not one paragraph of prose`);
  } else if (!/[.!?]["'”’)\]*_]*$/.test(request)) {
    report(file, "the request does not end with the end of a sentence");
  } else {
    const sentences = sentenceCount(request);
    if (sentences < 2 || sentences > 3) {
      report(
        file,
        `the request is ${sentences} sentence${sentences === 1 ? "" : "s"}, not two or three on what the sheet was asked to cover, for whom and what for`,
      );
    }
  }
  skipBlank();
  if (index < lines.length) {
    report(
      file,
      `holds text after the request; "${REQUEST_HEADING}" is the README's only section and holds one paragraph`,
    );
  }
}

function checkProject(projectDir, fields, fonts, report) {
  const canvasFile = path.join(projectDir, "canvas.json");
  const entries = listEntries(projectDir);
  if (!entries.includes("canvas.json")) {
    report(canvasFile, "is missing");
    return;
  }
  const { canvas, problem } = readCanvas(canvasFile);
  if (problem) {
    report(canvasFile, problem);
    return;
  }
  if (fields?.title !== undefined && canvas.title !== fields.title) {
    report(
      canvasFile,
      `its title ${JSON.stringify(canvas.title)} is not the title of the README, ${JSON.stringify(fields.title)}`,
    );
  }
  const boards = canvas.boards;
  if (
    !boards ||
    typeof boards !== "object" ||
    Array.isArray(boards) ||
    Object.keys(boards).length === 0
  ) {
    report(canvasFile, '"boards" holds no page');
    return;
  }
  const size = paperSize(fields?.paper);
  let framesValid = true;
  for (const [key, board] of Object.entries(boards)) {
    if (!PAGE_NAME.test(key)) {
      report(
        canvasFile,
        `the board ${JSON.stringify(key)} is not a page file name of the form <page>.dc.html directly in project/`,
      );
    }
    if (!["x", "y", "w", "h"].every((axis) => Number.isFinite(board?.[axis]))) {
      report(canvasFile, `the board ${key} has no numeric x, y, w and h`);
      framesValid = false;
      continue;
    }
    if (size && (board.w !== size.w || board.h !== size.h)) {
      report(
        canvasFile,
        `the board ${key} measures ${board.w} × ${board.h} px, not the ${size.w} × ${size.h} px of paper ${fields.paper}`,
      );
    }
  }
  const keys = Object.keys(boards);
  const order = Array.isArray(canvas.order) ? canvas.order : [];
  if ([...order].sort().join("\n") !== [...keys].sort().join("\n")) {
    report(canvasFile, '"order" does not list the same file names as "boards"');
  }
  if (framesValid) {
    const first = pagesInPrintOrder(canvas)[0];
    if (first !== FIRST_PAGE)
      report(canvasFile, `the first page in print order is ${first}, not ${FIRST_PAGE}`);
  }
  for (const entry of entries) {
    if (entry === "canvas.json") continue;
    if (!keys.includes(entry)) {
      report(
        path.join(projectDir, entry),
        entry.endsWith(".dc.html")
          ? "is not a board of canvas.json"
          : "is not part of a sheet; project/ holds only canvas.json and its pages",
      );
    }
  }
  for (const key of keys) {
    const pageFile = path.join(projectDir, key);
    if (!PAGE_NAME.test(key)) continue;
    if (!isFile(pageFile)) {
      report(pageFile, "is a board of canvas.json, but the file is missing");
      continue;
    }
    checkPage(pageFile, fonts, report);
  }
}

function checkPage(file, { dependencies, nodeModules }, report) {
  const text = readFileSync(file, "utf8");
  const page = readPage(text);
  if (!page.xdc) report(file, "holds no <x-dc> element");
  for (const problem of staticProblems(text, page)) report(file, `is not static: ${problem}`);
  const { requests, problems } = fontRequests(page);
  for (const problem of problems) report(file, problem);
  for (const request of requests) {
    const name = fontPackage(request);
    if (!dependencies.has(name)) {
      report(
        file,
        `requests the font family ${request.family}; add its package to the dependencies: npm install --save-exact ${name}`,
      );
      continue;
    }
    // A package in package.json that npm ci has not installed yet cannot be
    // read; the renderer reports it then, so the check does not fail on it.
    const { problems: missing } = fontStylesheets(request, nodeModules);
    for (const problem of missing) {
      if (!problem.includes("is not installed")) report(file, problem);
    }
  }
}

function main() {
  const usage = "usage: check-sheets.mjs [--root <folder>]";
  let values;
  try {
    ({ values } = parseArgs({ options: { root: { type: "string", default: "sheets" } } }));
  } catch (error) {
    console.error(`${error.message}; ${usage}`);
    process.exitCode = 2;
    return;
  }
  // A mistyped root would otherwise pass as a root that holds no sheet.
  if (!existsSync(values.root) || !statSync(values.root).isDirectory()) {
    console.error(`${values.root} is not a folder; ${usage}`);
    process.exitCode = 2;
    return;
  }
  const { violations, sheets } = checkSheets(values.root);
  for (const line of violations) console.log(line);
  if (violations.length > 0) {
    console.log(
      `${violations.length} violation${violations.length === 1 ? "" : "s"} in ${values.root}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `${sheets.length} sheet${sheets.length === 1 ? "" : "s"} in ${values.root}, no violation`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
