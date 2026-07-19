// Nunjucks shortcode tags ({% image ... %}, {% youtube ... %}) survive in
// page.rawInput because Eleventy never runs the raw source through the
// template engine -- so without help they'd reach Gopher/Gemini readers as
// literal template syntax (issue #1). Neither protocol can embed media, but
// both link to it natively, so known media shortcodes are rewritten to plain
// Markdown links *before* conversion (the converters then give them the same
// link-line treatment as a hand-written ![alt](url)), and unrecognized tags
// are stripped so raw {% ... %} syntax never leaks into output.
//
// Tags inside fenced code blocks pass through untouched, so a post *about*
// shortcodes can still show them verbatim.

const TAG_RE = /\{%-?\s*([\w-]+)([\s\S]*?)-?%\}/g;

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
  return {
    image: ([src = "", alt = ""]) => (src ? `![${alt}](${rewrite(src)})` : ""),
    youtube: ([id]) =>
      id ? `[YouTube video](https://www.youtube.com/watch?v=${id})` : "",
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
      buffer.join("\n").replace(TAG_RE, (tag, name, argStr) => {
        const builder = shortcodes[name];
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
