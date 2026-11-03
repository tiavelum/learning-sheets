import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkSheets } from "../scripts/check-sheets.mjs";
import { pagesInPrintOrder } from "../scripts/sheet-files.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sheets");
const CHECK = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "scripts",
  "check-sheets.mjs",
);
const SHEET = "two-pages-of-squares";
const temporary = mkdtempSync(path.join(tmpdir(), "check-sheets-"));
after(() => rmSync(temporary, { recursive: true, force: true }));

let copies = 0;
function brokenCopy(change) {
  const root = path.join(temporary, String(copies++), "sheets");
  mkdirSync(root, { recursive: true });
  cpSync(path.join(FIXTURES, SHEET), path.join(root, SHEET), { recursive: true });
  change?.(root, path.join(root, SHEET));
  return root;
}

function edit(file, from, to) {
  const text = readFileSync(file, "utf8");
  assert.ok(text.includes(from), `${file} holds ${from}`);
  writeFileSync(file, text.replace(from, to));
}

function editCanvas(sheet, change) {
  const file = path.join(sheet, "project", "canvas.json");
  const canvas = JSON.parse(readFileSync(file, "utf8"));
  change(canvas);
  writeFileSync(file, JSON.stringify(canvas));
}

function assertViolation(root, file, pattern) {
  const { violations } = checkSheets(root);
  assert.equal(violations.length, 1, violations.join("\n"));
  assert.ok(violations[0].startsWith(`${path.join(root, ...file)}: `), violations[0]);
  assert.match(violations[0], pattern);
}

const readme = [SHEET, "README.md"];
const canvasFile = [SHEET, "project", "canvas.json"];
const mainPage = [SHEET, "project", "Main.dc.html"];

describe("the print order", () => {
  test("pages print by y, then x, whatever order lists", () => {
    const canvas = {
      boards: {
        "C.dc.html": { x: 0, y: 1300, w: 1, h: 1 },
        "B.dc.html": { x: 900, y: 0, w: 1, h: 1 },
        "Main.dc.html": { x: 0, y: 0, w: 1, h: 1 },
      },
      order: ["C.dc.html", "B.dc.html", "Main.dc.html"],
    };
    assert.deepEqual(pagesInPrintOrder(canvas), ["Main.dc.html", "B.dc.html", "C.dc.html"]);
  });
});

