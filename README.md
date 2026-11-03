# learning-sheets

The source of the printable learning sheets made with the learning-sheet skill of
[tiavelum/claude-setup](https://github.com/tiavelum/claude-setup), each to be kept
with the prompt and the version of the skill that made it.

## Getting started

The repository holds no sheet yet. Read
[issue #1](https://github.com/tiavelum/learning-sheets/issues/1) first: it tracks
the work that adds the sheets, the releases of their PDFs and a page to browse them.

What a sheet folder holds, field by field, is in [`sheets/README.md`](sheets/README.md).

## Content and structure

| Path | Holds |
|---|---|
| `README.md` | This description |
| [`sheets/`](sheets/README.md) | One folder per learning sheet, with its README and its canvas files; its [README](sheets/README.md) states what a sheet folder holds and how it is named |
| `docs/` | The documentation beyond the READMEs: in `docs/decisions/`, the decision records that say why the sheets are kept, rendered, released, browsed and archived as they are |
| `deviations.md` | The rules of tiavelum/engineering-standards that this repository deviates from, with the reason for each |
| `.editorconfig` | The formatting rules that editors apply to every file |
| `.gitignore` | The files that tools write into the repository and that are not committed |
