# Site

This folder holds the source of the browse page, which lists every sheet and filters and sorts them, and this file describes its files and how the build fills them, for whoever changes the page.

| File         | Holds                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `index.html` | The page: the filters, the list and an empty `<script id="catalog" type="application/json">` that the build fills         |
| `browse.js`  | The script that reads the catalog from that element, lists each sheet and filters and sorts the list by the form's values |
| `browse.css` | The stylesheet, in the system fonts, with one palette for a light and one for a dark colour scheme                        |

[`scripts/build-site.mjs`](../scripts/README.md#build-sitemjs) copies these files into the built page, puts the catalog into the empty `catalog` element of `index.html`, and writes `catalog.json` and the images of page one beside them. The catalog stands in the page, not only in `catalog.json`, so the built page also works when opened as a file, where a browser does not fetch JSON. The page loads nothing from another site: no font, no script and no stylesheet from elsewhere.

The page keeps the form's values in its address, as `?q=`, `tag=`, `lang=` and `sort=`, so that a filtered list can be shared as a link. A sheet that the latest release holds no PDF of shows "PDF not released yet" in a dashed amber box with a dash, where a released one shows a filled "PDF" button with a down arrow, so the two differ in colour, in shape and in their words.