describe("the check", () => {
  test("passes the fixture sheet", () => {
    const { violations, sheets } = checkSheets(FIXTURES);
    assert.deepEqual(violations, []);
    assert.deepEqual(sheets, [SHEET]);
  });

  test("passes a root that does not exist", () => {
    assert.deepEqual(checkSheets(path.join(temporary, "none")).violations, []);
  });

  test("allows README.md and LICENSE beside the sheet folders", () => {
    const root = brokenCopy((root) => {
      writeFileSync(path.join(root, "README.md"), "# Sheets\n");
      writeFileSync(path.join(root, "LICENSE"), "CC BY 4.0\n");
    });
    assert.deepEqual(checkSheets(root).violations, []);
  });

  test("reports another file beside the sheet folders", () => {
    const root = brokenCopy((root) => writeFileSync(path.join(root, "catalog.json"), "{}\n"));
    assertViolation(root, ["catalog.json"], /is not a sheet folder/);
  });

  test("reports a file in a sheet folder other than README.md and project/", () => {
    const root = brokenCopy((_, sheet) => writeFileSync(path.join(sheet, "sheet.pdf"), "%PDF"));
    assertViolation(root, [SHEET, "sheet.pdf"], /holds exactly README.md and project\//);
  });

  test("reports a missing README", () => {
    const root = brokenCopy((_, sheet) => rmSync(path.join(sheet, "README.md")));
    assertViolation(root, readme, /is missing/);
  });

  test("reports a missing project folder", () => {
    const root = brokenCopy((_, sheet) => rmSync(path.join(sheet, "project"), { recursive: true }));
    assertViolation(root, [SHEET, "project"], /is missing/);
  });

  test("reports a README without front matter", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), "---\ntitle", "title"),
    );
    const { violations } = checkSheets(root);
    assert.ok(
      violations.some((line) => line.includes("has no YAML front matter")),
      violations.join("\n"),
    );
  });

  test("reports a missing field", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), 'artifact_version: "1793655646-5d0b"\n', ""),
    );
    assertViolation(root, readme, /"artifact_version" is missing/);
  });

  test("reports a field the contract does not name", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), 'language: "en"\n', 'language: "en"\nauthor: "x"\n'),
    );
    assertViolation(root, readme, /"author" is not a field of a sheet/);
  });

  test("reports fields out of order", () => {
    const root = brokenCopy((_, sheet) =>
      edit(
        path.join(sheet, "README.md"),
        'language: "en"\npaper: "a4"',
        'paper: "a4"\nlanguage: "en"',
      ),
    );
    assertViolation(root, readme, /fields stand in the order/);
  });

  test("reports last_modified before created in the order of the fields", () => {
    const root = brokenCopy((_, sheet) =>
      edit(
        path.join(sheet, "README.md"),
        'created: "2026-11-01"\nlast_modified: "2026-11-03"',
        'last_modified: "2026-11-03"\ncreated: "2026-11-01"',
      ),
    );
    assertViolation(
      root,
      readme,
      /fields stand in the order .*paper, last_modified, created, skill_version.*, not .*paper, created, last_modified, skill_version/,
    );
  });

  for (const [old, field] of [
    ["made", "created"],
    ["skill", "skill_version"],
  ]) {
    test(`reports the field ${old}, which ${field} replaces`, () => {
      const root = brokenCopy((_, sheet) =>
        edit(path.join(sheet, "README.md"), `${field}: `, `${old}: `),
      );
      const { violations } = checkSheets(root);
      assert.deepEqual(
        violations.map((line) => line.slice(line.indexOf(": ") + 2)),
        [`front matter: "${field}" is missing`, `front matter: "${old}" is not a field of a sheet`],
      );
    });
  }

  for (const [field, quoted, unquoted] of [
    ["created", '"2026-11-01"', "2026-11-01"],
    ["last_modified", '"2026-11-03"', "2026-11-03"],
    ["language", '"en"', "no"],
    ["topic", '"A fixture for the tests of the checks and the renderer"', "'single quoted'"],
  ]) {
    test(`reports an unquoted ${field}`, () => {
      const root = brokenCopy((_, sheet) =>
        edit(path.join(sheet, "README.md"), `${field}: ${quoted}`, `${field}: ${unquoted}`),
      );
      const { violations } = checkSheets(root);
      assert.ok(
        violations.some((line) => line.includes(`"${field}" is not a string in double quotes`)),
        violations.join("\n"),
      );
    });
  }

  test("reports an unquoted tag", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), '["fixture", "test"]', '["fixture", test]'),
    );
    assertViolation(root, readme, /the tag "test" is not a string in double quotes/);
  });

  test("reports a tag not in the form of NAM-2", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), '"test"]', '"Test Sheets"]'),
    );
    assertViolation(root, readme, /the tag "Test Sheets" is not in the form of NAM-2/);
  });

  test("reports a tag that stands twice", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), '"test"]', '"fixture"]'),
    );
    assertViolation(root, readme, /the tag "fixture" stands twice/);
  });

  test("reports a topic with a final period", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), 'the renderer"', 'the renderer."'),
    );
    assertViolation(root, readme, /"topic" ends with a period/);
  });

  for (const [field, from, to, pattern] of [
    ["language", '"en"', '"english language"', /"language" .* is not a BCP 47 language tag/],
    ["paper", '"a4"', '"a3"', /"paper" is "a3", not a4 or letter/],
    ["created", '"2026-11-01"', '"2026-02-30"', /"created" "2026-02-30" is not a date/],
    ["last_modified", '"2026-11-03"', '"3 Nov 2026"', /"last_modified" "3 Nov 2026" is not a date/],
    [
      "skill_version",
      '"tiavelum/claude-setup@4f26fe8"',
      '"tiavelum/claude-setup@main"',
      /"skill_version" .* is not tiavelum\/claude-setup@ and a commit hash/,
    ],
    [
      "artifact",
      '"https://claude.ai/artifact/',
      '"https://example.org/artifact/',
      /"artifact" .* is not/,
    ],
  ]) {
    test(`reports a ${field} out of form`, () => {
      const root = brokenCopy((_, sheet) =>
        edit(path.join(sheet, "README.md"), `${field}: ${from}`, `${field}: ${to}`),
      );
      const { violations } = checkSheets(root);
      assert.ok(
        violations.some((line) => pattern.test(line)),
        violations.join("\n"),
      );
    });
  }

  test("allows a last_modified equal to created, as a sheet with one version has", () => {
    const root = brokenCopy((_, sheet) =>
      edit(
        path.join(sheet, "README.md"),
        'last_modified: "2026-11-03"',
        'last_modified: "2026-11-01"',
      ),
    );
    assert.deepEqual(checkSheets(root).violations, []);
  });

  test("reports a last_modified before created", () => {
    const root = brokenCopy((_, sheet) =>
      edit(
        path.join(sheet, "README.md"),
        'last_modified: "2026-11-03"',
        'last_modified: "2026-10-31"',
      ),
    );
    assertViolation(root, readme, /"last_modified" 2026-10-31 is before "created" 2026-11-01/);
  });

  test("reports an empty artifact_version", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), '"1793655646-5d0b"', '""'),
    );
    assertViolation(root, readme, /"artifact_version" is empty/);
  });

  test("reports a title folded over two lines", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), '"two-pages-of-squares"', '"two-pages-\\\n  of-squares"'),
    );
    assertViolation(root, readme, /"title" is not on one line/);
  });

  test("allows a skill commit hash of 40 and of 64 hexadecimal characters", () => {
    for (const hash of ["a".repeat(40), "b".repeat(64)]) {
      const root = brokenCopy((_, sheet) =>
        edit(path.join(sheet, "README.md"), "@4f26fe8", `@${hash}`),
      );
      assert.deepEqual(checkSheets(root).violations, []);
    }
  });

  const REQUEST =
    "A two-page test sheet with a square on each page, which the tests of the checks, the renderer and the browse page read. It is for whoever changes those scripts.";

  for (const request of [
    "A sheet of two coloured squares for Dr. Smith and her class.",
    "A sheet of squares for those who test scripts, e.g. Alice and Bob. It has two pages. Each holds one square.",
    "A sheet of squares (for whoever changes the scripts.)",
    "A sheet of squares\nfor whoever changes the scripts, written over two lines.",
  ]) {
    test(`allows the request ${JSON.stringify(request)}`, () => {
      const root = brokenCopy((_, sheet) => edit(path.join(sheet, "README.md"), REQUEST, request));
      assert.deepEqual(checkSheets(root).violations, []);
    });
  }

  for (const [what, from, to, pattern] of [
    [
      "four sentences",
      "those scripts.",
      "those scripts. It has two pages. Each holds a square.",
      /the request is 4 sentences, not one to three/,
    ],
    ["no request", REQUEST, "", /has no request below "## Request"/],
    [
      "a request that is a list",
      REQUEST,
      "- A test sheet.\n- For whoever changes the scripts.",
      /the request below "## Request" is not one paragraph of prose/,
    ],
    [
      "a request that is a code block",
      REQUEST,
      "```text\nMake a two-page test sheet.\n```",
      /the request below "## Request" is not one paragraph of prose/,
    ],
    [
      "a request that does not end a sentence",
      "those scripts.",
      "those scripts",
      /the request does not end with the end of a sentence/,
    ],
    [
      "no heading Request",
      "## Request\n",
      "",
      /has no heading "## Request" below the front matter/,
    ],
    [
      "another heading in place of Request",
      "## Request",
      "## Prompt",
      /has no heading "## Request" below the front matter/,
    ],
    [
      "a sentence above Request",
      "## Request",
      "A two-page sheet of coloured squares.\n\n## Request",
      /holds text between the front matter and "## Request", the README's only section/,
    ],
    [
      "a section Prompt after the request",
      "those scripts.",
      "those scripts.\n\n## Prompt\n\n```text\nMake a two-page test sheet.\n```",
      /holds text after the request; "## Request" is the README's only section/,
    ],
    [
      "a second paragraph",
      "those scripts.",
      "those scripts.\n\nIt has two pages.",
      /holds text after the request/,
    ],
  ]) {
    test(`reports ${what}`, () => {
      const root = brokenCopy((_, sheet) => edit(path.join(sheet, "README.md"), from, to));
      assertViolation(root, readme, pattern);
    });
  }

  for (const title of [
    "Two Pages of Squares",
    "two pages of squares",
    "Two-Pages-of-Squares",
    "two_pages_of_squares",
    "two-pages--of-squares",
    "-two-pages-of-squares",
    "two-pages-of-squares-",
    "two-pages-of-carrés",
  ]) {
    test(`reports the title ${JSON.stringify(title)}, which is not in the form of a name`, () => {
      const root = brokenCopy((_, sheet) => {
        edit(path.join(sheet, "README.md"), '"two-pages-of-squares"', JSON.stringify(title));
        editCanvas(sheet, (canvas) => {
          canvas.title = title;
        });
      });
      assertViolation(
        root,
        readme,
        /the title .* is not a sheet's name, lowercase words of a-z and 0-9 joined by single hyphens \(Folder name, NAM-2\)$/,
      );
    });
  }

  for (const title of ["squares-learning-sheet", "learning-sheets-of-squares"]) {
    test(`reports the title ${title}, which holds the words learning sheet`, () => {
      const root = brokenCopy((root) => {
        cpSync(path.join(root, SHEET), path.join(root, title), { recursive: true });
        rmSync(path.join(root, SHEET), { recursive: true });
        edit(path.join(root, title, "README.md"), '"two-pages-of-squares"', `"${title}"`);
        editCanvas(path.join(root, title), (canvas) => {
          canvas.title = title;
        });
      });
      assertViolation(root, [title, "README.md"], /holds the words "learning sheet"/);
    });
  }

  for (const title of [
    "machine-learning-on-sheets",
    "relearning-sheet",
    "learning-sheetmusic",
    "saeule-3a",
    "3a",
    "squares",
  ]) {
    test(`allows the title ${title}`, () => {
      const root = brokenCopy((root) => {
        cpSync(path.join(root, SHEET), path.join(root, title), { recursive: true });
        rmSync(path.join(root, SHEET), { recursive: true });
        edit(path.join(root, title, "README.md"), '"two-pages-of-squares"', `"${title}"`);
        editCanvas(path.join(root, title), (canvas) => {
          canvas.title = title;
        });
      });
      assert.deepEqual(checkSheets(root).violations, []);
    });
  }

  test("reports a folder name that is not the title", () => {
    const root = brokenCopy((_, sheet) => {
      edit(path.join(sheet, "README.md"), "two-pages-of-squares", "two-pages-of-circles");
      editCanvas(sheet, (canvas) => {
        canvas.title = "two-pages-of-circles";
      });
    });
    assertViolation(
      root,
      readme,
      /the folder name two-pages-of-squares is not the title, two-pages-of-circles$/,
    );
  });

  test("reports a second sheet that takes the title of another", () => {
    const root = brokenCopy((root) =>
      cpSync(path.join(root, SHEET), path.join(root, "two-pages-of-squares-again"), {
        recursive: true,
      }),
    );
    assertViolation(
      root,
      ["two-pages-of-squares-again", "README.md"],
      /the folder name two-pages-of-squares-again is not the title, two-pages-of-squares$/,
    );
  });

  test("reports a canvas title other than the README's", () => {
    const root = brokenCopy((_, sheet) =>
      editCanvas(sheet, (canvas) => {
        canvas.title = "Two Pages of Squares";
      }),
    );
    assertViolation(root, canvasFile, /is not the title of the README/);
  });

  test("reports a board whose file is missing", () => {
    const root = brokenCopy((_, sheet) => rmSync(path.join(sheet, "project", "back.dc.html")));
    assertViolation(root, [SHEET, "project", "back.dc.html"], /the file is missing/);
  });

  test("reports a page file that is not a board", () => {
    const root = brokenCopy((_, sheet) =>
      cpSync(
        path.join(sheet, "project", "back.dc.html"),
        path.join(sheet, "project", "Extra.dc.html"),
      ),
    );
    assertViolation(root, [SHEET, "project", "Extra.dc.html"], /is not a board of canvas.json/);
  });

  test("reports another file in project/", () => {
    const root = brokenCopy((_, sheet) =>
      writeFileSync(path.join(sheet, "project", "SKILL.md"), "x"),
    );
    assertViolation(root, [SHEET, "project", "SKILL.md"], /project\/ holds only canvas.json/);
  });

  test("reports an order that lists other files than boards", () => {
    const root = brokenCopy((_, sheet) =>
      editCanvas(sheet, (canvas) => {
        canvas.order = ["Main.dc.html"];
      }),
    );
    assertViolation(root, canvasFile, /"order" does not list the same file names/);
  });

  test("reports a first page in print order other than Main.dc.html", () => {
    const root = brokenCopy((_, sheet) =>
      editCanvas(sheet, (canvas) => {
        canvas.boards["back.dc.html"].x = -900;
      }),
    );
    assertViolation(root, canvasFile, /the first page in print order is back.dc.html/);
  });

  test("reports a board size that does not match paper", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), 'paper: "a4"', 'paper: "letter"'),
    );
    const { violations } = checkSheets(root);
    assert.equal(violations.length, 2, violations.join("\n"));
    for (const line of violations)
      assert.match(line, /794 × 1123 px, not the 816 × 1056 px of paper letter/);
  });

  for (const [what, from, to, pattern] of [
    ["a hole", "Page 1</h1>", "{{title}}</h1>", /not static: holds a hole/],
    ["an <sc-for>", "<h1 ", '<sc-for list="x"></sc-for><h1 ', /not static: holds <sc-for>/],
    ["an <sc-if>", "<h1 ", '<sc-if value="x"></sc-if><h1 ', /not static: holds <sc-if>/],
    [
      "a <dc-import>",
      "<h1 ",
      '<dc-import name="Back"></dc-import><h1 ',
      /not static: holds <dc-import>/,
    ],
    [
      "an uploaded asset",
      "<h1 ",
      '<img src="/_blob/abc" alt=""><h1 ',
      /not static: loads an uploaded asset/,
    ],
    [
      "another script",
      "</x-dc>",
      "<script>document.title = 1;</script></x-dc>",
      /not static: holds a script other than/,
    ],
    [
      "an image from the network",
      "<h1 ",
      '<img src="https://example.org/a.png" alt=""><h1 ',
      /not static: loads https:\/\/example.org\/a.png/,
    ],
    [
      "a CSS url()",
      "<style>",
      "<style>body{background:url(https://example.org/b.png)}",
      /not static: loads https:\/\/example.org\/b.png from a <style>/,
    ],
    [
      "a url() in a presentation attribute",
      "<h1 ",
      '<svg width="1" height="1" aria-hidden="true"><rect width="1" height="1" fill="url(https://example.org/g.svg#a)"/></svg><h1 ',
      /not static: loads https:\/\/example.org\/g.svg#a from the fill of <rect>/,
    ],
    [
      "an image-set() in an inline style",
      "<h1 ",
      "<p style=\"background-image: image-set('https://example.org/i.png' 1x)\">x</p><h1 ",
      /not static: loads https:\/\/example.org\/i.png from the style of <p>/,
    ],
    [
      "a -webkit-image-set() in a <style>",
      "<style>",
      '<style>h1{background-image:-webkit-image-set("https://example.org/w.png" 1x)}',
      /not static: loads https:\/\/example.org\/w.png from a <style>/,
    ],
    [
      "another stylesheet",
      "<style>",
      '<link rel="stylesheet" href="https://example.org/c.css"><style>',
      /not static: loads https:\/\/example.org\/c.css through <link>/,
    ],
    [
      "a preconnect to another host",
      "<style>",
      '<link rel="preconnect" href="https://example.org"><style>',
      /not static: loads https:\/\/example.org through <link>/,
    ],
  ]) {
    test(`reports a page with ${what}`, () => {
      const root = brokenCopy((_, sheet) =>
        edit(path.join(sheet, "project", "Main.dc.html"), from, to),
      );
      const { violations } = checkSheets(root);
      assert.ok(violations.length >= 1, "no violation");
      for (const line of violations)
        assert.ok(line.startsWith(`${path.join(root, ...mainPage)}: `), line);
      assert.ok(
        violations.some((line) => pattern.test(line)),
        violations.join("\n"),
      );
    });
  }

  test("allows a URL in an <a href>, an xmlns and the text", () => {
    const root = brokenCopy((_, sheet) =>
      edit(
        path.join(sheet, "project", "Main.dc.html"),
        "<h1 ",
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" aria-hidden="true"></svg><p>See https://example.org/.</p><h1 ',
      ),
    );
    assert.deepEqual(checkSheets(root).violations, []);
  });

  test("in a git work tree, ignores a file git leaves out and reports one it would commit", () => {
    const root = brokenCopy((root, sheet) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      writeFileSync(path.join(root, ".git", "info", "exclude"), ".DS_Store\n");
      writeFileSync(path.join(sheet, ".DS_Store"), "x");
      writeFileSync(path.join(sheet, "project", ".DS_Store"), "x");
    });
    assert.deepEqual(checkSheets(root).violations, []);
    writeFileSync(path.join(root, SHEET, "notes.txt"), "x");
    assertViolation(root, [SHEET, "notes.txt"], /holds exactly README.md and project\//);
  });

  test("reports a font family without its package in package.json", () => {
    const root = brokenCopy();
    const packageFile = path.join(temporary, "package.json");
    writeFileSync(packageFile, JSON.stringify({ dependencies: {} }));
    const { violations } = checkSheets(root, { packageFile });
    assert.equal(violations.length, 2, violations.join("\n"));
    for (const line of violations) {
      assert.match(
        line,
        /requests the font family Source Sans 3; .*npm install --save-exact @fontsource\/source-sans-3$/,
      );
    }
  });

  test("names the variable package for an axis other than ital and wght", () => {
    const root = brokenCopy((_, sheet) =>
      edit(
        path.join(sheet, "project", "Main.dc.html"),
        "family=Source+Sans+3:ital,wght@0,400;0,700;1,400",
        "family=Bricolage+Grotesque:opsz,wght@12..96,600",
      ),
    );
    const packageFile = path.join(temporary, "package-variable.json");
    writeFileSync(
      packageFile,
      JSON.stringify({ dependencies: { "@fontsource/bricolage-grotesque": "5.3.0" } }),
    );
    const { violations } = checkSheets(root, { packageFile });
    assert.ok(
      violations.some((line) =>
        line.endsWith("npm install --save-exact @fontsource-variable/bricolage-grotesque"),
      ),
      violations.join("\n"),
    );
  });

  test("reports a weight the font package does not hold", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "project", "Main.dc.html"), "0,700;1,400", "0,700;1,400;0,950"),
    );
    assertViolation(
      root,
      mainPage,
      /requests Source Sans 3 at weight 950, which @fontsource\/source-sans-3 does not hold/,
    );
  });
});

describe("the command", () => {
  const run = (...args) => spawnSync(process.execPath, [CHECK, ...args], { encoding: "utf8" });

  test("exits 0 and counts the sheets where there is no violation", () => {
    const result = run("--root", FIXTURES);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `1 sheet in ${FIXTURES}, no violation\n`);
  });

  test("exits 1 and prints each violation and their number", () => {
    const root = brokenCopy((root) => writeFileSync(path.join(root, "catalog.json"), "{}\n"));
    const result = run("--root", root);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /catalog\.json: is not a sheet folder/);
    assert.match(result.stdout, new RegExp(`\n1 violation in ${root.replaceAll("\\", "\\\\")}\n$`));
  });

  test("exits 2 on an option it does not know", () => {
    const result = run("--roots", FIXTURES);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage: check-sheets\.mjs/);
  });

  test("exits 2 on a root that is not a folder", () => {
    const result = run("--root", path.join(temporary, "none"));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /is not a folder/);
  });
});
