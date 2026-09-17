"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
  AButton,
  AContextPanel,
  ADetailGrid,
  AErrorState,
  AForbiddenState,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  type AOverflowItem,
} from "@/components/a";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  INVOICE_STATUS_LABELS,
  cancelInvoice,
  fetchInvoice,
  invoiceBadgeTone,
  issueInvoice,
  type FinInvoice,
} from "@/lib/finance";
import {
  downloadTejXml,
  generateTejInvoicePack,
} from "@/lib/tax";
import { FULFILLMENT_DOC_LABELS } from "@/lib/customers";
import { softPanel } from "@/lib/d294-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: FinInvoice }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function FinanceInvoiceFichePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchInvoice(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Facture introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setActionError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onIssue() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const res = await issueInvoice(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
    if (res.data.taxWithholdingId) {
      setActionError(null);
    }
  }

  async function onTejInvoicePack() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const res = await generateTejInvoicePack(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    downloadTejXml(res.data);
  }

  async function onCancel() {
    if (!id) return;
    if (
      !window.confirm(
        "Annuler cette facture ? La créance ouverte sera clôturée et le GL décomptabilisé via Thunder.",
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    const res = await cancelInvoice(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  const inv = state.kind === "ok" ? state.data : null;

  const overflowItems = useMemo((): AOverflowItem[] => {
    if (!inv) return [];
    const items: AOverflowItem[] = [];
    if (inv.status === "ISSUED") {
      items.push({
        id: "credit-note",
        label: "Avoir",
        onSelect: () =>
          router.push(
            `/finance/credit-notes?invoiceId=${encodeURIComponent(inv.id)}`,
          ),
      });
      items.push({
        id: "tej",
        label: "TEJ Center",
        onSelect: () => router.push("/tax/tej-center"),
      });
      if (inv.taxWithholdingId) {
        items.push({
          id: "tej-pack",
          label: "XML TEJ facture",
          disabled: busy,
          onSelect: () => void onTejInvoicePack(),
        });
      }
    }
    if (inv.status === "DRAFT" || inv.status === "ISSUED") {
      items.push({
        id: "cancel",
        label: "Annuler",
        danger: true,
        disabled: busy,
        onSelect: () => void onCancel(),
      });
    }
    return items;
  }, [inv, busy, router]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/finance/invoices" className="hover:text-a-fg">
            Factures
          </Link>
        }
        kicker={
          inv
            ? FULFILLMENT_DOC_LABELS[inv.fulfillmentDoc ?? "DELIVERY_NOTE"]
            : "Finance"
        }
        title={inv ? inv.number : "Document"}
        description="Fiche — HT/TVA/FODEC/timbre/TTC as-recorded (D224)."
        status={
          inv ? (
            <ABadge tone={invoiceBadgeTone(inv.status)}>
              {INVOICE_STATUS_LABELS[inv.status]}
            </ABadge>
          ) : undefined
        }
        primary={
          inv?.status === "DRAFT" ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onIssue()}
            >
              Émettre
            </AButton>
          ) : undefined
        }
        more={
          overflowItems.length > 0 ? (
            <AOverflowMenu items={overflowItems} />
          ) : undefined
        }
      />

      <APageBody>
        <ExpertiseHintsStrip keys={["tax.fodec", "tax.timbre", "tax.ras", "tax.tej"]} />

        {inv?.taxWithholdingId ? (
          <div className={`${softPanel} mb-4 flex flex-wrap items-center gap-3 p-4`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/tej-logo.png"
              alt="Tej"
              className="h-10 w-auto object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[length:var(--a-text-sm)] font-medium">
                RAS client liée — TEJ Center
              </p>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Retenue créée à l’émission (Prefs tax.ras). Valider / certificat /
                XML dans TEJ Center. Transmission DISABLED.
              </p>
            </div>
            <AButton
              type="button"
              size="sm"
              onClick={() => router.push("/tax/tej-center")}
            >
              Ouvrir TEJ Center
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onTejInvoicePack()}
            >
              XML facture
            </AButton>
          </div>
        ) : null}

        {actionError ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}

        {state.kind === "loading" ? (
          <div className="space-y-3">
            <ASkeleton className="h-8 w-48" />
            <ASkeleton className="h-40 w-full" />
          </div>
        ) : null}

        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}

        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}

        {inv ? (
          <ADetailGrid
            primary={
              <>
                <APageSection title="Identité">
                  <span className="mb-3 inline-block a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
                    v{inv.version}
                  </span>
                  <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                    <div>
                      <dt className="text-a-fg-muted">Document</dt>
                      <dd>
                        {
                          FULFILLMENT_DOC_LABELS[
                            inv.fulfillmentDoc ?? "DELIVERY_NOTE"
                          ]
                        }
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Client</dt>
                      <dd>
                        {inv.customerName ?? "—"}{" "}
                        <span className="a-mono text-a-fg-muted">
                          {inv.customerCode}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Libellé</dt>
                      <dd>{inv.label ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Échéance</dt>
                      <dd className="a-mono">{inv.dueDate ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Émise le</dt>
                      <dd className="a-mono">
                        {inv.issuedAt ? inv.issuedAt.slice(0, 10) : "—"}
                      </dd>
                    </div>
                    {inv.salesOrderId ? (
                      <div>
                        <dt className="text-a-fg-muted">Commande</dt>
                        <dd>
                          <Link
                            href={`/sales/${inv.salesOrderId}`}
                            className="text-a-accent hover:underline"
                          >
                            Ouvrir Sales
                          </Link>
                        </dd>
                      </div>
                    ) : null}
                    {inv.openItemId ? (
                      <div>
                        <dt className="text-a-fg-muted">Créance AR</dt>
                        <dd>
                          <Link
                            href="/finance"
                            className="a-mono text-a-accent hover:underline"
                          >
                            {inv.openItemId.slice(0, 8)}…
                          </Link>
                        </dd>
                      </div>
                    ) : null}
                    {inv.notes ? (
                      <div className="sm:col-span-2">
                        <dt className="text-a-fg-muted">Notes</dt>
                        <dd>{inv.notes}</dd>
                      </div>
                    ) : null}
                  </dl>
                </APageSection>

                <APageSection title="Lignes">
                  {(inv.lines?.length ?? 0) > 0 ? (
                    <ASoftTable>
                      <ASoftThead>
                        <ASoftTr>
                          <ASoftTh>#</ASoftTh>
                          <ASoftTh>Description</ASoftTh>
                          <ASoftTh numeric>Qté</ASoftTh>
                          <ASoftTh numeric>PU HT</ASoftTh>
                          <ASoftTh>TVA</ASoftTh>
                          <ASoftTh numeric>HT</ASoftTh>
                          <ASoftTh numeric>Taxe</ASoftTh>
                          <ASoftTh numeric>TTC</ASoftTh>
                        </ASoftTr>
                      </ASoftThead>
                      <tbody>
                        {inv.lines.map((l) => (
                          <ASoftTr key={l.id}>
                            <ASoftTd className="a-mono">{l.lineNo}</ASoftTd>
                            <ASoftTd>{l.description}</ASoftTd>
                            <ASoftTd numeric className="a-mono a-tabular">
                              {l.qty}
                            </ASoftTd>
                            <ASoftTd numeric className="a-mono a-tabular">
                              {l.unitPriceHt}
                            </ASoftTd>
                            <ASoftTd className="a-mono text-a-fg-muted">
                              {l.taxCode ?? "—"}
                            </ASoftTd>
                            <ASoftTd numeric className="a-mono a-tabular">
                              {l.amountHt}
                            </ASoftTd>
                            <ASoftTd numeric className="a-mono a-tabular">
                              {l.amountTax}
                            </ASoftTd>
                            <ASoftTd
                              numeric
                              className="a-mono a-tabular font-medium"
                            >
                              {l.amountTtc}
                            </ASoftTd>
                          </ASoftTr>
                        ))}
                      </tbody>
                    </ASoftTable>
                  ) : (
                    <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Aucune ligne (facture legacy).
                    </p>
                  )}
                </APageSection>
              </>
            }
            context={
              <AContextPanel title="Synthèse">
                <dl className="space-y-3 text-[length:var(--a-text-sm)]">
                  <div>
                    <dt className="text-a-fg-muted">HT</dt>
                    <dd className="a-mono a-tabular font-medium">
                      {inv.amountHt}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">TVA</dt>
                    <dd className="a-mono a-tabular">{inv.amountTax}</dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">FODEC</dt>
                    <dd className="a-mono a-tabular">
                      {inv.amountFodec ?? "0.000"}
                      {!inv.expertiseApplied?.fodec ? (
                        <span className="ml-1 text-[length:var(--a-text-xs)] text-a-fg-subtle">
                          (off)
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Timbre</dt>
                    <dd className="a-mono a-tabular">
                      {inv.amountTimbre ?? "0.000"}
                      {!inv.expertiseApplied?.timbre ? (
                        <span className="ml-1 text-[length:var(--a-text-xs)] text-a-fg-subtle">
                          (off)
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">TTC</dt>
                    <dd className="a-mono a-tabular text-[length:var(--a-text-base)] font-medium">
                      {inv.amountTotal} {inv.currency}
                    </dd>
                  </div>
                  <p className="pt-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Calcul général : HT + TVA + FODEC + timbre. RAS / TEJ →{" "}
                    <Link
                      href="/tax"
                      className="text-a-accent hover:underline"
                    >
                      Fiscalité
                    </Link>{" "}
                    /{" "}
                    <Link
                      href="/settings#expertise"
                      className="text-a-accent hover:underline"
                    >
                      Prefs
                    </Link>
                    .
                  </p>
                </dl>
              </AContextPanel>
            }
          />
        ) : null}
      </APageBody>
    </>
  );
}
