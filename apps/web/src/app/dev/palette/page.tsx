"use client";

import { useEffect } from "react";
import { AButton, ADevPage } from "@/components/a";
import { ACommandPalette } from "@/components/a/a-command-palette";
import {
  COMMAND_CATALOG,
  DEMO_ENABLED_MODULES,
  DEMO_PERMISSION_GRANTS,
  filterCommands,
} from "@/lib/command-catalog";
import { useShellStore } from "@/stores/shell-store";

export default function DevPalettePage() {
  const open = useShellStore((s) => s.paletteOpen);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!useShellStore.getState().paletteOpen);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  const visible = filterCommands(COMMAND_CATALOG, {
    query: "",
    grants: DEMO_PERMISSION_GRANTS,
    enabledModules: DEMO_ENABLED_MODULES,
  });
  const hidden = COMMAND_CATALOG.filter(
    (c) => !visible.some((v) => v.id === c.id),
  );

  return (
    <ADevPage
      kicker="UI-08 · Command palette"
      title="Palette + recherche"
      description="Gate clavier : Ctrl+K · ↑↓ · Entrée · Esc — raccourcis affichés à droite de chaque commande"
      extraActions={
        <AButton type="button" size="sm" onClick={() => setPaletteOpen(true)}>
          Ouvrir (ou Ctrl+K)
        </AButton>
      }
      overlay={<ACommandPalette open={open} onOpenChange={setPaletteOpen} />}
      mainClassName="mx-auto max-w-2xl space-y-6 px-[var(--a-space-6)] py-[var(--a-space-7)]"
    >
        <section className="a-card space-y-2 p-4">
          <h2 className="font-medium">Visibles (grants + modules ON)</h2>
          <ul className="a-mono space-y-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            {visible.map((c) => (
              <li key={c.id}>
                [{c.group}] {c.label}
              </li>
            ))}
          </ul>
        </section>
        <section className="a-card space-y-2 p-4">
          <h2 className="font-medium">Masqués (permission / module)</h2>
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Ex. <span className="a-mono">payroll.export</span> sans grant →
            absent de la palette.
          </p>
          <ul className="a-mono space-y-1 text-[length:var(--a-text-xs)] text-a-danger">
            {hidden.map((c) => (
              <li key={c.id}>
                {c.label}
                {c.permissionKey ? ` · ${c.permissionKey}` : ""}
                {c.requiresModule ? ` · mod:${c.requiresModule}` : ""}
              </li>
            ))}
          </ul>
        </section>
    </ADevPage>
  );
}
