"use client";

import type { ReactNode, TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { softTableWrap, softThead, softTr } from "@/lib/soft-glass-ui";

export type ASoftTableProps = TableHTMLAttributes<HTMLTableElement> & {
  children: ReactNode;
  wrapClassName?: string;
};

/** Full-width Soft Glass table host — no frame (D225). */
export function ASoftTable({
  children,
  className,
  wrapClassName,
  ...props
}: ASoftTableProps) {
  return (
    <div className={cn(softTableWrap, wrapClassName)}>
      <table
        className={cn(
          "w-full min-w-full border-collapse text-left text-[length:var(--a-text-sm)]",
          className,
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function ASoftThead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <thead className={cn(softThead, className)}>{children}</thead>;
}

export function ASoftTr({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(softTr, onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}
