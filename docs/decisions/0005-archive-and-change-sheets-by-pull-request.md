# 0005: Archive and change a sheet by pull request from the session that works on it

This record states how a sheet reaches this repository and how an archived sheet is changed, and why, for the sessions that archive or change sheets and for whoever writes their instructions.

Status: accepted.

## Context

[The maintainer decided in issue #1](https://github.com/tiavelum/learning-sheets/issues/1) that a new session can find and work on an existing sheet, that the maintainer does no git mechanics, and that Claude merges its own pull requests once checks pass and a checker agent has reviewed them. The learning-sheet skill of tiavelum/claude-setup makes the sheet and names no repository; the person's instructions name this one as the place where learning sheets are kept, so references run one way. The session that made a sheet is the one that holds its canvas, its prompt and the skill text it loaded.

## Decision

- **Archive.** The session that made a sheet archives it by following this repository's README: it opens an issue for the sheet ([GW-29](https://github.com/tiavelum/engineering-standards/blob/main/standards/git-workflow.md#gw-29)), works on a branch `feat/<issue>-add-<name>`, with `<name>` cut to its first four words so that the branch description stays within the five words of [NAM-12](https://github.com/tiavelum/engineering-standards/blob/main/standards/naming.md#nam-12), reads the canvas files with the Artifact tool and writes them unchanged, writes the sheet's README, runs the checks and renders the sheet, and opens a pull request that closes the issue.
- **Change.** A session finds the sheet by name in the listing of `sheets/` or in `catalog.json`, and reads its README. If the artifact still holds the archived version, it changes the sheet there; if the artifact holds a newer version, it archives that version first; if the artifact is gone, it creates a Design canvas with the same title from the archived files. It then archives the change by pull request, with the artifact's new link and version in the README.
- **Merge.** Claude merges a pull request that adds or changes one sheet once its checks pass and a checker has compared its files with the artifact.
- **What only Claude needs** here stands in `project-instructions.md`, imported by `CLAUDE.md`, and its text goes into the instructions of the claude.ai project "Learning Sheet", in which the sheets are made.

[The contract of a sheet folder](../../sheets/README.md) gives what the archived files and the README hold.

## Alternatives considered

- **The maintainer commits the sheets.** Against the decision that the maintainer does no git mechanics.
- **A session commits straight to `main`.** [GW-2](https://github.com/tiavelum/engineering-standards/blob/main/standards/git-workflow.md#gw-2) brings every commit to the default branch through a pull request, and without one no check would run before a sheet lands.
- **A later session imports the sheet from the artifact.** It would lack the prompt and the skill text the making session holds, and the archived files would not be compared with the canvas while the person can still answer.
- **The skill names this repository.** It would tie a skill that others can use to one person's archive.

## Consequences

- Every sheet in `sheets/` arrived through a pull request whose checks passed and whose PDF a reviewer could open.
- The archive step of the learning-sheet skill points to the person's instructions, and this repository's README holds the steps it follows.
- A changed sheet keeps its folder and name, and its README names the canvas version its files were last read from, so a later session can tell whether the artifact has moved on.
