"use client";

import Link from "next/link";
import { APageBody, APageSection, AScreenHeader } from "@/components/a";
import {
  HELP_INTRO,
  HELP_MODULES,
  HELP_SHORTCUTS,
  helpText,
} from "@/lib/help-guide-catalog";
import { useLocaleStore } from "@/stores/locale-store";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";

export default function HelpPage() {
  const locale = useLocaleStore((s) => s.locale);
  const intro = HELP_INTRO[locale];

  return (
    <>
      <AScreenHeader
        kicker={intro.kicker}
        title={intro.title}
        description={intro.description}
        primary={
          <Link
            href="/help/guide"
            className="a-action-primary inline-flex h-8 items-center px-3 text-[length:var(--a-text-xs)] font-medium"
          >
            {intro.guideCta}
          </Link>
        }
      />

      <APageBody className="mx-auto max-w-3xl space-y-8">
        <APageSection title={intro.shortcutsTitle} bare>
          <ul className="space-y-2 text-[13px] text-a-fg-muted">
            {HELP_SHORTCUTS.map((row) => (
              <li key={row.fr}>
                <kbd className="a-mono text-a-fg">·</kbd> {helpText(locale, row)}
              </li>
            ))}
          </ul>
        </APageSection>

        <APageSection title={intro.toc} bare>
          <nav className="flex flex-col gap-1.5">
            {HELP_MODULES.map((mod) => (
              <a
                key={mod.id}
                href={`#${mod.id}`}
                className="a-action-quiet w-fit px-1 py-1 text-[13px] font-medium"
              >
                {helpText(locale, mod.title)}
              </a>
            ))}
          </nav>
        </APageSection>

        {HELP_MODULES.map((mod) => (
          <section
            key={mod.id}
            id={mod.id}
            className="a-underlay scroll-mt-24 space-y-4 rounded-[var(--a-radius-md)] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-medium tracking-[-0.015em] text-a-fg">
                  {helpText(locale, mod.title)}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-a-fg-muted">
                  {helpText(locale, mod.summary)}
                </p>
              </div>
              {mod.href ? (
                <Link
                  href={mod.href}
                  className="a-action-quiet shrink-0 px-2 py-1 text-[12px] font-medium"
                >
                  {locale === "it" ? "Apri" : "Ouvrir"} →
                </Link>
              ) : null}
            </div>

            <div>
              <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-a-orange">
                {intro.whenLabel}
              </h3>
              <p className="mt-1 text-[13px] text-a-fg-muted">
                {helpText(locale, mod.when)}
              </p>
            </div>

            <div className="space-y-5">
              <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-a-orange">
                {intro.featuresLabel}
              </h3>
              {mod.features.map((feat) => (
                <div key={feat.name.fr} className="space-y-2">
                  <h4 className="text-[14px] font-medium text-a-fg">
                    {helpText(locale, feat.name)}
                  </h4>
                  <p className="text-[12px] text-a-fg-muted">
                    <span className="font-medium text-a-fg-subtle">
                      {intro.whenLabel} —{" "}
                    </span>
                    {helpText(locale, feat.when)}
                  </p>
                  <p className="text-[12px] font-medium text-a-fg-subtle">
                    {intro.stepsLabel}
                  </p>
                  <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-a-fg-muted">
                    {(locale === "it" ? feat.steps.it : feat.steps.fr).map(
                      (step) => (
                        <li key={step}>{step}</li>
                      ),
                    )}
                  </ol>
                </div>
              ))}
            </div>

            {mod.locks ? (
              <div>
                <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-a-orange">
                  {intro.locksLabel}
                </h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-a-fg-muted">
                  {(locale === "it" ? mod.locks.it : mod.locks.fr).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ))}

        <p className="pb-8 text-center text-[12px] text-a-fg-subtle">
           · {LAYOUT_ACTIONS.save} ·{" "}
          {locale === "it"
            ? "Mai inventare aliquote tunisine"
            : "Jamais inventer de taux tunisiens"}
        </p>
      </APageBody>
    </>
  );
}
