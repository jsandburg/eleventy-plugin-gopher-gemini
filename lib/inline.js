// Shared inline-Markdown handling for the Gemtext and Gopher text
// converters. Neither protocol has inline markup, so:
//   - `code` spans are pulled out first, so their contents are never
//     misparsed as links or emphasis, then restored as plain text,
//   - inline [label](url) / ![alt](url) references are handed to the
//     caller's replacer (each converter renders links differently),
//   - **bold**, *italic*, __bold__, and _italic_ wrappers are unwrapped.
//
// The link pattern allows one level of balanced parentheses inside the URL
// so Wikipedia-style links (".../Gopher_(protocol)") survive intact.
export const LINK_RE = /!?\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;

export function processInline(text, linkReplacer) {
  // Code-span contents are swapped out for NUL-delimited placeholders (NUL
  // can't appear in sane Markdown source) and restored at the end.
  const codeSpans = [];
  const restore = (s) =>
    s.replace(/\u0000(\d+)\u0000/g, (match, i) => codeSpans[+i] ?? match);

  let out = text.replace(/`([^`]+)`/g, (match, code) => {
    codeSpans.push(code);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  out = out.replace(LINK_RE, (match, label, url) =>
    linkReplacer(match, restore(label), restore(url))
  );
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\b_([^_]+)_\b/g, "$1");
  return restore(out);
}
