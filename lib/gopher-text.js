// Converts a Markdown source string to the plain, word-wrapped text a
// Gopher type-0 (text file) selector serves. Gopher has no markup at all,
// so headings/lists/quotes are rendered as plain-text conventions instead,
// and every link or image reference is replaced inline with a "[n]" citation
// and collected into a numbered list at the end -- the same footnote-style
// link handling the original hugo2gg.py script uses.

import { processInline } from "./inline.js";
import {
  splitLines,
  fenceChar,
  resolveReferences,
  HR_RE,
  SETEXT_RE,
  TABLE_ROW_RE,
  LIST_ITEM_RE,
  HARD_BREAK_RE,
} from "./blocks.js";

export function toGopherText(markdown = "", { maxLineWidth = 70 } = {}) {
  const lines = resolveReferences(splitLines(markdown));
  const out = [];
  let fence = null;
  let para = [];
  const links = [];

  // `rest` indents the wrapped continuation lines; it defaults to the
  // first-line indent, but a list item continues under its text instead of
  // repeating the bullet.
  const pushWrapped = (text, indent = "", rest = indent, breakLong = true) => {
    if (text.trim() === "") {
      out.push("");
      return;
    }
    wrap(text, maxLineWidth - indent.length, breakLong).forEach((wrapped, i) =>
      out.push((i ? rest : indent) + wrapped)
    );
  };

  // The source lines of one Markdown paragraph are joined and re-wrapped
  // together, so hard-wrapped source doesn't come out ragged.
  const flushPara = () => {
    if (!para.length) return;
    const text = stripMarkdown(para.join(" "), links);
    para = [];
    if (text.trim()) pushWrapped(text);
  };

  const pushHeading = (text) => {
    const headingLines = wrap(stripMarkdown(text, links).toUpperCase(), maxLineWidth);
    const longest = Math.max(...headingLines.map((l) => l.length));
    out.push("");
    out.push(...headingLines);
    out.push("-".repeat(Math.max(0, Math.min(longest, maxLineWidth))));
  };

  for (const line of lines) {
    const f = fenceChar(line);
    if (f && (!fence || f === fence)) {
      flushPara();
      fence = fence ? null : f;
      continue;
    }
    // Code is preformatted, so it is never re-wrapped, even past the width
    if (fence) {
      out.push(line);
      continue;
    }

    // Table rows are kept verbatim so the columns stay aligned
    if (TABLE_ROW_RE.test(line)) {
      flushPara();
      out.push(line.trim());
      continue;
    }

    if (para.length && SETEXT_RE.test(line)) {
      const text = para.join(" ");
      para = [];
      pushHeading(text);
      continue;
    }

    if (HR_RE.test(line)) {
      flushPara();
      out.push("-".repeat(Math.max(3, maxLineWidth) || 3));
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flushPara();
      pushHeading(heading[1]);
      continue;
    }

    const listItem = line.match(LIST_ITEM_RE);
    if (listItem) {
      flushPara();
      const marker = listItem[1] ? `  ${listItem[1]}. ` : "  * ";
      pushWrapped(stripMarkdown(listItem[2], links), marker, " ".repeat(marker.length));
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      pushWrapped(stripMarkdown(line.replace(/^>\s?/, ""), links), "  | ");
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      out.push("");
      continue;
    }

    para.push(line.replace(/\\$/, "").trim());
    if (HARD_BREAK_RE.test(line)) flushPara();
  }
  flushPara();

  if (links.length) {
    out.push("");
    out.push("Links:");
    links.forEach((link, i) => {
      // Wrapped at word boundaries only: a URL broken across lines can't
      // be copied, so a long one may run past the width instead.
      const marker = `  [${i + 1}] `;
      const entry = link.label === link.url ? link.url : `${link.label} - ${link.url}`;
      pushWrapped(entry, marker, " ".repeat(marker.length), false);
    });
  }

  return { body: collapse(out), links };
}

function stripMarkdown(text, collector) {
  return processInline(text, (match, label, url) => {
    collector.push({ url, label: label || url });
    return `${label || url} [${collector.length}]`;
  });
}

function wrap(text, width, breakLong = true) {
  const words = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (breakLong && width > 0 && word.length > width) {
      // Hard-break a word longer than the width (usually a bare URL) so
      // body text never exceeds maxLineWidth.
      for (let i = 0; i < word.length; i += width) words.push(word.slice(i, i + width));
    } else {
      words.push(word);
    }
  }
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
  // A line consisting of just "." is the RFC 1436 type-0 end-of-file marker;
  // pad it with a trailing space so a strict server/client can't mistake it
  // for the terminator mid-document.
  const text = lines
    .map((line) => (line === "." ? ". " : line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
  return `${text}\n`;
}
