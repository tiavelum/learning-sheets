# 0007: Draw the symbols a page's fonts lack from pinned fallback fonts, and warn on what they lack

This record states where a sheet's PDF takes a character from that no font its page loads holds, and why, for whoever writes the renderer or archives a sheet.

Status: accepted.

## Context

A page loads its fonts from Fontsource packages, as [decision 0002](0002-render-with-chromium-and-fontsource.md) records. A Fontsource package splits a family into [subsets that its CSS loads by `unicode-range`](https://fontsource.org/docs/getting-started/subsets), so a page's family holds the letters of its subsets but often not an arrow, a mathematical sign, a check mark or an emoji. Chromium then draws such a character from whatever font the machine has, so the same sheet printed in CI, in a Claude cloud workspace and on a Mac shows it in different fonts, or not at all. Four sheets of `sheets/` draw "→" (U+2192), and one of them also "≥" (U+2265), from such a font, as [issue #25](https://github.com/tiavelum/learning-sheets/issues/25) reports. A canvas on screen draws these characters in the viewer's own fonts, so the learning-sheet skill cannot see that a page's fonts lack them.

## Decision

As [issue #47](https://github.com/tiavelum/learning-sheets/issues/47) settles:

- The renderer adds three fallback fonts to every family a page loads, each the regular weight of a Fontsource package pinned in `package-lock.json`: Noto Sans Math for arrows and mathematical signs, Noto Sans Symbols 2 for check marks, stars, warning signs, shapes and other symbols, and Noto Emoji, the black-and-white emoji. Each joins a family as further `@font-face` rules with that family's descriptors, defined before the page's own and limited to the ranges of punctuation, symbols and emoji, so Chromium takes a character from a font of the page wherever one holds it, and from the fallback only where none does.
- A character that neither the page's fonts nor the fallback hold does not fail the sheet: the renderer writes the PDF and names the character on stderr, one line per character and page.
- Letters of other scripts, such as Greek, Cyrillic or Chinese, are not in the fallback's ranges; a sheet that uses them takes a family whose package holds them.

[`scripts/README.md`](../../scripts/README.md#render-sheetsmjs) gives the ranges and the warning.

## Alternatives considered

- **Fail a sheet whose page draws a character its fonts lack.** Every sheet with such a character would need a change on its canvas before it could be archived, including the four sheets already here, although the canvas shows the character and the person asked for it.
- **Leave the character to the machine's fonts.** A PDF would differ from machine to machine, and a release would print what CI's runner image happens to hold.
- **Noto Color Emoji in place of Noto Emoji.** Chromium embeds its glyphs in the PDF as a Type 3 font, which poppler's `pdftoppm` draws blank; Noto Emoji prints as outlines, as every other font does.
- **Only Noto Sans Symbols 2 and Noto Emoji.** The files of Noto Sans Symbols 2 hold neither "→" nor "≥" although its CSS declares them, so the four sheets would still print them from a font of the machine; Noto Sans Math holds both.
- **A fallback family named at the end of each `font-family` list.** The lists stand in the canvas files, which stay as the canvas wrote them ([decision 0001](0001-keep-each-sheet-as-its-canvas-files.md)), so the renderer would have to rewrite every `font-family` of each page's stylesheets and `style` attributes, where the added faces need none of them changed.

## Consequences

- "→", "≥", "✓", "★" and most emoji print from the same pinned fonts on every machine, and a character that a page's fonts hold prints as before.
- An emoji written with U+FE0F, which asks for the colour form, is not drawn from Noto Emoji and so prints from a font of the machine, with a warning.
- The repository depends on three more font packages, which no page asks for and which the check of the sheet folders does not require.
