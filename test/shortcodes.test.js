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

test("gopherLink treats an explicitly undefined host/port option as unset", (t) => {
  t.mock.method(console, "warn", () => {});
  const { gopherLink } = loadShortcodes({ host: undefined, port: undefined });
  const line = gopherLink("About", "/about");
  assert.ok(!line.includes("undefined"), line);
  assert.equal(line, "0About\t/about\t\t70");
});

test("gopherLink warns once when no host is configured", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const { gopherLink } = loadShortcodes();
  gopherLink("A", "/a");
  gopherLink("B", "/b");
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /host/);
});

test("gopherLink splits a gopher:// URL into type, selector, host and port", () => {
  const { gopherLink } = loadShortcodes(OPTIONS);
  assert.equal(
    gopherLink("Other hole", "gopher://other.host:7070/0/docs/a%20b.txt"),
    "0Other hole\t/docs/a b.txt\tother.host\t7070"
  );
  assert.equal(gopherLink("Root", "gopher://other.host"), "1Root\t\tother.host\t70");
});

test("gemLink percent-encodes spaces in the URI so the label is not split off", () => {
  const { gemLink } = loadShortcodes();
  assert.equal(gemLink("/my page.gmi", "My page"), "=> /my%20page.gmi My page");
});
