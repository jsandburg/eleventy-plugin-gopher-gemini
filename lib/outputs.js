// Per-page protocol targeting.
//
// A page opts into a subset of protocols via front matter:
//
//   ---
//   outputs: [web, gopher]
//   ---
//
// Pages with no `outputs` field ship to all protocols. This mirrors the
// "some content is gopher-only, some is web-only" behavior of the original
// Hugo-2-Gopher-and-Gemini `outputs` front-matter flag, but as a plain
// Eleventy data field instead of a Hugo output-format config.

const ALL_PROTOCOLS = ["web", "gopher", "gemini"];

// Accepts either an Eleventy collection item ({ data: {...} }) or a plain
// data object ({ outputs: [...] }) so it works both as a collection filter
// and as a template filter called on `page.data` / a front-matter object.
export function hasOutput(itemOrData, protocol) {
  const outputs = itemOrData?.data?.outputs ?? itemOrData?.outputs;
  if (!outputs) return true;
  if (!Array.isArray(outputs)) return true;
  return outputs.includes(protocol);
}

export function filterByOutput(items, protocol) {
  return items.filter((item) => hasOutput(item, protocol));
}

export { ALL_PROTOCOLS };
