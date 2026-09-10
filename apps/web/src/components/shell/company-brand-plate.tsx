import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Brand — logo société | Powered by AUTHORITY (D095 Contiental).
 * `bar` = topbar ; `hero` = pages publiques (login/invite).
 */
export function CompanyBrandPlate({
  className,
  variant = "bar",
  href = "/",
}: {
  className?: string;
  compact?: boolean;
  variant?: "bar" | "hero";
  href?: string;
}) {
  const isHero = variant === "hero";

  const inner = (
    <>
      <Image
        src="/brand/company-logo.png"
        alt="Fattorie Covelli"
        width={isHero ? 280 : 200}
        height={isHero ? 80 : 56}
        className={cn(
          "a-brand-logo w-auto shrink-0 object-contain",
          isHero
            ? "h-12 object-center sm:h-14"
            : "h-9 object-left sm:h-10",
        )}
        priority
      />

      {isHero ? (
        <span className="mt-3 flex flex-col items-center leading-[1.1]">
          <span className="text-[10px] font-medium tracking-[0.06em] text-a-fg-subtle">
            Powered by
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-a-fg">
            AUTHORITY
          </span>
          <span className="mt-1 text-[10px] font-normal tracking-[0.02em] text-a-fg-subtle">
            Haithem Hammami
          </span>
        </span>
      ) : (
        <>
          <span className="a-brand-divider h-7 w-px shrink-0" aria-hidden />
          <span className="hidden min-w-0 flex-col justify-center leading-[1.05] sm:flex">
            <span className="text-[9px] font-medium tracking-[0.04em] text-a-fg-subtle">
              Powered by
            </span>
            <span className="text-[13px] font-semibold tracking-[-0.02em] text-a-fg">
              AUTHORITY
            </span>
            <span className="mt-0.5 text-[9px] font-normal tracking-[0.02em] text-a-fg-subtle">
              Haithem Hammami
            </span>
          </span>
        </>
      )}
    </>
  );

  return (
    <Link
      href={href}
      className={cn(
        "a-brand-plate group",
        isHero
          ? "inline-flex flex-col items-center"
          : "inline-flex min-w-0 items-center gap-1.5",
        className,
      )}
      aria-label="Fattorie Covelli — Powered by AUTHORITY — Haithem Hammami"
    >
      {inner}
    </Link>
  );
}
