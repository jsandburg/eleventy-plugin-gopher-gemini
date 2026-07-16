import { test } from "node:test";
import assert from "node:assert/strict";
import { toGemtext } from "../lib/gemtext.js";

test("passes headings through, clamped to level 3", () => {
  const out = toGemtext("# One\n## Two\n###### Six");
  assert.equal(out, "# One\n## Two\n### Six\n");
});

test("converts inline links to trailing link lines", () => {
  const out = toGemtext("See the [docs](https://example.com/docs) for more.");
  assert.equal(out, "See the docs for more.\n=> https://example.com/docs docs\n");
});

test("converts image references to link lines", () => {
  const out = toGemtext("![a gif](/img/keroppi.gif)");
  assert.equal(out, "a gif\n=> /img/keroppi.gif a gif\n");
});

test("passes blockquotes through with a stripped inline link", () => {
  const out = toGemtext("> quoting [a source](https://example.com)");
  assert.equal(out, "> quoting a source\n=> https://example.com a source\n");
});

test("converts list items to Gemtext list lines", () => {
  const out = toGemtext("- one\n- two\n1. three");
  assert.equal(out, "* one\n* two\n* three\n");
});

test("passes preformatted code blocks through unchanged", () => {
  const out = toGemtext("```\nconst x = 1;\n```");
  assert.equal(out, "```\nconst x = 1;\n```\n");
});

test("strips bold/italic/code markup, since Gemtext has no inline formatting", () => {
  const out = toGemtext("This is **bold**, *italic*, and `code`.");
  assert.equal(out, "This is bold, italic, and code.\n");
});

test("strips inline markup from headings too", () => {
  const out = toGemtext("# A **bold** heading");
  assert.equal(out, "# A bold heading\n");
});

test("collapses runs of blank lines", () => {
  const out = toGemtext("one\n\n\n\ntwo");
  assert.equal(out, "one\n\ntwo\n");
});

test("handles empty input without throwing", () => {
  assert.equal(toGemtext(""), "\n");
  assert.equal(toGemtext(), "\n");
});

test("leaves an unpaired asterisk alone instead of misparsing it as emphasis", () => {
  assert.equal(toGemtext("5 * 3 = 15"), "5 * 3 = 15\n");
});

test("does not hang or throw on an unclosed code fence", () => {
  assert.equal(toGemtext("```\ncode line"), "```\ncode line\n");
});

test("normalizes CRLF line endings", () => {
  assert.equal(toGemtext("one\r\ntwo\r\n"), "one\ntwo\n");
});

test("handles multiple links on the same line, in order", () => {
  const out = toGemtext("[a](https://a.example) then [b](https://b.example)");
  assert.equal(
    out,
    "a then b\n=> https://a.example a\n=> https://b.example b\n"
  );
});

test("does not flatten a nested list item's own marker", () => {
  // Gemtext has no concept of nested lists; every marker just becomes a
  // top-level "* " line, in source order.
  const out = toGemtext("- parent\n  - nested");
  assert.equal(out, "* parent\n* nested\n");
});

test("passes non-ASCII text through unchanged", () => {
  const out = toGemtext("emoji 🎉 unicode ☃ text");
  assert.equal(out, "emoji 🎉 unicode ☃ text\n");
});

test("a heading with no text after the hashes does not throw", () => {
  assert.equal(toGemtext("# "), "# \n");
});
