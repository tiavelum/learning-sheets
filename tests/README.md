# Tests

This folder holds the tests of the scripts in [`scripts/`](../scripts/README.md) and the sheet they run on, for whoever changes those scripts.

| Path                                    | Holds                                                                                                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-sheets.test.mjs`                 | The tests of the check: the folder-name rule on a set of titles, the page order, and each check on a copy of the fixture sheet that one change breaks                                                                                                |
| `render-sheets.test.mjs`                | The tests of the renderer: the page count and page size of the fixture's PDF and PNG, a font from a variable package, and the failures on content past the frame and on a network request                                                            |
| `build-site.test.mjs`                   | The tests of the page build: the release lookup with a stubbed fetch, with a release, with none and unreachable, the catalog of the fixture sheet, a root with no sheet, and the built page in Chromium filtered by text and tag and sorted by title |
| `fixtures/sheets/`                      | A sheets root that holds the fixture sheet, the only content of `fixtures/`                                                                                                                                                                          |
| `fixtures/sheets/two-pages-of-squares/` | A sheet that follows [the contract of a sheet folder](../sheets/README.md), two A4 pages in Source Sans 3                                                                                                                                            |

The fixture's page files are written for the tests, not by a Design canvas, so Biome formats and lints them as it does every other file.

Run the tests from the root of the repository:

```bash
npm test
```

The tests of the renderer and of the page build launch the browser that `render-sheets.mjs` uses, so Chromium is installed first, as the root README's "Getting started" shows. The run ends with the number of tests that passed and failed:

```text
# pass 81
# fail 0
```
