import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Typeahead folding: a list field that needs exact accents reads as broken
 * ("societe" hides "Société"), and AZERTY users rarely type them.
 */
export function foldSearchText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function matchesFolded(
  needle: string,
  ...values: Array<string | null | undefined>
): boolean {
  const q = foldSearchText(needle);
  if (!q) return true;
  return values.some((v) => v != null && foldSearchText(v).includes(q));
}
