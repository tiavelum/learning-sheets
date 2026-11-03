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
npm run check -- --root sheets
```

| Option          | Default  | Effect                                   |
| --------------- | -------- | ---------------------------------------- |
| `--root <path>` | `sheets` | The folder whose sheet folders it checks |

It checks each subfolder of the root as a sheet, and allows beside them only `README.md` and `LICENSE`. In a git work tree it looks only at files git would commit, so a file that `.gitignore` leaves out, such as `.DS_Store`, is no violation. For each sheet it checks:

- the folder holds exactly `README.md` and `project/`, and `project/` holds `canvas.json` and one page file per board, and no other file;
- the front matter holds every field in the order of the contract, each a string in double quotes, with `title`, `topic`, `tags`, `language`, `paper`, `made`, `skill` and `artifact` in their form;
- the README holds, below the front matter, one sentence, the heading `## Prompt` and the prompt in a fenced block marked `text`, whose fence is longer than any run of backticks in the prompt;
- the folder name is the name the title gives, and no two sheets' titles give the same name;
- the canvas's `title` equals the README's, its `order` lists the same files as its `boards`, and the first page in reading order (by `y`, then `x`) is `Main.dc.html`;
- every board measures 794 × 1123 px for `paper: "a4"` and 816 × 1056 px for `paper: "letter"`;
- every page is static and loads nothing over the network but what the contract allows;
- every font family a page asks for has its Fontsource package in `package.json`, and the installed package holds every weight, style and axis the page asks for.

It prints one line per violation, the file and the problem, then their number; with no violation it prints the number of sheets:

```text
sheets/logins-at-a-glance/README.md: front matter: "made" is not a string in double quotes
1 violation in sheets
```

| Exit status | Means                      |
| ----------- | -------------------------- |
| 0           | No violation               |
| 1           | At least one violation     |
| 2           | An option it does not know |

## render-sheets.mjs

```bash
npm run render -- --root sheets --out build --png-width 400 logins-at-a-glance
```

| Option             | Default  | Effect                                                                  |
| ------------------ | -------- | ----------------------------------------------------------------------- |
| `--root <path>`    | `sheets` | The folder whose sheet folders it renders                               |
| `--out <path>`     | `build`  | The folder it writes the PDFs and PNGs to, made where it does not exist |
| `--png-width <px>` | none     | Also writes `<out>/<name>.png`, the first page at this width in px      |
| `<name> ...`       | all      | The sheet folders to render; without a name it renders every sheet      |

For each sheet it prints the pages in the reading order of their frames in `canvas.json`, by `y`, then `x`. For each page it puts the `<helmet>` into `<head>` and what `<x-dc>` holds into `<body>`, drops the canvas runtime and the Google Fonts links, links the Fontsource stylesheets of the same families from `node_modules` instead, sets `@page` to the board's size with no margin and prints one page with backgrounds. A family requested with an axis other than `ital` and `wght`, or with a range, comes from the variable package `@fontsource-variable/<id>` with that axis, under the family name the page uses; every other family comes from the static package `@fontsource/<id>`. It merges the pages into `<out>/<name>.pdf`.

A sheet fails, and leaves no PDF, where:

- a page is not static under [the contract](../sheets/README.md#page-files), or asks for a font its installed package does not hold;
- a page requests anything other than its own HTML and the Fontsource files, a request the renderer blocks;
- a font does not load;
- the content of a page's root runs past its frame, which it reports by side and by how many px.

It renders with the Chrome at `CHROME_PATH` where that variable is set, and otherwise with Playwright's Chromium, which this command installs:

```bash
npx playwright install chromium
```

It prints one line per sheet, the PDF and its number of pages or the reason it failed, then how many sheets rendered:

```text
build/logins-at-a-glance.pdf: 2 pages
1 of 1 sheet rendered to build
```

| Exit status | Means                                                      |
| ----------- | ---------------------------------------------------------- |
| 0           | Every sheet rendered, or the root holds no sheet           |
| 1           | At least one sheet failed, or a name is not a sheet folder |
| 2           | An option it does not know, or a `--png-width` out of form |
