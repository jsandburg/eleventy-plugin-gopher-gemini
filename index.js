import { hasOutput, filterByOutput, ALL_PROTOCOLS } from "./lib/outputs.js";
import { toGemtext } from "./lib/gemtext.js";
import { toGopherText } from "./lib/gopher-text.js";
import { gopherItemType } from "./lib/item-type.js";
import { convertShortcodes, defaultShortcodes } from "./lib/shortcodes.js";

export default function gopherGeminiPlugin(eleventyConfig, options = {}) {
  const config = {
    maxLineWidth: 70,
    host: "",
    port: "70",
    // Also accepted: `imageSrcRewrite` (maps {% image %} repo paths to served
    // paths) and `shortcodes` (extends/overrides the built-in image/youtube
    // tag handling) -- see lib/shortcodes.js.
    ...options,
  };
  // An option passed as undefined/null (e.g. an unset env var) means "not set"
  config.host ??= "";
  config.port ??= "70";

  // Nunjucks shortcode tags in page.rawInput are rewritten to Markdown links
  // (or stripped, if unrecognized) before conversion, so raw {% ... %}
  // syntax never reaches Gopher/Gemini output.
  const shortcodeMap = { ...defaultShortcodes(config), ...(config.shortcodes || {}) };
  const preprocess = (markdown) => convertShortcodes(markdown, shortcodeMap);

  // {{ post | hasOutput("gopher") }}
  eleventyConfig.addFilter("hasOutput", hasOutput);

  // {{ content | gemtext | safe }}
  eleventyConfig.addFilter("gemtext", (markdown) => toGemtext(preprocess(markdown)));

  // {{ content | gopherText | safe }}  -- plain wrapped body only
  eleventyConfig.addFilter("gopherText", (markdown) => toGopherText(preprocess(markdown), config).body);

  // {{ content | gopherLinks }}  -- [{ url, label }, ...] extracted from the content
  eleventyConfig.addFilter("gopherLinks", (markdown) => toGopherText(preprocess(markdown), config).links);

  // {{ "/images/keroppi.gif" | gopherItemType }} -> "g"
  eleventyConfig.addFilter("gopherItemType", gopherItemType);

  // Gophermap fields are tab-delimited and both formats are line-based, so
  // a tab or newline inside a shortcode argument (e.g. a post title) would
  // corrupt the menu line or inject extra lines; collapse them to spaces.
  const sanitize = (value) => String(value).replace(/[\t\r\n]+/g, " ");

  let warnedNoHost = false;

  // {% gopherLink "About" "/about" %} -- host/port default to the plugin's
  // configured `host`/`port` options, but can be overridden per link
  eleventyConfig.addShortcode("gopherLink", function (description, selector = "", host, port) {
    let target = sanitize(selector);
    const type = gopherItemType(target);
    host ??= config.host;
    port ??= config.port;
    // A gopher:// URL (RFC 4266) already names its own host, port, item
    // type and selector, so split those out instead of using it as a selector
    const gopherUrl = target.match(/^gopher:\/\/([^/:]*)(?::(\d+))?(?:\/.(.*))?$/i);
    if (gopherUrl) {
      host = gopherUrl[1];
      port = gopherUrl[2] || "70";
      target = sanitize(decodeSelector(gopherUrl[3] ?? ""));
    } else if (type === "h" && !/^URL:/i.test(target)) {
      // Web links use the conventional "hURL:<url>" selector form
      target = `URL:${target}`;
    }
    if (!host && !warnedNoHost) {
      warnedNoHost = true;
      console.warn(
        "[eleventy-plugin-gopher-gemini] gopherLink: no `host` option is set, so menu lines have an empty host field. Set it to your Gopher server's hostname."
      );
    }
    return `${type}${sanitize(description)}\t${target}\t${sanitize(host)}\t${sanitize(port)}`;
  });

  // {% gemLink "/about.gmi" "About" %}
  eleventyConfig.addShortcode("gemLink", function (uri, label) {
    // A space would end the URI early, so it's percent-encoded like the
    // link URLs the gemtext filter emits
    const cleanUri = sanitize(uri).trim().replace(/\s/g, "%20");
    return `=> ${cleanUri}${label ? " " + sanitize(label) : ""}`;
  });
}

// Selectors in gopher:// URLs are percent-encoded; leave a malformed one as-is
function decodeSelector(selector) {
  try {
    return decodeURIComponent(selector);
  } catch {
    return selector;
  }
}

export { hasOutput, filterByOutput, ALL_PROTOCOLS, toGemtext, toGopherText, gopherItemType, convertShortcodes, defaultShortcodes };
