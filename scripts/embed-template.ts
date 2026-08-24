// Regenerates src/html-template.generated.ts from templates/report.html.
// Run from the repo root: pnpm gen
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("templates/report.html", "utf8");
// light minify: HTML comments, leading indentation, blank lines. Safe because
// the template has no <pre> and no multi-line JS/CSS strings. Keep in sync
// with the transform in test/html.test.ts.
const min = src
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/^[ \t]+/gm, "")
  .replace(/\n{2,}/g, "\n");
const out = `// AUTO-GENERATED from templates/report.html — edit that file, then run \`pnpm gen\`.
export const TEMPLATE = ${JSON.stringify(min)};
`;
writeFileSync("src/html-template.generated.ts", out);
console.log(
  `src/html-template.generated.ts (${min.length} bytes, from ${src.length})`,
);
