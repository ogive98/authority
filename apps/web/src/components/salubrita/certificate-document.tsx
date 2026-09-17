"use client";

import type { SalubritaCertificateItem } from "@/lib/inventory";

function fmtFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Printable certificat — modèle Word Covelli / Dr Methnani. */
export function SalubritaCertificateDocument({
  packDate,
  items,
}: {
  packDate: string;
  items: SalubritaCertificateItem[];
}) {
  return (
    <article
      className="mx-auto max-w-[210mm] space-y-5 px-2 py-4 font-serif text-[12px] leading-snug text-black"
      lang="fr"
    >
      <header className="grid grid-cols-2 gap-4 border-b border-black/20 pb-3">
        <div className="space-y-0.5 text-[11px]">
          <p className="font-medium">Dr. Mohamed METHNANI</p>
          <p>Medicine Vétérinaire</p>
          <p>65, Rue Mimosas 2080 Ariana</p>
          <p>Tel: +216-20342809</p>
        </div>
        <div className="space-y-0.5 text-right text-[11px]">
          <p className="font-medium">Dr. Mohamed METHNANI</p>
          <p>Medicine Vétérinaire</p>
          <p>65, Rue Mimosas 2080 Ariana</p>
          <p>Tel: +216-20342809</p>
          <p className="mt-3">Tunis, le {fmtFr(packDate)}</p>
        </div>
      </header>

      <div className="space-y-1 text-center">
        <h1 className="text-[15px] font-bold uppercase tracking-wide">
          Certificat de salubrité produit de
        </h1>
        <p className="text-[13px] font-medium">
          FATTORIE COVELLI GROUP-MF 1327082/N
        </p>
        <p className="text-[11px]">
          Km 8, Route de Bizerte Sanheji, Mnihla 2094
        </p>
      </div>

      <p className="text-[12px]">
        Je soussigné Dr. Mohamed Methnani certifie avoir examiné ce jour les
        produits suivants&nbsp;:
      </p>

      <table className="w-full border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1.5 pr-2 font-medium">COD Prod.</th>
            <th className="py-1.5 pr-2 font-medium">DESIGNATION</th>
            <th className="py-1.5 pr-2 font-medium">Date Production</th>
            <th className="py-1.5 pr-2 font-medium">Date emballage</th>
            <th className="py-1.5 pr-2 font-medium">DLC</th>
            <th className="py-1.5 font-medium">Jour après emballage</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr
              key={`${row.productId}-${row.lotCode ?? row.productSku}`}
              className="border-b border-black/15"
            >
              <td className="a-mono py-1 pr-2 align-top">{row.productSku}</td>
              <td className="py-1 pr-2 align-top">{row.productName}</td>
              <td className="a-mono py-1 pr-2 align-top a-tabular">
                {fmtFr(row.productionDate)}
              </td>
              <td className="a-mono py-1 pr-2 align-top a-tabular">
                {fmtFr(row.packDate)}
              </td>
              <td className="a-mono py-1 pr-2 align-top a-tabular">
                {fmtFr(row.dlc)}
              </td>
              <td className="a-mono py-1 align-top a-tabular">
                {row.daysAfterPack}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="space-y-2 pt-4 text-[11px]">
        <p>
          Ces produits sont retenus salubres et propres à la consommation
          humaine au moment de l&apos;examen.
        </p>
        <p>Et suivant les analyses de laboratoire effectuées régulièrement</p>
        <p className="font-medium">
          Le Numéro de Lot se réfère à la Date de Production
        </p>
      </footer>
    </article>
  );
}

export function salubritaMailtoBody(
  packDate: string,
  items: SalubritaCertificateItem[],
): string {
  const lines = items.map(
    (r) =>
      `${r.productSku}\t${r.productName}\t${fmtFr(r.productionDate)}\t${fmtFr(r.packDate)}\t${fmtFr(r.dlc)}\t${r.daysAfterPack}`,
  );
  return [
    `Certificat de salubrité — FATTORIE COVELLI GROUP — emballage ${fmtFr(packDate)}`,
    "",
    "COD Prod.\tDESIGNATION\tDate Production\tDate emballage\tDLC\tJour après emballage",
    ...lines,
    "",
    "Ces produits sont retenus salubres et propres à la consommation humaine au moment de l'examen.",
    "Le Numéro de Lot se réfère à la Date de Production.",
  ].join("\n");
}

export { fmtFr as formatSalubritaDateFr };
