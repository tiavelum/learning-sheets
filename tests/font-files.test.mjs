import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { fontFile } from "../scripts/font-files.mjs";

const NODE_MODULES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "node_modules");
const temporary = mkdtempSync(path.join(tmpdir(), "font-files-"));
after(() => rmSync(temporary, { recursive: true, force: true }));

describe("the font file reader", () => {
  test("reads the PostScript name and the characters of a static font", () => {
    const font = fontFile(
      path.join(
        NODE_MODULES,
        "@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff2",
      ),
    );
    assert.equal(font.name, "SourceSans3ExtraLight-Bold");
    for (const character of "Aa€′″∕™•") {
      assert.ok(font.characters.has(character.codePointAt(0)), character);
    }
    for (const character of ["→", "Ω", "\u{E000}"]) {
      assert.equal(font.characters.has(character.codePointAt(0)), false, character);
    }
  });

  test("reads a variable font, and a cmap above U+FFFF", () => {
    const variable = fontFile(
      path.join(NODE_MODULES, "@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2"),
    );
    assert.equal(variable.name, "ArchivoSemiBold-Regular");
    assert.ok(variable.characters.has(0x41));
    const emoji = fontFile(
      path.join(NODE_MODULES, "@fontsource/noto-emoji/files/noto-emoji-emoji-400-normal.woff2"),
    );
    assert.equal(emoji.name, "NotoEmoji-Regular");
    assert.ok(emoji.characters.has(0x1f600));
  });

  test("refuses a file that is not WOFF2", () => {
    const file = path.join(temporary, "not-a-font.woff2");
    writeFileSync(file, "not a font");
    assert.throws(() => fontFile(file), /is not a WOFF2 file/);
  });
});
