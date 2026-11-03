// The build of the browse page by scripts/build-site.mjs: its release lookup
// with a stubbed fetch, the catalog built from the fixture sheet, and the
// built page in Chromium.

import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildSite,
  catalogOf,
  IMAGE_WIDTH,
  latestRelease,
  pageWithCatalog,
} from "../scripts/build-site.mjs";
import { launchBrowser } from "../scripts/render-sheets.mjs";
import { FRONT_MATTER_FIELDS } from "../scripts/sheet-files.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sheets");
const SHEET = "two-pages-of-squares";
const REPO = "https://github.com/tiavelum/learning-sheets";
const temporary = mkdtempSync(path.join(tmpdir(), "build-site-test-"));
after(() => rmSync(temporary, { recursive: true, force: true }));

/** A fetch that answers every request with one status and body, and records the requests. */
function stubFetch(status, body) {
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, headers: options.headers });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return { fetch, requests };
}

const RELEASE = {
  tag_name: "2026-11-03-1430",
  html_url: `${REPO}/releases/tag/2026-11-03-1430`,
  assets: [
    { name: `${SHEET}.pdf` },
    { name: "learning-sheets-2026-11-03-1430.zip" },
    { name: "catalog.json" },
  ],
};

describe("the release lookup", () => {
  test("asks the REST API for the latest release, with the token where one is given", async () => {
    const { fetch, requests } = stubFetch(200, RELEASE);
    const release = await latestRelease({ fetch, token: "secret" });
    assert.equal(
      requests[0].url,
      "https://api.github.com/repos/tiavelum/learning-sheets/releases/latest",
    );
    assert.equal(requests[0].headers.authorization, "Bearer secret");
    assert.deepEqual(release, {
      state: "found",
      tag: "2026-11-03-1430",
      url: RELEASE.html_url,
      assets: [`${SHEET}.pdf`, "learning-sheets-2026-11-03-1430.zip", "catalog.json"],
    });
  });

  test("sends no authorization without a token", async () => {
    const { fetch, requests } = stubFetch(200, RELEASE);
    await latestRelease({ fetch, token: "" });
    assert.equal(requests[0].headers.authorization, undefined);
  });

  test("reads a 404 as no release", async () => {
    const { fetch } = stubFetch(404, { message: "Not Found" });
    assert.deepEqual(await latestRelease({ fetch, token: "" }), { state: "none" });
  });

  test("reads another status or a failed request as unreachable, with the reason", async () => {
    const { fetch } = stubFetch(403, { message: "API rate limit exceeded" });
    assert.deepEqual(await latestRelease({ fetch, token: "" }), {
      state: "unreachable",
      reason: "HTTP 403",
    });
    const failing = async () => {
      throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
    };
    assert.deepEqual(await latestRelease({ fetch: failing, token: "" }), {
      state: "unreachable",
      reason: "ENOTFOUND",
    });
  });
});

describe("the catalog", () => {
  const fields = Object.fromEntries(FRONT_MATTER_FIELDS.map((field) => [field, field]));
  const sheets = [
    { name: "in-the-release", fields: { ...fields, tags: ["a"] } },
    { name: "merged-since", fields: { ...fields, tags: ["b"] } },
  ];

  test("links the PDF of a sheet the latest release holds, and no PDF of one it does not", () => {
    const release = { state: "found", tag: "t", url: `${REPO}/releases/tag/t`, assets: [] };
    release.assets.push("in-the-release.pdf");
    const catalog = catalogOf(sheets, release, "sheets");
    assert.deepEqual(catalog.release, { tag: "t", url: `${REPO}/releases/tag/t` });
    assert.equal(catalog.sheets[0].pdf, `${REPO}/releases/latest/download/in-the-release.pdf`);
    assert.equal(catalog.sheets[1].pdf, null);
  });

  test("links no PDF where there is no release or it cannot be read", () => {
    for (const release of [{ state: "none" }, { state: "unreachable", reason: "HTTP 500" }]) {
      const catalog = catalogOf(sheets, release, "sheets");
      assert.equal(catalog.release, null);
      assert.deepEqual(
        catalog.sheets.map((sheet) => sheet.pdf),
        [null, null],
      );
    }
  });

  test("puts the catalog into the page so that no < in a value closes its script", () => {
    const html = '<body><script id="catalog" type="application/json"></script></body>';
    const page = pageWithCatalog(html, { sheets: [{ title: "</script><b>" }] });
    assert.equal(page.match(/<\/script>/g).length, 1);
    const json = /<script id="catalog" type="application\/json">(.*)<\/script>/.exec(page)[1];
    assert.equal(JSON.parse(json).sheets[0].title, "</script><b>");
  });
});

