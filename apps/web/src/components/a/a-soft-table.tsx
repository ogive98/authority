"use client";

import type {
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { softTableWrap, softThead, softTr } from "@/lib/soft-glass-ui";

export type ASoftTableProps = TableHTMLAttributes<HTMLTableElement> & {
  children: ReactNode;
  wrapClassName?: string;
};

/**
 * Full-width D294 table host — dense, sticky header via ASoftThead.
 * Prefer `ASoftTable` + `ASoftThead` / `ASoftTr` / `ASoftTh` / `ASoftTd`
 * over raw `softTableWrap` + `<table>` on new screens.
 */
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

export function ASoftTh({
  children,
  className,
  numeric,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  children?: ReactNode;
  numeric?: boolean;
}) {
  return (
    <th
      className={cn(
        "a-table-cell font-medium text-a-fg-muted",
        numeric && "a-mono a-tabular text-right",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function ASoftTd({
  children,
  className,
  numeric,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  children?: ReactNode;
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "a-table-cell",
        numeric && "a-mono a-tabular text-right",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
