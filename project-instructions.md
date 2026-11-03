Repository tiavelum/learning-sheets.

This repository keeps the learning sheets made with the learning-sheet skill of tiavelum/claude-setup, each as the files of its Design canvas with a README, so that they can be found, printed and changed after their session ends.

Canvas files: Take a sheet's canvas files only from its artifact through the Artifact tool; to change a page, change it on the canvas and read it again. `sheets/README.md` gives how the files are kept.

Prompts: When unsure whether a detail in a sheet's prompt is private, leave it out; `sheets/README.md` gives what a prompt leaves out and how.

Merging: You may merge a pull request that adds or changes one sheet. List the artifact's files with the Artifact tool and give the agent that checks the pull request each file's sha256 and the version, so that it compares them with the sha256 of each committed canvas file and the README's `artifact_version`.

Workflows: Never dispatch or rerun a GitHub Actions workflow; tiavelum starts each release with the "Run workflow" button.

Done: Run `npm ci && npx biome ci . && npm test && npm run check`, and `npm run render -- <name>` for each sheet you added or changed, before each push. If you cannot run them, wait for the CI run of your commit and report its result.