describe("the build", () => {
  const out = path.join(temporary, "site");
  let built;
  before(async () => {
    const { fetch } = stubFetch(200, RELEASE);
    built = await buildSite({ root: FIXTURES, out, fetch, token: "" });
  });

  test("writes catalog.json with the fixture's folder name, front matter and links", () => {
    const catalog = JSON.parse(readFileSync(path.join(out, "catalog.json"), "utf8"));
    assert.deepEqual(catalog, {
      repository: REPO,
      release: { tag: "2026-11-03-1430", url: RELEASE.html_url },
      sheets: [
        {
          name: SHEET,
          title: "Two Pages of Squares",
          topic: "A fixture for the tests of the checks and the renderer",
          tags: ["fixture", "test"],
          language: "en",
          paper: "a4",
          made: "2026-11-03",
          skill: "tiavelum/claude-setup@4f26fe8",
          artifact: "https://claude.ai/artifact/Fixture0000000000000000",
          artifact_version: "1793655646-5d0b",
          source: `${REPO}/tree/main/tests/fixtures/sheets/${SHEET}`,
          pdf: `${REPO}/releases/latest/download/${SHEET}.pdf`,
          image: `images/${SHEET}.png`,
        },
      ],
    });
    assert.deepEqual(built.lines.slice(-2), [
      "the latest release 2026-11-03-1430 holds the PDF of 1 of 1 sheet",
      `1 sheet built into ${out}`,
    ]);
  });

  test("writes the page, its script and stylesheet, and a PNG of page one", () => {
    for (const file of ["index.html", "browse.js", "browse.css"]) {
      assert.ok(existsSync(path.join(out, file)), file);
    }
    assert.equal(existsSync(path.join(out, "README.md")), false);
    const png = readFileSync(path.join(out, "images", `${SHEET}.png`));
    assert.equal(png.readUInt32BE(16), IMAGE_WIDTH);
  });

  test("builds a page that says so where the root holds no sheet", async () => {
    const root = path.join(temporary, "empty-root");
    mkdirSync(root);
    const { fetch } = stubFetch(404, { message: "Not Found" });
    const result = await buildSite({ root, out: path.join(temporary, "empty"), fetch, token: "" });
    assert.deepEqual(result.catalog.sheets, []);
    assert.deepEqual(result.lines, [
      "no release yet: every sheet shows as not released yet",
      `0 sheets built into ${path.join(temporary, "empty")}`,
    ]);
  });

  test("fails where the release lookup is required and the API cannot be reached", async () => {
    const { fetch } = stubFetch(500);
    await assert.rejects(
      buildSite({ root: FIXTURES, out: path.join(temporary, "x"), fetch, requireRelease: true }),
      /the latest release could not be read \(HTTP 500\)/,
    );
  });

  test("shows the fixture sheet in Chromium, and filters and sorts it with a second sheet", async () => {
    const root = path.join(temporary, "two-sheets");
    mkdirSync(root);
    cpSync(path.join(FIXTURES, SHEET), path.join(root, SHEET), { recursive: true });
    // A second sheet with another tag, so that the tag filter has one to leave out.
    const other = path.join(root, "two-pages-of-circles");
    cpSync(path.join(FIXTURES, SHEET), other, { recursive: true });
    const readme = path.join(other, "README.md");
    writeFileSync(
      readme,
      readFileSync(readme, "utf8")
        .replace('"Two Pages of Squares"', '"Two Pages of Circles"')
        .replace('["fixture", "test"]', '["other"]')
        .replace('"2026-11-03"', '"2026-11-02"'),
    );
    const { fetch } = stubFetch(404, { message: "Not Found" });
    const site = path.join(temporary, "two-sheets-site");
    await buildSite({ root, out: site, fetch, token: "" });

    const browser = await launchBrowser();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const outside = [];
      page.on("request", (request) => {
        if (!request.url().startsWith("file:")) outside.push(request.url());
      });
      await page.goto(pathToFileURL(path.join(site, "index.html")).href);
      const sheet = page.getByRole("article", { name: "Two Pages of Squares" });
      await sheet.waitFor();
      assert.equal(await page.locator("#count").textContent(), "2 sheets");
      assert.deepEqual(await page.locator("#sheets h2").allTextContents(), [
        "Two Pages of Squares",
        "Two Pages of Circles",
      ]);
      assert.match(await sheet.textContent(), /PDF not released yet/);
      assert.equal(
        await sheet
          .getByRole("link", { name: "Source of Two Pages of Squares" })
          .getAttribute("href"),
        `${REPO}/tree/main/sheets/${SHEET}`,
      );
      const loaded = await sheet
        .getByRole("img", { name: "Page one of Two Pages of Squares" })
        .evaluate((image) => image.complete && image.naturalWidth);
      assert.equal(loaded, IMAGE_WIDTH);

      // On a phone the filters start folded below their summary.
      assert.equal(await page.getByLabel("Search titles and topics").isVisible(), false);
      await page.getByText("Filter and sort").click();
      await page.getByLabel("Search titles and topics").fill("squares");
      assert.equal(await page.locator("#sheets > li").count(), 1);
      await page.getByLabel("Search titles and topics").fill("");
      await page.getByLabel("Sort by").selectOption("title");
      assert.deepEqual(await page.locator("#sheets h2").allTextContents(), [
        "Two Pages of Circles",
        "Two Pages of Squares",
      ]);

      await page.getByRole("checkbox", { name: /fixture/ }).check();
      assert.deepEqual(await page.locator("#sheets h2").allTextContents(), [
        "Two Pages of Squares",
      ]);
      assert.equal(await page.locator("#count").textContent(), "1 of 2 sheets match");
      assert.match(page.url(), /\?tag=fixture&sort=title$/);
      await page.getByLabel("Search titles and topics").fill("no such words");
      assert.equal(await page.locator("#sheets > li").count(), 0);
      assert.equal(await page.locator("#empty").isVisible(), true);
      await page.getByRole("button", { name: "Clear the filters" }).click();
      assert.equal(await page.locator("#sheets > li").count(), 2);
      assert.deepEqual(outside, []);
    } finally {
      await browser.close();
    }
  });
});
