"use client";

import { useState } from "react";
import {
  AButton,
  AContextPanel,
  ADetailGrid,
  ADevPage,
  AFilterBar,
  AInput,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASoftTable,
  ASoftThead,
  ASoftTr,
  AWorkflowActionBar,
  AWorkflowStepper,
} from "@/components/a";
import { softChipClass } from "@/lib/soft-glass-ui";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";

export default function DevLayoutPage() {
  const [filter, setFilter] = useState<"all" | "open">("all");

  return (
    <ADevPage
      kicker="L0 · Layout D225"
      title="Layout primitives"
      description="Gate Soft Glass — List / Detail / Form / Workflow (pas de 2e design system)."
    >
      <APageBody className="!p-0">
        <AScreenHeader
          breadcrumb="Dev / Layout"
          title="Liste canonique"
          description="Anatomie List : header · FilterBar · table"
          primary={
            <AButton size="sm">{LAYOUT_ACTIONS.newOrder}</AButton>
          }
          more={
            <AOverflowMenu
              items={[
                { id: "export", label: LAYOUT_ACTIONS.export },
                { id: "print", label: LAYOUT_ACTIONS.print },
              ]}
            />
          }
        />

        <div className="space-y-5 px-6 md:px-8">
          <AFilterBar
            search={<AInput placeholder="Rechercher…" />}
            filters={
              <>
                <button
                  type="button"
                  className={softChipClass(filter === "all")}
                  onClick={() => setFilter("all")}
                >
                  Tout
                </button>
                <button
                  type="button"
                  className={softChipClass(filter === "open")}
                  onClick={() => setFilter("open")}
                >
                  Ouverts
                </button>
              </>
            }
          />

          <ASoftTable>
            <ASoftThead>
              <tr>
                <th className="px-3 py-2 font-medium">Réf.</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 text-right font-medium">TND</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </ASoftThead>
            <tbody>
              <ASoftTr>
                <td className="px-3 py-2">SO-1001</td>
                <td className="px-3 py-2">ATLAS</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  1&nbsp;250,000
                </td>
                <td className="px-3 py-2">
                  <AOverflowMenu
                    items={[{ id: "open", label: "Ouvrir" }]}
                  />
                </td>
              </ASoftTr>
            </tbody>
          </ASoftTable>

          <AScreenHeader
            title="Fiche détail"
            description="DetailGrid + ContextPanel in-page"
            primary={<AButton size="sm">{LAYOUT_ACTIONS.edit}</AButton>}
            more={
              <AOverflowMenu
                items={[
                  { id: "print", label: LAYOUT_ACTIONS.print },
                  {
                    id: "cancel",
                    label: LAYOUT_ACTIONS.cancel,
                    danger: true,
                  },
                ]}
              />
            }
          />

          <ADetailGrid
            primary={
              <APageSection title="Identité">
                <p className="text-[13px] text-a-fg-muted">
                  Sections Soft Glass underlay — une question métier.
                </p>
              </APageSection>
            }
            context={
              <AContextPanel title="Contexte">
                <p className="text-[13px] text-a-fg-muted">
                  ≠ Smart Action Dock. Résumé record / workflow.
                </p>
              </AContextPanel>
            }
            below={
              <APageSection title="Historique" bare>
                <p className="text-[13px] text-a-fg-muted">
                  Contenu secondaire sous le workspace.
                </p>
              </APageSection>
            }
          />

          <APageSection title="Formulaire">
            <div className="grid max-w-xl gap-3 sm:grid-cols-2">
              <AInput placeholder="Code" />
              <AInput placeholder="Libellé" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <AButton variant="secondary" size="sm">
                {LAYOUT_ACTIONS.cancel}
              </AButton>
              <AButton size="sm">{LAYOUT_ACTIONS.save}</AButton>
            </div>
          </APageSection>

          <AWorkflowStepper
            steps={[
              { id: "1", label: "Saisie", done: true },
              { id: "2", label: "Contrôle", current: true },
              { id: "3", label: "Clôture" },
            ]}
          />
          <AWorkflowActionBar status="Étape contrôle">
            <AButton size="sm">{LAYOUT_ACTIONS.validate}</AButton>
          </AWorkflowActionBar>
        </div>
      </APageBody>
    </ADevPage>
  );
}
