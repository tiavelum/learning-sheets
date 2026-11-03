# 0003: Release every sheet's PDF from a workflow started by hand, tagged by its date and time

This record states how the PDFs of the sheets are released and why, for whoever writes the release workflow or makes a release.

Status: accepted.

## Context

[Issue #1](https://github.com/tiavelum/learning-sheets/issues/1) states that PDFs are not committed and go into releases, that a release of all PDFs is made only now and then by pressing a button, that nobody tags by hand, that the maintainer does no git mechanics and that Claude does not trigger CI. [A comment on issue #1](https://github.com/tiavelum/learning-sheets/issues/1#issuecomment-6591127441) sets the release identifier to date and time, since releases may come more than once a day. Rendering two A4 pages takes a few seconds per sheet, as [issue #1](https://github.com/tiavelum/learning-sheets/issues/1) reports.

## Decision

- `.github/workflows/release.yml` starts only on `workflow_dispatch`, the event a workflow needs [to be run manually](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), from the repository's Actions tab with the button "Run workflow": the maintainer runs it there by hand, and Claude never starts it.
- It runs only on `main`. It runs the checks, renders every sheet, and creates a release whose tag it makes from the time of the run in UTC, in the form `YYYY-MM-DD-HHMM`, such as `2026-11-03-1430`.
- The release holds `<name>.pdf` for each sheet, `learning-sheets-<tag>.zip` holding all of them, and `catalog.json`.
- Its notes are the notes of the GitHub release ([DOC-16](https://github.com/tiavelum/engineering-standards/blob/main/standards/documentation.md#doc-16)) and tell the reader of the sheets what changed for them ([DOC-17](https://github.com/tiavelum/engineering-standards/blob/main/standards/documentation.md#doc-17)): the titles of the sheets added, changed and removed since the previous release, and the number of sheets in all.
- Afterwards it rebuilds the browse page itself, since [events that the workflow's own `GITHUB_TOKEN` causes start no other workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow), other than `workflow_dispatch` and `repository_dispatch` events.

## Alternatives considered

- **A release on every merge.** It would make releases that nobody asked for, against the decision that releases come now and then by a button.
- **Rendering only the sheets that changed.** Rendering all of them takes seconds per sheet, and a release built whole needs no logic to find what changed and holds every PDF from one commit and one renderer.
- **A tag of the date alone, or a semantic version.** A date alone allows one release a day; a semantic version needs someone to judge each change, and the repository's product is printed sheets, not something others build on; for the same reason the standards for software repositories (versioning, module layers) are not applied here ([CO-16](https://github.com/tiavelum/engineering-standards/blob/main/meta/consuming.md#co-16)).
- **Committing the PDFs.** Issue #1 rules it out; [RL-14](https://github.com/tiavelum/engineering-standards/blob/main/standards/repo-layout.md#rl-14) and [RL-13](https://github.com/tiavelum/engineering-standards/blob/main/standards/repo-layout.md#rl-13) keep large binaries and build output out of git.

## Consequences

- A sheet merged to `main` reaches a release only when the maintainer next runs the workflow; until then the PDF its pull request's checks attached, or the canvas's own export, stands in for it.
- A tag is never moved ([NAM-16](https://github.com/tiavelum/engineering-standards/blob/main/standards/naming.md#nam-16)), so a second run within the same minute fails without releasing.
- The latest release holds every sheet's PDF under a fixed name, so the browse page links to each sheet's PDF without knowing the tag.
