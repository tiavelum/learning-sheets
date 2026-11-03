# Scripts

This folder holds the scripts that check the sheet folders, render the sheets to PDF, build the browse page and write the notes and catalog of a release, and this file describes what each does, its options, its output and its exit status, for whoever runs or changes them.

| File                  | Does                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-sheets.mjs`    | Checks every sheet folder against [the contract of a sheet folder](../sheets/README.md), run by `npm run check`                                    |
| `render-sheets.mjs`   | Renders each sheet to one PDF, and on request a PNG of its first page, run by `npm run render`                                                     |
| `build-site.mjs`      | Builds the browse page from the page's source in [`site/`](../site/README.md), the sheet READMEs and the images of page one, run by `npm run site` |
| `prepare-release.mjs` | Writes the notes and `catalog.json` of a release, run by [the release workflow](../README.md#release-the-pdfs)                                     |
| `sheet-files.mjs`     | What the scripts read from a sheet folder: the form of a name, the front matter, the page order, the static rule and the fonts                     |

The scripts run from the root of the repository, on Node 22 after `npm ci`.

## check-sheets.mjs

```bash
npm run check -- --root tests/fixtures/sheets
```

| Option          | Default  | Effect                                   |
| --------------- | -------- | ---------------------------------------- |
| `--root <path>` | `sheets` | The folder whose sheet folders it checks |

It checks the root and each of its subfolders against the rules of [the contract of a sheet folder](../sheets/README.md) that a script can decide, those of [What this folder holds](../sheets/README.md#what-this-folder-holds), [A sheet folder](../sheets/README.md#a-sheet-folder), [The sheet README](../sheets/README.md#the-sheet-readme), [Front matter](../sheets/README.md#front-matter), [Page files](../sheets/README.md#page-files) and [Folder name](../sheets/README.md#folder-name). It requires the request to be one paragraph of prose that ends a sentence and holds two or three sentences. It counts a sentence end at each full stop, question mark and exclamation mark, with any closing quotation mark or bracket after it, that a space and then a capital or a digit follow, with any opening quotation mark or bracket before them, other than the full stops of the abbreviations Dr., Mr., Mrs., Ms., Prof., St., vs., e.g., i.e., etc. and z. B. What needs a reader is left to the review: whether the request is in English, and whether it says what the prompt in the pull request asked for. Beyond the contract:

- In a git work tree it looks only at files git would commit, so a file that `.gitignore` leaves out, such as `.DS_Store`, is no violation.
- It reads which fonts a package holds from the `metadata.json` of the installed package. A font family whose package is missing from `package.json` is a violation that names the command adding it; a package that `package.json` names and `npm ci` has not installed is left to the renderer, which fails on it.

It prints one line per violation, the file and the problem, then their number; with no violation it prints the number of sheets. The command above prints:

```text
1 sheet in tests/fixtures/sheets, no violation
```

On a violation it prints, for example for a `created` without quotes:

```text
sheets/login-methods-and-recovery/README.md: front matter: "created" is not a string in double quotes
1 violation in sheets
```

| Exit status | Means                                                   |
| ----------- | ------------------------------------------------------- |
| 0           | No violation                                            |
| 1           | At least one violation                                  |
| 2           | An option it does not know, or a root that is no folder |

## render-sheets.mjs

```bash
npm run render -- --root tests/fixtures/sheets --out build --png-width 400 two-pages-of-squares
```

| Option             | Default  | Effect                                                                           |
| ------------------ | -------- | -------------------------------------------------------------------------------- |
| `--root <path>`    | `sheets` | The folder whose sheet folders it renders                                        |
| `--out <path>`     | `build`  | The folder it writes the PDFs and PNGs to, made where it does not exist          |
| `--png-width <px>` | none     | Also writes `<out>/<name>.png`, the first page at this width, from 1 to 16384 px |
| `<name> ...`       | all      | The sheet folders to render; without a name it renders every sheet               |

For each sheet it prints the pages in the reading order of their frames, as [Page files](../sheets/README.md#page-files) gives. For each page it puts the `<helmet>` into `<head>` and what `<x-dc>` holds into `<body>`, drops the canvas runtime and the Google Fonts links, links the Fontsource stylesheets of the same families from `node_modules` instead, sets `@page` to the board's size with no margin and prints one page with backgrounds, as wide as the board. It takes each family from the package that [Page files](../sheets/README.md#page-files) names. From a variable package it links one of the stylesheets that [the Fontsource guide to variable fonts](https://fontsource.org/docs/getting-started/variable) describes, with `-italic` before `.css` for italic: `wght.css` where the page asks for no axis but `ital` and `wght`, `<axis>.css` where it asks for one other axis and the package holds that file, and `standard.css` otherwise. The family of a variable package takes the name the page uses, as [decision 0002](../docs/decisions/0002-render-with-chromium-and-fontsource.md) gives. It merges the pages into `<out>/<name>.pdf`.

A sheet fails, and leaves neither its PDF nor its PNG in the output folder, also none of an earlier run, where:

- a page is not static under [the contract](../sheets/README.md#page-files), or asks for a font its installed package does not hold;
- a page requests anything other than its own HTML and the Fontsource files, a request the renderer blocks;
- a font does not load;
- the content of a page's body runs past its frame, which it reports by side and by how many px.

It renders with the Chrome at `CHROME_PATH` where that variable is set, and otherwise with Playwright's Chromium, which this command installs:

```bash
npx playwright install chromium
```

Where neither starts, it prints a line that begins with `no browser:` and names this command, and exits with status 1.

It prints one line per sheet, the PDF and its number of pages or the reason it failed, then how many sheets rendered. The command above prints:

```text
build/two-pages-of-squares.pdf: 2 pages
1 of 1 sheet rendered to build
```

| Exit status | Means                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| 0           | Every sheet rendered, or the root holds no sheet                                              |
| 1           | At least one sheet failed, a name is not a sheet folder, or no browser starts                 |
| 2           | An option it does not know, a `--png-width` out of form or range, or a root that is no folder |

## build-site.mjs

```bash
npm run site -- --root sheets --out build/site
```

| Option                     | Default      | Effect                                                                                   |
| -------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `--root <path>`            | `sheets`     | The folder whose sheet folders it lists                                                  |
| `--out <path>`             | `build/site` | The folder it writes the page to, made where it does not exist                           |
| `--require-release-lookup` | off          | Fails where the latest release cannot be read, instead of building the page without PDFs |

It reads the front matter of each sheet's README and renders each sheet's first page through `render-sheets.mjs`, at 240 px wide. The page shows each sheet's `created` and `last_modified` and lists the sheets by `last_modified`, newest first, unless the reader sorts them by title. It asks [the REST API for the latest release](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) of tiavelum/learning-sheets, with the token in `GITHUB_TOKEN` where that variable is set, and without one otherwise, which the endpoint allows for a public repository. A sheet whose `<name>.pdf` that release holds links to `https://github.com/tiavelum/learning-sheets/releases/latest/download/<name>.pdf`; every other sheet shows "PDF not released yet", and so does every sheet where the repository has no release or the API cannot be reached.

