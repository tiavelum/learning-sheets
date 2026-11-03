# learning-sheets

The source of the printable learning sheets made with the learning-sheet skill of
[tiavelum/claude-setup](https://github.com/tiavelum/claude-setup), each kept with
the prompt and the version of the skill that made it, for anyone who wants to find,
print or change a sheet and for the sessions that archive them.

## Getting started

The repository holds no sheet yet; [issue #1](https://github.com/tiavelum/learning-sheets/issues/1) tracks the work that adds the sheets, the releases of their PDFs and a page to browse them. What a sheet folder holds, field by field, is in [`sheets/README.md`](sheets/README.md).

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

## Browse the sheets

Open `https://tiavelum.github.io/learning-sheets/` in a browser. The page lists every sheet of `main` with its title, topic, tags, language, paper, date and a small image of its page one, filters them by words in the title and topic, by tag and by language, and sorts them by date or by title. Each sheet links to its PDF in the latest release, or says "PDF not released yet", to its folder on GitHub and to its Design canvas. Beside the page, `https://tiavelum.github.io/learning-sheets/catalog.json` lists every sheet's folder name, front matter and links as data. [Decision 0004](docs/decisions/0004-publish-the-browse-page-on-github-pages.md) records why the page is built this way.

The page is served once GitHub Pages publishes from the workflow `.github/workflows/pages.yml`, which a maintainer enables once, by hand: in the repository on GitHub, open Settings, then Pages, and under "Build and deployment" set Source to "GitHub Actions", as [GitHub's guide to the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow) shows. Until then, each run of the workflow "Pages" builds the page and ends with the notice "Page not deployed", which says how to enable it. From then on, every push to `main`, every release and every press of "Run workflow" for "Pages" under Actions deploys the page, and the Pages settings link to the run that deployed it last, as the same guide states.

Build the page on your machine, after the steps of [Getting started](#getting-started), from the fixture sheet that [the tests](tests/README.md) use:

```bash
npm run site -- --root tests/fixtures/sheets
```

It prints `build/site/images/two-pages-of-squares.png: page one at 240 px`, a line saying which PDFs the latest release holds, such as `no release yet: every sheet shows as not released yet`, and `1 sheet built into build/site`. Open `build/site/index.html` in a browser: it shows the sheet "Two Pages of Squares" with the image of its page one, the tags "fixture" and "test", and "PDF not released yet". Without `--root`, the same command builds the page from every sheet of [`sheets/`](sheets/README.md); [`scripts/README.md`](scripts/README.md#build-sitemjs) gives its options.

## Content and structure

| Path                            | Holds                                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                     | This description                                                                                                                                                                                      |
| [`sheets/`](sheets/README.md)   | One folder per learning sheet, with its README and its canvas files; its [README](sheets/README.md) states what a sheet folder holds and how it is named                                              |
| [`scripts/`](scripts/README.md) | The scripts that check the sheet folders, render the sheets to PDF and build the browse page; its [README](scripts/README.md) gives their options, output and exit status                             |
| [`site/`](site/README.md)       | The source of the browse page: its HTML, script and stylesheet, which `scripts/build-site.mjs` builds into the page; its [README](site/README.md) describes them                                      |
| [`tests/`](tests/README.md)     | The tests of the scripts and the fixture sheet they run on; its [README](tests/README.md) lists them                                                                                                  |
| `docs/`                         | The documentation beyond the READMEs: in `docs/decisions/`, the decision records that say why the sheets are kept, rendered, released, browsed and archived as they are                               |
| `.github/workflows/check.yml`   | The checks every pull request and every push to `main` run: formatting and lint, the tests, the sheet check and the render of every sheet, whose PDFs it attaches to the run as the artifact `sheets` |
| `.github/workflows/pages.yml`   | The build of the browse page on every push to `main`, on "Run workflow" and when the release workflow calls it, and its deployment to GitHub Pages where Pages publishes from GitHub Actions          |
| `package.json`                  | The npm scripts `check`, `render`, `site`, `test`, `lint` and `format`, and the dependencies, with `package-lock.json` pinning their versions                                                         |
| `biome.json`                    | The configuration of Biome, which formats and lints every file but the canvas files below `sheets/*/project/`                                                                                         |
| `deviations.md`                 | The rules of tiavelum/engineering-standards that this repository deviates from, with the reason for each                                                                                              |
| `LICENSE`                       | The MIT license of everything outside `sheets/`                                                                                                                                                       |
| `.editorconfig`                 | The formatting rules that editors apply to every file                                                                                                                                                 |
| `.gitignore`                    | The files that tools write into the repository and that are not committed, such as `node_modules/`, and the rendered PDFs and the built page in `build/`                                              |

## License

The sheets in [`sheets/`](sheets/README.md) are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.txt): anyone may print, share and adapt them when they credit the source, link the license and mark any change. See [sheets/LICENSE](sheets/LICENSE).
Everything else is licensed under MIT. See [LICENSE](LICENSE).
