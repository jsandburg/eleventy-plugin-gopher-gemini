# eleventy-plugin-gopher-gemini

Publish an [Eleventy](https://www.11ty.dev/) site as a web site *and* a
[Gopher](https://en.wikipedia.org/wiki/Gopher_(protocol)) hole and/or a
[Gemini](https://geminiprotocol.net/) capsule, from the same source content —
with per-page control over which of the three a given page ships to.

This is an Eleventy-native alternative to
[Hugo-2-Gopher-and-Gemini](https://github.com/mkamarin/Hugo-2-Gopher-and-Gemini):
instead of running Hugo, then post-processing its HTML output with a Python
script, this plugin adds filters/shortcodes you use directly in your own
Eleventy templates and collections, so Gopher/Gemini output is generated in
the same build as everything else.

## Install

Requires Eleventy 3.0 or later (this plugin reads `page.rawInput`, added in
3.0, to get at the raw Markdown source of a page — see below).

Pin a released tag rather than tracking `main`, so a future breaking change
doesn't silently break your build:

```bash
npm install github:jsandburg/eleventy-plugin-gopher-gemini#v0.2.0
```

```js
// eleventy.config.js
import gopherGemini from "eleventy-plugin-gopher-gemini";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(gopherGemini, {
    maxLineWidth: 70, // Gopher text wrap width, RFC 1436 default
    host: "gopher.example.com", // default host for the gopherLink shortcode
    port: "70", // default port for the gopherLink shortcode
  });
}
```

## Per-page protocol targeting

Add an `outputs` front-matter field to any page. Omit it and the page ships
to all three protocols by default:

```yaml
---
title: "A web-only post"
outputs: [web]
---
```

```yaml
---
title: "A gopher-only note"
outputs: [gopher]
---
```

A bare string (`outputs: gopher`) is treated the same as a one-element list
(`outputs: [gopher]`).

Use the `hasOutput` filter to build protocol-specific collections in your
`eleventy.config.js`:

```js
eleventyConfig.addCollection("gopherPosts", (api) =>
  api.getFilteredByGlob("src/blog/*.md").filter((item) => item.data.outputs ? item.data.outputs.includes("gopher") : true)
);

eleventyConfig.addCollection("geminiPosts", (api) =>
  api.getFilteredByGlob("src/blog/*.md").filter((item) => item.data.outputs ? item.data.outputs.includes("gemini") : true)
);
```

Or call the exported `filterByOutput(items, protocol)` helper directly if
you'd rather not repeat the filter inline.

### Disabling the web page

Collections only control the Gopher/Gemini side. For a post that excludes
`web` to also get no web page, compute its permalink in the posts folder's
directory data file, using the exported `hasOutput` helper:

```js
// src/blog/blog.11tydata.js
import { hasOutput } from "eleventy-plugin-gopher-gemini";

export default {
  eleventyComputed: {
    // Only apply to markdown posts — see warning below.
    permalink: (data) =>
      data.page.inputPath.endsWith(".md")
        ? hasOutput(data, "web")
          ? `/blog/${data.page.fileSlug}/`
          : false
        : "/blog/",
  },
};
```

> **Warning: guard against non-post templates.** A directory data file
> applies to *every* template in the folder — including an archive page
> like `src/blog/index.njk` — and computed data overrides a template's own
> front-matter permalink. Without the `.md` guard above, an index page's
> permalink becomes `/blog/<its fileSlug>/`, i.e. `/blog/blog/`, leaving
> nothing at `/blog/` (and, behind a `/blog → /blog/` trailing-slash
> redirect rule, an infinite redirect loop). Adjust the guard's fallback
> (`"/blog/"`) if your folder holds anything other than posts and a single
> index page.

## Filters and shortcodes

| Name | Kind | Description |
|---|---|---|
| `hasOutput` | filter | `{{ post \| hasOutput("gopher") }}` — true if the page's `outputs` list includes the protocol (or has no `outputs` field at all) |
| `gemtext` | filter | Converts a Markdown string to Gemtext: headings/blockquotes pass through, inline formatting is unwrapped, inline links become trailing `=> url label` lines. A line consisting of only a Markdown link becomes a bare `=> url label` line in place, and a hand-authored `=>` line passes through verbatim (note that raw `=>` lines appear as literal text in your web/Gopher output) |
| `gopherText` | filter | Converts a Markdown string to plain, word-wrapped Gopher body text; links become `[n]` citations with a numbered list at the end |
| `gopherLinks` | filter | Returns the `[{ url, label }]` array extracted from a Markdown string, for building gophermap menu lines separately from the body |
| `gopherItemType` | filter | `{{ "/images/keroppi.gif" \| gopherItemType }}` → `g`/`I`/`9`/`h`/`1`/`0`, the Gopher item-type code for a path |
| `gopherLink` | shortcode | `{% gopherLink "About", "/about" %}` — one gophermap menu line, item type auto-detected from the selector; an `http(s)://` selector becomes a type-`h` `URL:` web link; host/port default to the plugin's configured `host`/`port` options and can be overridden with `{% gopherLink "About", "/about", "other.host", "70" %}`. Tabs and newlines in any argument are collapsed to spaces so a title can't corrupt the menu |
| `gemLink` | shortcode | `{% gemLink "/about.gmi", "About" %}` — one Gemtext link line |

> **Important:** `gemtext` and `gopherText` parse **Markdown**, not HTML. Pass
> them the page's raw Markdown source (`page.rawInput`, added in Eleventy
> 3.0) — never `templateContent` or `content`, which are already
> Eleventy's own compiled HTML output and will not parse as Markdown.

## Shortcode tags in post markdown

Because `page.rawInput` is the raw source, Nunjucks shortcode tags a site
uses inside post markdown (`markdownTemplateEngine: "njk"`) are never
evaluated on the Gopher/Gemini path. Neither protocol can embed media, but
both link to it natively, so before conversion the `gemtext`, `gopherText`,
and `gopherLinks` filters rewrite known media tags to plain Markdown links —
which then get the same link-line treatment as a hand-written `![alt](url)`:

- `{% image "src/images/blog/frog.jpg", "a frog" %}` → `![a frog](/images/blog/frog.jpg)`
  → `=> /images/blog/frog.jpg a frog` in Gemtext, an `[n]` citation in Gopher text
- `{% youtube "dQw4w9WgXcQ" %}` → a `[YouTube video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)` web link

Unrecognized `{% ... %}` tags are **stripped**, so raw template syntax never
reaches a reader. Tags inside fenced code blocks pass through verbatim, so a
post *about* shortcodes can still show them.

Two plugin options control this:

```js
eleventyConfig.addPlugin(gopherGemini, {
  // Maps {% image %}'s repo path to the served path. Default strips a
  // leading "src/" ("src/images/foo.jpg" -> "/images/foo.jpg"), matching
  // the usual addPassthroughCopy("src/images") layout.
  imageSrcRewrite: (src) => src.replace(/^src\//, "/"),

  // Extend (or override) tag handling: name -> (args) => replacement
  // Markdown, where args is the parsed argument list. Return null to strip.
  shortcodes: {
    stamp: ([name]) => `![stamp](/stamps/${name}.png)`,
    youtube: () => null, // e.g. drop videos from text protocols entirely
  },
});
```

## Example templates

> **Build paths from `page.fileSlug`, not `post.url`.** A site that honors
> `outputs` on the web side disables the web page for a gopher/gemini-only
> post by setting `permalink: false` — which makes `post.url` literally
> `false`, so a permalink like `/gemini{{ post.url }}index.gmi` collapses
> into garbage (`/geminifalseindex.gmi`) for exactly the posts this plugin
> exists to support. `{{ post.page.fileSlug }}` is stable no matter which
> protocols a post ships to, and produces the same path for ordinary posts.

A Gemini capsule page per post (`src/gemini/blog.njk`, using Eleventy's
pagination over the `geminiPosts` collection):

```njk
---
pagination:
  data: collections.geminiPosts
  size: 1
  alias: post
permalink: "/gemini/blog/{{ post.page.fileSlug }}/index.gmi"
eleventyExcludeFromCollections: true
---
# {{ post.data.title }}

{{ post.rawInput | gemtext | safe }}
```

A Gopher text page per post (`src/gopher/post.njk`). Gophermap selector
lines are also extensionless, so `eleventyAllowMissingExtension: true` is
required or Eleventy will refuse to write the file:

```njk
---
pagination:
  data: collections.gopherPosts
  size: 1
  alias: post
permalink: "/gopher/blog/{{ post.page.fileSlug }}/text"
eleventyExcludeFromCollections: true
eleventyAllowMissingExtension: true
---
{{ post.rawInput | gopherText | safe }}
```

A gophermap listing posts (`src/gopher/gophermap.njk`). The selectors point
at the Gopher text pages above, *relative to the Gopher root* — if you serve
`_site/gopher/` as the root of the hole, `/gopher/blog/foo/text` on disk is
selector `/blog/foo/text`:

```njk
---
permalink: "/gopher/gophermap"
eleventyExcludeFromCollections: true
eleventyAllowMissingExtension: true
---
{% for post in collections.gopherPosts -%}
{% gopherLink post.data.title, "/blog/" + post.page.fileSlug + "/text" %}
{% endfor -%}
```

## Images

Gopher and Gemini are line-oriented text protocols — neither can inline an
image, so an image reference always becomes its own link line, and the
client fetches it (and displays or downloads it) as a separate request:

- `gopherItemType` maps file extensions to the Gopher item-type codes clients
  use to decide how to handle the selector: `g` for GIF, `I` for other raster
  images, `9` for other binary files, `h` for web URLs, `1` for directories,
  `0` for plain text.
- `gemtext` and `gopherText` both pull `![alt](path)` image references out of
  the running text and turn them into their own link line (`=> path alt` for
  Gemini, an `[n]` citation for Gopher), the same way a regular link is
  handled.
- Copy the actual image files into your Gopher/Gemini output the same way you
  already do for the web build, e.g.:

  ```js
  eleventyConfig.addPassthroughCopy({ "src/images": "gopher/images" });
  eleventyConfig.addPassthroughCopy({ "src/images": "gemini/images" });
  ```

There's no thumbnailing, resizing, or inline rendering — that's a limitation
of the protocols themselves, not this plugin.

## Development

```bash
npm install
npm test
```

The test suite covers the `gemtext`/`gopherText`/`gopherItemType`/`hasOutput`
conversion logic directly, plus an end-to-end test that runs a real Eleventy
build against the plugin and inspects the emitted web/Gemini/Gopher output.

## License

MIT
