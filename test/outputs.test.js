import { test } from "node:test";
import assert from "node:assert/strict";
import { hasOutput, filterByOutput, ALL_PROTOCOLS } from "../lib/outputs.js";

test("ALL_PROTOCOLS lists web, gopher, and gemini", () => {
  assert.deepEqual(ALL_PROTOCOLS, ["web", "gopher", "gemini"]);
});

test("hasOutput defaults to true when a page has no outputs field", () => {
  assert.equal(hasOutput({ data: {} }, "gopher"), true);
  assert.equal(hasOutput({}, "gopher"), true);
});

test("hasOutput checks the requested protocol against the outputs list", () => {
  const item = { data: { outputs: ["web", "gopher"] } };
  assert.equal(hasOutput(item, "gopher"), true);
  assert.equal(hasOutput(item, "gemini"), false);
});

test("hasOutput also accepts a plain data object, not just a collection item", () => {
  assert.equal(hasOutput({ outputs: ["gemini"] }, "gemini"), true);
  assert.equal(hasOutput({ outputs: ["gemini"] }, "gopher"), false);
});

test("filterByOutput keeps only items shipping to the given protocol", () => {
  const items = [
    { data: { outputs: ["web"] } },
    { data: { outputs: ["gopher"] } },
    { data: {} },
  ];
  const filtered = filterByOutput(items, "gopher");
  assert.equal(filtered.length, 2);
});

test("hasOutput treats a bare string outputs value as a one-protocol list", () => {
  assert.equal(hasOutput({ data: { outputs: "gopher" } }, "gopher"), true);
  assert.equal(hasOutput({ data: { outputs: "gopher" } }, "gemini"), false);
});

test("hasOutput fails open (defaults to true) when outputs is neither a string nor an array", () => {
  assert.equal(hasOutput({ data: { outputs: 42 } }, "gopher"), true);
  assert.equal(hasOutput({ data: { outputs: { web: true } } }, "gemini"), true);
});
