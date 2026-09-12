"use client";

import { Printer, Mail, MessageCircle, Globe, FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  SalubritaCertificateDocument,
  formatSalubritaDateFr,
  salubritaMailtoBody,
} from "@/components/salubrita/certificate-document";
import {
  downloadSalubritaTemplate,
  fetchSalubritaCertificate,
  fetchSalubritaRecipients,
  generateDailyCheeseLots,
  type SalubritaCertificateItem,
  type SalubritaRecipient,
} from "@/lib/inventory";
import { fetchEffectiveSettings } from "@/lib/settings";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ok";
      packDate: string;
      source: "snapshot" | "live" | undefined;
      items: SalubritaCertificateItem[];
    }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type SendChannel = "email" | "whatsapp" | "portal";

function todayIsoLocal(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const iconBtn =
  "inline-flex h-10 flex-1 min-w-[7.5rem] items-center justify-center gap-2 rounded-[10px] bg-a-surface-3 px-3 text-[13px] font-medium text-a-fg transition-colors hover:bg-a-surface-2 disabled:pointer-events-none disabled:opacity-40";

export default function CertificatSalubritePage() {
  const [packDate, setPackDate] = useState(todayIsoLocal);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [sendOpen, setSendOpen] = useState(false);
  const [sendChannel, setSendChannel] = useState<SendChannel>("email");
  const [q, setQ] = useState("");
  const [recipients, setRecipients] = useState<SalubritaRecipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendAll, setSendAll] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [waPrefix, setWaPrefix] = useState("");
  const [outlookFrom, setOutlookFrom] = useState("");

  const load = useCallback(async (date: string) => {
    setState({ kind: "loading" });
    const res = await fetchSalubritaCertificate({ packDate: date });
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({
      kind: "ok",
      packDate: res.data.packDate,
      source: res.data.source,
      items: res.data.items,
    });
  }, []);

  useEffect(() => {
    void load(packDate);
  }, [load, packDate]);

  useEffect(() => {
    void (async () => {
      const res = await fetchEffectiveSettings();
      if (!res.ok) return;
      const pref = res.data.settings.find(
        (s) => s.key === "salubrita.whatsapp.default_prefix",
      );
      if (pref && typeof pref.value === "string") setWaPrefix(pref.value);
      const from = res.data.settings.find(
        (s) => s.key === "salubrita.outlook.from_email",
      );
      if (from && typeof from.value === "string") setOutlookFrom(from.value);
    })();
  }, []);

  const bodyText = useMemo(() => {
    if (state.kind !== "ok") return "";
    return salubritaMailtoBody(state.packDate, state.items);
  }, [state]);

  const canSend = state.kind === "ok" && state.items.length > 0;

  async function openSend(channel: SendChannel) {
    if (!canSend) return;
    setSendChannel(channel);
    setSendOpen(true);
    setQ("");
    setSendAll(false);
    setSelected(new Set());
    setLoadingRecipients(true);
    const res = await fetchSalubritaRecipients({ channel, q: "" });
    setLoadingRecipients(false);
    if (res.ok) {
      setRecipients(res.data.items);
      setSelected(new Set(res.data.items.map((r) => r.id)));
    } else {
      setRecipients([]);
      setToast(res.message);
    }
  }

  async function searchRecipients(query: string) {
    setQ(query);
    setLoadingRecipients(true);
    const res = await fetchSalubritaRecipients({
      channel: sendChannel,
      q: query,
    });
    setLoadingRecipients(false);
    if (res.ok) setRecipients(res.data.items);
  }

  function toggleId(id: string) {
    setSendAll(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectEveryone() {
    setSendAll(true);
    setSelected(new Set(recipients.map((r) => r.id)));
  }

  async function confirmSend() {
    if (state.kind !== "ok") return;
    const chosen = sendAll
      ? recipients
      : recipients.filter((r) => selected.has(r.id));
    if (chosen.length === 0) {
      setToast("Sélectionnez au moins un client (ou « tout le monde »).");
      return;
    }

    if (sendChannel === "email") {
      const emails = chosen
        .map((c) => c.email)
        .filter((e): e is string => Boolean(e?.trim()));
      if (emails.length === 0) {
        setToast(
          "Aucun e-mail — activez Outlook sur la fiche client et renseignez le contact.",
        );
        return;
      }
      const subject = encodeURIComponent(
        `Certificat de salubrité — ${formatSalubritaDateFr(state.packDate)}`,
      );
      const body = encodeURIComponent(bodyText);
      const bcc = encodeURIComponent(emails.join(","));
      window.location.href = `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`;
      setToast(
        outlookFrom.trim()
          ? `Outlook · ${emails.length} destinataire(s) · from ${outlookFrom.trim()}`
          : `Outlook · ${emails.length} destinataire(s).`,
      );
    }

    if (sendChannel === "whatsapp") {
      const phones = chosen
        .map((c) => normalizePhone(c.whatsapp, waPrefix))
        .filter(Boolean);
      if (phones.length === 0) {
        setToast(
          "Aucun WhatsApp — activez le canal sur la fiche et renseignez le numéro.",
        );
        return;
      }
      const text = encodeURIComponent(bodyText.slice(0, 3500));
      window.open(
        `https://wa.me/${phones[0]}?text=${text}`,
        "_blank",
        "noopener,noreferrer",
      );
      setToast(
        phones.length > 1
          ? `WhatsApp · 1 ouvert, ${phones.length - 1} autre(s) restant(s).`
          : "WhatsApp ouvert.",
      );
    }

    if (sendChannel === "portal") {
      setBusy(true);
      const res = await fetchSalubritaCertificate({ packDate: state.packDate });
      setBusy(false);
      if (!res.ok) {
        setToast(res.message);
        return;
      }
      setToast(
        `Portail · visible pour ${chosen.length} client(s) (canal Portail).`,
      );
      window.open(
        `/portal/salubrita/${state.packDate}`,
        "_blank",
        "noopener,noreferrer",
      );
    }

    setSendOpen(false);
  }

  async function onGenerate() {
    setBusy(true);
    setToast(null);
    const res = await generateDailyCheeseLots({ packDate });
    setBusy(false);
    if (!res.ok) {
      setToast(res.message);
      return;
    }
    setToast(
      `Lots ${res.data.packDate} — créés ${res.data.created}, déjà ${res.data.skipped}`,
    );
    await load(packDate);
  }

  function onRefreshToday() {
    setPackDate(todayIsoLocal());
    setToast("Date du jour.");
  }

  const channelTitle =
    sendChannel === "email"
      ? "Envoyer par Outlook"
      : sendChannel === "whatsapp"
        ? "Envoyer par WhatsApp"
        : "Publier au portail";

  return (
    <>
      <AScreenHeader
        kicker="Stock"
        title="Certificat de salubrité"
        description="Date → certificat → imprimer ou envoyer"
        primary={
          <AButton
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void onGenerate()}
          >
            Générer lots
          </AButton>
        }
      />

      <APageBody className="mx-auto max-w-3xl print:max-w-none print:px-0 print:pb-0">
        <APageSection bare className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="min-w-[14rem] flex-1 space-y-1">
            <label htmlFor="pack-date" className="text-[12px] text-a-fg-subtle">
              Date d’emballage
            </label>
            <AInput
              id="pack-date"
              type="date"
              value={packDate}
              onChange={(e) => setPackDate(e.target.value)}
            />
          </div>
          <AButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={onRefreshToday}
          >
            Actualiser
          </AButton>
        </APageSection>

        <APageSection
          bare
          className="flex flex-wrap gap-2 a-underlay rounded-md p-2 print:hidden"
        >
          <button
            type="button"
            className={iconBtn}
            disabled={!canSend}
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 text-a-fg" strokeWidth={1.75} />
            Imprimer
          </button>
          <button
            type="button"
            className={iconBtn}
            disabled={!canSend}
            onClick={() => void openSend("email")}
          >
            <Mail className="h-4 w-4 text-a-fg" strokeWidth={1.75} />
            Outlook
          </button>
          <button
            type="button"
            className={iconBtn}
            disabled={!canSend}
            onClick={() => void openSend("whatsapp")}
          >
            <MessageCircle className="h-4 w-4 text-a-fg" strokeWidth={1.75} />
            WhatsApp
          </button>
          <button
            type="button"
            className={iconBtn}
            disabled={!canSend || busy}
            onClick={() => void openSend("portal")}
          >
            <Globe className="h-4 w-4 text-a-fg" strokeWidth={1.75} />
            Portail
          </button>
          <button
            type="button"
            className={iconBtn}
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                const res = await downloadSalubritaTemplate();
                setBusy(false);
                if (!res.ok) setToast(res.message);
              })();
            }}
          >
            <FileText className="h-4 w-4 text-a-fg" strokeWidth={1.75} />
            Modèle Word
          </button>
        </APageSection>

        {toast ? (
          <p className="text-[13px] text-a-fg-muted print:hidden" role="status">
            {toast}
          </p>
        ) : null}

        {state.kind === "loading" ? (
          <ASkeleton className="h-64 w-full print:hidden" />
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(packDate)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun produit à certifier"
            description="Conservation (jours) sur le catalogue, puis Générer lots."
            actionLabel="Catalogue"
            onAction={() => {
              window.location.href = "/products";
            }}
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="salubrita-sheet rounded-[var(--a-radius-md)] bg-white px-4 py-2 text-black print:rounded-none print:px-0 print:py-0">
            <SalubritaCertificateDocument
              packDate={state.packDate}
              items={state.items}
            />
          </div>
        ) : null}
      </APageBody>

      <ADrawer
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={channelTitle}
        description={`Certificat ${formatSalubritaDateFr(packDate)} · canaux sur fiche client`}
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setSendOpen(false)}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void confirmSend()}
            >
              Envoyer
            </AButton>
          </div>
        }
      >
        <div className="space-y-4">
          <AInput
            value={q}
            onChange={(e) => void searchRecipients(e.target.value)}
            placeholder="Rechercher un client…"
          />
          <label className="flex items-center gap-2 text-[13px] text-a-fg">
            <input
              type="checkbox"
              checked={sendAll}
              onChange={(e) => {
                if (e.target.checked) selectEveryone();
                else {
                  setSendAll(false);
                  setSelected(new Set());
                }
              }}
            />
            Envoyer à tout le monde (liste filtrée)
          </label>
          {loadingRecipients ? <ASkeleton className="h-32 w-full" /> : null}
          {!loadingRecipients && recipients.length === 0 ? (
            <p className="text-[13px] text-a-fg-muted">
              Aucun client pour ce canal. Activez Outlook / WhatsApp / Portail
              sur la fiche client · Préférences → Envois pour le préfixe
              WhatsApp.
            </p>
          ) : null}
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {recipients.map((r) => (
              <li key={r.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-[10px] px-2 py-2 hover:bg-a-surface-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(r.id)}
                    onChange={() => toggleId(r.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-a-fg">
                      {r.code} · {r.nickname || r.legalName}
                    </span>
                    <span className="block text-[11px] text-a-fg-subtle">
                      {sendChannel === "email"
                        ? r.email || "pas d’e-mail"
                        : sendChannel === "whatsapp"
                          ? r.whatsapp || "pas de WhatsApp"
                          : "accès portail"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </ADrawer>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .salubrita-sheet, .salubrita-sheet * { visibility: visible !important; }
          .salubrita-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 12mm 14mm;
          }
        }
      `}</style>
    </>
  );
}

function normalizePhone(raw: string | null, prefix: string): string {
  if (!raw?.trim()) return "";
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (prefix.trim() && !digits.startsWith(prefix.trim().replace(/\D/g, ""))) {
    digits = `${prefix.trim().replace(/\D/g, "")}${digits.replace(/^0+/, "")}`;
  }
  return digits;
}
