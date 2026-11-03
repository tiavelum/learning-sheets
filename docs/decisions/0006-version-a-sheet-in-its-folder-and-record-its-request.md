# 0006: Keep a sheet's versions in its folder, and record its request in the README and its prompt in the pull request

This record states how a sheet's README records the sheet's versions and the request behind them, and how a new sheet on a topic already present is kept, and why, for whoever archives, changes or checks a sheet and for whoever writes the scripts that read its README.

Status: accepted.

## Context

A session that makes a learning sheet can find a sheet on its topic archived here by an earlier session, and build on that sheet's canvas instead of making another next to it, which [the pull request tiavelum/claude-setup#181](https://github.com/tiavelum/claude-setup/pull/181) adds to the learning-sheet skill as its first steps. Before that, sheets on one topic were made side by side in separate sessions; the import of the sheets made so far keeps them as the versions of one sheet, as [issue #28](https://github.com/tiavelum/learning-sheets/issues/28) settles. A sheet then has versions, made at different dates, possibly by different versions of the skill and from different prompts.

[Decision 0001](0001-keep-each-sheet-as-its-canvas-files.md) gave the README the fields `made` and `skill` and, below the front matter, one sentence on what the sheet covers and for whom and the prompt as written, and kept all of them when a sheet changed. The README then named only the first version's skill and prompt, and a later version's were found only in git. A name with the scene of its story told two sheets on one topic apart, which [issue #28](https://github.com/tiavelum/learning-sheets/issues/28) rules out: a name states the topic, and the scene belongs to the story.

## Decision

As [issue #29](https://github.com/tiavelum/learning-sheets/issues/29) and [issue #28](https://github.com/tiavelum/learning-sheets/issues/28) settle:

- **`created`** replaces `made`: the date, in UTC, on which the sheet's first version was handed over. It never changes.
- **`last_modified`** follows `created`: the date, in UTC, on which the sheet's latest version was handed over, equal to `created` for a sheet with one version.
- **`skill_version`** replaces `skill`: the learning-sheet skill that made the latest version, in the same form, `tiavelum/claude-setup@<commit>`.
- **`## Request`** replaces the sentence and `## Prompt`: two or three sentences, in English, saying what the sheet was asked to cover, for whom and what for, as the session understood the person's prompt. A later version rewrites it where its request changes what the sheet is asked to be.
- **The prompt as written** stands in the description of the pull request that archives each version, with names of people and private details left out and marked, so that the sheet can be made again from it and the request checked against it.
- **A new sheet on a topic already present** is, as the person chooses, a new version of that sheet, kept in its folder, or a variant beside it, with a name that says what sets it apart and never its scene; only where no such name is found does a variant take the topic's name with `-2`, `-3` in the order made, with no `v`, since these count variants and not versions.

[The contract of a sheet folder](../../sheets/README.md) gives every field, form and step, and the README's tasks "Archive a sheet" and "Change a sheet" the steps that write them.

## Alternatives considered

- **Keep the first version's values**, as decision 0001 did. The README would name a skill that did not make the current pages, and the latest version's date and request would be found only in git.
- **A `## Prompts` section that lists every version's prompt**, each under a line with its date and skill. The README would hold the person's words with marks for what was left out, grow with every version, and need the check to match its last entry with the front matter.
- **All three fields follow the latest version**, without `created`. The sheet would look new on the browse page after each version, and when it first existed would be found only in git.
- **No `last_modified`**, the latest date read from git or from a list of prompts. The browse page and the release catalog read the front matter, so they could not show or sort by the last change.
- **The prompt as written kept nowhere.** Only the person's own words let a sheet be made again from the same prompt with a newer skill, and let a checker test the request against them.
- **A variant named after its scene, or numbered with `v`.** The scene says nothing of what the sheet covers, and a `v` would read as a version of the same sheet.

## Consequences

- The browse page shows when each sheet was created and last modified, and sorts by the last change, so a sheet built on moves up the list.
- The check enforces the fields, their order, a `last_modified` not before `created`, and `## Request` as the README's only section with a request of two or three sentences; whether the request is in English and matches the prompt is left to the review of the pull request, which holds the prompt.
- A session that finds a sheet on its topic asks the person whether to build on it or make a variant, before it archives.
- The prompts of the sheets archived before this decision stand in the description of [pull request #31](https://github.com/tiavelum/learning-sheets/pull/31) (feat: record when a sheet was created and last modified, its skill version and its request).
