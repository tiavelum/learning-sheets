# 0001: Keep each sheet as its canvas files and a README that holds its facts

This record states how this repository keeps a learning sheet and why, for whoever archives, changes, checks or publishes a sheet.

Status: accepted; superseded by [decision 0006](0006-version-a-sheet-in-its-folder-and-record-its-request.md) in what stands below the front matter and in how a new sheet on a topic already present is named.

## Context

A learning sheet is made as a Design canvas in the Claude app. While the session that made it lives, its PDF comes from the canvas's own export; in the long run its source lives here and the releases build its PDF, as [issue #1](https://github.com/tiavelum/learning-sheets/issues/1) states. The decisions of that issue require, for each sheet, a README with its topic, its prompt, the skill and the date that made it and the artifact's link and version; names that a person can tell apart, with the artifact named like its folder; no PDF in git; and that a new session can find an existing sheet and work on it.

A canvas consists of its index `project/canvas.json` and one page file per page, as [Page files](../../sheets/README.md#page-files) describes; the Artifact tool reads and publishes them under the same paths.

## Decision

- Each sheet is one folder below `sheets/`, holding its README and, in `project/`, the canvas's index and page files unchanged, under the paths the canvas gives them, so that a session can publish them back to a canvas as they are.
- The README's YAML front matter is the one home of the sheet's facts (the fields of [Front matter](../../sheets/README.md#front-matter)); below it stand one sentence on what the sheet covers and for whom, and the prompt.
- The folder name is the title in the form of [NAM-2](https://github.com/tiavelum/engineering-standards/blob/main/standards/naming.md#nam-2), and no two sheets share one, so a new sheet on a topic already present takes a title that says what sets it apart. The listing of `sheets/` is the list of names taken.
- No catalog file is committed. Where a list of all sheets is needed, it is generated from the READMEs as `catalog.json`, for the browse page and for each release.
- No PDF, image or other generated file is committed; the PDFs go into releases, as [issue #1](https://github.com/tiavelum/learning-sheets/issues/1) states and [decision 0003](0003-release-every-pdf-from-a-dispatched-workflow.md) records.
- The skill is named by the commit of tiavelum/claude-setup whose `skills/learning-sheet/SKILL.md` has the same text as the copy the session loaded, since the skill has no released version.
- The page files keep the canvas's file names, which [deviations.md](../../deviations.md#nam-2-page-files-below-sheetsproject) records as a deviation from NAM-2.

[The contract of a sheet folder](../../sheets/README.md) gives every file, field, form and naming step.

## Alternatives considered

- **A catalog file at the root**, one entry per sheet, as the only file a session reads to learn the names taken. It would hold each sheet's facts a second time beside its README, which [DOC-3](https://github.com/tiavelum/engineering-standards/blob/main/standards/documentation.md#doc-3) forbids, and the two copies could disagree. The folder listing gives the names in one read, and the generated `catalog.json` gives the facts.
- **Numbered or dated folder names**, so that names never collide. A person identifies a sheet by its name, and the artifact carries the same name, so a number would tell two sheets apart without saying how they differ; [NAM-1](https://github.com/tiavelum/engineering-standards/blob/main/standards/naming.md#nam-1) also asks a name to say what the thing is.
- **Exported HTML or the PDF as the source.** Neither can be published back to a canvas, so a sheet could no longer be changed in the Design editor once its session is gone.
- **Renaming the page files to the form of NAM-2.** The renamed files would no longer match the keys in `canvas.json` or the paths the canvas serves.

## Consequences

- The checks enforce the contract of a sheet folder on every pull request, among them that the folder name follows from the title and that the title equals the canvas's.
- A sheet's facts change in one place, its README, and the browse page and the releases pick them up when they are next built.
- The canvas files are files a tool writes, so no formatter or linter changes them ([TL-23](https://github.com/tiavelum/engineering-standards/blob/main/standards/tooling.md#tl-23)).
- A session that archives a new sheet reads one directory listing to pick a title that is free, and gives the artifact the same title.
