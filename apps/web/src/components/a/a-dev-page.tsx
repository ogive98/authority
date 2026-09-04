"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/shell";
import { cn } from "@/lib/utils";
import { AScreenHeader } from "./a-screen-header";

export function ADevGateActions({ extra }: { extra?: ReactNode }) {
  return (
    <>
      <ThemeToggle />
      <Link
        href="/"
        className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-accent"
      >
        Shell
      </Link>
      {extra}
    </>
  );
}

export type ADevPageProps = {
  kicker: string;
  title: string;
  description?: ReactNode;
  extraActions?: ReactNode;
  stickyHeader?: boolean;
  overlay?: ReactNode;
  className?: string;
  children: ReactNode;
  mainClassName?: string;
};

/** Locked chrome for /dev gates — same header everywhere. */
export function ADevPage({
  kicker,
  title,
  description,
  extraActions,
  stickyHeader,
  overlay,
  className,
  children,
  mainClassName,
}: ADevPageProps) {
  return (
    <div className={cn("min-h-screen bg-a-surface-1 text-a-fg", className)}>
      {overlay}
      <AScreenHeader
        kicker={kicker}
        title={title}
        description={description}
        sticky={stickyHeader}
        actions={<ADevGateActions extra={extraActions} />}
      />
      <main
        className={
          mainClassName ?? "px-[var(--a-space-6)] py-[var(--a-space-7)]"
        }
      >
        {children}
      </main>
    </div>
  );
}
