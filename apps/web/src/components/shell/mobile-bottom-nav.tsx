"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MOBILE_ITEMS = [
  { href: "/", label: "Accueil" },
  { href: "/settings", label: "Réglages" },
] as const;

/** Bottom nav mobile — role-critical only (no /dev noise in product chrome). */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[var(--a-z-sticky)] flex h-12 items-stretch border-t border-a-border-subtle bg-a-surface-1 md:hidden"
      aria-label="Navigation mobile"
    >
      {MOBILE_ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 items-center justify-center text-[length:var(--a-text-sm)]",
              active ? "font-medium text-a-accent" : "text-a-fg-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
