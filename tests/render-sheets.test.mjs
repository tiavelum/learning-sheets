import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { pageHtml, renderSheets } from "../scripts/render-sheets.mjs";

const TESTS = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(TESTS, "fixtures", "sheets");
const RENDER = path.join(TESTS, "..", "scripts", "render-sheets.mjs");
const NODE_MODULES = path.join(TESTS, "..", "node_modules");
const SHEET = "two-pages-of-squares";
// Characters of the private use area, which no font of the repository holds
// and the fonts of a machine may or may not hold, and characters that draw
// nothing, written as code points so that they show. The tests that warn on
// them pass both where a font of the machine draws them and where none does.
const PRIVATE_USE = String.fromCodePoint(0xe000);
const PRIVATE_USE_2 = String.fromCodePoint(0xe001);
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
const SOFT_HYPHEN = String.fromCodePoint(0xad);
const temporary = mkdtempSync(path.join(tmpdir(), "render-sheets-"));
after(() => rmSync(temporary, { recursive: true, force: true }));

let copies = 0;
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
      // 794 × 1123 CSS px at 72 / 96 pt per px; Chrome rounds the height.
      assert.equal(width, 595.5);
      assert.ok(Math.abs(height - 842.25) < 1, `height ${height}`);
    }
    // The fixture lists the second page first in "boards" and "order".
    const ink = pdf.getPages().map((page) => {
      const contents = page.node.Contents();
      const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
      return refs
        .map((ref) =>
          inflateSync(Buffer.from(pdf.context.lookup(ref).getContents())).toString("latin1"),
        )
        .join("\n");
    });
    assert.match(ink[0], /\.1216 \.3725 \.749 rg/); // #1F5FBF, page one
    assert.match(ink[1], /\.902 \.6235 0 rg/); // #E69F00, page two
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

  test("measures every element of the body, whatever stands before the page's root", async () => {
    const { root, out, main } = copyWithMain((text) =>
      text
        .replace("<div\n", "<style>p { margin: 0 }</style>\n      <div\n")
        .replace("overflow: hidden; ", "")
        .replace("Page 1</h1>", `<span style="white-space: nowrap">${"W".repeat(120)}</span></h1>`),
    );
    const [result] = await renderSheets({ root, out });
    assert.match(
      result.error ?? "",
      new RegExp(`^${literal(main)}: the content runs past .* at the right$`),
    );
  });

  test("removes the PDF and PNG of a sheet that fails, also those of an earlier run", async () => {
    const { root, out, main } = copyWithMain();
    const [first] = await renderSheets({ root, out, pngWidth: 100 });
    assert.equal(first.error, undefined, first.error);
    writeFileSync(main, readFileSync(main, "utf8").replace("Page 1</h1>", "{{title}}</h1>"));
    const [second] = await renderSheets({ root, out, pngWidth: 100 });
    assert.ok(second.error, "the second render failed");
    assert.equal(existsSync(path.join(out, `${SHEET}.pdf`)), false);
    assert.equal(existsSync(path.join(out, `${SHEET}.png`)), false);
  });

  test("fails on a font that does not load", async () => {
    const { root, out, main } = copyWithMain();
    const modules = path.join(temporary, "broken-fonts", "node_modules");
    const fontDir = path.join(modules, "@fontsource", "source-sans-3");
    cpSync(path.join(NODE_MODULES, "@fontsource", "source-sans-3"), fontDir, { recursive: true });
    for (const file of readdirSync(path.join(fontDir, "files"))) {
      writeFileSync(path.join(fontDir, "files", file), "not a font");
    }
    const [result] = await renderSheets({ root, out, nodeModules: modules });
    assert.match(
      result.error ?? "",
      new RegExp(`^${literal(main)}: the fonts .*Source Sans 3.* did not load$`),
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

  test("draws the characters its fonts lack from the fallback, in text and generated content", async () => {
    const { root, out } = copyWithMain((text) =>
      text
        .replace(
          "<style>",
          '<style>h1::after { content: " ✓"; } p::before { content: "⇒ "; font-family: \'Source Sans 3\', Arial, sans-serif; }',
        )
        .replace("Page 1</h1>", "Page 1 → 2 → 3</h1>")
        .replace("that loads nothing.", "that loads nothing, ≥ 1 ★ 😀."),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    assert.deepEqual(result.warnings, []);
    const drawn = await fontCharacters(path.join(out, `${SHEET}.pdf`));
    assert.deepEqual(drawn.get("NotoSansMath-Regular"), new Set(["→", "≥", "⇒"]));
    assert.deepEqual(drawn.get("NotoSansSymbols2-Regular"), new Set(["✓", "★"]));
    assert.deepEqual(drawn.get("NotoEmoji-Regular"), new Set(["😀"]));
    assert.ok(
      [...drawn.keys()].every((font) => /^(SourceSans3|Noto)/.test(font)),
      `fonts embedded: ${[...drawn.keys()].join(", ")}`,
    );
  });

  test("draws a character the page's fonts hold from them, not from the fallback", async () => {
    // Source Sans 3 and the fallback both hold each of these characters.
    const { root, out } = copyWithMain((text) => text.replace("Page 1</h1>", "Page 1 ′ • ™</h1>"));
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    assert.deepEqual(result.warnings, []);
    const drawn = await fontCharacters(path.join(out, `${SHEET}.pdf`));
    assert.deepEqual(drawn.get("SourceSans3ExtraLight-Bold"), new Set(["′", "•", "™"]));
    assert.ok(
      [...drawn.keys()].every((font) => !font.startsWith("Noto")),
      `fonts embedded: ${[...drawn.keys()].join(", ")}`,
    );
  });

  test("draws a character from a later family of the font-family list that holds it, before the fallback", async () => {
    // Zilla Slab lacks these characters, Source Sans 3 and Noto Sans Math hold them.
    const { root, out } = copyWithMain((text) =>
      text
        .replace(
          "family=Source+Sans+3:ital,wght@0,400;0,700;1,400",
          "family=Source+Sans+3:ital,wght@0,400;0,700;1,400&amp;family=Zilla+Slab:wght@700",
        )
        .replace(
          '<h1 style="margin: 0;',
          "<h1 style=\"margin: 0; font-family: 'Zilla Slab', 'Source Sans 3', serif;",
        )
        .replace("Page 1</h1>", "Page 1 ′ ″ ∕ →</h1>"),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    assert.deepEqual(result.warnings, []);
    const drawn = await fontCharacters(path.join(out, `${SHEET}.pdf`));
    assert.deepEqual(drawn.get("SourceSans3ExtraLight-Bold"), new Set(["′", "″", "∕"]));
    assert.deepEqual(drawn.get("NotoSansMath-Regular"), new Set(["→"]));
  });

  test("warns once per page on each character neither its fonts nor the fallback hold, and prints the sheet", async () => {
    const { root, out, main } = copyWithMain((text) =>
      text
        .replace("Page 1</h1>", `Page 1 ${PRIVATE_USE_2} ${PRIVATE_USE}</h1>`)
        .replace("that loads nothing.", `that loads nothing ${PRIVATE_USE} →.`),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    assert.deepEqual(result.warnings, [
      `${main}: draws U+E000 ${PRIVATE_USE} in a font neither the page nor the fallback loads`,
      `${main}: draws U+E001 ${PRIVATE_USE_2} in a font neither the page nor the fallback loads`,
    ]);
    assert.equal(existsSync(path.join(out, `${SHEET}.pdf`)), true);
  });

  test("warns on a character of generated content that neither its fonts nor the fallback hold", async () => {
    const { root, out, main } = copyWithMain((text) =>
      text.replace("<style>", '<style>h1::before { content: "\\E000 "; }'),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    assert.deepEqual(result.warnings, [
      `${main}: draws U+E000 ${PRIVATE_USE} in a font neither the page nor the fallback loads`,
    ]);
  });

  test("warns on a character that none of the families it loads nor the fallback hold, whatever the fonts of the machine", async () => {
    const { root, out, main } = copyWithMain((text) =>
      text
        .replace(
          "family=Source+Sans+3:ital,wght@0,400;0,700;1,400",
          "family=Source+Sans+3:ital,wght@0,400;0,700;1,400&amp;family=Zilla+Slab:wght@700",
        )
        .replace(
          '<h1 style="margin: 0;',
          "<h1 style=\"margin: 0; font-family: 'Zilla Slab', Georgia, serif;",
        )
        .replace("Page 1</h1>", "Page 1 Ω</h1>"),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    assert.deepEqual(result.warnings, [
      `${main}: draws U+03A9 Ω in a font neither the page nor the fallback loads`,
    ]);
  });

  test("passes characters that a later family of the font-family list covers, and those that draw nothing", async () => {
    const { root, out } = copyWithMain((text) =>
      text
        .replace(
          "family=Source+Sans+3:ital,wght@0,400;0,700;1,400",
          "family=Source+Sans+3:ital,wght@0,400;0,700;1,400&amp;family=Zilla+Slab:wght@700",
        )
        .replace(
          '<h1 style="margin: 0;',
          "<h1 style=\"margin: 0; font-family: 'Zilla Slab', 'Source Sans 3', serif;",
        )
        .replace("Page 1</h1>", `“Page 1” Ω&nbsp;${ZERO_WIDTH_SPACE}${SOFT_HYPHEN}</h1>`),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    assert.deepEqual(result.warnings, []);
    assert.equal(existsSync(path.join(out, `${SHEET}.pdf`)), true);
  });

  test("looks only at text whose visibility is visible", async () => {
    const { root, out } = copyWithMain((text) =>
      text.replace(
        "Page 1</h1>",
        `Page 1<span style="visibility: hidden">${PRIVATE_USE}</span><span style="display: none">${PRIVATE_USE_2}</span></h1>`,
      ),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    assert.deepEqual(result.warnings, []);
  });

  test("looks at the first letter that a ::first-letter rule sets apart", async () => {
    const { root, out, main } = copyWithMain((text) =>
      text
        .replace(
          "<style>",
          "<style>h1::first-letter { font-size: 60px; } p::first-letter { font-size: 30px; font-family: 'Source Sans 3', Arial, sans-serif; }",
        )
        .replace('700">Page 1</h1>', `700">${PRIVATE_USE}Page 1</h1>`)
        .replace('16px">', '16px">→ '),
    );
    const [result] = await renderSheets({ root, out });
    assert.equal(result.error, undefined, result.error);
    assert.deepEqual(result.warnings, [
      `${main}: draws U+E000 ${PRIVATE_USE} in a font neither the page nor the fallback loads`,
    ]);
    const drawn = await fontCharacters(path.join(out, `${SHEET}.pdf`));
    assert.deepEqual(drawn.get("NotoSansMath-Regular"), new Set(["→"]));
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

describe("the command", () => {
  const run = (args, env = {}) =>
    spawnSync(process.execPath, [RENDER, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
  const out = () => path.join(temporary, `command-${copies++}`);

  test("exits 0 and prints each PDF and the number of sheets rendered", () => {
    const folder = out();
    const result = run(["--root", FIXTURES, "--out", folder]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout,
      `${path.join(folder, `${SHEET}.pdf`)}: 2 pages\n1 of 1 sheet rendered to ${folder}\n`,
    );
  });

  test("exits 1 on a name that is not a sheet folder", () => {
    const result = run(["--root", FIXTURES, "--out", out(), "no-such-sheet"]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, `${FIXTURES} holds no sheet no-such-sheet\n`);
  });

  test("exits 1 on a sheet that fails", () => {
    const { root, out: folder } = copyWithMain((text) => text.replace("Page 1</h1>", "{{x}}</h1>"));
    const result = run(["--root", root, "--out", folder]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /is not static: holds a hole/);
    assert.equal(result.stdout, `0 of 1 sheet rendered to ${folder}\n`);
  });

  test("exits 0 and warns on stderr where a page draws a character neither its fonts nor the fallback hold", () => {
    const {
      root,
      out: folder,
      main,
    } = copyWithMain((text) => text.replace("Page 1</h1>", `Page 1 ${PRIVATE_USE} →</h1>`));
    const result = run(["--root", root, "--out", folder]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stderr,
      `${main}: draws U+E000 ${PRIVATE_USE} in a font neither the page nor the fallback loads\n`,
    );
    assert.equal(
      result.stdout,
      `${path.join(folder, `${SHEET}.pdf`)}: 2 pages\n1 of 1 sheet rendered to ${folder}\n`,
    );
    assert.equal(existsSync(path.join(folder, `${SHEET}.pdf`)), true);
  });

  test("exits 1, naming the fix, where no browser starts", () => {
    const result = run(["--root", FIXTURES, "--out", out()], { CHROME_PATH: "/nonexistent" });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /^no browser: run npx playwright install chromium or set CHROME_PATH/,
    );
  });

  for (const args of [
    ["--pages"],
    ["--png-width", "abc"],
    ["--png-width", "0"],
    ["--png-width", "1.5"],
    ["--png-width", "16385"],
    ["--root", "no-such-folder"],
  ]) {
    test(`exits 2 on ${args.join(" ")}`, () => {
      const result = run([...args, "--out", out()]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /usage: render-sheets\.mjs/);
    });
  }
});

// The characters each font of a PDF draws, by font name, from its ToUnicode map.
async function fontCharacters(file) {
  const pdf = await PDFDocument.load(readFileSync(file));
  const fonts = new Map();
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    const base = object.get(PDFName.of("BaseFont"));
    const map = object.get(PDFName.of("ToUnicode"));
    if (!(base instanceof PDFName) || !map) continue;
    const cmap = inflateSync(Buffer.from(pdf.context.lookup(map).getContents())).toString("latin1");
    const characters = new Set();
    const text = (hex) => Buffer.from(hex, "hex").swap16().toString("utf16le");
    // A bfchar line maps one glyph, a bfrange line consecutive glyphs to
    // consecutive characters, such as <0101> <0102> <2032> for ′ and ″.
    const mapped = [];
    for (const [, hex] of cmap.matchAll(/^<[0-9A-Fa-f]+>\s*<([0-9A-Fa-f]+)>\s*$/gm)) {
      mapped.push(text(hex));
    }
    for (const [, low, high, hex] of cmap.matchAll(
      /^<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*$/gm,
    )) {
      const first = text(hex).codePointAt(0);
      for (let glyph = 0; glyph <= Number.parseInt(high, 16) - Number.parseInt(low, 16); glyph++) {
        mapped.push(String.fromCodePoint(first + glyph));
      }
    }
    for (const character of mapped) {
      // A font can map a glyph it never draws to the noncharacter U+FFFF.
      if (character.codePointAt(0) > 0x7e && !/\p{Noncharacter_Code_Point}/u.test(character)) {
        characters.add(character);
      }
    }
    const name = base.decodeText().split("+").pop();
    fonts.set(name, new Set([...(fonts.get(name) ?? []), ...characters]));
  }
  return fonts;
}

function literal(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
