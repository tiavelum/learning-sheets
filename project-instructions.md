Repository tiavelum/learning-sheets.

This repository keeps the learning sheets made with the learning-sheet skill of tiavelum/claude-setup, each as the files of its Design canvas with a README, so that they can be found, printed and changed after their session ends.

Canvas files: Take a sheet's canvas files only from its artifact through the Artifact tool, and commit them as the tool saved them. Never write, fix or reformat one yourself; to change a page, change it on the canvas and read it again.

Prompts: Before committing a sheet's README, leave every name of a person and every private detail out of its prompt, marked as `sheets/README.md` shows; when unsure whether a detail is private, leave it out.

Merging: You may merge a pull request that adds or changes one sheet. Have the agent that checks it compare each committed canvas file's sha256, and the README's `artifact_version`, with what the Artifact tool reports for the artifact.

Workflows: Never dispatch or rerun a GitHub Actions workflow; tiavelum starts each release with the "Run workflow" button.

Done: Run `npm ci && npx biome ci . && npm test && npm run check`, and `npm run render -- <name>` for each sheet you added or changed, before each push. If you cannot run them, wait for the CI run of your commit and report its result.
