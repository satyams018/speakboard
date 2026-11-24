// Copies the web fonts the app uses from npm (@fontsource) into src/fonts, so the
// app can serve them itself and keep working offline. Both fonts use the SIL Open
// Font License, which allows bundling; the licence files are copied alongside.
// Run: node scripts/copy-fonts.mjs

import { copyFileSync, mkdirSync } from "node:fs";

const root = new URL("..", import.meta.url);
const out = new URL("src/fonts/", root);
mkdirSync(out, { recursive: true });

const files = [
  ["lexend", "lexend-latin-400-normal.woff2"],
  ["lexend", "lexend-latin-600-normal.woff2"],
  ["lexend", "lexend-latin-800-normal.woff2"],
  ["mukta", "mukta-devanagari-500-normal.woff2"],
  ["mukta", "mukta-devanagari-700-normal.woff2"],
  ["mukta", "mukta-devanagari-800-normal.woff2"],
];

for (const [pkg, file] of files) {
  copyFileSync(new URL(`node_modules/@fontsource/${pkg}/files/${file}`, root), new URL(file, out));
  console.log(`copied ${file}`);
}
for (const pkg of ["lexend", "mukta"]) {
  copyFileSync(
    new URL(`node_modules/@fontsource/${pkg}/LICENSE`, root),
    new URL(`LICENSE-${pkg}.txt`, out),
  );
}
