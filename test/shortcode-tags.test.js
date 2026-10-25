import { test } from "node:test";
import assert from "node:assert/strict";
import { convertShortcodes, defaultShortcodes } from "../lib/shortcodes.js";
import { toGemtext } from "../lib/gemtext.js";
import { toGopherText } from "../lib/gopher-text.js";

const defaults = defaultShortcodes();

test("rewrites an {% image %} tag to a Markdown image with the served path", () => {
  const out = convertShortcodes(
    '{% image "src/images/blog/frog.jpg", "a frog with a gameboy" %}',
    defaults
  );
  assert.equal(out, "![a frog with a gameboy](/images/blog/frog.jpg)");
});

test("a standalone {% image %} tag becomes a bare Gemtext link line", () => {
  const out = toGemtext(
    convertShortcodes('{% image "src/images/blog/frog.jpg", "a frog" %}', defaults)
  );
  assert.equal(out, "=> /images/blog/frog.jpg a frog\n");
});

test("an {% image %} tag becomes a Gopher [n] citation", () => {
  const { body, links } = toGopherText(
    convertShortcodes('{% image "src/images/blog/frog.jpg", "a frog" %}', defaults)
  );
  assert.match(body, /a frog \[1\]/);
  assert.deepEqual(links, [{ url: "/images/blog/frog.jpg", label: "a frog" }]);
});

test("rewrites a {% youtube %} tag to a watch-URL link", () => {
  const out = convertShortcodes('{% youtube "dQw4w9WgXcQ" %}', defaults);
  assert.equal(out, "[YouTube video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)");
});

test("ignores extra {% youtube %} args (width/height variants)", () => {
  const out = convertShortcodes('{% youtube "dQw4w9WgXcQ", 560, 315 %}', defaults);
  assert.equal(out, "[YouTube video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)");
});

test("strips unrecognized tags so raw template syntax never leaks", () => {
  const out = convertShortcodes("before\n{% mystery \"arg\" %}\nafter", defaults);
  assert.ok(!out.includes("{%"), `raw tag leaked: ${out}`);
  assert.match(out, /before/);
  assert.match(out, /after/);
});

test("strips a tag with missing required args instead of emitting a broken link", () => {
  assert.equal(convertShortcodes("{% image %}", defaults), "");
  assert.equal(convertShortcodes("{% youtube %}", defaults), "");
});

test("leaves tags inside fenced code blocks verbatim", () => {
  const src = 'Use it like:\n\n```\n{% image "src/x.jpg", "alt" %}\n```\n';
  const out = convertShortcodes(src, defaults);
  assert.match(out, /\{% image "src\/x\.jpg", "alt" %\}/);
});

test("handles {%- -%} whitespace-trim tag variants", () => {
  const out = convertShortcodes('{%- youtube "abc123" -%}', defaults);
  assert.equal(out, "[YouTube video](https://www.youtube.com/watch?v=abc123)");
});

test("parses args with escaped quotes and single-quoted strings", () => {
  const out = convertShortcodes(
    "{% image 'src/images/pic.jpg', \"she said \\\"hi\\\"\" %}",
    defaults
  );
  assert.equal(out, '![she said "hi"](/images/pic.jpg)');
});

test("a custom imageSrcRewrite overrides the default src/ stripping", () => {
  const custom = defaultShortcodes({ imageSrcRewrite: (src) => `/pix/${src.split("/").pop()}` });
  const out = convertShortcodes('{% image "content/img/frog.jpg", "frog" %}', custom);
  assert.equal(out, "![frog](/pix/frog.jpg)");
});

test("a user-supplied builder extends the defaults and can override them", () => {
  const map = {
    ...defaults,
    stamp: ([name]) => `![stamp](/stamps/${name}.png)`,
    youtube: () => null, // override: strip instead of link
  };
  assert.equal(convertShortcodes('{% stamp "jazz" %}', map), "![stamp](/stamps/jazz.png)");
  assert.equal(convertShortcodes('{% youtube "abc" %}', map), "");
});

test("surrounding prose and markdown links are untouched", () => {
  const src = 'Intro with a [link](https://example.com).\n\n{% youtube "abc" %}\n\nOutro.';
  const out = toGemtext(convertShortcodes(src, defaults));
  assert.equal(
    out,
    "Intro with a link.\n=> https://example.com link\n\n=> https://www.youtube.com/watch?v=abc YouTube video\n\nOutro.\n"
  );
});

test("brackets and line breaks in {% image %} alt text cannot break the link", () => {
  const out = convertShortcodes('{% image "src/a.jpg", "Frog [cute]\nand small" %}', defaults);
  assert.equal(out, "![Frog cute and small](/a.jpg)");
});

test("URL-encodes the {% youtube %} id", () => {
  const out = convertShortcodes('{% youtube "abc&x=1 y" %}', defaults);
  assert.equal(out, "[YouTube video](https://www.youtube.com/watch?v=abc%26x%3D1%20y)");
});

test("stays fast on a long run of unclosed tags", () => {
  const start = performance.now();
  convertShortcodes("{% a ".repeat(100000), defaults);
  assert.ok(performance.now() - start < 2000, "quadratic-time tag matching");
});

test("strips Nunjucks {# comments #} including their contents", () => {
  const out = convertShortcodes("Hi {# private draft note #} there\n{#\nmulti\nline\n#}\nend", defaults);
  assert.ok(!out.includes("private") && !out.includes("multi"), `comment leaked: ${out}`);
  assert.match(out, /Hi\s+there/);
  assert.match(out, /end/);
});

test("strips Liquid {% comment %} blocks including their contents", () => {
  const out = convertShortcodes("a {% comment %}secret{% endcomment %} b", defaults);
  assert.equal(out, "a  b");
});

test("strips {{ expressions }} so raw template output syntax never leaks", () => {
  assert.equal(convertShortcodes("Site: {{ site.title }}!", defaults), "Site: !");
});

test("tags named after built-in object methods are stripped, not called", () => {
  for (const name of ["constructor", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf"]) {
    assert.equal(convertShortcodes(`a {% ${name} "x" %} b`, defaults), "a  b", name);
  }
});

test("leaves template syntax inside inline code spans verbatim", () => {
  const src = 'Use `{% youtube "abc" %}` or `{{ title }}`, not {% youtube "abc" %}.';
  assert.equal(
    convertShortcodes(src, defaults),
    'Use `{% youtube "abc" %}` or `{{ title }}`, not [YouTube video](https://www.youtube.com/watch?v=abc).'
  );
});

test("stays fast on an unclosed tag followed by a long word", () => {
  const start = performance.now();
  convertShortcodes("{% " + "a".repeat(100000), defaults);
  assert.ok(performance.now() - start < 2000, "quadratic-time tag-name matching");
});
