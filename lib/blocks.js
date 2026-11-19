// Block-level Markdown recognition shared by the converters (and, for
// fences, by the shortcode preprocessor).

// A bare "\r" counts as a line break too, so it can't smuggle a second
// line (e.g. a "=> ..." link line) through as part of one.
export const splitLines = (text) => String(text ?? "").split(/\r\n?|\n/);

// Returns the fence character ("`" or "~") if `line` opens or closes a
// fenced code block. A backtick fence can't have another backtick after it,
// so a paragraph starting with an inline ```code``` span isn't a fence.
// Callers track the open fence's character: only the same one closes it.
export function fenceChar(line) {
  const match = line.match(/^\s*(?:(`)``+[^`]*|(~)~~+.*)$/);
  return match ? match[1] || match[2] : null;
}

// "---", "***", "___" (optionally spaced out) -- a thematic break
export const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

// "====" or "----" under a paragraph turns it into a level 1 / 2 heading
export const SETEXT_RE = /^ {0,3}(=+|-+)[ \t]*$/;

// A pipe-delimited table row; kept verbatim so its columns stay aligned
export const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

// Group 1 = the number of an ordered item (undefined for a bullet),
// group 2 = the item text
export const LIST_ITEM_RE = /^\s*(?:[-*]|(\d+)\.)\s+(.*)$/;

// A hard line break: two trailing spaces or a trailing backslash
export const HARD_BREAK_RE = /(?: {2,}|\\)$/;

// "[label]: url" with an optional title. Footnote definitions ("[^1]: ...")
// are not link references.
const REF_DEF_RE = /^ {0,3}\[(?!\^)([^[\]]+)\]:\s*(\S+)(?:\s+(?:"[^"]*"|'[^']*'|\([^()]*\)))?\s*$/;

// [text][ref], [ref][] and the bare [ref] shortcut; not followed by "(",
// which would make it an ordinary inline link.
const REF_USE_RE = /(!?\[((?:[^[\]]|\[[^[\]]*\])*)\])(?:\[([^[\]]*)\])?(?!\()/g;

const refKey = (label) => label.trim().replace(/\s+/g, " ").toLowerCase();

// Rewrites reference-style links to inline [text](url) links and drops the
// definition lines, so the converters only ever see the inline form.
// Fenced code blocks are left untouched.
export function resolveReferences(lines) {
  const refs = new Map();
  const kept = [];
  let fence = null;
  for (const line of lines) {
    const f = fenceChar(line);
    if (f && (!fence || f === fence)) fence = fence ? null : f;
    const def = !fence && !f && line.match(REF_DEF_RE);
    if (def) {
      if (!refs.has(refKey(def[1]))) refs.set(refKey(def[1]), def[2]);
    } else {
      kept.push({ line, code: Boolean(fence || f) });
    }
  }
  if (!refs.size) return lines;
  return kept.map(({ line, code }) =>
    code
      ? line
      : line.replace(REF_USE_RE, (match, head, text, ref) => {
          const url = refs.get(refKey(ref || text));
          return url ? `${head}(${url})` : match;
        })
  );
}
