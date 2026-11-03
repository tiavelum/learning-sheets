# learning-sheets

The source of the printable learning sheets made with the learning-sheet skill of
[tiavelum/claude-setup](https://github.com/tiavelum/claude-setup), each kept with
the prompt and the version of the skill that made it, for anyone who wants to find,
print or change a sheet and for the sessions that archive them.

## Getting started

The repository holds no sheet yet; [issue #1](https://github.com/tiavelum/learning-sheets/issues/1) tracks the work that adds the sheets, the releases of their PDFs and a page to browse them. What a sheet folder holds, field by field, is in [`sheets/README.md`](sheets/README.md).

This section checks and renders the sheets on your machine. It needs Node.js 22, the version CI pins being 22.23.4, npm 10, which comes with it, and git; the commands below ran with git 2.43.0. Playwright's Chromium runs on macOS and Linux; on Linux it also needs [the system packages that Playwright lists](https://playwright.dev/docs/browsers#install-system-dependencies).

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

On Linux, install the packages with the browser, as root:

```bash
npx playwright install --with-deps chromium
```

Where the Playwright download host cannot be reached and Chrome is installed, as in a Claude cloud workspace, leave out the browser install and name the Chrome program in `CHROME_PATH` when you render, as the last step of this section shows.

Check every sheet folder against [its contract](sheets/README.md):

```bash
npm run check
```

It prints `0 sheets in sheets, no violation`, since `sheets/` holds no sheet yet; [`scripts/README.md`](scripts/README.md#check-sheetsmjs) gives what it prints on a violation and its exit status.

Render the sheet that the tests use, which stands in [`tests/fixtures/sheets/`](tests/README.md) beside the sheets of `sheets/`:

```bash
npm run render -- --root tests/fixtures/sheets
```

It prints `build/two-pages-of-squares.pdf: 2 pages` and `1 of 1 sheet rendered to build`. Open `build/two-pages-of-squares.pdf`: it shows two A4 pages, "Page 1" with a blue square and "Page 2" with an orange one, in Source Sans 3. Without `--root`, the same command renders every sheet of `sheets/`; [`scripts/README.md`](scripts/README.md) gives every option of both scripts.

With Chrome in place of Playwright's Chromium, here at its path in a Claude cloud workspace:

```bash
CHROME_PATH=/usr/bin/google-chrome npm run render -- --root tests/fixtures/sheets
```

It prints the same two lines.

## Browse the sheets

Open `https://tiavelum.github.io/learning-sheets/` in a browser. The page lists every sheet of `main` with its title, topic, tags, language, paper, date and a small image of its page one, filters them by words in the title and topic, by tag and by language, and sorts them by date or by title. Each sheet links to its PDF in the latest release, or says "PDF not released yet", to its folder on GitHub and to its Design canvas. Beside the page, `https://tiavelum.github.io/learning-sheets/catalog.json` lists every sheet's folder name, front matter and links as data. [Decision 0004](docs/decisions/0004-publish-the-browse-page-on-github-pages.md) records why the page is built this way.

The page is served once GitHub Pages publishes from the workflow `.github/workflows/pages.yml`, which a maintainer enables once, by hand, with [the REST API's call that creates a Pages site](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site) built by a workflow. In a terminal where the GitHub CLI `gh` is logged in as the maintainer, run:

```bash
gh api --method POST repos/tiavelum/learning-sheets/pages -f build_type=workflow
```

It prints the Pages site as JSON, with `"build_type": "workflow"`. If it fails with HTTP 409, Pages is already enabled; switch it to the workflow with [the call that updates the site](https://docs.github.com/en/rest/pages/pages#update-information-about-a-github-pages-site), which prints nothing and exits with status 0:

```bash
gh api --method PUT repos/tiavelum/learning-sheets/pages -f build_type=workflow
```

Without a terminal, open Settings in the repository on GitHub, then Pages, and under "Build and deployment" set Source to "GitHub Actions", as [GitHub's guide to the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow) shows. Until then, each run of the workflow "Pages" builds the page and ends with the notice "Page not deployed", which says how to enable it. From then on, every push to `main` and every press of "Run workflow" for "Pages" under Actions deploys the page, and [the Pages settings link to the run that deployed it last](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow).

Build the page on your machine, after the steps of [Getting started](#getting-started), from the fixture sheet that [the tests](tests/README.md) use:

```bash
npm run site -- --root tests/fixtures/sheets
```

It prints `build/site/images/two-pages-of-squares.png: page one at 240 px`, a line saying which PDFs the latest release holds, such as `no release yet: every sheet shows as not released yet`, and `1 sheet built into build/site`. Open `build/site/index.html` in a browser: it shows the sheet `two-pages-of-squares` with the image of its page one, the tags "fixture" and "test", and "PDF not released yet". Without `--root`, the same command builds the page from every sheet of [`sheets/`](sheets/README.md); [`scripts/README.md`](scripts/README.md#build-sitemjs) gives its options.

## Release the PDFs

In the repository on GitHub, open Actions, click "Release" in the list of workflows on the left, then click "Run workflow" above the list of its runs, leave the branch at `main` and click "Run workflow" in the menu that opens, as [GitHub's guide to running a workflow by hand](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) shows; it takes write access to the repository. The run appears at the top of the list and, when it is done after a few minutes, shows a green check mark.

The run checks and renders every sheet of `main` and publishes one release tagged with the date and time in UTC, to the minute, at which the run began its work, such as `2026-11-03-1430`, and titled "Learning sheets 2026-11-03 14:30 UTC". Open `https://github.com/tiavelum/learning-sheets/releases`: the new release stands at the top, marked "Latest", and holds:

- `<name>.pdf` for each sheet, named after its folder in [`sheets/`](sheets/README.md), such as `logins-at-a-glance.pdf`;
- `learning-sheets-<tag>.zip` with every PDF;
- `catalog.json`, every sheet's front matter and its links at that release.

Its notes give the number of sheets and the titles of the sheets added, changed and removed since the release before, as [`scripts/README.md`](scripts/README.md#prepare-releasemjs) describes. `https://github.com/tiavelum/learning-sheets/releases/latest/download/<name>.pdf` gives a sheet's PDF in whichever release is the latest, the form of [a link to an asset of the latest release](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases). After the release, the run rebuilds [the browse page](#browse-the-sheets), whose links then lead to the new PDFs.

A run makes no release, and shows a red cross, where `sheets/` holds no sheet, where a check fails or a sheet does not render, where it was started on a branch other than `main`, or where a release was made in the same minute. A red cross on the last job, `Rebuild the browse page`, leaves the release made; run the workflow "Pages" with "Run workflow" to rebuild the page. Click the run, then the job with the red cross: the step with the red cross names the reason in its log, such as the sheet that did not render and why. After a release in the same minute, run the workflow again a minute later. A run started while another is in progress waits for it, and of several runs waiting, only the one started last goes ahead, as [GitHub's guide to concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) describes for a group's pending runs. [Decision 0003](docs/decisions/0003-release-every-pdf-from-a-dispatched-workflow.md) records why releases are made this way.

## Content and structure

| Path                            | Holds                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                     | This description                                                                                                                                                                                        |
| [`sheets/`](sheets/README.md)   | One folder per learning sheet, with its README and its canvas files; its [README](sheets/README.md) states what a sheet folder holds and how it is named                                                |
| [`scripts/`](scripts/README.md) | The scripts that check the sheet folders, render the sheets to PDF, build the browse page and write the notes of a release; its [README](scripts/README.md) gives their options, output and exit status |
| [`site/`](site/README.md)       | The source of the browse page: its HTML, script and stylesheet, which `scripts/build-site.mjs` builds into the page; its [README](site/README.md) describes them                                        |
| [`tests/`](tests/README.md)     | The tests of the scripts and the fixture sheet they run on; its [README](tests/README.md) lists them                                                                                                    |
| `docs/`                         | The documentation beyond the READMEs: in `docs/decisions/`, the decision records that say why the sheets are kept, rendered, released, browsed and archived as they are                                 |
| `.github/workflows/check.yml`   | The checks every pull request and every push to `main` run: formatting and lint, the tests, the sheet check and the render of every sheet, whose PDFs it attaches to the run as the artifact `sheets`   |
| `.github/workflows/release.yml` | The release of every sheet's PDF, the zip of them all and the catalog, started by "Run workflow" under Actions, and the rebuild of the browse page after it                                             |
| `.github/workflows/pages.yml`   | The build of the browse page on every push to `main`, on "Run workflow" and when the release workflow calls it, and its deployment to GitHub Pages where Pages publishes from GitHub Actions            |
| `package.json`                  | The npm scripts `check`, `render`, `site`, `test`, `lint` and `format`, and the dependencies, with `package-lock.json` pinning their versions                                                           |
| `biome.json`                    | The configuration of Biome, the formatter and linter of every file other than the canvas files that [Page files](sheets/README.md#page-files) keeps as the canvas wrote them                            |
| `deviations.md`                 | The rules of tiavelum/engineering-standards that this repository deviates from, with the reason for each                                                                                                |
| `LICENSE`                       | The MIT license of everything outside `sheets/`                                                                                                                                                         |
| `.editorconfig`                 | The formatting rules that editors apply to every file                                                                                                                                                   |
| `.gitignore`                    | The files that tools write into the repository and that are not committed, such as `node_modules/`, and the rendered PDFs and the built page in `build/`                                                |

## License

The sheets in [`sheets/`](sheets/README.md) are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.txt): anyone may print, share and adapt them when they credit the source, link the license and mark any change. See [sheets/LICENSE](sheets/LICENSE).
Everything else is licensed under MIT. See [LICENSE](LICENSE).
