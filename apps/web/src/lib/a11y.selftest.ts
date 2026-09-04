import assert from "node:assert/strict";
import {
  CONTRAST_PAIRS,
  contrastRatio,
  cycleTab,
  getFocusable,
  meetsContrastAa,
} from "./a11y";

assert.ok(contrastRatio("#ffffff", "#000000") > 20);
assert.ok(meetsContrastAa("#f4f4f5", "#0b0c10"));

for (const pair of CONTRAST_PAIRS) {
  assert.ok(
    meetsContrastAa(pair.fg, pair.bg),
    `${pair.name} ${contrastRatio(pair.fg, pair.bg).toFixed(2)}:1`,
  );
}

const root = {
  querySelectorAll() {
    return [];
  },
} as unknown as HTMLElement;
assert.deepEqual(getFocusable(root), []);

const ev = { key: "Enter", preventDefault() {} } as KeyboardEvent;
cycleTab(ev, root);

console.log("a11y contrast + trap helpers OK");
