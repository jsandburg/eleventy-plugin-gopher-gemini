// Feeds toGemtext/toGopherText a large number of randomly-assembled
// documents built from valid, broken, and adversarial Markdown fragments,
// and checks that they never throw and always return well-formed output.
// This is the kind of edge case (unmatched formatting characters, unclosed
// fences, degenerate widths, ...) that hand-written example-based tests
// tend to miss. The PRNG is seeded so a failure is reproducible.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toGemtext } from "../lib/gemtext.js";
import { toGopherText } from "../lib/gopher-text.js";

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAGMENTS = [
  "# Heading",
  "## Sub heading",
  "###### Deep heading",
  "#no space after hash",
  "- list item",
  "* star item",
  "1. numbered item",
  "  - nested item",
  "> a quote",
  ">no space quote",
  "**bold**",
  "*italic*",
  "`code`",
  "**unclosed bold",
  "*unclosed italic",
  "`unclosed code",
  "[label](https://example.com/path)",
  "![alt](image.png)",
  "[empty-label]()",
  "```",
  "plain text line",
  "",
  "   ",
  "unmatched * asterisk",
  "unmatched ` backtick",
  "unmatched _ underscore",
  "_italic underscore_",
  "5 * 3 = 15",
  ".",
  "=> not authored as a link line",
  "[wiki](https://en.wikipedia.org/wiki/Gopher_(protocol))",
  "emoji 🎉 unicode ☃ text",
  "line with\ttab",
  "multiple [a](https://a.example) links [b](https://b.example) here",
];

function randomDoc(rand, lineCount) {
  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(FRAGMENTS[Math.floor(rand() * FRAGMENTS.length)]);
  }
  return lines.join("\n");
}

test("toGemtext never throws and always returns a newline-terminated string", () => {
  const rand = mulberry32(12345);
  for (let i = 0; i < 500; i++) {
    const doc = randomDoc(rand, 1 + Math.floor(rand() * 25));
    const out = toGemtext(doc);
    assert.equal(typeof out, "string", `doc: ${JSON.stringify(doc)}`);
    assert.ok(out.endsWith("\n"), `output not newline-terminated for doc: ${JSON.stringify(doc)}`);
  }
});

test("toGopherText never throws and always returns well-formed output, even at degenerate widths", () => {
  const rand = mulberry32(67890);
  for (let i = 0; i < 500; i++) {
    const doc = randomDoc(rand, 1 + Math.floor(rand() * 25));
    const maxLineWidth = Math.floor(rand() * 41) - 5; // -5..35, includes zero/negative
    const { body, links } = toGopherText(doc, { maxLineWidth });
    assert.equal(typeof body, "string", `doc: ${JSON.stringify(doc)}, width: ${maxLineWidth}`);
    assert.ok(body.endsWith("\n"), `output not newline-terminated for doc: ${JSON.stringify(doc)}`);
    assert.ok(Array.isArray(links));
    for (const link of links) {
      assert.equal(typeof link.url, "string");
      assert.equal(typeof link.label, "string");
    }
  }
});
