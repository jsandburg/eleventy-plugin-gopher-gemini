// Converts a Markdown source string to Gemtext (the Gemini protocol's line
// format). Gemtext already shares headings ("#", "##", "###") and blockquotes
// (">") with Markdown, so those pass through almost unchanged. The one hard
// rule Gemtext enforces is that links can't be inline -- "=> url label" must
// be its own line -- so inline [label](url) and ![alt](url) are pulled out
// of the running text and appended as link lines after the paragraph or list
// item they came from. Two authoring escape hatches: a line consisting of
// only a Markdown link becomes a bare "=> url label" line where it stands,
// and a hand-authored "=>" line passes through verbatim.

import { processInline, LINK_RE } from "./inline.js";

const STANDALONE_LINK_RE = new RegExp(`^\\s*${LINK_RE.source}\\s*$`);

export function toGemtext(markdown = "") {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let inCode = false;
  let pendingLinks = [];

  const flushLinks = () => {
    if (!pendingLinks.length) return;
    for (const { url, label } of pendingLinks) {
      out.push(`=> ${url}${label ? " " + label : ""}`);
    }
    pendingLinks = [];
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      // Gemtext only recognizes ``` at the very start of a line, so an
      // indented fence has to be left-trimmed or clients won't toggle
      // preformatted mode.
      out.push(line.trimStart());
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }

    // A hand-authored Gemtext link line passes through verbatim -- it must
    // skip stripInline, which would mangle e.g. underscores in the URL.
    if (line.startsWith("=>")) {
      out.push(line);
      continue;
    }

    // A line that is only a Markdown link becomes a bare link line in
    // place, instead of label text plus a trailing link line.
    const standalone = line.match(STANDALONE_LINK_RE);
    if (standalone) {
      const [, label, url] = standalone;
      out.push(`=> ${url}${label ? " " + label : ""}`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushLinks();
      const level = Math.min(heading[1].length, 3);
      out.push(`${"#".repeat(level)} ${stripInline(heading[2], pendingLinks)}`);
      flushLinks();
      continue;
    }

    if (/^>\s?/.test(line)) {
      out.push(`> ${stripInline(line.replace(/^>\s?/, ""), pendingLinks)}`);
      continue;
    }

    const listItem = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (listItem) {
      out.push(`* ${stripInline(listItem[1], pendingLinks)}`);
      continue;
    }

    if (line.trim() === "") {
      flushLinks();
      out.push("");
      continue;
    }

    out.push(stripInline(line, pendingLinks));
  }
  flushLinks();

  return collapseBlankLines(out.join("\n"));
}

function stripInline(text, collector) {
  return processInline(text, (match, label, url) => {
    collector.push({ url, label: label || url });
    return label || url;
  });
}

function collapseBlankLines(text) {
  return text.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "") + "\n";
}
