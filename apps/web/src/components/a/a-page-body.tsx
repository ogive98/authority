"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { softPageBody } from "@/lib/soft-glass-ui";

export type APageBodyProps = {
  children: ReactNode;
  className?: string;
};

/** Standard main column body — Soft Glass spacing (D225). */
export function APageBody({ children, className }: APageBodyProps) {
  return <div className={cn(softPageBody, className)}>{children}</div>;
}
