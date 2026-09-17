"use client";

import Link from "next/link";
import { APageBody, APageSection, AScreenHeader } from "@/components/a";
import {
  HELP_INTRO,
  HELP_MODULES,
  helpText,
} from "@/lib/help-guide-catalog";
import { useLocaleStore } from "@/stores/locale-store";

/** Parcours bout-en-bout — renvoie vers les sections exhaustives du Centre d’aide. */
export default function UserGuidePage() {
  const locale = useLocaleStore((s) => s.locale);
  const intro = HELP_INTRO[locale];

  const journey = HELP_MODULES.filter((m) =>
    [
      "shell",
      "customers",
      "products",
      "sales",
      "inventory",
      "delivery",
      "finance",
      "accounting",
      "tax",
      "hr",
      "settings",
    ].includes(m.id),
  );

  return (
    <>
      <AScreenHeader
        kicker={locale === "it" ? "Documentazione" : "Documentation"}
        title="User Guide"
        description={
          locale === "it"
            ? "Percorso AUTHORITY — caseificio B2B Tunisia — ."
            : "Parcours AUTHORITY — fromagerie B2B Tunisie — ."
        }
        primary={
          <Link
            href="/help"
            className="a-action-quiet inline-flex h-8 items-center px-3 text-[length:var(--a-text-xs)] font-medium"
          >
            {intro.backHelp}
          </Link>
        }
      />
      <APageBody className="mx-auto max-w-2xl space-y-6">
        <APageSection
          title={
            locale === "it"
              ? "Ordine consigliato"
              : "Ordre recommandé"
          }
          description={
            locale === "it"
              ? "Segui i moduli nell’ordine operativo tipico. Ogni voce apre la scheda dettagliata nel Centro assistenza."
              : "Suivez les modules dans l’ordre opérationnel typique. Chaque entrée ouvre la fiche détaillée du Centre d’aide."
          }
          bare
        >
          <ol className="mt-4 list-decimal space-y-4 pl-5">
            {journey.map((mod, i) => (
              <li key={mod.id} className="text-[13px] leading-relaxed">
                <Link
                  href={`/help#${mod.id}`}
                  className="font-semibold text-a-accent hover:underline"
                >
                  {i + 1}. {helpText(locale, mod.title)}
                </Link>
                <p className="mt-1 text-a-fg-muted">
                  {helpText(locale, mod.summary)}
                </p>
                <p className="mt-1 text-[12px] text-a-fg-subtle">
                  <span className="font-medium">{intro.whenLabel} — </span>
                  {helpText(locale, mod.when)}
                </p>
              </li>
            ))}
          </ol>
        </APageSection>

        <p className="text-center text-[12px] text-a-fg-subtle">
          <Link href="/help#shell" className="text-a-accent hover:underline">
            {intro.toc}
          </Link>
        </p>
      </APageBody>
    </>
  );
}
