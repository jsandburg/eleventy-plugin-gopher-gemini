// End-to-end check: run a real Eleventy build against the plugin, the way a
// consuming site would, and inspect the emitted files. This is what caught
// the `templateContent` vs. `rawInput` bug and the extensionless-permalink
// crash that unit tests alone did not exercise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Eleventy } from "@11ty/eleventy";

async function build() {
  const elev = new Eleventy("test/fixtures/site/src", "test/fixtures/site/_site", {
    configPath: "test/fixtures/site/eleventy.config.js",
  });
  const results = await elev.toJSON();
  return Object.fromEntries(results.map((r) => [r.url, r.content]));
}

test("builds web, gemini, and gopher output from the same source without errors", async () => {
  const pages = await build();
  assert.ok(pages["/blog/hello/"], "web page missing");
  assert.ok(pages["/gemini/blog/hello/index.gmi"], "gemini page missing");
  assert.ok(pages["/gopher/blog/hello/text"], "gopher page missing");
  assert.ok(pages["/gopher/gophermap"], "gophermap missing");
});

test("web output is still normal HTML from Eleventy's own markdown pipeline", async () => {
  const pages = await build();
  assert.match(pages["/blog/hello/"], /<h1>Hello World<\/h1>/);
});

test("gemini output is Gemtext, not leaked HTML", async () => {
  const pages = await build();
  const gmi = pages["/gemini/blog/hello/index.gmi"];
  assert.doesNotMatch(gmi, /<[a-z]+>/i, "HTML tags leaked into Gemtext output");
  assert.match(gmi, /=> https:\/\/example\.com link/);
  assert.doesNotMatch(gmi, /\*\*bold\*\*/, "bold markup was not stripped");
});

test("gopher post output is plain wrapped text, not leaked HTML", async () => {
  const pages = await build();
  const text = pages["/gopher/blog/hello/text"];
  assert.doesNotMatch(text, /<[a-z]+>/i, "HTML tags leaked into Gopher text output");
  assert.match(text, /HELLO WORLD/);
  assert.match(text, /Links:\n {2}\[1\] link - https:\/\/example\.com/);
});

test("web output renders the site's own image/youtube shortcodes as HTML", async () => {
  const pages = await build();
  assert.match(pages["/blog/hello/"], /<img src="\/images\/frog\.jpg" alt="a hopping frog">/);
  assert.match(pages["/blog/hello/"], /youtube\.com\/embed\/dQw4w9WgXcQ/);
});

test("gemini output converts shortcode tags to link lines, never raw {% %} syntax", async () => {
  const pages = await build();
  const gmi = pages["/gemini/blog/hello/index.gmi"];
  assert.doesNotMatch(gmi, /\{%/, "raw shortcode tag leaked into Gemtext output");
  assert.match(gmi, /=> \/images\/frog\.jpg a hopping frog/);
  assert.match(gmi, /=> https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ YouTube video/);
});

test("gopher output converts shortcode tags to citations, never raw {% %} syntax", async () => {
  const pages = await build();
  const text = pages["/gopher/blog/hello/text"];
  assert.doesNotMatch(text, /\{%/, "raw shortcode tag leaked into Gopher text output");
  assert.match(text, /a hopping frog \[\d\]/);
  assert.match(text, /\[\d\] a hopping frog - \/images\/frog\.jpg/);
  assert.match(text, /\[\d\] YouTube video - https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ/);
});

test("gophermap emits a conformant selector line using the plugin's configured host/port", async () => {
  const pages = await build();
  const map = pages["/gopher/gophermap"].trim();
  const [type, rest] = [map[0], map.slice(1)];
  const [description, selector, host, port] = rest.split("\t");
  assert.equal(type, "1");
  assert.equal(description, "Hello World");
  assert.equal(selector, "/blog/hello/");
  assert.equal(host, "gopher.example.com");
  assert.equal(port, "70");
});
