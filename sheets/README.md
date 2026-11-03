# Sheets

This folder holds one folder per learning sheet, and this file states what a sheet folder holds, for whoever archives or changes a sheet and for the checks that enforce it.

## What this folder holds

This folder holds one folder per sheet, named as [Folder name](#folder-name) gives, with the sheet's README and its canvas files. Beside the sheet folders it holds no file other than this `README.md` and `LICENSE`, the license of the sheets. Why a sheet is kept this way, and not as a PDF or with a catalog file beside it, is recorded in [decision 0001](../docs/decisions/0001-keep-each-sheet-as-its-canvas-files.md).

## A sheet folder

A sheet folder holds exactly these files, here for the sheet "Logins at a Glance":

```
sheets/logins-at-a-glance/
  README.md              the sheet's facts, what it covers and its prompt
  project/
    canvas.json          the canvas's index of its pages
    Main.dc.html         page one
    Details.dc.html      page two
```

`project/` holds the canvas's own files, as [Page files](#page-files) describes; the Design type expects them in a `project/` folder under the folder it publishes from, so a session can publish them back to a canvas as they are.

## The sheet README

The README of a sheet holds, in this order:

1. YAML front matter between two `---` lines, with every field of [Front matter](#front-matter) and no other.
2. One sentence saying what the sheet covers and for whom.
3. A heading `## Prompt`, then the prompt in a fenced block marked `text`, whose fence is longer than any run of backticks in the prompt.

The prompt is the person's request that started the sheet, as written, with names of people and private details left out, since the repository is public. Each place where something is left out is marked in square brackets with what kind of thing it was, such as `[left out: a name]`.

This example uses the facts of the canvas "Logins at a Glance"; its prompt is an illustration:

````markdown
---
title: Logins at a Glance
topic: How logins work, from passwords and passkeys to getting back in
tags: [accounts, security]
language: en
paper: a4
made: 2026-11-01
skill: tiavelum/claude-setup@4f26fe8
artifact: https://claude.ai/artifact/Dcqoruumq3zMKKfUJWJ26Q
artifact_version: 1793655646-5d0b
---

A two-page learning sheet that pictures logins as getting into houses, for anyone with online accounts who wants to see how passwords, passkeys and recovery fit together.

## Prompt

```text
Make me a learning sheet on how logins work: passwords, passkeys, the codes
from an app and what to do when I'm locked out. It's for [left out: a name],
who keeps forgetting her passwords.
```
````

## Front matter

Every field is required, and they stand in the order of this table.

| Field | Holds | Form | Example |
|---|---|---|---|
| `title` | The sheet's name, equal to `title` in `project/canvas.json` and to the title of its artifact | Text on one line that gives a folder name of at least one word | `Logins at a Glance` |
| `topic` | What the sheet covers | Text on one line without a final period | `How logins work, from passwords and passkeys to getting back in` |
| `tags` | The words to filter sheets by | A list of one or more distinct words, each in the form of [NAM-2](https://github.com/tiavelum/engineering-standards/blob/main/standards/naming.md#nam-2) | `[accounts, security]` |
| `language` | The language of the sheet's text | A language tag of [BCP 47](https://www.rfc-editor.org/info/rfc5646) | `en` |
| `paper` | The paper the pages are made for | `a4` or `letter` | `a4` |
| `made` | The date on which the session that made the sheet first handed it over | `YYYY-MM-DD` | `2026-11-01` |
| `skill` | The learning-sheet skill that made the sheet | `tiavelum/claude-setup@` and the hash of a commit of that repository, at least 7 lowercase hexadecimal characters | `tiavelum/claude-setup@4f26fe8` |
| `artifact` | The link of the Design canvas that holds the sheet | `https://claude.ai/artifact/` and the canvas's id | `https://claude.ai/artifact/Dcqoruumq3zMKKfUJWJ26Q` |
| `artifact_version` | The version of the canvas whose files the folder holds | The version as the Artifact tool reports it | `1793655646-5d0b` |

`made` and `skill` keep their values when the sheet changes; `artifact` and `artifact_version` name the canvas and version that the folder's files were last read from.

The skill has no released version, so `skill` names the commit of tiavelum/claude-setup that first holds, in `skills/learning-sheet/SKILL.md`, the same text as the copy the session loaded. In a clone of tiavelum/claude-setup, with that copy saved as `/tmp/learning-sheet-skill.md`, this prints the commit:

```bash
git log --reverse --format=%h --find-object="$(git hash-object /tmp/learning-sheet-skill.md)" -- skills/learning-sheet/SKILL.md | head -n 1
```

## Page files

- `project/canvas.json` is the canvas's index. Its `boards` hold one entry per page, keyed by the page's file name, and its `order` lists the same file names in the order the pages print.
- Each page is one `project/<page>.dc.html`, one per key of `boards` and none besides. The first in `order` is `Main.dc.html`, the name the Design type gives a canvas's first page; the others keep the names the session that made the sheet gave them, such as `Details.dc.html`, `Facts.dc.html` or `Page-2.dc.html`, as [the deviation from NAM-2](../deviations.md#nam-2-page-files-below-sheetsproject) records.
- Every page's board measures 794 × 1123 px for `paper: a4` and 816 × 1056 px for `paper: letter`, the sizes at which [the learning-sheet skill](https://github.com/tiavelum/claude-setup/blob/main/skills/learning-sheet/SKILL.md#lay-out-the-pages) makes one artboard per page.
- Every page is static: it holds no hole `{{…}}`, no `<sc-for>`, `<sc-if>` or `<dc-import>`, and it loads nothing over the network other than the Google Fonts `css2` stylesheet in its `<helmet>`, so no uploaded asset (`/_blob/…`).
- Every font family a page loads has its Fontsource package among the repository's npm dependencies, since the renderer takes the fonts from there, as [decision 0002](../docs/decisions/0002-render-with-chromium-and-fontsource.md) records.

The files are written byte for byte as the Artifact tool reads them, and no formatter or linter changes them.

## Folder name

The folder name follows from `title` in these steps, which give a name in the form of NAM-2:

1. Write every letter in lowercase.
2. Write `ä`, `ö` and `ü` as `ae`, `oe` and `ue`.
3. Split the title into words at spaces and hyphens.
4. In each word, drop every character other than `a`-`z` and `0`-`9`; then drop the words left empty.
5. Join the words with single hyphens.

| Title | Folder name |
|---|---|
| `Logins at a Glance` | `logins-at-a-glance` |
| `Drei Säulen der Vorsorge` | `drei-saeulen-der-vorsorge` |
| `Don't Get Locked Out` | `dont-get-locked-out` |

No two sheets share a folder name, and a new sheet never takes the folder of another. A new sheet on a topic already present takes a title that says what sets it apart, such as its scene ("Points of Sail on a Hillside"), and its artifact is given the same title. The listing of `sheets/` is the list of names taken: one directory read shows them all.

## What never goes in

- A PDF, an image or any other file that a tool generates from the sheet; the releases hold the PDFs.
- Any file of the canvas other than `project/canvas.json` and its pages, such as the Design type's own files that the Artifact tool lists beside `project/` (`SKILL.md`, `index.html`, `artifact-type/`), design system files under `project/ds/` and uploaded assets.
- Names of people and private details, in the prompt as anywhere else in the sheet's README.
- Secrets, credentials and tokens, in any form.
