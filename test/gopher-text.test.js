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

test("keeps the list-item indent on every wrapped continuation line", () => {
  const { body } = toGopherText("- a rather long list item text here", { maxLineWidth: 20 });
  assert.equal(body, "  * a rather long\n  * list item text\n  * here\n");
  for (const line of body.trim().split("\n")) {
    assert.ok(line.length <= 20, `line "${line}" exceeds width 20`);
  }
});

test("handles empty input without throwing", () => {
  assert.deepEqual(toGopherText(""), { body: "\n", links: [] });
  assert.deepEqual(toGopherText(), { body: "\n", links: [] });
});

test("leaves an unpaired asterisk alone instead of misparsing it as emphasis", () => {
  assert.equal(toGopherText("5 * 3 = 15").body, "5 * 3 = 15\n");
});

test("does not hang or throw on an unclosed code fence", () => {
  assert.equal(toGopherText("```\ncode line").body, "code line\n");
});

test("does not hang or throw on a degenerate (zero or negative) maxLineWidth", () => {
  assert.doesNotThrow(() => toGopherText("- a fairly long item", { maxLineWidth: 0 }));
  assert.doesNotThrow(() => toGopherText("- a fairly long item", { maxLineWidth: -5 }));
});

test("a heading does not throw on a negative maxLineWidth (String.repeat needs a non-negative count)", () => {
  assert.doesNotThrow(() => toGopherText("# A Heading", { maxLineWidth: -5 }));
});

test("normalizes CRLF line endings", () => {
  assert.equal(toGopherText("one\r\ntwo\r\n").body, "one\ntwo\n");
});

test("numbers multiple links across a document in order, not per line", () => {
  const { body, links } = toGopherText("[a](https://a.example)\n\n[b](https://b.example)");
  assert.match(body, /a \[1\]/);
  assert.match(body, /b \[2\]/);
  assert.deepEqual(links, [
    { url: "https://a.example", label: "a" },
    { url: "https://b.example", label: "b" },
  ]);
});

test("does not flatten a nested list item's own marker", () => {
  const { body } = toGopherText("- parent\n  - nested");
  assert.equal(body, "  * parent\n  * nested\n");
});

test("passes non-ASCII text through unchanged", () => {
  const { body } = toGopherText("emoji 🎉 unicode ☃ text");
  assert.equal(body, "emoji 🎉 unicode ☃ text\n");
});

test("keeps a URL with balanced parentheses intact", () => {
  const { body, links } = toGopherText("[Gopher](https://en.wikipedia.org/wiki/Gopher_(protocol))");
  assert.deepEqual(links, [
    { url: "https://en.wikipedia.org/wiki/Gopher_(protocol)", label: "Gopher" },
  ]);
  assert.match(body, /Gopher \[1\]/);
});

test("hard-breaks a word longer than maxLineWidth so no line exceeds it", () => {
  const { body } = toGopherText("see https://example.com/a/very/long/path/here ok", { maxLineWidth: 20 });
  for (const line of body.trim().split("\n")) {
    assert.ok(line.length <= 20, `line "${line}" exceeds width 20`);
  }
});

test("pads a lone '.' line so it cannot be taken for the type-0 terminator", () => {
  assert.equal(toGopherText("before\n.\nafter").body, "before\n. \nafter\n");
});

test("strips underscore emphasis but leaves snake_case identifiers alone", () => {
  assert.equal(toGopherText("_italic_ and __bold__").body, "italic and bold\n");
  assert.equal(toGopherText("call snake_case_name here").body, "call snake_case_name here\n");
});

test("does not extract a link written inside an inline code span", () => {
  const { body, links } = toGopherText("run `curl [x](http://a)` now");
  assert.equal(links.length, 0);
  assert.equal(body, "run curl [x](http://a) now\n");
});
