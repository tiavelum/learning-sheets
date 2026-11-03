// The renderer of scripts/render-sheets.mjs, run on the fixture sheet and on
// copies of it that load from the network or run past their frame.

import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { pageHtml, renderSheets } from "../scripts/render-sheets.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sheets");
const SHEET = "two-pages-of-squares";
const temporary = mkdtempSync(path.join(tmpdir(), "render-sheets-"));
after(() => rmSync(temporary, { recursive: true, force: true }));

let copies = 0;
/** A sheets root and an output folder, with a copy of the fixture whose page one `change` edits. */
function copyWithMain(change) {
  const base = path.join(temporary, String(copies++));
  const root = path.join(base, "sheets");
  mkdirSync(root, { recursive: true });
  cpSync(path.join(FIXTURES, SHEET), path.join(root, SHEET), { recursive: true });
  const main = path.join(root, SHEET, "project", "Main.dc.html");
  if (change) writeFileSync(main, change(readFileSync(main, "utf8")));
  return { root, out: path.join(base, "build"), main };
}

describe("the renderer", () => {
  test("prints each page in reading order at its frame's size, merged into one PDF and a PNG", async () => {
    const out = path.join(temporary, "fixture-build");
    const [result] = await renderSheets({ root: FIXTURES, out, pngWidth: 397 });
    assert.equal(result.error, undefined, result.error);
    assert.equal(result.pages, 2);
    const pdf = await PDFDocument.load(readFileSync(path.join(out, `${SHEET}.pdf`)));
    assert.equal(pdf.getPageCount(), 2);
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      // 794 × 1123 CSS px at 72 / 96 pt per px.
      assert.ok(Math.abs(width - 595.5) < 1, `width ${width}`);
      assert.ok(Math.abs(height - 842.25) < 1, `height ${height}`);
    }
    const png = readFileSync(path.join(out, `${SHEET}.png`));
    assert.equal(png.readUInt32BE(16), 397);
    assert.equal(png.readUInt32BE(20), Math.round((1123 * 397) / 794));
  });

  test("puts the helmet in the head, the x-dc content in the body and Fontsource in place of Google Fonts", () => {
    const text = readFileSync(path.join(FIXTURES, SHEET, "project", "Main.dc.html"), "utf8");
    const { html } = pageHtml(text, { w: 794, h: 1123 });
    assert.doesNotMatch(html, /googleapis|gstatic|support\.js|text\/x-dc|<x-dc|<helmet/);
    assert.match(
      html,
      /<link rel="stylesheet" href="\/fonts\/@fontsource\/source-sans-3\/400.css">/,
    );
    assert.match(
      html,
      /<link rel="stylesheet" href="\/fonts\/@fontsource\/source-sans-3\/400-italic.css">/,
    );
    assert.match(html, /@page\{size:794px 1123px;margin:0\}/);
    assert.match(html, /<body>\s*<div style="width: 794px/);
  });

  test("takes an axis other than ital and wght from the variable package", () => {
    const text = readFileSync(
      path.join(FIXTURES, SHEET, "project", "Main.dc.html"),
      "utf8",
    ).replace(
      "family=Source+Sans+3:ital,wght@0,400;0,700;1,400",
      "family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800",
    );
    const { html } = pageHtml(text, { w: 794, h: 1123 });
    assert.match(html, /href="\/fonts\/@fontsource-variable\/bricolage-grotesque\/opsz.css"/);
  });

  test("prints a family from a variable package under the name the page asks for", async () => {
    const { root, out } = copyWithMain((text) =>
      text
        .replace(
          "family=Source+Sans+3:ital,wght@0,400;0,700;1,400",
          "family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&amp;family=Source+Sans+3:ital,wght@0,400;0,700;1,400",
        )
        .replace(
          '<h1 style="margin: 0;',
          "<h1 style=\"margin: 0; font-family: 'Bricolage Grotesque', serif;",
        ),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    const pdf = await PDFDocument.load(readFileSync(path.join(out, `${SHEET}.pdf`)));
    // A font's name stands in BaseFont, or for a Type 3 font in the Name of
    // its dictionary and the FontName of its descriptor.
    const fonts = pdf.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object) => object instanceof PDFDict)
      .flatMap((object) =>
        ["BaseFont", "Name", "FontName"].map((key) => object.get(PDFName.of(key))),
      )
      .filter((value) => value instanceof PDFName)
      .map((value) => value.decodeText());
    assert.ok(
      fonts.some((name) => name.includes("BricolageGrotesque")),
      `fonts embedded: ${fonts.join(", ")}`,
    );
  });

  test("fails on content past the frame, naming the page and by how many px", async () => {
    const { root, out, main } = copyWithMain((text) =>
      text
        .replace("overflow: hidden; ", "position: relative; ")
        .replace(
          "</h1>",
          '</h1><p style="position: absolute; top: 1100px; left: 48px; height: 50px; margin: 0">Past</p>',
        ),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(
      result.error,
      `${main}: the content runs past the 794 × 1123 px frame by 27 px at the bottom`,
    );
    assert.equal(existsSync(path.join(out, `${SHEET}.pdf`)), false);
  });

  test("refuses a page that the static rule forbids, naming the page and the URL", async () => {
    const { root, out, main } = copyWithMain((text) =>
      text.replace("<style>", "<style>@import url(https://example.org/a.css);"),
    );
    const [result] = await renderSheets({ root, out });
    assert.ok(result.error.startsWith(`${main}: is not static: `), result.error);
    assert.match(result.error, /example\.org\/a\.css/);
  });

  test("fails on a network request made while the page renders", async () => {
    const { root, out, main } = copyWithMain((text) =>
      text.replace("<style>", '<style>h1{background-image:u\\72l("https://example.org/e.png")}'),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(
      result.error,
      `${main}: requested https://example.org/e.png, which a page may not load`,
    );
    assert.equal(existsSync(path.join(out, `${SHEET}.pdf`)), false);
  });
});
