# Sheets

This folder holds one folder per learning sheet, and this file states what a sheet folder holds, for whoever archives or changes a sheet and for the checks that enforce it.

## What this folder holds

This folder holds one folder per sheet, named as [Folder name](#folder-name) gives, with the sheet's README and its canvas files. A sheet folder keeps a sheet made as a Design canvas; a sheet made in another form has no `project/canvas.json` and does not fit this contract. Beside the sheet folders it holds no file other than this `README.md` and `LICENSE`, the license of the sheets. Why a sheet is kept this way, and not as a PDF or with a catalog file beside it, is recorded in [decision 0001](../docs/decisions/0001-keep-each-sheet-as-its-canvas-files.md); why its README records its versions as it does, and how a new sheet on a topic already present is kept, in [decision 0006](../docs/decisions/0006-version-a-sheet-in-its-folder-and-record-its-request.md).

## A sheet folder

A sheet folder holds exactly these files, here for the sheet `login-methods-and-recovery`:

```
sheets/login-methods-and-recovery/
  README.md              the sheet's facts and its request
  project/
    canvas.json          the canvas's index of its pages
    Main.dc.html         page one
    Details.dc.html      page two
```

`project/` holds the canvas's own files, as [Page files](#page-files) describes; the Design type expects them in a `project/` folder under the folder it publishes from, so a session can publish them back to a canvas as they are.

A sheet can have several versions, each made by a session and handed over to the person. The folder holds the files of the latest version; git and the pull requests that archived them hold the earlier ones.

## The sheet README

The README of a sheet holds, in this order:

1. YAML front matter between two `---` lines, with every field of [Front matter](#front-matter) and no other.
2. A heading `## Request`, the README's only section, then the request: one paragraph of prose, two or three sentences in English, saying what the sheet was asked to cover, for whom and what for, as the session that made it understood the person's prompt.

The request says what the sheet was asked to be: it names the scene that the pages picture only where the prompt asked for one, since the scene belongs to the sheet's story and not to what it covers. Where the prompt refers to an earlier conversation, such as "all those items", the request says what it refers to. A later version keeps the request, and rewrites it where its own prompt changes what the sheet is asked to be, such as a further subject or another reader. The prompt as written does not stand in the README; [The prompt](#the-prompt) gives where it stands.

A sheet's README is a document about the repository's content, so under [WR-1](https://github.com/tiavelum/engineering-standards/blob/main/standards/writing.md#wr-1) its request, its `topic` and its `tags` are in English, whatever the sheet's `language` and whatever language the prompt was written in; its `title` alone is not translated, since it is the sheet's name that [Folder name](#folder-name) gives.

This example uses the facts of the sheet `login-methods-and-recovery` as its first version had them:

```markdown
---
title: "login-methods-and-recovery"
topic: "How logins work, from passwords and passkeys to getting back in"
tags: ["accounts", "security"]
language: "en"
paper: "a4"
created: "2026-11-01"
last_modified: "2026-11-01"
skill_version: "tiavelum/claude-setup@669bb79"
artifact: "https://claude.ai/artifact/Dcqoruumq3zMKKfUJWJ26Q"
artifact_version: "1793715998-6304"
---

## Request

A printable handout, rather than a Markdown list, on the ways of logging in that an earlier conversation went through, from passwords and passkeys to getting back into an account. It explains each way and how they relate, and gives each an everyday analogy in two or three sentences, for anyone with online accounts who wants to see how they fit together.
```

## The prompt

The prompt is the person's request that started a version of a sheet, as written. The description of the pull request that archives the version quotes it, so that the sheet can be made again from it, such as with a newer skill, and its request checked against it. It stands there in a collapsed `<details>` section, as [WR-10](https://github.com/tiavelum/engineering-standards/blob/main/standards/writing.md#wr-10) asks of what follows a description's opening, in a fenced block marked `text` whose fence has at least three backticks and is longer than any run of backticks in the prompt.

Since the repository and its pull requests are public, the prompt leaves out names of people and private details. Each place where something is left out is marked in square brackets with what kind of thing it was, such as `[left out: a name]`. The prompt is quoted in the language the person wrote it in, since it is the person's words and not text of the pull request.

This example is an illustration:

````markdown
<details>
<summary>The prompt</summary>

```text
Make me a learning sheet on how logins work: passwords, passkeys, the codes
from an app and what to do when I'm locked out. It's for [left out: a name],
who keeps forgetting her passwords.
```

</details>
````

## Front matter

Every field is required, and they stand in the order of this table. Every value is a YAML string in double quotes, with `\"` for a quote and `\\` for a backslash inside it, and so is each item of `tags`; unquoted, YAML 1.1 reads `created` as [a date](https://yaml.org/type/timestamp.html) and `language: no` as [a boolean](https://yaml.org/type/bool.html), and a topic with a colon does not parse.

| Field              | Holds                                                                                                                              | Form                                                                                                                                                                                       | Example                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `title`            | The sheet's name, equal to `title` in `project/canvas.json` and to the title of its artifact                                       | The sheet's folder name, in the form that [Folder name](#folder-name) gives                                                                                                                | `"login-methods-and-recovery"`                                      |
| `topic`            | What the sheet covers                                                                                                              | Text on one line without a final period                                                                                                                                                    | `"How logins work, from passwords and passkeys to getting back in"` |
| `tags`             | The words to filter sheets by                                                                                                      | A list of one or more distinct words, each in the form of [NAM-2](https://github.com/tiavelum/engineering-standards/blob/main/standards/naming.md#nam-2)                                   | `["accounts", "security"]`                                          |
| `language`         | The language of the sheet's text                                                                                                   | A language tag of [BCP 47](https://www.rfc-editor.org/info/rfc5646)                                                                                                                        | `"en"`                                                              |
| `paper`            | The paper the pages are made for                                                                                                   | `a4` or `letter`                                                                                                                                                                           | `"a4"`                                                              |
| `created`          | The date on which the session that made the sheet's first version handed it over, in UTC                                           | `YYYY-MM-DD`                                                                                                                                                                               | `"2026-11-01"`                                                      |
| `last_modified`    | The date on which the session that made the sheet's latest version handed it over, in UTC; for a sheet with one version, `created` | `YYYY-MM-DD`, not before `created`                                                                                                                                                         | `"2026-11-01"`                                                      |
| `skill_version`    | The learning-sheet skill that made the sheet's latest version                                                                      | `tiavelum/learning-sheets@`, or `tiavelum/claude-setup@` for a version made before decision 0008, and the hash of a commit of that repository, at least 7 lowercase hexadecimal characters | `"tiavelum/claude-setup@669bb79"`                                   |
| `artifact`         | The link of the Design canvas that holds the sheet                                                                                 | `https://claude.ai/artifact/` and the canvas's id                                                                                                                                          | `"https://claude.ai/artifact/Dcqoruumq3zMKKfUJWJ26Q"`               |
| `artifact_version` | The version of the canvas whose files the folder holds                                                                             | The version as the Artifact tool reports it                                                                                                                                                | `"1793715998-6304"`                                                 |

`created` is written when the sheet's first version is archived and never changes. `last_modified` and `skill_version` follow the sheet's latest version: the pull request that archives a version sets them to the date on which its session handed it over and to the skill that session loaded. A change made on the sheet's own canvas is such a version, so they then take the hand-over date and the skill of the session that made the change. `artifact` and `artifact_version` name the canvas and version that the folder's files were last read from.

The skill has no released version, so `skill_version` names the first commit whose `skills/learning-sheet/SKILL.md` holds the same text as the copy the session loaded. The skill is kept in this repository, as [decision 0008](../docs/decisions/0008-keep-the-learning-sheet-skill-in-this-repository.md) records, and was kept in tiavelum/claude-setup before. In a clone of this repository, with that copy saved as `/tmp/learning-sheet-skill.md`, this prints the skill version:

```bash
git log --reverse --format='tiavelum/learning-sheets@%h' --find-object="$(git hash-object /tmp/learning-sheet-skill.md)" -- skills/learning-sheet/SKILL.md | head -n 1
```

Run it with the default branch checked out and up to date. If it prints nothing, the copy is a version from before the move; this prints it from tiavelum/claude-setup:

```bash
git clone -q https://github.com/tiavelum/claude-setup.git /tmp/claude-setup && git -C /tmp/claude-setup log --reverse --format='tiavelum/claude-setup@%h' --find-object="$(git hash-object /tmp/learning-sheet-skill.md)" -- skills/learning-sheet/SKILL.md | head -n 1
```

If that prints nothing either, the copy matches no version of the skill: stop and ask the person which skill version to name.

## Page files

A page file is a page of the canvas in its own HTML: it loads the canvas runtime, `./support.js` in its `<head>` and a `text/x-dc` script at the end of its `<body>`, and wraps the page's plain HTML and inline SVG in an `<x-dc>` element, whose `<helmet>` holds the page's stylesheets and font links.

- `project/canvas.json` is the canvas's index. Its `boards` hold one entry per page, keyed by the page's file name, with the frame's position `x`, `y` and size `w`, `h`; its `order` lists the same file names, back to front. The pages print in the reading order of their frames: sorted by `y`, then by `x`.
- Each page is one `project/<page>.dc.html`, one per key of `boards` and none besides. The first page in reading order is `Main.dc.html`, the name the Design type gives a canvas's first page; the others keep the names the session that made the sheet gave them, such as `Details.dc.html`, `Facts.dc.html` or `Page-2.dc.html`, as [the deviation from NAM-2](../deviations.md#nam-2-page-files-below-sheetsproject) records.
- Every page's board measures 794 × 1123 px for `paper: a4` and 816 × 1056 px for `paper: letter`, the sizes at which [the learning-sheet skill](../skills/learning-sheet/SKILL.md#lay-out-the-pages) makes one artboard per page.
- Every page is static: the file holds no hole `{{…}}`, no `<sc-for>`, `<sc-if>` or `<dc-import>`, and no uploaded asset (`/_blob/…`). It loads over the network only `./support.js` in `<head>` (the canvas runtime) and, in `<helmet>`, the Google Fonts `css2` stylesheet with the `<link rel="preconnect">` elements for `https://fonts.googleapis.com` and `https://fonts.gstatic.com`. A URL in an `<a href>`, in an `xmlns` or in the page's text loads nothing and is allowed.
- Every font family a page loads has its Fontsource package among the repository's npm dependencies, since the renderer takes the fonts from there ([decision 0002](../docs/decisions/0002-render-with-chromium-and-fontsource.md)): `@fontsource/<id>`, or `@fontsource-variable/<id>` ([the Fontsource guide to variable fonts](https://fontsource.org/docs/getting-started/variable)) where the `css2` URL asks for an axis other than `ital` and `wght`, or for a range of values, with `<id>` the family in lowercase and its spaces as hyphens, and every weight and style the URL asks for is among the package's.
- A character a page draws, in its text and in content its CSS generates, may be any character. A Fontsource package splits a family into [subsets, whose CSS uses `unicode-range` to load only the characters a page uses](https://fontsource.org/docs/getting-started/subsets), so a family holds only the characters of its subsets, such as neither "→" (U+2192) nor "≥" (U+2265) in any package a page of the repository loads. The renderer draws what none of the families of a text's `font-family` list that the page loads holds from the fallback fonts that [`scripts/README.md`](../scripts/README.md#render-sheetsmjs) names, such as arrows, mathematical signs, check marks, stars, shapes and emoji, and warns about a character that even these lack, such as a letter of a script the page's fonts do not cover, which then prints in whatever font the machine that renders it has, or as an empty box where it has none. The canvas on screen draws such characters in the viewer's own fonts.

The files are written byte for byte as the Artifact tool reads them, and no formatter or linter changes them.

## Folder name

A sheet's name is its folder name, and its README's `title`, the `title` of its canvas and so the title of its artifact are the same string. The name is lowercase words of `a`-`z` and `0`-`9` joined by single hyphens, the form of [NAM-2](https://github.com/tiavelum/engineering-standards/blob/main/standards/naming.md#nam-2), such as `login-methods-and-recovery`. A topic written with other letters or characters is turned into such words: `ä`, `ö`, `ü`, `ß`, `æ`, `œ`, `ø` and `ł` become `ae`, `oe`, `ue`, `ss`, `ae`, `oe`, `o` and `l`, other accents and apostrophes are dropped, and any other character separates two words, so that "Drei Säulen der Vorsorge" becomes `drei-saeulen-der-vorsorge`, "Straße und Café" becomes `strasse-und-cafe` and "Don't Get Locked Out" becomes `dont-get-locked-out`. The name leaves out the words `learning sheet` and `learning sheets`, since every sheet here is one: `points-of-sail`, not `points-of-sail-learning-sheet`.

No two sheets share a folder name, and a new sheet never takes the folder of another. The listing of `sheets/` is the list of names taken: one directory read shows them all.

Where `sheets/` already holds a sheet on the topic of a new one, the person chooses which of the two the new one is:

- **A new version** of that sheet, kept in its folder under its name, as "Change a sheet" in [the repository's README](../README.md#change-a-sheet) gives.
- **A variant** beside it: a sheet of its own on a related topic, with a name of its own that says what sets it apart, such as `points-of-sail-for-racing` beside `points-of-sail`, and never its scene, which belongs to the sheet's story and not to what it covers. Only where no such name is found does the variant take the topic's name with `-2`, `-3` and so on, in the order the variants are made, such as `points-of-sail-2`. These numbers count variants, not versions, so they carry no `v`.

Either way the canvas is given the sheet's name as its title, and so its artifact too.

A sheet keeps its folder as long as its title stays. A pull request that retitles a sheet changes its README's `title`, the `title` of its canvas and its folder name together. A pull request that removes a sheet deletes its folder, and a session opens one only when the person asks for it.

## What never goes in

- A PDF, an image or any other file that a tool generates from the sheet; the releases hold the PDFs.
- Any file of the canvas other than `project/canvas.json` and its pages, such as the Design type's own files that the Artifact tool lists beside `project/` (`SKILL.md`, `index.html`, `artifact-type/`), design system files under `project/ds/` and uploaded assets.
- Names of people and private details, anywhere in the sheet's README, as in the prompt that [The prompt](#the-prompt) places in a pull request.
- Secrets, credentials and tokens, in any form.
