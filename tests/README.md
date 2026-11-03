# Tests

This folder holds the tests of the scripts in [`scripts/`](../scripts/README.md) and the sheet they run on, for whoever changes those scripts.

| Path                                    | Holds                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-sheets.test.mjs`                 | The tests of the check: the page order, each check on a copy of the fixture sheet that one change breaks, the listing in a git work tree, and the command's output and exit status                                                                                                                     |
| `render-sheets.test.mjs`                | The tests of the renderer: the page order, count and size of the fixture's PDF and PNG, a font from a variable package, the failures on content past the frame, on a font that does not load and on a network request, the removal of a failed sheet's files, and the command's output and exit status |
| `fixtures/sheets/`                      | A sheets root that holds the fixture sheet, the only content of `fixtures/`                                                                                                                                                                                                                            |
| `fixtures/sheets/two-pages-of-squares/` | A sheet that follows [the contract of a sheet folder](../sheets/README.md), two A4 pages in Source Sans 3                                                                                                                                                                                              |

The fixture's page files are written for the tests, not by a Design canvas, so Biome formats and lints them as it does every other file.

Run the tests from the root of the repository:

```bash
npm test
```

The renderer's tests launch the browser that `render-sheets.mjs` uses, so Chromium is installed first, as the root README's "Getting started" shows. The run ends with the number of tests that passed and failed:

```text
# pass 91
# fail 0
```
