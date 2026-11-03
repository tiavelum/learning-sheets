# 0002: Render each sheet to PDF with Playwright's Chromium and Fontsource fonts

This record states how a sheet's canvas files become its PDF and why, for whoever writes or runs the renderer and the checks.

Status: accepted.

## Context

A page file of a canvas holds its page's HTML in the canvas's own elements and loads the canvas runtime, as [Page files](../../sheets/README.md#page-files) describes, and takes its fonts from a Google Fonts `css2` stylesheet. [The learning-sheet skill](https://github.com/tiavelum/claude-setup/blob/main/skills/learning-sheet/SKILL.md#lay-out-the-pages) makes one artboard per page at A4 or Letter and gives every table column and card a width in px with a fixed table layout, so that no other browser can redistribute the space.

[Issue #1](https://github.com/tiavelum/learning-sheets/issues/1) reports that the Claude app's cloud workspace cannot reach Google Fonts while npm `@fontsource` packages work there, and that in the session that made "Logins at a Glance" such a render matched the canvas's own PDF export to the pixel on a page without an auto-sized table. [Fontsource](https://fontsource.org/docs/getting-started/introduction) is a collection of open-source fonts packaged into individual npm packages for self-hosting.

## Decision

- One script, `scripts/render-sheets.mjs`, renders the sheets with Playwright on Node 22. Playwright is pinned in `package-lock.json` ([TL-14](https://github.com/tiavelum/engineering-standards/blob/main/standards/tooling.md#tl-14)) and Node by its exact version in the workflows ([TL-15](https://github.com/tiavelum/engineering-standards/blob/main/standards/tooling.md#tl-15)). The script drives Playwright's Chromium in CI and on a Mac, and the Chrome installed in a Claude cloud workspace, where the download host is not reachable.
- For each page, in the reading order of the frames in `canvas.json`, it moves the `<helmet>` into `<head>`, keeps what `<x-dc>` holds as the body, drops the canvas runtime, replaces the Google Fonts `css2` link and its `preconnect` links with the Fontsource stylesheets of the same families and weights from `node_modules`, and prints one PDF page at the board's `w` × `h` with backgrounds. A variable package names its family with the suffix ` Variable`, such as `Bricolage Grotesque Variable`, so the script gives the page's family name to it. It merges the pages into `<name>.pdf`, where `<name>` is the sheet's folder name, and can write a PNG of page one for the browse page.
- A sheet that uses a font family without its Fontsource package fails, naming the package to add.
- It refuses a page that breaks the static rule of [Page files](../../sheets/README.md#page-files) and reports a page whose content runs past its frame.
- The same command runs in CI, in a Claude cloud workspace and on a Mac.

## Alternatives considered

- **The canvas's own PDF export.** It needs the Claude app and a person to press it, so it serves the short cycle while the session lives but cannot build every sheet in a release.
- **Fonts from Google Fonts at render time.** The cloud workspace cannot reach them, so a session could not render the sheet it archives, and a render would depend on a service that can change its files.
- **Font files committed to the repository.** They would repeat what the npm registry already versions, and the lock file pins the Fontsource packages as it pins every other dependency.
- **Another browser engine or an HTML-to-PDF library.** The canvas shows its pages in a browser, and a render matched the canvas's export with Chromium; another engine would break lines differently and move content on a fixed page.

## Consequences

- The PDF a pull request's checks attach comes from CI's Chromium, as the release's PDFs do, so it shows what the release will hold; a render in a cloud workspace uses its Chrome and can differ in line breaks.
- Every font family a sheet uses needs its Fontsource package among the repository's dependencies, and the checks name the package that is missing.
- A page made with the canvas's interactive features or with uploaded images cannot be archived until it is static and loads nothing over the network but what [Page files](../../sheets/README.md#page-files) allows.
