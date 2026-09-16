import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** Ban raw hex color literals — use --a-* / text-a-* tokens. */
const noRawHexLiteral = {
  selector:
    "Literal[value=/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/]",
  message:
    "Raw hex colors are forbidden in Soft Glass chrome. Use --a-* design tokens.",
};

/**
 * Stage 1 — ban Tailwind arbitrary hex in class strings
 * (e.g. text-[#ff9f0a], bg-[#0b1220]/35). Soft Glass uses text-a-* / bg-a-*.
 */
const noTailwindArbitraryHex = {
  selector:
    "Literal[value=/(?:text|bg|border|from|to|via|ring|outline|fill|stroke|decoration|shadow|caret|accent)-\\[#[0-9a-fA-F]{3,8}/]",
  message:
    "Tailwind arbitrary hex is forbidden in Soft Glass chrome. Use text-a-* / bg-a-*.",
};

const noTailwindArbitraryHexInTemplate = {
  selector:
    "TemplateElement[value.raw=/(?:text|bg|border|from|to|via|ring|outline|fill|stroke|decoration|shadow|caret|accent)-\\[#[0-9a-fA-F]{3,8}/]",
  message:
    "Tailwind arbitrary hex is forbidden in Soft Glass chrome. Use text-a-* / bg-a-*.",
};

const softGlassHexRules = [
  noRawHexLiteral,
  noTailwindArbitraryHex,
  noTailwindArbitraryHexInTemplate,
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  /**
   * Stage 1 chrome only — Soft Glass primitives + shell.
   * Out of scope (documented): repair canvases, print, SA repair, a11y fixtures.
   */
  {
    files: [
      "src/components/a/**/*.{ts,tsx}",
      "src/components/shell/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...softGlassHexRules],
    },
  },
];

export default eslintConfig;
