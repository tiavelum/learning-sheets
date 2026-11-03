#!/usr/bin/env node
// Writes the notes and the catalog of a release: which sheets were added,
// changed and removed since the latest release, read from git, and the
// catalog of the browse page with every sheet's PDF in the new release.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { catalogOf, latestRelease, REPOSITORY, readSheets } from "./build-site.mjs";
import { readFrontMatter } from "./sheet-files.mjs";

const GITHUB = `https://github.com/${REPOSITORY}`;
// The form decision 0003 gives a release's tag: the run's time in UTC.
const TAG = /^\d{4}-\d{2}-\d{2}-\d{4}$/;

export class ReleaseError extends Error {}

function git(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new ReleaseError(
      `git ${args.join(" ")} failed: ${error.stderr?.trim() || error.message}`,
    );
  }
}

/**
 * The sheets added, changed and removed since the commit of `previous`, a
 * tag, by folder name and title. A sheet changed where any file of its
 * folder differs; a retitled sheet has a new folder, so it shows as one
 * removed and one added.
 */
export function changesSince(previous, root, sheets) {
  // Every path stays relative to the root, which can lie anywhere in the repository.
  git(root, ["rev-parse", "--verify", "--quiet", `${previous}^{commit}`]);
  const before = git(root, ["ls-tree", "-d", "-z", "--name-only", previous, "."])
    .split("\0")
    .filter((name) => name !== "");
  const differing = new Set(
    git(root, ["diff", "--name-only", "--relative", "-z", previous, "HEAD", "--", "."])
      .split("\0")
      .filter((file) => file.includes("/"))
      .map((file) => file.slice(0, file.indexOf("/"))),
  );
  const now = new Map(sheets.map(({ name, fields }) => [name, fields.title]));
  const titleBefore = (name) => {
    const text = git(root, ["show", `${previous}:./${name}/README.md`]);
    return readFrontMatter(text).fields?.title ?? name;
  };
  return {
    added: sheets.filter(({ name }) => !before.includes(name)).map(({ name }) => now.get(name)),
    changed: sheets
      .filter(({ name }) => before.includes(name) && differing.has(name))
      .map(({ name }) => now.get(name)),
    removed: before.filter((name) => !now.has(name)).map(titleBefore),
  };
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The notes of the release, in Markdown, for whoever downloads its PDFs. */
export function releaseNotes({ tag, previous, count, changes }) {
  const lines = [`This release holds the PDFs of ${plural(count, "learning sheet")}.`, ""];
  const lists = [
    ["Added", changes.added],
    ["Changed", changes.changed],
    ["Removed", changes.removed],
  ].filter(([, titles]) => titles.length > 0);
  if (previous === null) lines.push("It is the first release.", "");
  else if (lists.length === 0)
    lines.push(`No sheet was added, changed or removed since ${previous}.`, "");
  else lines.push(`Since ${previous}:`, "");
  for (const [heading, titles] of lists) {
    lines.push(`${heading}:`, "", ...[...titles].sort().map((title) => `- ${title}`), "");
  }
  lines.push(
    "Each sheet's PDF is an asset of this release, named after its folder in `sheets/`; " +
      `\`learning-sheets-${tag}.zip\` holds all of them, and \`catalog.json\` lists every sheet's facts and links.`,
  );
  return `${lines.join("\n")}\n`;
}

/**
 * The catalog of the browse page as the release `tag` holds it: each sheet's
 * source and PDF are linked at that tag, so that the links stay valid once
 * a later release has changed or removed the sheet, and the image of page
 * one, which only the browse page holds, is left out.
 */
export function releaseCatalog(sheets, tag, root) {
  const release = {
    state: "found",
    tag,
    url: `${GITHUB}/releases/tag/${tag}`,
    assets: sheets.map(({ name }) => `${name}.pdf`),
  };
  const catalog = catalogOf(sheets, release, root);
  return {
    ...catalog,
    sheets: catalog.sheets.map(({ image, ...sheet }) => ({
      ...sheet,
      source: sheet.source.replace(`${GITHUB}/tree/main/`, `${GITHUB}/tree/${tag}/`),
      pdf: `${GITHUB}/releases/download/${tag}/${sheet.name}.pdf`,
    })),
  };
}

/**
 * Writes the notes and the catalog of the release `tag` and returns what it
 * printed; a root without a sheet, a sheet that cannot be read or a latest
 * release that cannot be read throws a ReleaseError and writes nothing.
 */
export async function prepareRelease({
  tag,
  root = "sheets",
  notes = "build/release/notes.md",
  catalog = "build/release/assets/catalog.json",
  fetch,
  token,
}) {
  if (!TAG.test(tag ?? "")) {
    throw new ReleaseError(`the tag must have the form YYYY-MM-DD-HHMM, not ${tag}`);
  }
  const { sheets, problems } = readSheets(root);
  if (problems.length > 0) {
    throw new ReleaseError([...problems, "npm run check names every problem"].join("\n"));
  }
  if (sheets.length === 0)
    throw new ReleaseError(`${root} holds no sheet, so there is nothing to release`);
  const latest = await latestRelease({ fetch, token });
  if (latest.state === "unreachable") {
    throw new ReleaseError(`the latest release could not be read (${latest.reason})`);
  }
  const previous = latest.state === "found" ? latest.tag : null;
  const changes =
    previous === null
      ? { added: sheets.map(({ fields }) => fields.title), changed: [], removed: [] }
      : changesSince(previous, root, sheets);
  const text = releaseNotes({ tag, previous, count: sheets.length, changes });
  for (const file of [notes, catalog]) mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(notes, text);
  writeFileSync(catalog, `${JSON.stringify(releaseCatalog(sheets, tag, root), null, 2)}\n`);
  return {
    previous,
    changes,
    lines: [
      previous === null ? "no release yet: this is the first" : `the latest release is ${previous}`,
      `${notes}: notes on ${plural(sheets.length, "sheet")}, ${changes.added.length} added, ${changes.changed.length} changed, ${changes.removed.length} removed`,
      `${catalog}: ${plural(sheets.length, "sheet")}`,
    ],
  };
}

async function main() {
  const usage =
    "usage: prepare-release.mjs --tag <YYYY-MM-DD-HHMM> [--root <folder>] [--notes <file>] [--catalog <file>]";
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        tag: { type: "string" },
        root: { type: "string", default: "sheets" },
        notes: { type: "string", default: "build/release/notes.md" },
        catalog: { type: "string", default: "build/release/assets/catalog.json" },
      },
    }));
  } catch (error) {
    console.error(`${error.message}; ${usage}`);
    process.exitCode = 2;
    return;
  }
  if (!TAG.test(values.tag ?? "")) {
    console.error(`--tag must have the form YYYY-MM-DD-HHMM, not ${values.tag}; ${usage}`);
    process.exitCode = 2;
    return;
  }
  try {
    const { lines } = await prepareRelease(values);
    for (const line of lines) console.log(line);
  } catch (error) {
    if (!(error instanceof ReleaseError)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
