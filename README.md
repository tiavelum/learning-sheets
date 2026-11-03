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

## Archive a sheet

1. In a clone set up as "Getting started" shows, with push access to this repository, start from the latest `main`:

   ```bash
   git switch main
   git pull
   npm ci
   ```

2. List the folder names that sheets already take:

   ```bash
   ls sheets
   ```

   Then print the folder name that the canvas's title gives, here for "Logins at a Glance", with the rule of [Folder name](sheets/README.md#folder-name) as [`scripts/`](scripts/README.md) implements it:

   ```bash
   node --input-type=module -e 'import { nameFromTitle } from "./scripts/sheet-files.mjs"; console.log(nameFromTitle(process.argv[1]))' "Logins at a Glance"
   ```

   It prints `logins-at-a-glance`. Where `ls sheets` lists that name, the title is taken: choose with the person a title that says what sets the new sheet apart, as [Folder name](sheets/README.md#folder-name) gives, and give the canvas that title by changing `title` in its `project/canvas.json` with the Artifact tool, as the Design type's "Revising a canvas" says. The reply of the next `read` then names the new `title`; where it does not, ask the person to rename the artifact to it.

3. Open an issue in this repository titled `Archive the learning sheet "Logins at a Glance"`, whose description says what and why and when it is done:

   ```markdown
   Archive the learning sheet "Logins at a Glance" from [its canvas](https://claude.ai/artifact/Dcqoruumq3zMKKfUJWJ26Q) in `sheets/logins-at-a-glance/`, so that it outlives its session and its artifact.

   Done when the pull request that adds `sheets/logins-at-a-glance/` is merged.
   ```

4. Create the branch for the issue, here number 21, with the folder name cut to its first four words, since [NAM-12](https://github.com/tiavelum/engineering-standards/blob/main/standards/naming.md#nam-12) allows five words after the number:

   ```bash
   git switch -c "feat/21-add-$(echo logins-at-a-glance | cut -d- -f1-4)"
   ```

5. With the Artifact tool, `read` the canvas's `project/canvas.json`, with `out_dir` set to the absolute path of the sheet folder, `sheets/logins-at-a-glance`, so that the tool saves it as `sheets/logins-at-a-glance/project/canvas.json`. List the pages it names:

   ```bash
   node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).boards).join("\n"))' sheets/logins-at-a-glance/project/canvas.json
   ```

   It prints one file name per page, such as `Main.dc.html` and `Details.dc.html`. `read` each of them as `project/<page>` in one call with the same `out_dir`. Keep the reply's `url`, `title` and `ver`; where the `ver` of the second read differs from the first, the canvas changed between them, so read all its files again. Where the tool takes no `out_dir` and saves the files in the canvas's own folder, the reply's `saved_dir`, copy them from there with the shell, since a file tool would write them anew, here from the folder the Claude app gives the canvas:

   ```bash
   mkdir -p sheets/logins-at-a-glance
   cp -R /mnt/user-data/outputs/artifacts/Dcqoruumq3zMKKfUJWJ26Q/project sheets/logins-at-a-glance/
   ```

   [Page files](sheets/README.md#page-files) gives what these files are and how they are kept.

6. Confirm that the files hold the bytes the canvas holds:

   ```bash
   sha256sum sheets/logins-at-a-glance/project/*
   ```

   Each line's hash equals the `sha256` that the Artifact tool reported for that path. On a Mac, this prints the same:

   ```bash
   shasum -a 256 sheets/logins-at-a-glance/project/*
   ```

7. Find the commit of the skill that made the sheet. Clone tiavelum/claude-setup and save the copy of the learning-sheet skill the session loaded, here from the skills folder of a Claude cloud workspace; elsewhere, save the `SKILL.md` the session read with its file tool:

   ```bash
   git clone https://github.com/tiavelum/claude-setup.git /tmp/claude-setup
   cp /mnt/skills/user/learning-sheet/SKILL.md /tmp/learning-sheet-skill.md
   ```

   In `/tmp/claude-setup`, run the command of [Front matter](sheets/README.md#front-matter) that prints the commit, such as `24b49de`, and do what it says where it prints nothing.

8. Write `sheets/logins-at-a-glance/README.md` as [The sheet README](sheets/README.md#the-sheet-readme) and [Front matter](sheets/README.md#front-matter) give: `title` from the `title` of `project/canvas.json`, `artifact` from its `url`, `artifact_version` from its `ver`, `skill` from step 7, and `made` as this command prints it on the day of the first hand-over:

   ```bash
   date -u +%F
   ```

9. Run the checks and render the sheet:

   ```bash
   npx biome ci .
   npm test
   npm run check
   npm run render -- logins-at-a-glance
   ```

   Biome ends with `No fixes applied.`, the tests with `# fail 0`, the check with the number of sheets and `no violation`, and the render with `build/logins-at-a-glance.pdf: 2 pages`, the number of pages the canvas has, and `1 of 1 sheet rendered to build`. Open the PDF: each page shows what the canvas shows. Where Biome reports the sheet's README, this rewrites it in Biome's form and leaves the canvas files as they are:

   ```bash
   npm run format
   ```

   Where the check or the render reports a page, change the page on the canvas and go back to step 5; [`scripts/README.md`](scripts/README.md) explains each message.

10. Commit the sheet folder and push the branch:

    ```bash
    git add sheets/logins-at-a-glance
    git commit -m 'feat: add the learning sheet "Logins at a Glance"' -m "Archives version 1793655646-5d0b of the canvas with the sheet's README, so that the sheet outlives its session and its artifact."
    git push -u origin feat/21-add-logins-at-a-glance
    ```

11. Open a pull request from the branch, titled `feat: add the learning sheet "Logins at a Glance"`, with this description, and in its `<details>` the lines that step 6 printed:

    ````markdown
    Add the learning sheet "Logins at a Glance", read from version 1793655646-5d0b of [its canvas](https://claude.ai/artifact/Dcqoruumq3zMKKfUJWJ26Q), so that it outlives its session and its artifact.

    Closes #21 (Archive the learning sheet "Logins at a Glance")

    To check, open the artifact `sheets` of this pull request's check run: its `logins-at-a-glance.pdf` shows the pages of the canvas.

    <details>
    <summary>The sha256 of each canvas file</summary>

    ```text
    d170548d32add08f5d084804b920190596453ed49e0ac53cacfab3992e9b7814  sheets/logins-at-a-glance/project/Details.dc.html
    8612403f9bc281b88832967ae77e3b9d099bb6f7e86c3374899e7c03118e51a2  sheets/logins-at-a-glance/project/Main.dc.html
    19e2222405727b857c8b14f2299a272f4d82eac95ae8120fea145919b437ad8b  sheets/logins-at-a-glance/project/canvas.json
    ```

    </details>
    ````

    The title follows [GW-6](https://github.com/tiavelum/engineering-standards/blob/main/standards/git-workflow.md#gw-6) and [GW-7](https://github.com/tiavelum/engineering-standards/blob/main/standards/git-workflow.md#gw-7) and stays within 105 characters. The check run renders every sheet and attaches the PDFs, as [`.github/workflows/check.yml`](.github/workflows/check.yml) does on every pull request.

## Change a sheet

1. In a clone on the latest `main`, as step 1 of "Archive a sheet" gives, find the sheet by its name or topic in the sheets' front matter:

   ```bash
   grep -H -e '^title:' -e '^topic:' sheets/*/README.md
   ```

   It prints the `title` and `topic` of every sheet, each after its README's path. Read the sheet's README and keep its `artifact` and `artifact_version`.

2. With the Artifact tool, `list` the files of the canvas at `artifact`, and compare the reply's `ver` with `artifact_version`:
   - **The same version.** The canvas holds the archived files: go to step 3.
   - **Another version.** Compare the `sha256` the reply gives for `project/canvas.json` and each page with what this prints for the sheet:

     ```bash
     sha256sum sheets/logins-at-a-glance/project/*
     ```

     Where all are equal, go to step 3. Otherwise the canvas holds a version that is not archived: archive it first as step 4 gives, with an issue titled `Archive the newer version of the learning sheet "Logins at a Glance"`, and go on from step 3 once its pull request is merged.
   - **No canvas.** The Artifact tool finds no canvas at `artifact`: create a Design canvas with the sheet's `title`, as the Design type's "The canvas exists" says, and publish the archived `project/canvas.json` and every page to it unchanged, as the Design type's "The calls" says. Where the Artifact tool takes a `root`, `root` is the sheet folder, `file_path` is `sheets/logins-at-a-glance/project/canvas.json` and `files` maps each page's `project/<page>` to the same path below the sheet folder; where it takes `files` as a list, copy the sheet's `project/` into the canvas's own folder first. Then `read` the new canvas's `project/canvas.json`: its `title` is the sheet's. The new canvas's link is the sheet's `artifact` from now on.

3. Change the pages on the canvas as the person asks, as the Design type's "Revising a canvas" says.

4. Archive the change as "Archive a sheet" gives from step 3 on, with these differences:
   - The issue is titled after the change, such as `Archive the recovery codes added to "Logins at a Glance"`, and the branch is `feat/<issue>-change-` and the folder name's first four words.
   - Before step 5, remove the sheet's canvas files, so that a page the canvas no longer has goes too:

     ```bash
     git rm -q -r sheets/logins-at-a-glance/project
     ```

   - In the README, `artifact` and `artifact_version` take the canvas's current link and version, and `made`, `skill` and the prompt stay as they are, as [Front matter](sheets/README.md#front-matter) gives; step 7 is left out.
   - A change of title changes the folder name too, as [Folder name](sheets/README.md#folder-name) gives.
   - The pull request's title names the change, such as `feat: add the recovery codes to "Logins at a Glance"`.

## Content and structure

| Path                            | Holds                                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                     | This description                                                                                                                                                                                      |
| `project-instructions.md`       | The rules a Claude session follows in this repository; after each change to it, the maintainer pastes its whole text into the instructions field of the claude.ai project "Learning Sheet"            |
| `CLAUDE.md`                     | The file Claude Code reads in this repository: it imports `project-instructions.md` and adds what only Claude Code needs                                                                              |
| [`sheets/`](sheets/README.md)   | One folder per learning sheet, with its README and its canvas files; its [README](sheets/README.md) states what a sheet folder holds and how it is named                                              |
| [`scripts/`](scripts/README.md) | The scripts that check the sheet folders and render the sheets to PDF; its [README](scripts/README.md) gives their options, output and exit status                                                    |
| [`tests/`](tests/README.md)     | The tests of the scripts and the fixture sheet they run on; its [README](tests/README.md) lists them                                                                                                  |
| `docs/`                         | The documentation beyond the READMEs: in `docs/decisions/`, the decision records that say why the sheets are kept, rendered, released, browsed and archived as they are                               |
| `.github/workflows/check.yml`   | The checks every pull request and every push to `main` run: formatting and lint, the tests, the sheet check and the render of every sheet, whose PDFs it attaches to the run as the artifact `sheets` |
| `package.json`                  | The npm scripts `check`, `render`, `test`, `lint` and `format`, and the dependencies, with `package-lock.json` pinning their versions                                                                 |
| `biome.json`                    | The configuration of Biome, the formatter and linter of every file other than the canvas files that [Page files](sheets/README.md#page-files) keeps as the canvas wrote them                          |
| `deviations.md`                 | The rules of tiavelum/engineering-standards that this repository deviates from, with the reason for each                                                                                              |
| `LICENSE`                       | The MIT license of everything outside `sheets/`                                                                                                                                                       |
| `.editorconfig`                 | The formatting rules that editors apply to every file                                                                                                                                                 |
| `.gitignore`                    | The files that tools write into the repository and that are not committed, such as `node_modules/` and the rendered PDFs in `build/`                                                                  |

## License

The sheets in [`sheets/`](sheets/README.md) are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.txt): anyone may print, share and adapt them when they credit the source, link the license and mark any change. See [sheets/LICENSE](sheets/LICENSE).
Everything else is licensed under MIT. See [LICENSE](LICENSE).
