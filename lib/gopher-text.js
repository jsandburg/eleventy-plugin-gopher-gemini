// Converts a Markdown source string to the plain, word-wrapped text a
// Gopher type-0 (text file) selector serves. Gopher has no markup at all,
// so headings/lists/quotes are rendered as plain-text conventions instead,
// and every link or image reference is replaced inline with a "[n]" citation
// and collected into a numbered list at the end -- the same footnote-style
// link handling the original hugo2gg.py script uses.

import { stripInlineFormatting } from "./inline.js";

export function toGopherText(markdown = "", { maxLineWidth = 70 } = {}) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let inCode = false;
  const links = [];

  const pushWrapped = (text, indent = "") => {
    if (text.trim() === "") {
      out.push("");
      return;
    }
    for (const wrapped of wrap(text, maxLineWidth - indent.length)) out.push(indent + wrapped);
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      const text = stripMarkdown(heading[1], links).toUpperCase();
      out.push("");
      out.push(text);
      out.push("-".repeat(Math.min(text.length, maxLineWidth)));
      continue;
    }

    const listItem = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (listItem) {
      pushWrapped(stripMarkdown(listItem[1], links), "  * ");
      continue;
    }

    if (/^>\s?/.test(line)) {
      pushWrapped(stripMarkdown(line.replace(/^>\s?/, ""), links), "  | ");
      continue;
    }

    pushWrapped(stripMarkdown(line, links));
  }

  if (links.length) {
    out.push("");
    out.push("Links:");
    links.forEach((link, i) => {
      out.push(`  [${i + 1}] ${link.label} - ${link.url}`);
    });
  }

  return { body: collapse(out), links };
}

function stripMarkdown(text, collector) {
  const withLinksExtracted = text.replace(/!?\[([^\]]*)\]\(([^)]+)\)/g, (match, label, url) => {
    collector.push({ url, label: label || url });
    return `${label || url} [${collector.length}]`;
  });
  return stripInlineFormatting(withLinksExtracted);
}

function wrap(text, width) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function collapse(lines) {
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "");
  return `${text}\n`;
}
