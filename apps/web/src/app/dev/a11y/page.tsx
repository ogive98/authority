"use client";

import { useState } from "react";
import {
  AButton,
  AConfirmDialog,
  ADevPage,
  ADrawer,
} from "@/components/a";
import { CONTRAST_PAIRS, contrastRatio, meetsContrastAa } from "@/lib/a11y";

export default function DevA11yPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <ADevPage
      kicker="UI-13 · a11y"
      title="Accessibilité"
      description="Skip link, piège de focus (Radix modal/drawer + popover modules), contraste AA, clavier."
      extraActions={
        <AButton type="button" size="sm" onClick={() => setModalOpen(true)}>
          Ouvrir modal
        </AButton>
      }
      overlay={
        <>
          <AConfirmDialog
            open={modalOpen}
            onOpenChange={setModalOpen}
            risk="generic"
            consequence="Tab doit rester dans cette boîte. Échap ferme et rend le focus."
            confirmLabel="OK"
            onConfirm={() => undefined}
          />
          <ADrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            title="Drawer a11y"
            description="Focus trap Radix"
          >
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Tab cycle dans le panneau. Fermer rend le focus au déclencheur
              Radix.
            </p>
            <AButton
              type="button"
              size="sm"
              className="mt-4"
              onClick={() => setDrawerOpen(false)}
            >
              Fermer
            </AButton>
          </ADrawer>
        </>
      }
      mainClassName="mx-auto max-w-3xl space-y-[var(--a-space-7)] px-[var(--a-space-6)] py-[var(--a-space-7)]"
    >
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Gate : Tab dès le chargement → skip link « Aller au contenu » →{" "}
        <span className="a-mono">#main</span>. Modal / drawer = trap. Statut =
        mot + couleur (pas la couleur seule).
      </p>

      <section className="a-card space-y-3 p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-medium">Clavier</h2>
        <ol className="list-decimal space-y-1 pl-5 text-[length:var(--a-text-sm)] text-a-fg-muted">
          <li>Tab : skip link, puis chrome / contenu.</li>
          <li>Ctrl+K : palette (trap Radix).</li>
          <li>Rail modules : Entrée ouvre le popover (dialog + Tab cycle).</li>
          <li>Échap ferme overlay / popover.</li>
        </ol>
        <AButton
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setDrawerOpen(true)}
        >
          Ouvrir drawer
        </AButton>
      </section>

      <section className="a-card space-y-3 p-[var(--a-space-5)]" id="contrast">
        <h2 className="text-[length:var(--a-text-lg)] font-medium">
          Contraste AA (≥ 4,5)
        </h2>
        <ul className="space-y-1 text-[length:var(--a-text-sm)]">
          {CONTRAST_PAIRS.map((p) => {
            const ratio = contrastRatio(p.fg, p.bg);
            const ok = meetsContrastAa(p.fg, p.bg);
            return (
              <li key={p.name} className="flex flex-wrap justify-between gap-2">
                <span>{p.name}</span>
                <span
                  className={
                    ok
                      ? "a-mono text-a-success"
                      : "a-mono text-a-danger"
                  }
                >
                  {ratio.toFixed(2)}:1 {ok ? "AA" : "fail"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
        Skip link : Tab au chargement. Zoom 200 % : chrome reste utilisable
        (rail fixe, pas de 2e sidebar).
      </p>
    </ADevPage>
  );
}
