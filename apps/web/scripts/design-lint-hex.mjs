/**
 * D294 design lint — no raw / Tailwind-arbitrary hex in product chrome
 * (`components/a`, `components/shell`). Also flags forbidden Soft Glass /
 * multi-accent token class names when used as intentional chrome (warn via
 * separate patterns over time).
 *
 * Allowed hex only in `src/app/globals.css` token definitions.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const roots = [
  path.join(webRoot, "src/components/a"),
  path.join(webRoot, "src/components/shell"),
];

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FORBIDDEN_TOKEN_USE =
  /(?:text|bg|border|ring|from|to|via)-a-(?:violet|sky|orange|spectre|glass)(?:-|\b)/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const hits = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    const rel = path.relative(webRoot, file).replace(/\\/g, "/");
    lines.forEach((line, i) => {
      if (HEX.test(line)) {
        HEX.lastIndex = 0;
        for (const m of line.match(HEX) ?? []) {
          hits.push({
            file: rel,
            line: i + 1,
            match: m,
            reason: "raw hex — use text-a-* / bg-a-* / var(--a-*)",
            snippet: line.trim().slice(0, 120),
          });
        }
      }
      HEX.lastIndex = 0;
      if (FORBIDDEN_TOKEN_USE.test(line)) {
        FORBIDDEN_TOKEN_USE.lastIndex = 0;
        for (const m of line.match(FORBIDDEN_TOKEN_USE) ?? []) {
          hits.push({
            file: rel,
            line: i + 1,
            match: m,
            reason:
              "D294 forbidden chrome accent/material — use text-a-accent / surfaces",
            snippet: line.trim().slice(0, 120),
          });
        }
      }
      FORBIDDEN_TOKEN_USE.lastIndex = 0;
    });
  }
}

if (hits.length) {
  console.error("design-lint-hex: FAIL — D294 chrome violations:\n");
  for (const h of hits) {
    console.error(
      `  ${h.file}:${h.line}  ${h.match}  ·  ${h.reason}  ·  ${h.snippet}`,
    );
  }
  console.error(`\n${hits.length} hit(s).`);
  process.exit(1);
}

console.log(
  "design-lint-hex: OK — no raw hex / forbidden chrome tokens in a+shell",
);
