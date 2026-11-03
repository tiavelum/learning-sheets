// Lists the sheets of the catalog that build-site.mjs puts into the page, and
// filters and sorts them by the form. The filters stand in the page's URL, so
// a filtered list can be shared as a link.

const PAPERS = { a4: "A4", letter: "US Letter" };
// The image of page one is shown at this width, its height following the paper.
const IMAGE_WIDTH = 120;
const IMAGE_HEIGHTS = { a4: 170, letter: 155 };

const catalog = JSON.parse(document.getElementById("catalog").textContent || '{"sheets":[]}');
const sheets = catalog.sheets ?? [];
const languageNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "code" });
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

const form = document.getElementById("filters");
const textInput = document.getElementById("text");
const tagList = document.getElementById("tag-list");
const languageSelect = document.getElementById("language");
const sortSelect = document.getElementById("sort");
const count = document.getElementById("count");
const list = document.getElementById("sheets");
const empty = document.getElementById("empty");

function element(name, properties = {}, children = []) {
  const node = document.createElement(name);
  for (const [key, value] of Object.entries(properties)) {
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

/** A link only to an https address, since the catalog's values end up in href. */
function safeUrl(url) {
  return typeof url === "string" && /^https:\/\//.test(url) ? url : null;
}

function languageName(tag) {
  try {
    const name = languageNames.of(tag);
    return name && name !== tag ? `${name} (${tag})` : tag;
  } catch {
    return tag;
  }
}

function dateText(day) {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : dateFormat.format(date);
}

function dateFact(term, day) {
  return element("div", {}, [
    element("dt", { text: term }),
    element("dd", {}, [element("time", { datetime: day, text: dateText(day) })]),
  ]);
}

/** A link whose visible label is short and whose name, for a screen reader, names the sheet. */
function sheetLink(href, label, title, className) {
  return element("a", { href, class: className }, [
    element("span", { text: label }),
    element("span", { class: "visually-hidden", text: ` of ${title}` }),
  ]);
}

function card(sheet) {
  const titleId = `sheet-${sheet.name}`;
  const facts = element("dl", { class: "facts" }, [
    element("div", {}, [
      element("dt", { text: "Language" }),
      element("dd", { text: languageName(sheet.language) }),
    ]),
    element("div", {}, [
      element("dt", { text: "Paper" }),
      element("dd", { text: PAPERS[sheet.paper] ?? sheet.paper }),
    ]),
    dateFact("Created", sheet.created),
    dateFact("Last modified", sheet.last_modified),
  ]);
  const tags = element(
    "ul",
    { class: "tags-of-sheet", "aria-label": "Tags" },
    (sheet.tags ?? []).map((tag) => element("li", { text: tag })),
  );

  const actions = element("ul", { class: "actions", "aria-label": "Links" });
  const pdf = safeUrl(sheet.pdf);
  if (pdf) {
    actions.append(element("li", {}, [sheetLink(pdf, "PDF", sheet.title, "pdf")]));
  } else {
    actions.append(
      element("li", {}, [
        element("span", { class: "unreleased" }, [
          element("span", { text: "PDF not released yet" }),
        ]),
      ]),
    );
  }
  const source = safeUrl(sheet.source);
  if (source)
    actions.append(element("li", {}, [sheetLink(source, "Source", sheet.title, "plain")]));
  const artifact = safeUrl(sheet.artifact);
  if (artifact) {
    actions.append(element("li", {}, [sheetLink(artifact, "Canvas", sheet.title, "plain")]));
  }

  const image = element("img", {
    src: sheet.image,
    alt: `Page one of ${sheet.title}`,
    width: String(IMAGE_WIDTH),
    height: String(IMAGE_HEIGHTS[sheet.paper] ?? IMAGE_HEIGHTS.a4),
    loading: "lazy",
    decoding: "async",
  });

  return element("li", {}, [
    element("article", { class: "sheet", "aria-labelledby": titleId }, [
      element("div", { class: "thumb" }, [image]),
      element("div", { class: "body" }, [
        element("h2", { id: titleId, text: sheet.title }),
        element("p", { class: "topic", text: sheet.topic }),
        facts,
        tags,
        actions,
      ]),
    ]),
  ]);
}

const cards = new Map(sheets.map((sheet) => [sheet.name, card(sheet)]));

function tagCheckboxes() {
  const counts = new Map();
  for (const sheet of sheets) {
    for (const tag of sheet.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  for (const tag of [...counts.keys()].sort()) {
    const id = `tag-${tag}`;
    const input = element("input", {
      type: "checkbox",
      id,
      name: "tag",
      value: tag,
      "aria-describedby": "tags-hint",
    });
    const label = element("label", { for: id }, [
      element("span", { class: "tag-name", text: tag }),
      element("span", { class: "tag-count", text: String(counts.get(tag)) }),
    ]);
    label.append(element("span", { class: "visually-hidden", text: " sheets" }));
    tagList.append(element("div", { class: "tag-option" }, [input, label]));
  }
}

function languageOptions() {
  const languages = [...new Set(sheets.map((sheet) => sheet.language))].sort();
  for (const language of languages) {
    languageSelect.append(element("option", { value: language, text: languageName(language) }));
  }
}

function selectedTags() {
  return [...tagList.querySelectorAll("input:checked")].map((input) => input.value);
}

function matches(sheet, { words, tags, language }) {
  const haystack = `${sheet.title} ${sheet.topic}`.toLocaleLowerCase();
  return (
    words.every((word) => haystack.includes(word)) &&
    tags.every((tag) => (sheet.tags ?? []).includes(tag)) &&
    (language === "" || sheet.language === language)
  );
}

const byTitle = (a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" });
const byDate = (a, b) => b.last_modified.localeCompare(a.last_modified) || byTitle(a, b);

/** The form's state in the page's URL, without the values that are the defaults. */
function writeUrl(state) {
  const params = new URLSearchParams();
  if (textInput.value.trim() !== "") params.set("q", textInput.value.trim());
  for (const tag of state.tags) params.append("tag", tag);
  if (state.language !== "") params.set("lang", state.language);
  if (state.sort !== "date") params.set("sort", state.sort);
  const query = params.toString();
  const url = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
  history.replaceState(null, "", url);
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  textInput.value = params.get("q") ?? "";
  const tags = params.getAll("tag");
  for (const input of tagList.querySelectorAll("input")) input.checked = tags.includes(input.value);
  const language = params.get("lang") ?? "";
  if ([...languageSelect.options].some((option) => option.value === language)) {
    languageSelect.value = language;
  }
  if (params.get("sort") === "title") sortSelect.value = "title";
}

function update() {
  const state = {
    words: textInput.value.toLocaleLowerCase().split(/\s+/).filter(Boolean),
    tags: selectedTags(),
    language: languageSelect.value,
    sort: sortSelect.value,
  };
  const shown = sheets.filter((sheet) => matches(sheet, state));
  shown.sort(state.sort === "title" ? byTitle : byDate);
  list.replaceChildren(...shown.map((sheet) => cards.get(sheet.name)));
  count.textContent =
    shown.length === sheets.length
      ? `${sheets.length} sheet${sheets.length === 1 ? "" : "s"}`
      : `${shown.length} of ${sheets.length} sheets match`;
  empty.hidden = shown.length > 0;
  empty.textContent = "No sheet matches these filters. Clear the filters to see every sheet.";
  writeUrl(state);
}

function releaseText() {
  const release = document.getElementById("release");
  if (catalog.release && safeUrl(catalog.release.url)) {
    release.append(
      "The PDFs come from the latest release, ",
      element("a", { href: catalog.release.url, text: catalog.release.tag }),
      ".",
    );
  } else {
    release.textContent =
      "No sheet links to a PDF: the latest release is missing or could not be read.";
  }
}

releaseText();
if (sheets.length === 0) {
  count.textContent = "No sheets yet";
  empty.hidden = false;
  empty.textContent =
    "The repository holds no sheet yet. Sheets show here once they are added to it.";
} else {
  tagCheckboxes();
  languageOptions();
  readUrl();
  // The filters start open where they stand beside the list, and closed on a
  // narrow screen, where they would stand before it, unless the URL sets one.
  const filterBox = document.getElementById("filter-box");
  filterBox.open = matchMedia("(min-width: 52rem)").matches || location.search !== "";
  document.getElementById("filter-area").hidden = false;
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("submit", (event) => event.preventDefault());
  document.getElementById("clear").addEventListener("click", () => {
    form.reset();
    update();
    textInput.focus();
  });
  update();
}