It writes into the output folder:

- `index.html`, `browse.js` and `browse.css` from `site/`, with the catalog put into `index.html`;
- `catalog.json`: the repository's address, the tag and address of the latest release or `null`, and for each sheet its folder name, every field of its front matter, among them `created`, `last_modified` and `skill_version`, and `source`, its folder on GitHub, `pdf`, its PDF in the latest release or `null`, and `image`, the path of its image;
- `images/<name>.png`: the first page of each sheet, 240 px wide, the folder emptied first so that it holds no image of a removed sheet.

A root that holds no sheet gives a page that says so. The page loads nothing from another site, so the built folder can be opened as a file. It prints one line per image, one line on the latest release and the number of sheets:

```text
build/site/images/login-methods-and-recovery.png: page one at 240 px
the latest release 2026-11-03-1430 holds the PDF of 1 of 1 sheet
1 sheet built into build/site
```

Where the release cannot be read, the middle line gives the reason, such as `the latest release could not be read (HTTP 403): every sheet shows as not released yet`.

| Exit status | Means                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0           | The page is built                                                                                                                                                 |
| 1           | A sheet's README has no valid front matter, a sheet failed to render, or, with `--require-release-lookup`, the latest release could not be read; no page is built |
| 2           | An option it does not know                                                                                                                                        |

## prepare-release.mjs

```bash
node scripts/prepare-release.mjs --tag 2026-11-03-1430 --root tests/fixtures/sheets
```

| Option             | Default                             | Effect                                                |
| ------------------ | ----------------------------------- | ----------------------------------------------------- |
| `--tag <tag>`      | none, required                      | The tag of the release, in the form `YYYY-MM-DD-HHMM` |
| `--root <path>`    | `sheets`                            | The folder whose sheet folders the release holds      |
| `--notes <file>`   | `build/release/notes.md`            | The file it writes the release notes to               |
| `--catalog <file>` | `build/release/assets/catalog.json` | The file it writes the catalog of the release to      |

It reads the latest release of tiavelum/learning-sheets as `build-site.mjs` does, with the token in `GITHUB_TOKEN` where that variable is set. The notes say how many sheets the release holds and list by title the sheets added, changed and removed since the latest release, each sheet added or changed with its `last_modified`, such as `- points-of-sail, last modified 2026-11-01`, comparing the root at that release's tag with the commit checked out, so it runs in a clone that holds the tag: a sheet is added where its folder is new, changed where any file of its folder differs and removed where its folder is gone, so a retitled sheet, whose folder name changes with its title, shows as one removed and one added. Where a sheet was removed, they add that its PDF stays in the releases that held it and that its link under "latest" no longer works. With no release yet, they list every sheet as added. The catalog holds what the browse page's `catalog.json` holds, without the image of page one, which only the page has, and with each sheet's source and PDF linked at the new tag, so its links stay valid after later releases.

It prints the latest release, then a line for each file it wrote; before the first release, it prints:

```text
no release yet: this is the first
build/release/notes.md: notes on 1 sheet, 1 added, 0 changed, 0 removed
build/release/assets/catalog.json: 1 sheet
```

Once a release exists, the first line names it, such as `the latest release is 2026-11-03-1430`, and the second counts the sheets added, changed and removed since then. Where the latest release cannot be read, it fails rather than write notes that would list every sheet as added; where its tag is not in the clone, it fails and names the tag.

| Exit status | Means                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 0           | The notes and the catalog are written                                                                                                 |
| 1           | The root holds no sheet, a sheet's README has no valid front matter, the latest release or its tag cannot be read; nothing is written |
| 2           | An option it does not know, or a tag that is missing or out of form                                                                   |
