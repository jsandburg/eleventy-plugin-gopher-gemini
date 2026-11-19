// Shared inline-Markdown handling for the Gemtext and Gopher text
// converters. Neither protocol has inline markup, so:
//   - `code` spans are pulled out first, so their contents are never
//     misparsed as links or emphasis, then restored as plain text,
//   - inline [label](url) / ![alt](url) references are handed to the
//     caller's replacer (each converter renders links differently),
//   - <autolinks> and HTML <a>/<img> are treated as links too, and any
//     other inline HTML tags are dropped,
//   - **bold**, *italic*, __bold__, and _italic_ wrappers are unwrapped.
//
// The link pattern allows two levels of balanced parentheses inside the URL
// so Wikipedia-style links (".../Gopher_(protocol)") survive intact, and one
// level of balanced brackets inside the label, so a linked image
// ("[![alt](img)](url)") or a bracketed word is part of the label. Every
// alternative starts with a different character, so a line full of
// unmatched "[" or "(" is scanned in linear rather than quadratic time.
export const LINK_RE = /!?\[((?:[^[\]]|\[[^[\]]*\])*)\]\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))+)\)/g;

// A link or image nested in another link's label is reduced to its own
// label: only the outer link is kept (a link can't contain a link).
const NESTED_LINK_RE = /!?\[([^[\]]*)\]\((?:[^()]|\([^()]*\))*\)/g;

// <https://example.com> (group 1) and <user@example.com> (group 2)
const AUTOLINK_RE = /<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*)>|<([^\s<>@]+@[^\s<>@]+)>/;

// Groups: 1 = label, 2 = destination, 3 = autolink URL, 4 = autolink email
export const ANY_LINK_RE = new RegExp(`${LINK_RE.source}|${AUTOLINK_RE.source}`, "g");

const CODE_SPAN_RE = /(`+)(?!`)(.+?)(?<!`)\1(?!`)/g;

export function processInline(text, linkReplacer) {
  // Code-span contents are swapped out for NUL-delimited placeholders (NUL
  // can't appear in sane Markdown source) and restored at the end.
  const codeSpans = [];
  const restore = (s) =>
    s.replace(/\u0000(\d+)\u0000/g, (match, i) => codeSpans[+i] ?? match);

  let out = text.replace(CODE_SPAN_RE, (match, ticks, code) => {
    codeSpans.push(code.trim());
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  out = htmlLinksToMarkdown(out).replace(ANY_LINK_RE, (match, label, url, autoUrl, autoEmail) => {
    if (url === undefined) return linkReplacer(match, "", restore(autoUrl ?? `mailto:${autoEmail}`));
    const cleanLabel = stripEmphasis(stripTags(label.replace(NESTED_LINK_RE, "$1")));
    return linkReplacer(match, restore(cleanLabel), linkDestination(restore(url)));
  });
  return restore(stripEmphasis(stripTags(out)));
}

// A URL in running text is left alone (group 1), so underscores or
// asterisks in it aren't taken for emphasis. Emphasis markers must hug
// their text ("*word*"), so a spaced-out "2 * 3 * 4" keeps its asterisks.
const BARE_URL = /(?<![\w+.-])([A-Za-z][A-Za-z0-9+.-]*:\/\/\S+)/.source;
const EMPHASIS_RES = [
  /\*\*(?!\s)([^*]+)(?<!\s)\*\*/,
  /\*(?!\s)([^*]+)(?<!\s)\*/,
  /__(?!\s)([^_]+)(?<!\s)__/,
  /\b_(?!\s)([^_]+)(?<!\s)_\b/,
].map((re) => new RegExp(`${BARE_URL}|${re.source}`, "g"));

function stripEmphasis(text) {
  for (const re of EMPHASIS_RES) text = text.replace(re, (match, url, inner) => url ?? inner);
  return text;
}

// Inline HTML has no meaning in either protocol: comments go, and tags are
// dropped while the text between them stays.
function stripTags(text) {
  return text.replace(/<!--(?:(?!<!--)[\s\S])*?-->|<\/?[A-Za-z][^<>]*>/g, "");
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match ? match[1] ?? match[2] : "";
}

// <a href> and <img src> are rewritten to Markdown links first, so they get
// the same treatment as hand-written ones instead of losing their target.
function htmlLinksToMarkdown(text) {
  const label = (s) => s.replace(/[[\]]/g, "");
  return text
    .replace(/<img\s[^<>]*>/gi, (tag) => {
      const src = attr(tag, "src");
      return src ? `![${label(attr(tag, "alt"))}](<${src}>)` : "";
    })
    .replace(/<a\s[^<>]*>((?:(?!<a\s)[\s\S])*?)<\/a>/gi, (match, inner) => {
      const href = attr(match.slice(0, match.indexOf(">") + 1), "href");
      return href ? `[${inner}](<${href}>)` : inner;
    });
}

// Reduces a Markdown link destination to a bare URL: drops an optional
// "title" (neither protocol has anywhere to put it), unwraps <...>, and
// percent-encodes whitespace, which would otherwise end the URL early on a
// Gemtext "=> url label" line.
function linkDestination(raw) {
  // The lookbehind anchors the match at the start of a whitespace run, so a
  // long run of spaces is scanned once rather than from every position.
  let url = raw.trim().replace(/(?<!\s)\s+(?:"[^"]*"|'[^']*')$/, "");
  const angled = url.match(/^<(.*)>$/);
  if (angled) url = angled[1];
  return url.replace(/\s/g, "%20");
}
