// Converts a Markdown source string to Gemtext (the Gemini protocol's line
// format). Gemtext already shares headings ("#", "##", "###") and blockquotes
// (">") with Markdown, so those pass through almost unchanged. The one hard
// rule Gemtext enforces is that links can't be inline -- "=> url label" must
// be its own line -- so inline [label](url) and ![alt](url) are pulled out
// of the running text and appended as link lines after the paragraph or list
// item they came from. The lines of a paragraph are joined into one, since
// Gemtext clients do their own wrapping. Two authoring escape hatches: a line consisting of
// only a Markdown link becomes a bare "=> url label" line where it stands,
// and a hand-authored "=>" line passes through verbatim.

import { processInline, ANY_LINK_RE } from "./inline.js";
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

const STANDALONE_LINK_RE = new RegExp(`^\\s*(?:${ANY_LINK_RE.source})\\s*$`);

const linkLine = ({ url, label }) => `=> ${url}${label && label !== url ? " " + label : ""}`;

export function toGemtext(markdown = "") {
  const lines = resolveReferences(splitLines(markdown));
  const out = [];
  let fence = null;
  let inTable = false;
  let para = [];
  let pendingLinks = [];

  const flushLinks = () => {
    for (const link of pendingLinks) out.push(linkLine(link));
    pendingLinks = [];
  };

  // The source lines of one Markdown paragraph are joined into a single
  // Gemtext line: clients wrap text themselves and would show each
  // hard-wrapped source line as its own paragraph.
  const flushPara = () => {
    if (!para.length) return;
    const text = stripInline(para.join(" "), pendingLinks).trim();
    para = [];
    if (!text) return;
    // Gemtext has no escape character, so a paragraph that would read as
    // another line type ("#hashtag" as a heading, say) gets a leading space.
    out.push(/^(?:#|=>|>|\* |```)/.test(text) ? ` ${text}` : text);
  };

  const pushHeading = (level, text) => {
    flushLinks();
    out.push(`${"#".repeat(Math.min(level, 3))} ${stripInline(text, pendingLinks).trim()}`);
    flushLinks();
  };

  for (const line of lines) {
    const f = fenceChar(line);
    if (f && (!fence || f === fence)) {
      flushPara();
      if (inTable) out.push("```");
      inTable = false;
      fence = fence ? null : f;
      // Gemtext only recognizes ``` at the very start of a line, so an
      // indented fence has to be left-trimmed (and a ~~~ fence rewritten)
      // or clients won't toggle preformatted mode.
      out.push(line.trimStart().replace(/^~+/, "```"));
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }

    // Table rows are kept verbatim in a preformatted block so the columns
    // stay aligned.
    if (TABLE_ROW_RE.test(line)) {
      flushPara();
      if (!inTable) out.push("```");
      inTable = true;
      out.push(line.trim());
      continue;
    }
    if (inTable) out.push("```");
    inTable = false;

    // A hand-authored Gemtext link line passes through verbatim -- it must
    // skip stripInline, which would mangle e.g. underscores in the URL.
    if (line.startsWith("=>")) {
      flushPara();
      flushLinks();
      out.push(line);
      continue;
    }

    // A line that is only a Markdown link becomes a bare link line in
    // place, instead of label text plus a trailing link line.
    if (STANDALONE_LINK_RE.test(line)) {
      flushPara();
      flushLinks();
      processInline(line, (match, label, url) => {
        out.push(linkLine({ url, label }));
        return "";
      });
      continue;
    }

    if (para.length && SETEXT_RE.test(line)) {
      const text = para.join(" ");
      para = [];
      pushHeading(line.trim().startsWith("=") ? 1 : 2, text);
      continue;
    }

    if (HR_RE.test(line)) {
      flushPara();
      out.push("---");
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      pushHeading(heading[1].length, heading[2]);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      out.push(`> ${stripInline(line.replace(/^>\s?/, ""), pendingLinks)}`);
      continue;
    }

    // Gemtext lists are unordered only, so a numbered item stays a plain
    // "1. text" line rather than losing its number to a "*" bullet.
    const listItem = line.match(LIST_ITEM_RE);
    if (listItem) {
      flushPara();
      const text = stripInline(listItem[2], pendingLinks);
      out.push(listItem[1] ? `${listItem[1]}. ${text}` : `* ${text}`);
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      flushLinks();
      out.push("");
      continue;
    }

    para.push(line.replace(/\\$/, "").trim());
    if (HARD_BREAK_RE.test(line)) flushPara();
  }
  flushPara();
  if (inTable) out.push("```");
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
