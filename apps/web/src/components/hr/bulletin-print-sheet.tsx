/** Shared Soft Glass bulletin print sheet (D200/D202) — CSS print + abatement lines. */

export type BulletinPrintModel = {
  number?: string | null;
  periodYm: string;
  employeeName: string;
  matricule: string;
  contractNumber: string;
  wageBase: string;
  cnssEmployeeAmount: string;
  cnssEmployerAmount: string;
  irppMonthly: string;
  netPay: string;
  currency: string;
  annualTaxableBeforeAbat?: string | null;
  abatChefAnnual?: string | null;
  abatEnfantAnnual?: string | null;
  abatTotalAnnual?: string | null;
  taxChefDeFamille?: boolean | null;
  taxEnfantCount?: number | null;
};

export function BulletinPrintSheet({ data }: { data: BulletinPrintModel }) {
  const showAbat =
    data.abatTotalAnnual != null && Number(data.abatTotalAnnual) > 0;

  return (
    <div className="hr-bulletin-sheet rounded-[16px] bg-white px-6 py-5 text-black print:rounded-none print:px-0 print:py-0">
      <header className="mb-6 border-b border-black/10 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
          AUTHORITY · RH
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          Bulletin de paie
          {data.number ? (
            <span className="a-mono ml-2 text-base font-normal text-black/70">
              {data.number}
            </span>
          ) : null}
        </h1>
        <p className="a-mono mt-1 text-sm text-black/60">
          Période {data.periodYm}
        </p>
      </header>

      <dl className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-black/45">
            Matricule
          </dt>
          <dd className="a-mono font-medium">{data.matricule}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-black/45">
            Employé
          </dt>
          <dd className="font-medium">{data.employeeName}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-black/45">
            Contrat
          </dt>
          <dd className="a-mono">{data.contractNumber}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-black/45">
            Devise
          </dt>
          <dd className="a-mono">{data.currency}</dd>
        </div>
      </dl>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/15 text-[11px] uppercase tracking-wider text-black/45">
            <th className="py-2 font-medium">Libellé</th>
            <th className="py-2 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody className="a-mono tabular-nums">
          <tr className="border-b border-black/8">
            <td className="py-2">Base salariale</td>
            <td className="py-2 text-right">{data.wageBase}</td>
          </tr>
          <tr className="border-b border-black/8">
            <td className="py-2">CNSS salarié</td>
            <td className="py-2 text-right">− {data.cnssEmployeeAmount}</td>
          </tr>
          <tr className="border-b border-black/8">
            <td className="py-2">CNSS employeur (info)</td>
            <td className="py-2 text-right">{data.cnssEmployerAmount}</td>
          </tr>
          {showAbat ? (
            <>
              {data.annualTaxableBeforeAbat ? (
                <tr className="border-b border-black/8">
                  <td className="py-2">Assiette annuelle avant abattements</td>
                  <td className="py-2 text-right">
                    {data.annualTaxableBeforeAbat}
                  </td>
                </tr>
              ) : null}
              {data.abatChefAnnual && Number(data.abatChefAnnual) > 0 ? (
                <tr className="border-b border-black/8">
                  <td className="py-2">Abattement chef de famille (annuel)</td>
                  <td className="py-2 text-right">− {data.abatChefAnnual}</td>
                </tr>
              ) : null}
              {data.abatEnfantAnnual && Number(data.abatEnfantAnnual) > 0 ? (
                <tr className="border-b border-black/8">
                  <td className="py-2">
                    Abattement enfants (annuel)
                    {data.taxEnfantCount != null
                      ? ` · ${data.taxEnfantCount}`
                      : ""}
                  </td>
                  <td className="py-2 text-right">− {data.abatEnfantAnnual}</td>
                </tr>
              ) : null}
              <tr className="border-b border-black/8">
                <td className="py-2">Total abattements annuels</td>
                <td className="py-2 text-right">− {data.abatTotalAnnual}</td>
              </tr>
            </>
          ) : null}
          <tr className="border-b border-black/8">
            <td className="py-2">IRPP mensuel</td>
            <td className="py-2 text-right">− {data.irppMonthly}</td>
          </tr>
          <tr>
            <td className="py-3 text-base font-semibold">Net à payer</td>
            <td className="py-3 text-right text-base font-semibold">
              {data.netPay} {data.currency}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-8 text-[11px] leading-relaxed text-black/45">
        Montants issus des snapshots CNSS / IRPP VALIDATED — aucun barème inventé.
        Abattements Prefs (si VALIDATED) réduisent l’assiette annuelle avant barème.
        Net = base − CNSS salarié − IRPP mensuel.
      </p>
    </div>
  );
}
