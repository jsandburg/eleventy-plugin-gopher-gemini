import gopherGemini from "../../../index.js";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(gopherGemini, {
    maxLineWidth: 70,
    host: "gopher.example.com",
    port: "70",
  });

  // Stand-ins for the image/youtube shortcodes a consuming site registers
  // for its web build; the plugin must convert the same tags to link lines
  // in the Gopher/Gemini output.
  eleventyConfig.addShortcode("image", (src, alt) =>
    `<img src="${src.replace(/^src\//, "/")}" alt="${alt}">`
  );
  eleventyConfig.addShortcode("youtube", (id) =>
    `<iframe src="https://www.youtube.com/embed/${id}"></iframe>`
  );

  eleventyConfig.addCollection("geminiPosts", (api) =>
    api.getFilteredByGlob("test/fixtures/site/src/blog/*.md").filter((item) =>
      item.data.outputs ? item.data.outputs.includes("gemini") : true
    )
  );
  eleventyConfig.addCollection("gopherPosts", (api) =>
    api.getFilteredByGlob("test/fixtures/site/src/blog/*.md").filter((item) =>
      item.data.outputs ? item.data.outputs.includes("gopher") : true
    )
  );

  return {
    dir: { input: "test/fixtures/site/src", output: "test/fixtures/site/_site" },
    markdownTemplateEngine: "njk",
  };
}
