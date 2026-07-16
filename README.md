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
npm install github:jsandburg/eleventy-plugin-gopher-gemini#v0.1.0
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

## Example templates

A Gemini capsule page per post (`src/gemini/blog.njk`, using Eleventy's
pagination over the `geminiPosts` collection):

```njk
---
pagination:
  data: collections.geminiPosts
  size: 1
  alias: post
permalink: "/gemini{{ post.url }}index.gmi"
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
permalink: "/gopher{{ post.url }}text"
eleventyExcludeFromCollections: true
eleventyAllowMissingExtension: true
---
{{ post.rawInput | gopherText | safe }}
```

A gophermap listing posts (`src/gopher/gophermap.njk`):

```njk
---
permalink: "/gopher/gophermap"
eleventyExcludeFromCollections: true
eleventyAllowMissingExtension: true
---
{% for post in collections.gopherPosts %}
{% gopherLink post.data.title, post.url %}
{% endfor %}
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
