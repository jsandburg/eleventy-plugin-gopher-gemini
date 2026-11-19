import { splitLines, fenceChar } from "./blocks.js";

// Nunjucks shortcode tags ({% image ... %}, {% youtube ... %}) survive in
// page.rawInput because Eleventy never runs the raw source through the
// template engine -- so without help they'd reach Gopher/Gemini readers as
// literal template syntax (issue #1). Neither protocol can embed media, but
// both link to it natively, so known media shortcodes are rewritten to plain
// Markdown links *before* conversion (the converters then give them the same
// link-line treatment as a hand-written ![alt](url)), and unrecognized tags
// are stripped so raw {% ... %} syntax never leaks into output.
//
// Comments ({# ... #} and Liquid's {% comment %} blocks) are removed with
// their contents, and {{ ... }} expressions are removed too, since there's
// no data to evaluate them against here.
//
// Template syntax inside fenced code blocks or inline `code` spans passes
// through untouched, so a post *about* shortcodes can still show them
// verbatim.

// A {% raw %} block keeps its contents verbatim, and a "{#id}" heading-ID
// attribute is removed on its own rather than read as the start of a
// comment.
//
// One pass, so a code span claims its text before any tag pattern can.
// Groups: 1 = code span, 2 = raw block contents, 3 = tag name, 4 = tag
// arguments. The tag name must end at a non-name character so it can't
// backtrack letter by letter, and every open-ended pattern stops at the
// next opener of its own kind, so unclosed runs are scanned in linear
// rather than quadratic time and a stray opener can't swallow the text up
// to some distant closer. {{ }} also stops at a paragraph break.
const SYNTAX_RE = new RegExp(
  [
    /(`[^`\n]+`)/,
    /\{%-?\s*raw\s*-?%\}((?:(?!\{%-?\s*raw\b)[\s\S])*?)\{%-?\s*endraw\s*-?%\}/,
    /\{%-?\s*comment\s*-?%\}(?:(?!\{%-?\s*comment\b)[\s\S])*?\{%-?\s*endcomment\s*-?%\}/,
    /\{#[\w:.-]+\}/,
    /\{#(?:(?!\{#)[\s\S])*?#\}/,
    /\{\{(?:(?!\{\{|\n[^\S\n]*\n)[\s\S])*?\}\}/,
    /\{%-?\s*([\w-]+)(?![\w-])((?:(?!\{%)[\s\S])*?)-?%\}/,
  ]
    .map((re) => re.source)
    .join("|"),
  "g"
);

// Args are comma-separated, quoted or bare, matching how Eleventy's Nunjucks
// shortcodes are called: {% image "src/x.jpg", "alt text" %}. Keyword
// arguments ({% image src="src/x.jpg", alt="alt text" %}) are collected on
// the returned array's `named` property instead of its positions.
function parseArgs(argStr) {
  const args = [];
  // No prototype, so a key like "__proto__" is just a key
  args.named = Object.create(null);
  const re = /(?:([A-Za-z_]\w*)=)?(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s,]+))/g;
  let match;
  while ((match = re.exec(argStr))) {
    const quoted = match[2] ?? match[3];
    const value = quoted !== undefined ? quoted.replace(/\\(.)/g, "$1") : match[4];
    if (match[1]) args.named[match[1]] = value;
    else args.push(value);
  }
  return args;
}

// Builders for the two shortcodes Eleventy sites most commonly use in post
// markdown. `imageSrcRewrite` maps the shortcode's *repo* path to the served
// path (e.g. "src/images/foo.jpg" -> "/images/foo.jpg"); the default strips
// a leading "src/" segment, which matches the usual passthrough-copy layout.
export function defaultShortcodes({ imageSrcRewrite } = {}) {
  const rewrite = imageSrcRewrite ?? ((src) => src.replace(/^src\//, "/"));
  // Brackets or line breaks in alt text would break the generated
  // ![alt](src) apart and leak it as literal Markdown.
  const cleanAlt = (alt) => String(alt).replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
  return {
    image: (args) => {
      const src = args.named?.src ?? args[0] ?? "";
      const alt = args.named?.alt ?? args[1] ?? "";
      return src ? `![${cleanAlt(alt)}](${rewrite(src)})` : "";
    },
    youtube: (args) => {
      const id = args.named?.id ?? args[0];
      return id ? `[YouTube video](https://www.youtube.com/watch?v=${encodeURIComponent(id)})` : "";
    },
  };
}

// Rewrites every {% name ... %} tag in the Markdown source. A builder in
// `shortcodes` receives the parsed argument list and returns replacement
// Markdown; a missing builder, or a builder returning null/undefined, strips
// the tag entirely.
export function convertShortcodes(markdown = "", shortcodes = {}) {
  const lines = splitLines(markdown);
  const out = [];
  let fence = null;
  let buffer = [];

  const flush = () => {
    if (!buffer.length) return;
    out.push(
      buffer.join("\n").replace(SYNTAX_RE, (match, code, raw, name, argStr) => {
        if (code) return code;
        if (raw !== undefined) return raw;
        // Only the map's own entries count, so a tag named e.g.
        // "constructor" or "valueOf" can't call an inherited method.
        const builder = name && Object.hasOwn(shortcodes, name) ? shortcodes[name] : undefined;
        if (typeof builder !== "function") return "";
        const replacement = builder(parseArgs(argStr));
        return replacement == null ? "" : String(replacement);
      })
    );
    buffer = [];
  };

  for (const line of lines) {
    const f = fenceChar(line);
    if (f && (!fence || f === fence)) {
      flush();
      fence = fence ? null : f;
      out.push(line);
      continue;
    }
    (fence ? out : buffer).push(line);
  }
  flush();

  return out.join("\n");
}
