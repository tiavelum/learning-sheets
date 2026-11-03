# 0002: Render each sheet to PDF with Playwright's Chromium and Fontsource fonts

This record states how a sheet's canvas files become its PDF and why, for whoever writes or runs the renderer and the checks.

Status: accepted.

## Context

A page file of a canvas wraps plain HTML and inline SVG in an `<x-dc>` element, with its stylesheets and font links in a `<helmet>`, and loads the canvas runtime (`support.js` and a `text/x-dc` script). Its fonts come from a Google Fonts `css2` stylesheet. [The learning-sheet skill](https://github.com/tiavelum/claude-setup/blob/main/skills/learning-sheet/SKILL.md#lay-out-the-pages) makes one artboard per page at A4 or Letter and gives every table column and card a width in px with a fixed table layout, so that no other browser can redistribute the space.

[Issue #1](https://github.com/tiavelum/learning-sheets/issues/1) observed that the Claude app's cloud workspace cannot reach Google Fonts while npm `@fontsource` packages work there, and that in the session that made "Logins at a Glance" such a render matched the canvas's own PDF export to the pixel on a page without an auto-sized table. [Fontsource](https://fontsource.org/docs/getting-started/introduction) is a collection of open-source fonts packaged into individual npm packages for self-hosting.

## Decision

- One script, `scripts/render-sheets.mjs`, renders the sheets, on Node 22 with Playwright's Chromium, both pinned in `package-lock.json` ([TL-14](https://github.com/tiavelum/engineering-standards/blob/main/standards/tooling.md#tl-14)).
- For each page, in the order of `canvas.json`, it moves the `<helmet>` into `<head>`, keeps what `<x-dc>` holds as the body, drops the canvas runtime, replaces the Google Fonts `css2` link with the Fontsource stylesheets of the same families and weights from `node_modules`, and prints one PDF page at the board's `w` × `h` with backgrounds. It merges the pages into `<name>.pdf`, where `<name>` is the sheet's folder name, and can write a PNG of page one for the browse page.
- A sheet that uses a font family without its Fontsource package fails, naming the package to add.
- It refuses a page that is not static (a hole `{{…}}`, `<sc-for>`, `<sc-if>` or `<dc-import>`) or that loads an uploaded asset (`/_blob/…`) or any other network resource, and reports a page whose content runs past its frame.
- The same command runs in CI, in a Claude cloud workspace and on a Mac.

## Alternatives considered

- **The canvas's own PDF export.** It needs the Claude app and a person to press it, so it serves the short cycle while the session lives but cannot build every sheet in a release.
- **Fonts from Google Fonts at render time.** The cloud workspace cannot reach them, so a session could not render the sheet it archives, and a render would depend on a service that can change its files.
- **Font files committed to the repository.** They would repeat what the npm registry already versions, and the lock file pins the Fontsource packages as it pins every other dependency.
- **Another browser engine or an HTML-to-PDF library.** The canvas shows its pages in a browser, and a render matched the canvas's export with Chromium; another engine would break lines differently and move content on a fixed page.

## Consequences

- A sheet renders the same in CI and in the session that archives it, so the PDF a pull request's checks attach shows what the release will hold.
- Every font family a sheet uses needs its Fontsource package among the repository's dependencies, and the checks name the package that is missing.
- A page made with the canvas's interactive features or with uploaded images cannot be archived until it is static and loads nothing but its fonts.
