"use client";

import Link from "next/link";
import {
  AButton,
  AKpiCard,
  AScreenHeader,
} from "@/components/a";
import { AWidgetHost } from "@/components/a/a-widget-host";

export default function HomePage() {
  return (
    <>
      <AScreenHeader
        title="Tableau de bord"
        description="Fromagerie ADV · site Sfax"
        actions={
          <AButton asChild size="sm">
            <Link href="/preview/lots">Nouveau lot</Link>
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-6)] p-[var(--a-space-6)]">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AKpiCard
            label="Chiffre d’affaires"
            value="124 560,00 TND"
            delta="+12,4 %"
            deltaTone="success"
          />
          <AKpiCard
            label="Stock fromage"
            value="12 450,000 kg"
            delta="−2,1 %"
            deltaTone="warning"
          />
          <AKpiCard
            label="Lots ouverts"
            value="42"
            delta="+3"
            deltaTone="success"
          />
          <AKpiCard
            label="DLC < 7 j"
            value="8"
            delta="critique"
            deltaTone="danger"
          />
        </section>

        <AWidgetHost includeBoom={false} />

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--a-text-sm)]">
          <li>
            <Link href="/preview" className="text-a-accent hover:underline">
              Écrans aperçu
            </Link>
          </li>
          <li>
            <Link href="/preview/lots" className="text-a-accent hover:underline">
              Lots
            </Link>
          </li>
          <li>
            <Link
              href="/preview/commandes"
              className="text-a-accent hover:underline"
            >
              Commandes
            </Link>
          </li>
          <li>
            <Link href="/settings" className="text-a-accent hover:underline">
              Préférences
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
