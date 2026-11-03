# Scripts

This folder holds the scripts that check the sheet folders and render the sheets to PDF, and this file describes what each does, its options, its output and its exit status, for whoever runs or changes them.

| File                | Does                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `check-sheets.mjs`  | Checks every sheet folder against [the contract of a sheet folder](../sheets/README.md), run by `npm run check`           |
| `render-sheets.mjs` | Renders each sheet to one PDF, and on request a PNG of its first page, run by `npm run render`                            |
| `sheet-files.mjs`   | What both read from a sheet folder: the folder-name rule, the front matter, the page order, the static rule and the fonts |

Both scripts run from the root of the repository, on Node 22 after `npm ci`.

## check-sheets.mjs

```bash
npm run check -- --root tests/fixtures/sheets
```

| Option          | Default  | Effect                                   |
| --------------- | -------- | ---------------------------------------- |
| `--root <path>` | `sheets` | The folder whose sheet folders it checks |

It checks the root and each of its subfolders against the rules of [the contract of a sheet folder](../sheets/README.md) that a script can decide, those of [What this folder holds](../sheets/README.md#what-this-folder-holds), [A sheet folder](../sheets/README.md#a-sheet-folder), [The sheet README](../sheets/README.md#the-sheet-readme), [Front matter](../sheets/README.md#front-matter), [Page files](../sheets/README.md#page-files) and [Folder name](../sheets/README.md#folder-name); whether a prompt leaves out names and private details is for the reviewer. Beyond the contract:

- In a git work tree it looks only at files git would commit, so a file that `.gitignore` leaves out, such as `.DS_Store`, is no violation.
- It reads which fonts a package holds from the `metadata.json` of the installed package. A font family whose package is missing from `package.json` is a violation that names the command adding it; a package that `package.json` names and `npm ci` has not installed is left to the renderer, which fails on it.

It prints one line per violation, the file and the problem, then their number; with no violation it prints the number of sheets. The command above prints:

```text
1 sheet in tests/fixtures/sheets, no violation
```

On a violation it prints, for example for a `made` without quotes:

```text
sheets/logins-at-a-glance/README.md: front matter: "made" is not a string in double quotes
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
