import { readFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";

// The tags that a WOFF2 table directory gives by their index, from the
// table of known tags in the W3C's WOFF File Format 2.0.
const KNOWN_TAGS = [
  "cmap",
  "head",
  "hhea",
  "hmtx",
  "maxp",
  "name",
  "OS/2",
  "post",
  "cvt ",
  "fpgm",
  "glyf",
  "loca",
  "prep",
  "CFF ",
  "VORG",
  "EBDT",
  "EBLC",
  "gasp",
  "hdmx",
  "kern",
  "LTSH",
  "PCLT",
  "VDMX",
  "vhea",
  "vmtx",
  "BASE",
  "GDEF",
  "GPOS",
  "GSUB",
  "EBSC",
  "JSTF",
  "MATH",
  "CBDT",
  "CBLC",
  "COLR",
  "CPAL",
  "SVG ",
  "sbix",
  "acnt",
  "avar",
  "bdat",
  "bloc",
  "bsln",
  "cvar",
  "fdsc",
  "feat",
  "fmtx",
  "fvar",
  "gvar",
  "hsty",
  "just",
  "lcar",
  "mort",
  "morx",
  "opbd",
  "prop",
  "trak",
  "Zapf",
  "Silf",
  "Glat",
  "Gloc",
  "Feat",
  "Sill",
];

const read = new Map();

// The PostScript name of a WOFF2 file, which Chromium reports for a font it
// drew with, and the code points that its cmap maps to a glyph.
export function fontFile(file) {
  if (!read.has(file)) {
    const tables = woff2Tables(readFileSync(file));
    if (!tables.cmap) throw new Error("holds no cmap table");
    read.set(file, {
      name: tables.name ? postScriptName(tables.name) : null,
      characters: codePoints(tables.cmap),
    });
  }
  return read.get(file);
}

function woff2Tables(data) {
  if (data.length < 48 || data.toString("latin1", 0, 4) !== "wOF2") {
    throw new Error("is not a WOFF2 file");
  }
  const count = data.readUInt16BE(12);
  const compressed = data.readUInt32BE(20);
  let at = 48;
  const base128 = () => {
    let value = 0;
    for (let bytes = 0; bytes < 5; bytes++) {
      const byte = data[at++];
      value = value * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
    throw new Error("holds a table length longer than five bytes");
  };
  const entries = [];
  for (let table = 0; table < count; table++) {
    const flags = data[at++];
    let tag = KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) {
      tag = data.toString("latin1", at, at + 4);
      at += 4;
    }
    const length = base128();
    // glyf and loca are transformed at version 0, every other table at any other version.
    const version = flags >> 6;
    const transformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    entries.push({ tag, length: transformed ? base128() : length });
  }
  // The tables stand one after the other in a single Brotli stream.
  const stream = brotliDecompressSync(data.subarray(at, at + compressed));
  const tables = {};
  let offset = 0;
  for (const { tag, length } of entries) {
    tables[tag] = stream.subarray(offset, offset + length);
    offset += length;
  }
  return tables;
}

// Name ID 6, from a Windows or Unicode record before a Macintosh one.
function postScriptName(table) {
  const count = table.readUInt16BE(2);
  const strings = table.readUInt16BE(4);
  const records = [];
  for (let record = 0; record < count; record++) {
    const at = 6 + record * 12;
    if (table.readUInt16BE(at + 6) !== 6) continue;
    const platform = table.readUInt16BE(at);
    const start = strings + table.readUInt16BE(at + 10);
    const bytes = Buffer.from(table.subarray(start, start + table.readUInt16BE(at + 8)));
    records.push({
      platform,
      text: platform === 1 ? bytes.toString("latin1") : bytes.swap16().toString("utf16le"),
    });
  }
  const order = [3, 0, 1];
  records.sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform));
  return records[0]?.text ?? null;
}

// The code points of every Unicode subtable, in the formats that map them: 4, 6, 12 and 13.
function codePoints(table) {
  const held = new Set();
  const count = table.readUInt16BE(2);
  for (let subtable = 0; subtable < count; subtable++) {
    const at = 4 + subtable * 8;
    const platform = table.readUInt16BE(at);
    const encoding = table.readUInt16BE(at + 2);
    if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) continue;
    const offset = table.readUInt32BE(at + 4);
    const format = table.readUInt16BE(offset);
    if (format === 4) segmentMap(table, offset, held);
    else if (format === 6) {
      const first = table.readUInt16BE(offset + 6);
      const entries = table.readUInt16BE(offset + 8);
      for (let entry = 0; entry < entries; entry++) {
        if (table.readUInt16BE(offset + 10 + entry * 2) !== 0) held.add(first + entry);
      }
    } else if (format === 12 || format === 13) {
      const groups = table.readUInt32BE(offset + 12);
      for (let group = 0; group < groups; group++) {
        const entry = offset + 16 + group * 12;
        const start = table.readUInt32BE(entry);
        const end = table.readUInt32BE(entry + 4);
        const glyph = table.readUInt32BE(entry + 8);
        for (let code = start; code <= end; code++) {
          // Format 12 counts the glyph up from the group's first; format 13 maps every code to one.
          if ((format === 12 ? glyph + code - start : glyph) !== 0) held.add(code);
        }
      }
    }
  }
  return held;
}

function segmentMap(table, offset, held) {
  const segments = table.readUInt16BE(offset + 6) / 2;
  const ends = offset + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const rangeOffsets = deltas + segments * 2;
  for (let segment = 0; segment < segments; segment++) {
    const end = table.readUInt16BE(ends + segment * 2);
    const start = table.readUInt16BE(starts + segment * 2);
    const delta = table.readUInt16BE(deltas + segment * 2);
    const rangeOffset = table.readUInt16BE(rangeOffsets + segment * 2);
    for (let code = start; code <= end && code !== 0xffff; code++) {
      let glyph;
      if (rangeOffset === 0) glyph = (code + delta) & 0xffff;
      else {
        const index = table.readUInt16BE(
          rangeOffsets + segment * 2 + rangeOffset + (code - start) * 2,
        );
        glyph = index === 0 ? 0 : (index + delta) & 0xffff;
      }
      if (glyph !== 0) held.add(code);
    }
  }
}
