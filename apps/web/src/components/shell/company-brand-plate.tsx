import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Topbar brand — logo | Powered by / AUTHORITY (stacked, tight).
 */
export function CompanyBrandPlate({
  className,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "a-brand-plate group inline-flex min-w-0 items-center gap-1.5",
        className,
      )}
      aria-label="Fattorie Covelli — Powered by AUTHORITY"
    >
      <Image
        src="/brand/company-logo.png"
        alt="Fattorie Covelli"
        width={200}
        height={56}
        className="a-brand-logo h-9 w-auto shrink-0 object-contain object-left sm:h-10"
        priority
      />

      <span className="a-brand-divider h-7 w-px shrink-0" aria-hidden />

      <span className="hidden min-w-0 flex-col justify-center leading-[1.05] sm:flex">
        <span className="text-[9px] font-medium tracking-[0.04em] text-a-fg-subtle">
          Powered by
        </span>
        <span className="text-[13px] font-semibold tracking-[-0.02em] text-a-fg">
          AUTHORITY
        </span>
      </span>
    </Link>
  );
}
