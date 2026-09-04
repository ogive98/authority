const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return el.tabIndex !== -1;
  });
}

/** Keep Tab inside `root` (feature popover). Radix Dialog already traps modals. */
export function cycleTab(event: KeyboardEvent, root: HTMLElement): void {
  if (event.key !== "Tab") return;
  const list = getFocusable(root);
  if (list.length === 0) {
    event.preventDefault();
    return;
  }
  const first = list[0];
  const last = list[list.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !root.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (active === last) {
    event.preventDefault();
    first.focus();
  }
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h.split("").map((ch) => parseInt(ch + ch, 16))
      : [
          parseInt(h.slice(0, 2), 16),
          parseInt(h.slice(2, 4), 16),
          parseInt(h.slice(4, 6), 16),
        ];
  const [r, g, b] = n;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.2 AA for normal text. */
export function meetsContrastAa(fgHex: string, bgHex: string): boolean {
  return contrastRatio(fgHex, bgHex) >= 4.5;
}

/**
 * Locked token pairs from globals.css (must stay AA).
 * Dark canvas / light canvas × body + muted (not subtle-only chrome hints).
 */
export const CONTRAST_PAIRS: { name: string; fg: string; bg: string }[] = [
  { name: "dark fg / surface-1", fg: "#f4f4f5", bg: "#0b0c10" },
  { name: "dark muted / surface-1", fg: "#a1a1aa", bg: "#0b0c10" },
  { name: "dark fg / surface-2", fg: "#f4f4f5", bg: "#171a22" },
  { name: "light fg / surface-1", fg: "#18181b", bg: "#f0f2f5" },
  { name: "light muted / surface-1", fg: "#52525b", bg: "#f0f2f5" },
  { name: "light fg / surface-2", fg: "#18181b", bg: "#ffffff" },
  { name: "accent on dark", fg: "#0d9488", bg: "#0b0c10" },
  { name: "danger text on dark", fg: "#c46d74", bg: "#0b0c10" },
];
