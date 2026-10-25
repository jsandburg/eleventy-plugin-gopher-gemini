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

// One pass, so a code span claims its text before any tag pattern can.
// Groups: 1 = code span, 2 = tag name, 3 = tag arguments. The tag name must
// end at a non-name character so it can't backtrack letter by letter, and
// the arguments and {{ }} contents stop at the next opener, so unclosed
// runs are scanned in linear rather than quadratic time.
const SYNTAX_RE = new RegExp(
  [
    /(`[^`\n]+`)/,
    /\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/,
    /\{#[\s\S]*?#\}/,
    /\{\{(?:(?!\{\{)[\s\S])*?\}\}/,
    /\{%-?\s*([\w-]+)(?![\w-])((?:(?!\{%)[\s\S])*?)-?%\}/,
  ]
    .map((re) => re.source)
    .join("|"),
  "g"
);

// Args are comma-separated, quoted or bare, matching how Eleventy's Nunjucks
// shortcodes are called: {% image "src/x.jpg", "alt text" %}
function parseArgs(argStr) {
  const args = [];
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s,]+)/g;
  let match;
  while ((match = re.exec(argStr))) {
    const quoted = match[1] ?? match[2];
    args.push(quoted !== undefined ? quoted.replace(/\\(.)/g, "$1") : match[3]);
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
    image: ([src = "", alt = ""]) => (src ? `![${cleanAlt(alt)}](${rewrite(src)})` : ""),
    youtube: ([id]) =>
      id ? `[YouTube video](https://www.youtube.com/watch?v=${encodeURIComponent(id)})` : "",
  };
}

// Rewrites every {% name ... %} tag in the Markdown source. A builder in
// `shortcodes` receives the parsed argument list and returns replacement
// Markdown; a missing builder, or a builder returning null/undefined, strips
// the tag entirely.
export function convertShortcodes(markdown = "", shortcodes = {}) {
  const lines = String(markdown).split(/\r?\n/);
  const out = [];
  let inCode = false;
  let buffer = [];

  const flush = () => {
    if (!buffer.length) return;
    out.push(
      buffer.join("\n").replace(SYNTAX_RE, (match, code, name, argStr) => {
        if (code) return code;
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
    if (/^\s*```/.test(line)) {
      flush();
      inCode = !inCode;
      out.push(line);
      continue;
    }
    (inCode ? out : buffer).push(line);
  }
  flush();

  return out.join("\n");
}
