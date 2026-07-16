import gopherGemini from "../../../index.js";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(gopherGemini, {
    maxLineWidth: 70,
    host: "gopher.example.com",
    port: "70",
  });

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
  };
}
