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
  assert.equal(out, "* one\n* two\n1. three\n");
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
  assert.equal(toGemtext("one\r\n\r\ntwo\r\n"), "one\n\ntwo\n");
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

test("strips inline markup from a link's label on its link line too", () => {
  assert.equal(
    toGemtext("See [**bold** link](https://x.example) ok"),
    "See bold link ok\n=> https://x.example bold link\n"
  );
});

test("drops a Markdown link title and unwraps an <angle-bracket> destination", () => {
  assert.equal(toGemtext('[x](https://x.example "Title")'), "=> https://x.example x\n");
  assert.equal(toGemtext("[x](<https://x.example/a b>)"), "=> https://x.example/a%20b x\n");
});

test("stays fast on a long line of unmatched brackets", () => {
  const start = performance.now();
  toGemtext("[".repeat(200000));
  assert.ok(performance.now() - start < 2000, "quadratic-time link matching");
});

test("a paragraph line starting with # is not turned into a Gemtext heading", () => {
  assert.equal(toGemtext("#hashtag at the start"), " #hashtag at the start\n");
  assert.equal(toGemtext("**#1** fan"), " #1 fan\n");
});

test("stays fast on a link destination with a long run of spaces", () => {
  const start = performance.now();
  toGemtext("[a](x" + " ".repeat(100000) + "y)");
  assert.ok(performance.now() - start < 2000, "quadratic-time link title matching");
});

test("joins the hard-wrapped lines of a paragraph into one Gemtext line", () => {
  assert.equal(toGemtext("line one\nline two\n\nnext"), "line one line two\n\nnext\n");
});

test("keeps a Markdown hard line break (two trailing spaces or a backslash)", () => {
  assert.equal(toGemtext("roses are red  \nviolets are blue\\\nthe end"), "roses are red\nviolets are blue\nthe end\n");
});

test("treats a bare carriage return as a line break, not part of the line", () => {
  assert.equal(toGemtext("one\r\rtwo"), "one\n\ntwo\n");
  assert.doesNotMatch(toGemtext("text\r=> gemini://x.example y"), /\r/);
});

test("a linked image keeps the outer link and uses the alt text as its label", () => {
  assert.equal(toGemtext("[![alt](img.png)](https://x.example)"), "=> https://x.example alt\n");
  assert.equal(toGemtext("see [![alt](img.png)](https://x.example) here"), "see alt here\n=> https://x.example alt\n");
});

test("handles brackets in a link label and two levels of parentheses in a URL", () => {
  assert.equal(toGemtext("[a [b] c](https://u.example)"), "=> https://u.example a [b] c\n");
  assert.equal(toGemtext("[a](http://x/(a(b)c))"), "=> http://x/(a(b)c) a\n");
});

test("leaves spaced-out asterisks and URLs in running text alone", () => {
  assert.equal(toGemtext("2 * 3 * 4 = 24"), "2 * 3 * 4 = 24\n");
  assert.equal(toGemtext("see https://e.example/_a_/ and *this*"), "see https://e.example/_a_/ and this\n");
});

test("resolves reference-style links and drops their definitions", () => {
  const out = toGemtext("See [the docs][d], [Home][] and [home].\n\n[d]: https://d.example \"Docs\"\n[home]: https://h.example");
  assert.equal(
    out,
    "See the docs, Home and home.\n=> https://d.example the docs\n=> https://h.example Home\n=> https://h.example home\n"
  );
  assert.equal(toGemtext("an [undefined] ref"), "an [undefined] ref\n");
});

test("converts autolinks and HTML links, and drops other inline HTML", () => {
  assert.equal(toGemtext("<https://a.example>"), "=> https://a.example\n");
  assert.equal(toGemtext("mail <me@example.com> now"), "mail mailto:me@example.com now\n=> mailto:me@example.com\n");
  assert.equal(
    toGemtext('a <a href="https://b.example">link</a> and <b>bold</b><!-- gone -->'),
    "a link and bold\n=> https://b.example link\n"
  );
  assert.equal(toGemtext('<img src="/a b.png" alt="pic">'), "pic\n=> /a%20b.png pic\n");
});

test("converts setext headings and thematic breaks", () => {
  assert.equal(toGemtext("Title\n=====\n\nSub\n---\n\ntext\n\n* * *"), "# Title\n\n## Sub\n\ntext\n\n---\n");
});

test("wraps table rows in a preformatted block", () => {
  assert.equal(toGemtext("| a | b |\n|---|---|\n| 1 | 2 |\n\nafter"), "```\n| a | b |\n|---|---|\n| 1 | 2 |\n```\n\nafter\n");
});

test("recognizes ~~~ fences, and does not take an inline ```code``` span for one", () => {
  assert.equal(toGemtext("~~~\n# not a heading\n~~~"), "```\n# not a heading\n```\n");
  assert.equal(toGemtext("```inline``` text\n\n# Heading"), "inline text\n\n# Heading\n");
});

test("emits a standalone link after the links of the text before it", () => {
  assert.equal(toGemtext("See [foo](a) here\n[bar](b)"), "See foo here\n=> a foo\n=> b bar\n");
});

test("treats null or undefined input as empty", () => {
  assert.equal(toGemtext(null), "\n");
  assert.equal(toGemtext(undefined), "\n");
});
