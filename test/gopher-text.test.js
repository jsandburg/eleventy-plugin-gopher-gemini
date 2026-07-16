import { test } from "node:test";
import assert from "node:assert/strict";
import { toGopherText } from "../lib/gopher-text.js";

test("renders headings as uppercase text underlined with dashes", () => {
  const { body } = toGopherText("# A Heading");
  assert.equal(body, "A HEADING\n---------\n");
});

test("replaces inline links with numbered citations and a trailing link list", () => {
  const { body, links } = toGopherText("See the [docs](https://example.com/docs) for more.");
  assert.equal(body, "See the docs [1] for more.\n\nLinks:\n  [1] docs - https://example.com/docs\n");
  assert.deepEqual(links, [{ url: "https://example.com/docs", label: "docs" }]);
});

test("strips bold/italic/code markup, since Gopher text has no inline formatting", () => {
  const { body } = toGopherText("This is **bold**, *italic*, and `code`.");
  assert.equal(body, "This is bold, italic, and code.\n");
});

test("wraps long lines to maxLineWidth", () => {
  const { body } = toGopherText("word ".repeat(30).trim(), { maxLineWidth: 20 });
  for (const line of body.trim().split("\n")) {
    assert.ok(line.length <= 20, `line "${line}" exceeds width 20`);
  }
});

test("renders list items and blockquotes with plain-text markers", () => {
  const { body } = toGopherText("- one\n> a quote");
  assert.equal(body, "  * one\n  | a quote\n");
});

test("passes fenced code block contents through without the fence markers", () => {
  const { body } = toGopherText("```\nconst x = 1;\n```");
  assert.equal(body, "const x = 1;\n");
});
