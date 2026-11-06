# 0008: Keep the learning-sheet skill in this repository

This record states where the learning-sheet skill is kept and how a sheet's `skill_version` names it, and why, for whoever changes or uploads the skill and for whoever archives a sheet or writes the scripts that check its README.

Status: accepted.

## Context

The learning-sheet skill was kept in tiavelum/claude-setup, in `skills/learning-sheet/SKILL.md`, beside that repository's other skills, and a sheet's `skill_version` named a commit of tiavelum/claude-setup in the form `tiavelum/claude-setup@<commit>` that [decision 0006](0006-version-a-sheet-in-its-folder-and-record-its-request.md) gives. tiavelum removed the skill from tiavelum/claude-setup, whose last version of it is its commit 797ca6e, and chose to keep it here, as [issue #48](https://github.com/tiavelum/learning-sheets/issues/48) states.

## Decision

- **The skill** is kept in `skills/learning-sheet/SKILL.md` and uploaded to the claude.ai account from there, as the README's "Upload the skill" gives. Its text came over unchanged from 797ca6e.
- **The skill still names no repository.** It finds the archive through the person's instructions, as [decision 0005](0005-archive-and-change-sheets-by-pull-request.md) gives, so a person who keeps sheets elsewhere can use it as it is.
- **`skill_version`** names a commit of this repository, in the form `tiavelum/learning-sheets@<commit>`, for a version made with the skill kept here. A version made before keeps naming its commit of tiavelum/claude-setup, in the form decision 0006 gives, and the sheet check accepts both forms.

## Alternatives considered

- **Keep the skill in tiavelum/claude-setup.** tiavelum removed it there, so its text, its versions and the archive steps that name them would stay in two repositories.
- **Let the skill name this repository**, so that the person's instructions need not. Decision 0005 rejected that, since it ties a skill that others can use to one person's archive.
- **Rewrite every existing `skill_version` to a commit of this repository.** Those versions were made from a text whose history is in tiavelum/claude-setup, and a commit here would name a version the sheet was not made with.

## Consequences

- A change to the skill is made by pull request here, and the skill is uploaded again after it.
- The skill is uploaded from a second repository beside tiavelum/claude-setup, whose skills are packaged by its own script.
- The sheet check accepts `skill_version` with either repository, and the steps of "Archive a sheet" look for the version here first and in tiavelum/claude-setup second.
