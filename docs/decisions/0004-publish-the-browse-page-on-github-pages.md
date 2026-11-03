# 0004: Publish the browse page on GitHub Pages, built from the sheet READMEs

This record states how the sheets can be browsed and filtered and why, for whoever builds or deploys the browse page.

Status: accepted.

## Context

[Issue #1](https://github.com/tiavelum/learning-sheets/issues/1) asks for a way to browse and filter the existing sheets, a script or better a web page. [Issue #3](https://github.com/tiavelum/learning-sheets/issues/3) settles that the repository stays public. [GitHub Pages is available in public repositories with GitHub Free](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), and serves a project site at `<owner>.github.io/<repository>`.

## Decision

- `scripts/build-site.mjs` builds the page from the sheet READMEs and from the page's source in `site/`. The built page is `index.html`, `catalog.json` and a small image of each sheet's page one; none of them is committed.
- `catalog.json` holds, for each sheet, its folder name and the fields of its front matter. It is also the list a session reads for every sheet's name and topic. It is published beside the page at `https://tiavelum.github.io/learning-sheets/catalog.json` once Pages is enabled; until then the listing of `sheets/` and the READMEs give the names and topics.
- The page filters by text in title and topic, by tag and by language, and sorts by date or title. Each sheet links to its folder, to its artifact, and to its PDF in the latest release as `releases/latest/download/<name>.pdf`, the form GitHub gives [a link to an asset of the latest release](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases), or says that the sheet is not released yet.
- `.github/workflows/pages.yml` builds it on every push to `main`, and the release workflow builds it after each release. It deploys to `https://tiavelum.github.io/learning-sheets/` once Pages has [the publishing source "GitHub Actions"](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site); until then it builds the page and stops with a notice.

## Alternatives considered

- **A script that lists and filters the sheets.** It needs a clone and a terminal, while the page works for anyone the maintainer shares a link with.
- **A page built from a committed catalog.** It would hold the facts of the READMEs a second time ([DOC-3](https://github.com/tiavelum/engineering-standards/blob/main/standards/documentation.md#doc-3)), as [decision 0001](0001-keep-each-sheet-as-its-canvas-files.md) records.
- **A private repository.** Its Pages site would need a paid plan and [would still be public on the internet](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), with links to sources and PDFs that need signing in.

## Consequences

- The page shows the sheets of `main`, rebuilt on every merge, and links to the PDFs of the latest release, so a sheet merged since that release shows as not released yet.
- Because the repository and its page are public, a sheet's README and prompt hold no names of people and no private details.
- Pages is enabled once, by hand, in the repository's settings with [the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) "GitHub Actions", under Settings, Pages, "Build and deployment", Source; the page deploys from the next run on.
