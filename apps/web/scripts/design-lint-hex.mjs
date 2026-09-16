/**
 * Stage 1 Soft Glass design lint — no raw / Tailwind-arbitrary hex
 * in product chrome primitives (`components/a`, `components/shell`).
 *
 * Allowed hex only in `src/app/globals.css` token definitions.
 * Out of scope: repair canvases, print sheets, a11y fixtures, /dev showcases.
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
    lines.forEach((line, i) => {
      if (!HEX.test(line)) return;
      HEX.lastIndex = 0;
      const matches = line.match(HEX) ?? [];
      for (const m of matches) {
        hits.push({
          file: path.relative(webRoot, file).replace(/\\/g, "/"),
          line: i + 1,
          match: m,
          snippet: line.trim().slice(0, 120),
        });
      }
    });
  }
}

if (hits.length) {
  console.error("design-lint-hex: FAIL — raw hex in Soft Glass chrome:\n");
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${h.match}  ·  ${h.snippet}`);
  }
  console.error(
    `\n${hits.length} hit(s). Use text-a-* / bg-a-* / var(--a-*).`,
  );
  process.exit(1);
}

console.log(
  "design-lint-hex: OK — no raw hex in components/a + components/shell",
);
