import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "coverage/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "design/**/*.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["src/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    // The end-to-end script runs in Node but also injects code into the page.
    files: ["scripts/e2e.mjs"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.mjs", "*.config.js"],
    languageOptions: { globals: { ...globals.node, indexedDB: "readonly" } },
  },
];
