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

test("converts a standalone image reference to a bare link line in place", () => {
  const out = toGemtext("![a gif](/img/keroppi.gif)");
  assert.equal(out, "=> /img/keroppi.gif a gif\n");
});

test("converts a standalone link line to a bare link line in place", () => {
  assert.equal(
    toGemtext("[docs](https://example.com/docs)"),
    "=> https://example.com/docs docs\n"
  );
  assert.equal(toGemtext("[](https://example.com/)"), "=> https://example.com/\n");
});

test("an image mid-sentence still becomes a trailing link line", () => {
  const out = toGemtext("see ![a gif](/img/keroppi.gif) here");
  assert.equal(out, "see a gif here\n=> /img/keroppi.gif a gif\n");
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

test("keeps a URL with balanced parentheses intact", () => {
  const out = toGemtext("Read [Gopher](https://en.wikipedia.org/wiki/Gopher_(protocol)) sometime.");
  assert.equal(out, "Read Gopher sometime.\n=> https://en.wikipedia.org/wiki/Gopher_(protocol) Gopher\n");
});

test("strips underscore emphasis but leaves snake_case identifiers alone", () => {
  assert.equal(toGemtext("_italic_ and __bold__"), "italic and bold\n");
  assert.equal(toGemtext("call snake_case_name here"), "call snake_case_name here\n");
});

test("does not extract a link written inside an inline code span", () => {
  assert.equal(toGemtext("run `curl [x](http://a)` now"), "run curl [x](http://a) now\n");
});

test("passes a hand-authored Gemtext link line through verbatim", () => {
  assert.equal(
    toGemtext("=> gemini://example.com/ click me"),
    "=> gemini://example.com/ click me\n"
  );
  // Verbatim means no inline stripping either -- underscores in the URL
  // must survive.
  assert.equal(toGemtext("=> /a/_b_/c label"), "=> /a/_b_/c label\n");
});

test("left-trims an indented code fence so clients recognize the toggle", () => {
  assert.equal(toGemtext("  ```\ncode\n  ```"), "```\ncode\n```\n");
});
