import { cn } from "@/lib/utils";

export type ASensitiveValueProps = {
  label: string;
  value: string;
  visible: boolean;
  maskedText?: string;
  className?: string;
};

/**
 * Field ACL display: never puts `value` in the DOM when hidden.
 * UI mask only — server must still refuse.
 */
export function ASensitiveValue({
  label,
  value,
  visible,
  maskedText = "••••",
  className,
}: ASensitiveValueProps) {
  if (!visible) {
    return (
      <span
        className={cn("a-mono a-tabular", className)}
        aria-label={`${label} masqué`}
      >
        {maskedText}
      </span>
    );
  }

  return <span className={cn("a-mono a-tabular", className)}>{value}</span>;
}
