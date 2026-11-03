// The notes and the catalog of a release by scripts/prepare-release.mjs, on
// a git repository made from copies of the fixture sheet, with the latest
// release from a stubbed fetch.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { prepareRelease, ReleaseError, releaseNotes } from "../scripts/prepare-release.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sheets");
const SHEET = "two-pages-of-squares";
const REPO = "https://github.com/tiavelum/learning-sheets";
const temporary = mkdtempSync(path.join(tmpdir(), "prepare-release-test-"));
after(() => rmSync(temporary, { recursive: true, force: true }));

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** A copy of the fixture sheet under another title, in the folder that title gives. */
function addSheet(root, title) {
  const name = title.toLowerCase().replaceAll(" ", "-");
  cpSync(path.join(FIXTURES, SHEET), path.join(root, name), { recursive: true });
  for (const file of [path.join(name, "README.md"), path.join(name, "project", "canvas.json")]) {
    const text = readFileSync(path.join(root, file), "utf8");
    writeFileSync(path.join(root, file), text.replaceAll("Two Pages of Squares", title));
  }
  return name;
}

let repositories = 0;
/** A git repository whose sheets root holds the given titles, committed and tagged as a release. */
function released(tag, titles) {
  const repository = path.join(temporary, String(repositories++));
  const root = path.join(repository, "sheets");
  mkdirSync(root, { recursive: true });
  git(repository, "init", "--quiet", "--initial-branch=main");
  git(repository, "config", "user.name", "Test");
  git(repository, "config", "user.email", "test@example.org");
  for (const title of titles) addSheet(root, title);
  writeFileSync(path.join(root, "README.md"), "# Sheets\n");
  git(repository, "add", ".");
  git(repository, "commit", "--quiet", "-m", "sheets");
  git(repository, "tag", tag);
  return { repository, root };
}

/** A fetch that answers as the REST API does for a latest release with this tag, or none. */
function latest(tag) {
  return async () =>
    tag === null
      ? new Response(JSON.stringify({ message: "Not Found" }), { status: 404 })
      : new Response(
          JSON.stringify({ tag_name: tag, html_url: `${REPO}/releases/tag/${tag}`, assets: [] }),
          { status: 200 },
        );
}

function files(directory) {
  return {
    notes: path.join(temporary, directory, "notes.md"),
    catalog: path.join(temporary, directory, "assets", "catalog.json"),
  };
}

describe("the notes", () => {
  test("list the sheets added, changed and removed since the latest release, by title", async () => {
    const { repository, root } = released("2026-11-01-0900", ["Alpha Sheet", "Beta Sheet", "Gone"]);
    const beta = path.join(root, "beta-sheet", "project", "Main.dc.html");
    writeFileSync(beta, `${readFileSync(beta, "utf8")}\n`);
    rmSync(path.join(root, "gone"), { recursive: true });
    addSheet(root, "Delta Sheet");
    git(repository, "add", "--all");
    git(repository, "commit", "--quiet", "-m", "change the sheets");

    const out = files("changes");
    const { previous, changes, lines } = await prepareRelease({
      tag: "2026-11-03-1430",
      root,
      ...out,
      fetch: latest("2026-11-01-0900"),
      token: "",
    });
    assert.equal(previous, "2026-11-01-0900");
    assert.deepEqual(changes, {
      added: ["Delta Sheet"],
      changed: ["Beta Sheet"],
      removed: ["Gone"],
    });
    assert.equal(
      readFileSync(out.notes, "utf8"),
      [
        "This release holds the PDFs of 3 learning sheets.",
        "",
        "Since 2026-11-01-0900:",
        "",
        "Added:",
        "",
        "- Delta Sheet",
        "",
        "Changed:",
        "",
        "- Beta Sheet",
        "",
        "Removed:",
        "",
        "- Gone",
        "",
        "Each sheet's PDF is an asset of this release, named after its folder in `sheets/`; " +
          "`learning-sheets-2026-11-03-1430.zip` holds all of them, and `catalog.json` lists every sheet's facts and links.",
        "",
      ].join("\n"),
    );
    assert.equal(lines[0], "the latest release is 2026-11-01-0900");
    assert.match(lines[1], /notes on 3 sheets, 1 added, 1 changed, 1 removed$/);
  });

  test("say so where nothing changed since the latest release", async () => {
    const { root } = released("2026-11-01-0900", ["Alpha Sheet"]);
    const out = files("unchanged");
    await prepareRelease({
      tag: "2026-11-03-1430",
      root,
      ...out,
      fetch: latest("2026-11-01-0900"),
      token: "",
    });
    assert.match(
      readFileSync(out.notes, "utf8"),
      /^This release holds the PDFs of 1 learning sheet\.\n\nNo sheet was added, changed or removed since 2026-11-01-0900\.\n\nEach/,
    );
  });

  test("list every sheet as added in the first release", () => {
    const notes = releaseNotes({
      tag: "2026-11-03-1430",
      previous: null,
      count: 2,
      changes: { added: ["Zeta", "Alpha"], changed: [], removed: [] },
    });
    assert.match(
      notes,
      /^This release holds the PDFs of 2 learning sheets\.\n\nIt is the first release\.\n\nAdded:\n\n- Alpha\n- Zeta\n\nEach/,
    );
  });
});

describe("the catalog", () => {
  test("links each sheet's source and PDF at the tag of the release, without the image", async () => {
    const out = files("catalog");
    await prepareRelease({
      tag: "2026-11-03-1430",
      root: FIXTURES,
      ...out,
      fetch: latest(null),
      token: "",
    });
    const catalog = JSON.parse(readFileSync(out.catalog, "utf8"));
    assert.deepEqual(catalog.release, {
      tag: "2026-11-03-1430",
      url: `${REPO}/releases/tag/2026-11-03-1430`,
    });
    assert.equal(catalog.sheets.length, 1);
    const [sheet] = catalog.sheets;
    assert.equal(sheet.name, SHEET);
    assert.equal(sheet.title, "Two Pages of Squares");
    assert.equal(sheet.source, `${REPO}/tree/2026-11-03-1430/tests/fixtures/sheets/${SHEET}`);
    assert.equal(sheet.pdf, `${REPO}/releases/download/2026-11-03-1430/${SHEET}.pdf`);
    assert.equal(sheet.image, undefined);
  });
});

describe("what it refuses", () => {
  const cases = [
    ["a tag out of form", { tag: "2026-11-03T14:30", root: FIXTURES }, /YYYY-MM-DD-HHMM/],
    [
      "a root that holds no sheet",
      { tag: "2026-11-03-1430", root: path.join(temporary, "empty") },
      /holds no sheet, so there is nothing to release/,
    ],
    [
      "a latest release it cannot read",
      {
        tag: "2026-11-03-1430",
        root: FIXTURES,
        fetch: async () => new Response(null, { status: 500 }),
      },
      /could not be read \(HTTP 500\)/,
    ],
  ];
  for (const [what, options, message] of cases) {
    test(`fails on ${what} and writes nothing`, async () => {
      const out = files(`refused-${what.replaceAll(" ", "-")}`);
      await assert.rejects(
        prepareRelease({ fetch: latest(null), token: "", ...out, ...options }),
        (error) => error instanceof ReleaseError && message.test(error.message),
      );
      assert.throws(() => readFileSync(out.notes), { code: "ENOENT" });
      assert.throws(() => readFileSync(out.catalog), { code: "ENOENT" });
    });
  }
});
