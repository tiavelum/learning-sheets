# learning-sheets

The source of the printable learning sheets made with the learning-sheet skill of
[tiavelum/claude-setup](https://github.com/tiavelum/claude-setup), each kept with
what it was asked to cover and the version of the skill that made it, for anyone
who wants to find, print or change a sheet and for the sessions that archive them.

## Getting started

Each sheet stands in a folder of its own in [`sheets/`](sheets/README.md), named after the sheet, so the listing of `sheets/` gives every sheet's name; what a sheet folder holds, field by field, is in [`sheets/README.md`](sheets/README.md).

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

It prints the number of sheets it checked, such as `12 sheets in sheets, no violation`; [`scripts/README.md`](scripts/README.md#check-sheetsmjs) gives what it prints on a violation and its exit status.

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

Open `https://tiavelum.github.io/learning-sheets/` in a browser. The page lists every sheet of `main` with its title, topic, tags, language, paper, the dates on which it was created and last modified, and a small image of its page one, filters them by words in the title and topic, by tag and by language, and sorts them by the date of their last change or by title. Each sheet links to its PDF in the latest release, or says "PDF not released yet", to its folder on GitHub and to its Design canvas. Beside the page, `https://tiavelum.github.io/learning-sheets/catalog.json` lists every sheet's folder name, front matter and links as data. [Decision 0004](docs/decisions/0004-publish-the-browse-page-on-github-pages.md) records why the page is built this way.

The page is served once GitHub Pages publishes from the workflow `.github/workflows/pages.yml`, which a maintainer enables once, by hand, with [the REST API's call that creates a Pages site](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site) built by a workflow. In a terminal where the GitHub CLI `gh` is logged in as the maintainer, run:

```bash
gh api --method POST repos/tiavelum/learning-sheets/pages -f build_type=workflow
```

It prints the Pages site as JSON, with `"build_type": "workflow"`. If it fails with HTTP 409 (Conflict), a Pages site probably exists already; switch it to the workflow with [the call that updates the site](https://docs.github.com/en/rest/pages/pages#update-information-about-a-github-pages-site), which prints nothing and exits with status 0:

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

From a terminal where the GitHub CLI `gh` is logged in with write access to the repository, [`gh workflow run`](https://cli.github.com/manual/gh_workflow_run) starts the same run:

```bash
gh workflow run release.yml --repo tiavelum/learning-sheets --ref main
```

It prints `✓ Created workflow_dispatch event for release.yml at main`, and the run then appears under Actions as one started with the button.

The run checks and renders every sheet of `main` and publishes one release tagged with the date and time in UTC, to the minute, at which the run began its work, such as `2026-11-03-1430`, and titled "Learning sheets 2026-11-03 14:30 UTC". Open `https://github.com/tiavelum/learning-sheets/releases`: the new release stands at the top, marked "Latest", and holds:

- `<name>.pdf` for each sheet, named after its folder in [`sheets/`](sheets/README.md), such as `login-methods-and-recovery.pdf`;
- `learning-sheets-<tag>.zip` with every PDF;
- `catalog.json`, every sheet's front matter and its links at that release.

Its notes give the number of sheets and the titles of the sheets added, changed and removed since the release before, each sheet added or changed with the date it was last modified, as [`scripts/README.md`](scripts/README.md#prepare-releasemjs) describes. `https://github.com/tiavelum/learning-sheets/releases/latest/download/<name>.pdf` gives a sheet's PDF in whichever release is the latest, the form of [a link to an asset of the latest release](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases). After the release, the run rebuilds [the browse page](#browse-the-sheets), whose links then lead to the new PDFs.

A run makes no release, and shows a red cross, where `sheets/` holds no sheet, where a check fails or a sheet does not render, where it was started on a branch other than `main`, or where a release was made in the same minute. A red cross on the last job, `Rebuild the browse page`, leaves the release made; run the workflow "Pages" with "Run workflow" to rebuild the page. Click the run, then the job with the red cross: the step with the red cross names the reason in its log, such as the sheet that did not render and why. After a release in the same minute, run the workflow again a minute later. A run started while another is in progress waits for it, and of several runs waiting, only the one started last goes ahead, as [GitHub's guide to concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) describes for a group's pending runs. [Decision 0003](docs/decisions/0003-release-every-pdf-from-a-dispatched-workflow.md) records why releases are made this way.

## Archive a sheet

1. In a clone set up as [Getting started](#getting-started) shows, with push access to this repository, start from the latest `main`:

   ```bash
   git switch main
   git pull
   npm ci
   ```

2. List the sheets already archived, with the title and topic of each:

   ```bash
   grep -H -e '^title:' -e '^topic:' sheets/*/README.md
   ```

   It prints the `title` and `topic` of every sheet, each after its README's path, whose folder name is the sheet's name. Where one of them is on the topic of the new sheet, ask the person whether the new sheet is a new version of that sheet or a variant beside it, the choice that [Folder name](sheets/README.md#folder-name) describes:
   - **A new version.** Give the canvas the title of that sheet, as the next paragraph gives, and archive it as step 4 of [Change a sheet](#change-a-sheet) gives, with this canvas as the sheet's `artifact`.
   - **A variant.** Go on as for any new sheet, with a name that says what sets the variant apart.

   The sheet's folder name is the one that [Folder name](sheets/README.md#folder-name) gives for the canvas's title, here `login-methods-and-recovery`. For a new sheet or a variant, where the canvas's title does not take the form that [Front matter](sheets/README.md#front-matter) gives for `title`, or the list names its folder name, choose with the person a title in that form whose folder name is free, one that says what sets the new sheet apart as [Folder name](sheets/README.md#folder-name) gives. For a new version the title is that of the existing sheet, which the list names. Give the canvas the chosen title, or the existing sheet's, by changing `title` in its `project/canvas.json` with the Artifact tool, as the Design type's "Revising a canvas" says. The reply of the next `read` then names the new `title`; where it does not, ask the person to rename the artifact to it.

3. Open an issue in this repository titled `Archive the learning sheet login-methods-and-recovery`, whose description says what and why and when it is done:

   ```markdown
   Archive the learning sheet `login-methods-and-recovery` from [its canvas](https://claude.ai/artifact/Dcqoruumq3zMKKfUJWJ26Q) in `sheets/login-methods-and-recovery/`, so that it outlives its session and its artifact.

   Done when the pull request that adds `sheets/login-methods-and-recovery/` is merged.
   ```

4. Create the branch for the issue, here number 21, with the folder name cut to its first four words, since [NAM-12](https://github.com/tiavelum/engineering-standards/blob/main/standards/naming.md#nam-12) allows five words after the number:

   ```bash
   git switch -c "feat/21-add-$(echo login-methods-and-recovery | cut -d- -f1-4)"
   ```

5. With the Artifact tool, `read` the canvas's `project/canvas.json`, with `out_dir` set to the absolute path of the sheet folder, `sheets/login-methods-and-recovery`, so that the tool saves it as `sheets/login-methods-and-recovery/project/canvas.json`. List the pages it names:

   ```bash
   node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).boards).join("\n"))' sheets/login-methods-and-recovery/project/canvas.json
   ```

   It prints one file name per page, such as `Main.dc.html` and `Details.dc.html`. `read` each of them as `project/<page>` in one call with the same `out_dir`. Keep the reply's `url`, `title` and `ver`; where the `ver` of the second read differs from the first, the canvas changed between them, so read all its files again. Where the tool takes no `out_dir` and saves the files in the canvas's own folder, the reply's `saved_dir`, copy them from there with the shell, since a file tool would write them anew, here from the folder the Claude app gives the canvas:

   ```bash
   mkdir -p sheets/login-methods-and-recovery
   cp -R /mnt/user-data/outputs/artifacts/Dcqoruumq3zMKKfUJWJ26Q/project sheets/login-methods-and-recovery/
   ```

   [Page files](sheets/README.md#page-files) gives what these files are and how they are kept.

6. Confirm that the files hold the bytes the canvas holds:

   ```bash
   sha256sum sheets/login-methods-and-recovery/project/*
   ```

   Each line's hash equals the `sha256` that the Artifact tool reported for that path. On a Mac, this prints the same:

   ```bash
   shasum -a 256 sheets/login-methods-and-recovery/project/*
   ```

7. Find the commit of the skill that made the sheet. Clone tiavelum/claude-setup and save the copy of the learning-sheet skill the session loaded, here from the skills folder of a Claude cloud workspace; elsewhere, save the `SKILL.md` the session read with its file tool:

   ```bash
   git clone https://github.com/tiavelum/claude-setup.git /tmp/claude-setup
   cp /mnt/skills/user/learning-sheet/SKILL.md /tmp/learning-sheet-skill.md
   ```

   In `/tmp/claude-setup`, run the command of [Front matter](sheets/README.md#front-matter) that prints the commit, such as `24b49de`, and do what it says where it prints nothing.

8. Write `sheets/login-methods-and-recovery/README.md` as [The sheet README](sheets/README.md#the-sheet-readme) and [Front matter](sheets/README.md#front-matter) give: `title` from the `title` of `project/canvas.json`, `artifact` from its `url`, `artifact_version` from its `ver`, `skill_version` as `tiavelum/claude-setup@` and the commit from step 7, `paper` from the board sizes, `topic`, `tags` and `language` from the sheet, the request under `## Request` from the person's prompt as [The sheet README](sheets/README.md#the-sheet-readme) gives, and `created` and `last_modified` both as this command prints it on the day the session hands the sheet over:

   ```bash
   date -u +%F
   ```

9. Run the checks and render the sheet:

   ```bash
   npx biome ci .
   npm test
   npm run check
   npm run render -- login-methods-and-recovery
   ```

   Biome ends with `No fixes applied.`, the tests with a summary that holds `fail 0`, the check with the number of sheets and `no violation`, and the render with `build/login-methods-and-recovery.pdf: 2 pages`, the number of pages the canvas has, and `1 of 1 sheet rendered to build`. Open the PDF: each page shows what the canvas shows. Where Biome reports the sheet's README, this rewrites it in Biome's form and leaves the canvas files as they are:

   ```bash
   npm run format
   ```

   Where the check or the render reports a page, change the page on the canvas and go back to step 5; [`scripts/README.md`](scripts/README.md) explains each message.

10. Commit the sheet folder and push the branch:

    ```bash
    git add sheets/login-methods-and-recovery
    git commit -m 'feat: add the learning sheet login-methods-and-recovery' -m "Archives version 1793715998-6304 of the canvas with the sheet's README, so that the sheet outlives its session and its artifact."
    git push -u origin feat/21-add-login-methods-and-recovery
    ```

11. Open a pull request from the branch, titled `feat: add the learning sheet login-methods-and-recovery`, with this description, and in its two `<details>` the person's prompt as [The prompt](sheets/README.md#the-prompt) gives and the lines that step 6 printed:

    ````markdown
    Add the learning sheet `login-methods-and-recovery`, read from version 1793715998-6304 of [its canvas](https://claude.ai/artifact/Dcqoruumq3zMKKfUJWJ26Q), so that it outlives its session and its artifact.

    Closes #21 (Archive the learning sheet login-methods-and-recovery)

    To check, open the artifact `sheets` of this pull request's check run: its `login-methods-and-recovery.pdf` shows the pages of the canvas.

    <details>
    <summary>The prompt</summary>

    ```text
    Well, I'd like you to create for me a handout that I can print. So not just an MD file that lists all those items and explains them, puts them in relation, and also has a analogy like in normal life, like in the way of a two or three sentence explanation ready for each of those variants. Could you please create something like that for me?
    ```

    </details>

    <details>
    <summary>The sha256 of each canvas file</summary>

    ```text
    d170548d32add08f5d084804b920190596453ed49e0ac53cacfab3992e9b7814  sheets/login-methods-and-recovery/project/Details.dc.html
    8612403f9bc281b88832967ae77e3b9d099bb6f7e86c3374899e7c03118e51a2  sheets/login-methods-and-recovery/project/Main.dc.html
    e77588e8ad482f1eb112172a355a18fee5dd6b059a9ada9b0e2feb66825c95d0  sheets/login-methods-and-recovery/project/canvas.json
    ```

    </details>
    ````

    The title follows [GW-6](https://github.com/tiavelum/engineering-standards/blob/main/standards/git-workflow.md#gw-6) and [GW-7](https://github.com/tiavelum/engineering-standards/blob/main/standards/git-workflow.md#gw-7) and stays within 105 characters as [WR-5](https://github.com/tiavelum/engineering-standards/blob/main/standards/writing.md#wr-5) gives. The pull request's check run renders the sheet and attaches its PDF, as [Content and structure](#content-and-structure) gives for `.github/workflows/check.yml`.

## Change a sheet

1. In a clone on the latest `main`, as step 1 of "Archive a sheet" gives, find the sheet by its name or topic in the sheets' front matter:

   ```bash
   grep -H -e '^title:' -e '^topic:' sheets/*/README.md
   ```

   It prints the `title` and `topic` of every sheet, each after its README's path. Read the sheet's README and keep its `artifact` and `artifact_version`.

   Where this session archived the sheet itself and has changed its canvas since, wait until the pull request that archived it is merged, bring `main` up to date as step 1 of "Archive a sheet" gives, and go to step 4.

2. With the Artifact tool, `list` the files of the canvas at `artifact`, and compare the reply's `ver` with `artifact_version`:
   - **The same version.** The canvas holds the archived files: go to step 3.
   - **Another version.** Compare the `sha256` the reply gives for `project/canvas.json` and each page with what this prints for the sheet:

     ```bash
     sha256sum sheets/login-methods-and-recovery/project/*
     ```

     Where all are equal, go to step 3. Otherwise the canvas holds a version that is not archived: archive it first as step 4 gives, with an issue titled `Archive the newer version of the learning sheet login-methods-and-recovery`, and go on from step 3 once its pull request is merged.
   - **No canvas.** The Artifact tool finds no canvas at `artifact`: create a Design canvas with the sheet's `title`, as the Design type's "The canvas exists" says, and publish the archived `project/canvas.json` and every page to it unchanged, as the Design type's "The calls" says. Where the Artifact tool takes a `root`, `root` is the sheet folder, `file_path` is `sheets/login-methods-and-recovery/project/canvas.json` and `files` maps each page's `project/<page>` to the same path below the sheet folder; where it takes `files` as a list, copy the sheet's `project/` into the canvas's own folder first. Then `read` the new canvas's `project/canvas.json`: its `title` is the sheet's. The new canvas's link is the sheet's `artifact` from now on.

3. Change the pages on the canvas as the person asks, as the Design type's "Revising a canvas" says.

4. Archive the change as "Archive a sheet" gives from step 3 on, with these differences:
   - A change of title changes the folder name too, as [Folder name](sheets/README.md#folder-name) gives. Give the canvas the new title and take its folder name as step 2 of "Archive a sheet" gives, and use that name for the branch and for every later path.
   - The issue is titled after the change, such as `Archive the recovery codes added to login-methods-and-recovery`, and the branch is `feat/<issue>-change-` and the folder name's first four words.
   - Before step 5 of "Archive a sheet", remove the sheet's canvas files, so that a page the canvas no longer has goes too:

     ```bash
     git rm -q -r sheets/login-methods-and-recovery/project
     ```

     Where the title changes, move the folder after that, here to the folder name `login-methods-and-recovery-codes`:

     ```bash
     git mv sheets/login-methods-and-recovery sheets/login-methods-and-recovery-codes
     ```

   - In the README, as [Front matter](sheets/README.md#front-matter) gives, `created` stays as it is, `last_modified` takes the date that the command of step 8 of "Archive a sheet" prints on the day this session hands the change over, `skill_version` takes the commit that step 7 of "Archive a sheet" finds for the skill this session loaded, and `artifact` and `artifact_version` take the canvas's current link and version. The request stays as it is, unless the change changes what the sheet is asked to be, such as a further subject or another reader; then rewrite it as [The sheet README](sheets/README.md#the-sheet-readme) gives.
   - The pull request's title names the change, such as `feat: add the recovery codes to login-methods-and-recovery`, and its description quotes the prompt that asked for the change, as [The prompt](sheets/README.md#the-prompt) gives.

## Content and structure

| Path                            | Holds                                                                                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                     | This description                                                                                                                                                                                                                                     |
| `project-instructions.md`       | The rules a Claude session follows in this repository; after each change to it, the maintainer pastes its whole text into the instructions field of the claude.ai project "Learning Sheet", whose description field stays empty or holds a few words |
| `CLAUDE.md`                     | The file Claude Code reads in this repository: it imports `project-instructions.md` and adds what only Claude Code needs                                                                                                                             |
| [`sheets/`](sheets/README.md)   | One folder per learning sheet, with its README and its canvas files; its [README](sheets/README.md) states what a sheet folder holds and how it is named                                                                                             |
| [`scripts/`](scripts/README.md) | The scripts that check the sheet folders, render the sheets to PDF, build the browse page and write the notes of a release; its [README](scripts/README.md) gives their options, output and exit status                                              |
| [`site/`](site/README.md)       | The source of the browse page: its HTML, script and stylesheet, which `scripts/build-site.mjs` builds into the page; its [README](site/README.md) describes them                                                                                     |
| [`tests/`](tests/README.md)     | The tests of the scripts and the fixture sheet they run on; its [README](tests/README.md) lists them                                                                                                                                                 |
| `docs/`                         | The documentation beyond the READMEs: in `docs/decisions/`, the decision records that say why the sheets are kept, versioned, rendered, released, browsed and archived as they are                                                                   |
| `.github/workflows/check.yml`   | The checks every pull request and every push to `main` run: formatting and lint, the tests, the sheet check and the render of every sheet, whose PDFs it attaches to the run as the artifact `sheets`                                                |
| `.github/workflows/release.yml` | The release of every sheet's PDF, the zip of them all and the catalog, started by "Run workflow" under Actions, and the rebuild of the browse page after it                                                                                          |
| `.github/workflows/pages.yml`   | The build of the browse page on every push to `main`, on "Run workflow" and when the release workflow calls it, and its deployment to GitHub Pages where Pages publishes from GitHub Actions                                                         |
| `package.json`                  | The npm scripts `check`, `render`, `site`, `test`, `lint` and `format`, and the dependencies, with `package-lock.json` pinning their versions                                                                                                        |
| `biome.json`                    | The configuration of Biome, the formatter and linter of every file other than the canvas files that [Page files](sheets/README.md#page-files) keeps as the canvas wrote them                                                                         |
| `deviations.md`                 | The rules of tiavelum/engineering-standards that this repository deviates from, with the reason for each                                                                                                                                             |
| `LICENSE`                       | The MIT license of everything outside `sheets/`                                                                                                                                                                                                      |
| `.editorconfig`                 | The formatting rules that editors apply to every file                                                                                                                                                                                                |
| `.gitignore`                    | The files that tools write into the repository and that are not committed, such as `node_modules/`, and the rendered PDFs and the built page in `build/`                                                                                             |

## License

The sheets in [`sheets/`](sheets/README.md) are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.txt): anyone may print, share and adapt them when they credit the source, link the license and mark any change. See [sheets/LICENSE](sheets/LICENSE).
Everything else is licensed under MIT. See [LICENSE](LICENSE).
