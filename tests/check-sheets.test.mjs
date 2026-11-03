// Each check of scripts/check-sheets.mjs, run on a copy of the fixture sheet
// that one change breaks.

import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkSheets } from "../scripts/check-sheets.mjs";
import { isNam2, nameFromTitle, pagesInPrintOrder } from "../scripts/sheet-files.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sheets");
const SHEET = "two-pages-of-squares";
const temporary = mkdtempSync(path.join(tmpdir(), "check-sheets-"));
after(() => rmSync(temporary, { recursive: true, force: true }));

let copies = 0;
/** A sheets root holding a copy of the fixture sheet, changed by `change`. */
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

/** Asserts that the check reports exactly one violation, on `file`, matching `pattern`. */
function assertViolation(root, file, pattern) {
  const { violations } = checkSheets(root);
  assert.equal(violations.length, 1, violations.join("\n"));
  assert.ok(violations[0].startsWith(`${path.join(root, ...file)}: `), violations[0]);
  assert.match(violations[0], pattern);
}

const readme = [SHEET, "README.md"];
const canvasFile = [SHEET, "project", "canvas.json"];
const mainPage = [SHEET, "project", "Main.dc.html"];

describe("the name rule", () => {
  const cases = [
    ["Logins at a Glance", "logins-at-a-glance"],
    ["How a web page reaches your screen", "how-a-web-page-reaches-your-screen"],
    ["Logins, Keys and Recovery", "logins-keys-and-recovery"],
    ["Säule 3a für Selbständige", "saeule-3a-fuer-selbstaendige"],
    ["Drei Säulen der Vorsorge", "drei-saeulen-der-vorsorge"],
    ["Don't Get Locked Out", "dont-get-locked-out"],
    ["Don’t Get Locked Out", "dont-get-locked-out"],
    ["Straße und Café", "strasse-und-cafe"],
    ["Input/Output", "input-output"],
    ["ÖL und ÄRGER", "oel-und-aerger"],
    ["Säule", "saeule"],
    ["  Points -- of   Sail  ", "points-of-sail"],
  ];
  for (const [title, name] of cases) {
    test(`${JSON.stringify(title)} gives ${name}`, () => {
      assert.equal(nameFromTitle(title), name);
      assert.ok(isNam2(name));
    });
  }
  test("a title of no letter or digit gives no name", () => {
    assert.equal(nameFromTitle("— ? —"), "");
  });
});

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

  for (const [field, quoted, unquoted] of [
    ["made", '"2026-11-03"', "2026-11-03"],
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
    ["made", '"2026-11-03"', '"2026-02-30"', /"made" .* is not a date/],
    [
      "skill",
      '"tiavelum/claude-setup@4f26fe8"',
      '"tiavelum/claude-setup@main"',
      /"skill" .* is not/,
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

  test("reports an empty artifact_version", () => {
    const root = brokenCopy((_, sheet) =>
      edit(path.join(sheet, "README.md"), '"1793655646-5d0b"', '""'),
    );
    assertViolation(root, readme, /"artifact_version" is empty/);
  });

  test("reports a folder name that is not the title's", () => {
    const root = brokenCopy((_, sheet) => {
      edit(path.join(sheet, "README.md"), "Two Pages of Squares", "Two Pages of Circles");
      editCanvas(sheet, (canvas) => {
        canvas.title = "Two Pages of Circles";
      });
    });
    assertViolation(root, readme, /is not the name the title gives, two-pages-of-circles/);
  });

  test("reports a canvas title other than the README's", () => {
    const root = brokenCopy((_, sheet) =>
      editCanvas(sheet, (canvas) => {
        canvas.title = "Two pages of squares";
      }),
    );
    assertViolation(root, canvasFile, /is not the title of the README/);
  });

  test("reports two sheets whose titles give one folder name", () => {
    const root = brokenCopy((root) => {
      const other = path.join(root, "two-pages-of-squares-again");
      cpSync(path.join(root, SHEET), other, { recursive: true });
      edit(path.join(other, "README.md"), "Two Pages of Squares", "Two Pages of Squares!");
      editCanvas(other, (canvas) => {
        canvas.title = "Two Pages of Squares!";
      });
    });
    const { violations } = checkSheets(root);
    assert.ok(
      violations.some((line) => line.includes("no two sheets share a folder name")),
      violations.join("\n"),
    );
  });

  test("reports a board whose file is missing", () => {
    const root = brokenCopy((_, sheet) => rmSync(path.join(sheet, "project", "Back.dc.html")));
    assertViolation(root, [SHEET, "project", "Back.dc.html"], /the file is missing/);
  });

  test("reports a page file that is not a board", () => {
    const root = brokenCopy((_, sheet) =>
      cpSync(
        path.join(sheet, "project", "Back.dc.html"),
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
        canvas.boards["Back.dc.html"].x = -900;
      }),
    );
    assertViolation(root, canvasFile, /the first page in print order is Back.dc.html/);
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
      "body{margin:0;",
      "body{margin:0;background:url(https://example.org/b.png);",
      /not static: loads https:\/\/example.org\/b.png from a <style>/,
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
