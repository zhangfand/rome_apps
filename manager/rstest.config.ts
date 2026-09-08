import { defineConfig } from "@rstest/core";

export default defineConfig({
  // Do not run the packed source copies under .rome/artifact a second time.
  include: ["src/**/*.test.ts"],
  tools: {
    swc: { jsc: { transform: { react: { runtime: "automatic" } } } },
  },
});
