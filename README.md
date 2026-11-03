# learning-sheets

The source of the printable learning sheets made with the learning-sheet skill of
[tiavelum/claude-setup](https://github.com/tiavelum/claude-setup), each kept with
the prompt and the version of the skill that made it, for anyone who wants to find,
print or change a sheet and for the sessions that archive them.

## Getting started

This section checks and renders the sheets on your machine. It needs Node.js 22, the version CI pins being 22.23.4, npm 10, which comes with it, and git. Playwright's Chromium runs on macOS and Linux; on Linux it also needs [the system packages that `npx playwright install --with-deps chromium` installs](https://playwright.dev/docs/browsers#install-system-dependencies), a command run as root.

Clone the repository and install its dependencies at the versions `package-lock.json` pins:

```bash
git clone https://github.com/tiavelum/learning-sheets.git
cd learning-sheets
npm ci
```

Install the Chromium that the pinned Playwright drives, which [Playwright keeps in its cache folder](https://playwright.dev/docs/browsers#managing-browser-binaries) outside the repository:

```bash
npx playwright install chromium
```

Where Chrome is already installed and the Playwright download host cannot be reached, as in a Claude cloud workspace, set `CHROME_PATH` to the Chrome program instead, and the renderer uses that one.

Check every sheet folder against [its contract](sheets/README.md):

```bash
npm run check
```

It prints the number of sheets it checked and `no violation`; on a violation it prints one line for each, the file first, and exits with status 1.

Render the sheet that the tests use, which stands in `tests/fixtures/sheets/` beside the sheets of `sheets/`:

```bash
npm run render -- --root tests/fixtures/sheets
```

It prints `build/two-pages-of-squares.pdf: 2 pages` and `1 of 1 sheet rendered to build`. Open `build/two-pages-of-squares.pdf`: it shows two A4 pages, "Page 1" with a blue square and "Page 2" with an orange one, in Source Sans 3. Without `--root`, the same command renders every sheet of `sheets/` into `build/`, one PDF per sheet named after its folder; [`scripts/README.md`](scripts/README.md) gives every option of both scripts.

## Content and structure

| Path                            | Holds                                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                     | This description                                                                                                                                                                                      |
| [`sheets/`](sheets/README.md)   | One folder per learning sheet, with its README and its canvas files; its [README](sheets/README.md) states what a sheet folder holds and how it is named                                              |
| [`scripts/`](scripts/README.md) | The scripts that check the sheet folders and render the sheets to PDF; its [README](scripts/README.md) gives their options, output and exit status                                                    |
| [`tests/`](tests/README.md)     | The tests of the scripts and the fixture sheet they run on; its [README](tests/README.md) lists them                                                                                                  |
| `docs/`                         | The documentation beyond the READMEs: in `docs/decisions/`, the decision records that say why the sheets are kept, rendered, released, browsed and archived as they are                               |
| `.github/workflows/check.yml`   | The checks every pull request and every push to `main` run: formatting and lint, the tests, the sheet check and the render of every sheet, whose PDFs it attaches to the run as the artifact `sheets` |
| `package.json`                  | The npm scripts `check`, `render`, `test`, `lint` and `format`, and the dependencies, with `package-lock.json` pinning their versions                                                                 |
| `biome.json`                    | The configuration of Biome, which formats and lints every file but the canvas files below `sheets/*/project/`                                                                                         |
| `deviations.md`                 | The rules of tiavelum/engineering-standards that this repository deviates from, with the reason for each                                                                                              |
| `.editorconfig`                 | The formatting rules that editors apply to every file                                                                                                                                                 |
| `.gitignore`                    | The files that tools write into the repository and that are not committed, such as `node_modules/` and the rendered PDFs in `build/`                                                                  |
