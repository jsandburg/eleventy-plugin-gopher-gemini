// The gopherLink/gemLink shortcodes emit tab-delimited / line-based
// protocol output, so their arguments must not be able to smuggle in
// structural characters. Registered against a minimal mock eleventyConfig
// so they can be unit-tested without a full build.
import { test } from "node:test";
import assert from "node:assert/strict";
import gopherGeminiPlugin from "../index.js";

function loadShortcodes(options = {}) {
  const shortcodes = {};
  gopherGeminiPlugin(
    {
      addFilter() {},
      addShortcode(name, fn) {
        shortcodes[name] = fn;
      },
    },
    options
  );
  return shortcodes;
}

const OPTIONS = { host: "gopher.example.com", port: "70" };

test("gopherLink emits a plain selector line with the configured host/port", () => {
  const { gopherLink } = loadShortcodes(OPTIONS);
  assert.equal(gopherLink("About", "/about/"), "1About\t/about/\tgopher.example.com\t70");
});

test("gopherLink collapses tabs and newlines so a title cannot inject menu lines", () => {
  const { gopherLink } = loadShortcodes(OPTIONS);
  const line = gopherLink("Evil\ttitle\n1Injected\t/evil\tattacker.example\t70", "/a/");
  assert.equal(line, "1Evil title 1Injected /evil attacker.example 70\t/a/\tgopher.example.com\t70");
});

test("gopherLink renders a web URL as an hURL: selector line", () => {
  const { gopherLink } = loadShortcodes(OPTIONS);
  assert.equal(
    gopherLink("Site", "https://example.com/"),
    "hSite\tURL:https://example.com/\tgopher.example.com\t70"
  );
});

test("gopherLink does not double an existing URL: prefix", () => {
  const { gopherLink } = loadShortcodes(OPTIONS);
  assert.equal(
    gopherLink("Site", "URL:https://example.com/"),
    "hSite\tURL:https://example.com/\tgopher.example.com\t70"
  );
});

test("gemLink emits a Gemtext link line", () => {
  const { gemLink } = loadShortcodes();
  assert.equal(gemLink("/about.gmi", "About"), "=> /about.gmi About");
  assert.equal(gemLink("/about.gmi"), "=> /about.gmi");
});

test("gemLink strips newlines so a label cannot inject extra Gemtext lines", () => {
  const { gemLink } = loadShortcodes();
  assert.equal(
    gemLink("/about.gmi", "About\n=> gemini://evil.example x"),
    "=> /about.gmi About => gemini://evil.example x"
  );
});
