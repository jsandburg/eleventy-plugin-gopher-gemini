import { hasOutput, filterByOutput, ALL_PROTOCOLS } from "./lib/outputs.js";
import { toGemtext } from "./lib/gemtext.js";
import { toGopherText } from "./lib/gopher-text.js";
import { gopherItemType } from "./lib/item-type.js";

export default function gopherGeminiPlugin(eleventyConfig, options = {}) {
  const config = {
    maxLineWidth: 70,
    host: "",
    port: "70",
    ...options,
  };

  // {{ post | hasOutput("gopher") }}
  eleventyConfig.addFilter("hasOutput", hasOutput);

  // {{ content | gemtext | safe }}
  eleventyConfig.addFilter("gemtext", (markdown) => toGemtext(markdown));

  // {{ content | gopherText | safe }}  -- plain wrapped body only
  eleventyConfig.addFilter("gopherText", (markdown) => toGopherText(markdown, config).body);

  // {{ content | gopherLinks }}  -- [{ url, label }, ...] extracted from the content
  eleventyConfig.addFilter("gopherLinks", (markdown) => toGopherText(markdown, config).links);

  // {{ "/images/keroppi.gif" | gopherItemType }} -> "g"
  eleventyConfig.addFilter("gopherItemType", gopherItemType);

  // {% gopherLink "About" "/about" %} -- host/port default to the plugin's
  // configured `host`/`port` options, but can be overridden per link
  eleventyConfig.addShortcode("gopherLink", function (description, selector = "", host = config.host, port = config.port) {
    const type = gopherItemType(selector);
    return `${type}${description}\t${selector}\t${host}\t${port}`;
  });

  // {% gemLink "/about.gmi" "About" %}
  eleventyConfig.addShortcode("gemLink", function (uri, label) {
    return `=> ${uri}${label ? " " + label : ""}`;
  });
}

export { hasOutput, filterByOutput, ALL_PROTOCOLS, toGemtext, toGopherText, gopherItemType };
