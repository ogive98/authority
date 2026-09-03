import { cn } from "@/lib/utils";

export type ADemoWatermarkProps = {
  label?: string;
  className?: string;
};

/**
 * Non-blocking demo watermark — does not intercept clicks.
 * Only show when demo env / DEMO mode.
 */
export function ADemoWatermark({
  label = "DEMO",
  className,
}: ADemoWatermarkProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[var(--a-z-modal)] flex items-center justify-center overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <span
        className="a-mono select-none text-[clamp(4rem,18vw,12rem)] font-semibold tracking-[0.2em] text-a-fg opacity-[0.06]"
        style={{ transform: "rotate(-18deg)" }}
      >
        {label}
      </span>
    </div>
  );
}
