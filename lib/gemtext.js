// Converts a Markdown source string to Gemtext (the Gemini protocol's line
// format). Gemtext already shares headings ("#", "##", "###") and blockquotes
// (">") with Markdown, so those pass through almost unchanged. The one hard
// rule Gemtext enforces is that links can't be inline -- "=> url label" must
// be its own line -- so inline [label](url) and ![alt](url) are pulled out
// of the running text and appended as link lines after the paragraph or list
// item they came from.

import { stripInlineFormatting } from "./inline.js";

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
      out.push(line);
      continue;
    }
    if (inCode) {
      out.push(line);
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
  const withLinksExtracted = text.replace(/!?\[([^\]]*)\]\(([^)]+)\)/g, (match, label, url) => {
    collector.push({ url, label: label || url });
    return label || url;
  });
  return stripInlineFormatting(withLinksExtracted);
}

function collapseBlankLines(text) {
  return text.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "") + "\n";
}
