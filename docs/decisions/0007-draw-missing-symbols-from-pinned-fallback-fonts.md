# 0007: Draw the symbols a page's fonts lack from pinned fallback fonts, and warn on what they lack

This record states where a sheet's PDF takes a character from that no font its page loads holds, and why, for whoever writes the renderer or archives a sheet.

Status: accepted.

## Context

A page loads its fonts from Fontsource packages, as [decision 0002](0002-render-with-chromium-and-fontsource.md) records. A Fontsource package splits a family into [subsets that its CSS loads by `unicode-range`](https://fontsource.org/docs/getting-started/subsets), so a page's family holds the letters of its subsets but often not an arrow, a mathematical sign, a check mark or an emoji. Chromium then draws such a character from whatever font the machine has, so the same sheet printed in CI, in a Claude cloud workspace and on a Mac shows it in different fonts, or not at all. Four sheets of `sheets/` draw "→" (U+2192), and one of them also "≥" (U+2265), from such a font, as [issue #25](https://github.com/tiavelum/learning-sheets/issues/25) reports. A canvas on screen draws these characters in the viewer's own fonts, so the learning-sheet skill cannot see that a page's fonts lack them.

## Decision

As [issue #47](https://github.com/tiavelum/learning-sheets/issues/47) settles:

- The renderer adds three fallback fonts, each the regular weight of a Fontsource package pinned in `package-lock.json`: Noto Sans Math for arrows and mathematical signs, Noto Sans Symbols 2 for check marks, stars, warning signs, shapes and other symbols, and Noto Emoji, the black-and-white emoji. Each is a family of its own, limited to the characters its files hold within the ranges of punctuation, symbols and emoji. Before a page is measured and printed, the renderer puts the three families into every computed `font-family` list of the page, right after the last family of the list that the page loads, or at the end of a list that names none. So the page's font list ends, for Chromium, in the fallback rather than in the machine's fonts: a character that any family of the list that the page loads holds is drawn from that family, and one that none of them holds is drawn from the fallback.
- A character that neither the page's fonts nor the fallback hold does not fail the sheet: the renderer writes the PDF and names the character on stderr, one line per character and page, whether a font of the machine draws it or none does.
- Letters of other scripts, such as Greek, Cyrillic or Chinese, are not in the fallback's ranges; a sheet that uses them takes a family whose package holds them.

[`scripts/README.md`](../../scripts/README.md#render-sheetsmjs) gives the ranges and the warning.

## Alternatives considered

- **Fail a sheet whose page draws a character its fonts lack.** Every sheet with such a character would need a change on its canvas before it could be archived, including the four sheets already here, although the canvas shows the character and the person asked for it.
- **Leave the character to the machine's fonts.** A PDF would differ from machine to machine, and a release would print what CI's runner image happens to hold.
- **Noto Color Emoji in place of Noto Emoji.** Chromium embeds its glyphs in the PDF as a Type 3 font, while Noto Emoji embeds as outlines, as every other font of a sheet does.
- **Only Noto Sans Symbols 2 and Noto Emoji.** The files of Noto Sans Symbols 2 hold neither "→" nor "≥" although its CSS declares them, so the four sheets would still print them from a font of the machine; Noto Sans Math holds both.
- **The fallback fonts as further faces of every family a page loads.** A character that the first family of a list lacks would be drawn from the fallback faces of that family before a later family of the list that holds it, such as "′" in `'Zilla Slab', 'Source Sans 3', serif`, so a sheet that prints the same today would change.
- **The fallback families at the very end of each `font-family` list.** The lists of the sheets end in names such as `Arial` and `sans-serif`, which stand for fonts of the machine, so "→" would still be drawn from one of those wherever the machine has it.
- **The fallback families written into the `font-family` lists of the page files.** The page files stay as the canvas wrote them ([decision 0001](0001-keep-each-sheet-as-its-canvas-files.md)), so the renderer changes the lists in the browser, after the cascade, and no file.

## Consequences

- "→", "≥", "✓", "★" and most emoji print from the same pinned fonts on every machine, and a character that a page's fonts hold prints as before.
- An emoji written with U+FE0F, which asks for the colour form, is not drawn from Noto Emoji where the machine has a colour emoji font: it prints from that font, with a warning.
- The repository depends on three more font packages, which no page asks for and which the check of the sheet folders does not require.
