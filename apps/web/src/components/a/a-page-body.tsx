"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { softPageBody } from "@/lib/d294-ui";

export type APageBodyProps = {
  children: ReactNode;
  className?: string;
};

/** Standard main column body — D294 / D225 spacing. */
export function APageBody({ children, className }: APageBodyProps) {
  return <div className={cn(softPageBody, className)}>{children}</div>;
}
