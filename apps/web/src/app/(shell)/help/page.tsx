"use client";

import Link from "next/link";
import { AScreenHeader } from "@/components/a";
import { USAGE_TIPS } from "@/lib/tips-catalog";

const CATEGORIES = [
  { id: "navigation", label: "Navigation" },
  { id: "finance", label: "Finance" },
  { id: "stock", label: "Stock & flux" },
  { id: "legal", label: "Légal / Expertise" },
  { id: "ops", label: "Ops (SPECTRE / PATCH)" },
  { id: "a11y", label: "Accessibilité" },
  { id: "guide", label: "Guide" },
] as const;

export default function HelpPage() {
  return (
    <>
      <AScreenHeader
        kicker="Aide"
        title="Centre d’aide"
        description="Astuces documentées, raccourcis et liens vers le User Guide."
        actions={
          <Link
            href="/help/guide"
            className="text-[13px] font-medium text-a-accent hover:underline"
          >
            User Guide →
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl space-y-10 px-6 pb-16 pt-2 md:px-10">
        <section id="shortcuts" className="text-center">
          <h2 className="text-[15px] font-semibold text-a-fg">Raccourcis</h2>
          <ul className="mt-3 space-y-2 text-[13px] text-a-fg-muted">
            <li>
              <kbd className="a-mono text-a-fg">⌘K</kbd> — palette de commandes
            </li>
            <li>Clic module sidebar — liste dense sur l’accueil</li>
            <li>
              Toolbar — SPECTRE / PATCH / thème
            </li>
          </ul>
        </section>

        <section id="modules" className="text-center">
          <h2 className="text-[15px] font-semibold text-a-fg">Modules</h2>
          <p className="mx-auto mt-2 max-w-lg text-[13px] text-a-fg-muted">
            Sidebar Finder : icône outline animée + nom. Un clic ouvre les
            fonctionnalités en liste Contiental sur{" "}
            <Link href="/" className="text-a-accent hover:underline">
              /
            </Link>
            .
          </p>
        </section>

        <section id="brand" className="text-center">
          <h2 className="text-[15px] font-semibold text-a-fg">Identité</h2>
          <p className="mx-auto mt-2 max-w-lg text-[13px] text-a-fg-muted">
            Barre du haut : logo société (Fattorie Covelli), trait élégant, puis
            « Powered by AUTHORITY ». Indépendant de la réduction sidebar.
          </p>
        </section>

        <section id="sidebar" className="text-center">
          <h2 className="text-[15px] font-semibold text-a-fg">Sidebar</h2>
          <p className="mx-auto mt-2 max-w-lg text-[13px] text-a-fg-muted">
            Réduction via le bouton panneau : rail d’icônes uniquement. Pas de
            sous-menus encadrés.
          </p>
        </section>

        <section id="theme" className="text-center">
          <h2 className="text-[15px] font-semibold text-a-fg">Thème</h2>
          <p className="mx-auto mt-2 max-w-lg text-[13px] text-a-fg-muted">
            Clair `#f5f5f7` / sombre `#1c1c1e` — matériaux vibrancy, sans cadres.
          </p>
        </section>

        <section id="a11y" className="text-center">
          <h2 className="text-[15px] font-semibold text-a-fg">Accessibilité</h2>
          <p className="mx-auto mt-2 max-w-lg text-[13px] text-a-fg-muted">
            Le lien « Aller au contenu » n’apparaît qu’au focus clavier (Tab) —
            il n’encombre pas le chrome Apple.
          </p>
        </section>

        {CATEGORIES.map((cat) => {
          const tips = USAGE_TIPS.filter((t) => t.category === cat.id);
          if (tips.length === 0) return null;
          return (
            <section key={cat.id} className="text-left">
              <h2 className="mb-4 text-center text-[15px] font-semibold text-a-fg">
                {cat.label}
              </h2>
              <ul className="space-y-4">
                {tips.map((tip) => (
                  <li key={tip.id} id={`tip-${tip.id}`} className="scroll-mt-24 text-center">
                    <p className="text-[13px] font-semibold text-a-fg">
                      {tip.title}
                      {tip.shortcut ? (
                        <kbd className="a-mono ml-2 text-[11px] font-normal text-a-fg-subtle">
                          {tip.shortcut}
                        </kbd>
                      ) : null}
                    </p>
                    <p className="mx-auto mt-1 max-w-xl text-[12px] leading-relaxed text-a-fg-muted">
                      {tip.body}
                    </p>
                    {tip.action.kind === "link" ? (
                      <Link
                        href={tip.action.href}
                        className="mt-1 inline-block text-[12px] font-medium text-a-accent hover:underline"
                      >
                        {tip.action.label}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
