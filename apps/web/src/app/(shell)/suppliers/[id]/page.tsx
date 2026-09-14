"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AErrorState,
  AForbiddenState,
  AInput,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASwitch,
  type AOverflowItem,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { softSelect } from "@/lib/soft-glass-ui";
import {
  SUPPLIER_CATEGORY_LABELS,
  SUPPLIER_STATUS_LABELS,
  addSupplierContact,
  fetchSupplier,
  setSupplierHold,
  updateSupplier,
  type Supplier,
  type SupplierCategory,
  type SupplierStatus,
} from "@/lib/suppliers";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: Supplier }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type EditForm = {
  legalName: string;
  taxId: string;
  category: SupplierCategory;
  leadTimeDays: string;
  moqDefault: string;
  preferred: boolean;
  paymentTerms: string;
  notes: string;
  status: SupplierStatus;
};

const CATEGORIES = Object.keys(
  SUPPLIER_CATEGORY_LABELS,
) as SupplierCategory[];
const STATUSES = Object.keys(SUPPLIER_STATUS_LABELS) as SupplierStatus[];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 py-2">
      <dt className="w-40 shrink-0 text-[length:var(--a-text-xs)] text-a-fg-muted">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[length:var(--a-text-sm)] text-a-fg">
        {value}
      </dd>
    </div>
  );
}

export default function SupplierDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    email: "",
    role: "",
    isPrimary: false,
  });
  const [contactError, setContactError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setState({ kind: "loading" });
    const res = await fetchSupplier(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", data: res.data });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(data: Supplier) {
    setEditError(null);
    setEditForm({
      legalName: data.legalName,
      taxId: data.taxId ?? "",
      category: data.category,
      leadTimeDays: data.leadTimeDays != null ? String(data.leadTimeDays) : "",
      moqDefault: data.moqDefault ?? "",
      preferred: data.preferred,
      paymentTerms: data.paymentTerms ?? "",
      notes: data.notes ?? "",
      status: data.status,
    });
    setEditOpen(true);
  }

  async function onSaveEdit() {
    if (state.kind !== "ok" || !editForm) return;
    setBusy(true);
    setEditError(null);
    try {
      const lead = editForm.leadTimeDays.trim();
      const moq = editForm.moqDefault.trim();
      const res = await updateSupplier(state.data.id, {
        version: state.data.version,
        legalName: editForm.legalName.trim(),
        taxId: editForm.taxId.trim() || null,
        category: editForm.category,
        leadTimeDays: lead === "" ? null : Number(lead),
        moqDefault: moq === "" ? null : Number(moq),
        preferred: editForm.preferred,
        paymentTerms: editForm.paymentTerms.trim() || null,
        notes: editForm.notes.trim() || null,
        status: editForm.status,
      });
      if (!res.ok) {
        setEditError(res.message);
        return;
      }
      setEditOpen(false);
      setState({ kind: "ok", data: res.data });
    } finally {
      setBusy(false);
    }
  }

  async function onToggleHold() {
    if (state.kind !== "ok") return;
    setBusy(true);
    setActionError(null);
    try {
      const next = !state.data.qualityHold;
      const res = await setSupplierHold(state.data.id, {
        version: state.data.version,
        qualityHold: next,
        setOnHoldStatus: next,
      });
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setState({ kind: "ok", data: res.data });
    } finally {
      setBusy(false);
    }
  }

  async function onAddContact() {
    if (state.kind !== "ok") return;
    setBusy(true);
    setContactError(null);
    try {
      const res = await addSupplierContact(state.data.id, {
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim() || undefined,
        whatsapp: contactForm.whatsapp.trim() || undefined,
        email: contactForm.email.trim() || undefined,
        role: contactForm.role.trim() || undefined,
        isPrimary: contactForm.isPrimary,
      });
      if (!res.ok) {
        setContactError(res.message);
        return;
      }
      setContactOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <>
        <AScreenHeader kicker="Fournisseurs" title="Fiche" />
        <APageBody>
          <ASkeleton className="h-40 w-full" />
        </APageBody>
      </>
    );
  }
  if (state.kind === "forbidden") {
    return (
      <>
        <AScreenHeader kicker="Fournisseurs" title="Fiche" />
        <APageBody>
          <AForbiddenState message={state.message} />
        </APageBody>
      </>
    );
  }
  if (state.kind === "error") {
    return (
      <>
        <AScreenHeader kicker="Fournisseurs" title="Fiche" />
        <APageBody>
          <AErrorState message={state.message} />
        </APageBody>
      </>
    );
  }

  const data = state.data;
  const overflow: AOverflowItem[] = [
    {
      id: "hold",
      label: data.qualityHold ? "Lever hold qualité" : "Hold qualité",
      onSelect: () => void onToggleHold(),
      disabled: busy,
    },
    {
      id: "ap",
      label: "Factures fournisseurs",
      onSelect: () => {
        window.location.href = "/finance/ap-bills";
      },
    },
  ];

  return (
    <>
      <AScreenHeader
        kicker="Fournisseurs"
        title={data.legalName}
        description={`${data.code} · ${SUPPLIER_CATEGORY_LABELS[data.category]}`}
        breadcrumb={
          <Link href="/suppliers" className="text-a-accent hover:underline">
            ← Liste
          </Link>
        }
        status={
          <>
            <ABadge
              tone={
                data.status === "ACTIVE"
                  ? "success"
                  : data.status === "ON_HOLD"
                    ? "warning"
                    : data.status === "BLOCKED"
                      ? "danger"
                      : "neutral"
              }
            >
              {SUPPLIER_STATUS_LABELS[data.status]}
            </ABadge>
            {data.preferred ? <ABadge tone="info">Préféré</ABadge> : null}
            {data.qualityHold ? (
              <ABadge tone="warning">Hold qualité</ABadge>
            ) : null}
          </>
        }
        primary={
          <AButton
            type="button"
            size="sm"
            onClick={() => openEdit(data)}
          >
            {LAYOUT_ACTIONS.edit}
          </AButton>
        }
        more={<AOverflowMenu items={overflow} />}
      />

      <APageBody>
        {actionError && (
          <p className="mb-3 text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        )}

        <APageSection title="Identité">
          <dl>
            <InfoRow label="Code" value={data.code} />
            <InfoRow label="Raison sociale" value={data.legalName} />
            <InfoRow label="Matricule fiscal" value={data.taxId ?? "—"} />
            <InfoRow
              label="Catégorie"
              value={SUPPLIER_CATEGORY_LABELS[data.category]}
            />
            <InfoRow
              label="Délai"
              value={
                data.leadTimeDays != null ? `${data.leadTimeDays} j` : "—"
              }
            />
            <InfoRow label="MOQ défaut" value={data.moqDefault ?? "—"} />
            <InfoRow
              label="Conditions paiement"
              value={data.paymentTerms ?? "—"}
            />
            <InfoRow label="Notes" value={data.notes ?? "—"} />
          </dl>
        </APageSection>

        <APageSection
          title="Contacts"
          action={
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setContactError(null);
                setContactForm({
                  name: "",
                  phone: "",
                  whatsapp: "",
                  email: "",
                  role: "",
                  isPrimary: false,
                });
                setContactOpen(true);
              }}
            >
              + Contact
            </AButton>
          }
        >
          {(data.contacts ?? []).length === 0 ? (
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Aucun contact.
            </p>
          ) : (
            <ul className="space-y-2">
              {(data.contacts ?? []).map((c) => (
                <li
                  key={c.id}
                  className="a-underlay flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2"
                >
                  <span className="font-medium">{c.name}</span>
                  {c.isPrimary ? (
                    <ABadge tone="info">Principal</ABadge>
                  ) : null}
                  <span className="text-a-fg-muted">{c.phone ?? "—"}</span>
                  <span className="text-a-fg-muted">{c.email ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </APageSection>
      </APageBody>

      <ADrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Éditer fournisseur"
      >
        {editForm && (
          <div className="space-y-3">
            {editError && (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {editError}
              </p>
            )}
            <Field label="Raison sociale">
              <AInput
                value={editForm.legalName}
                onChange={(e) =>
                  setEditForm({ ...editForm, legalName: e.target.value })
                }
              />
            </Field>
            <Field label="Matricule fiscal">
              <AInput
                value={editForm.taxId}
                onChange={(e) =>
                  setEditForm({ ...editForm, taxId: e.target.value })
                }
              />
            </Field>
            <Field label="Catégorie">
              <select
                className={softSelect}
                value={editForm.category}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    category: e.target.value as SupplierCategory,
                  })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SUPPLIER_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Statut">
              <select
                className={softSelect}
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    status: e.target.value as SupplierStatus,
                  })
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SUPPLIER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Délai (jours)">
                <AInput
                  value={editForm.leadTimeDays}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      leadTimeDays: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="MOQ défaut">
                <AInput
                  value={editForm.moqDefault}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      moqDefault: e.target.value,
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Conditions de paiement">
              <AInput
                value={editForm.paymentTerms}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    paymentTerms: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Notes">
              <AInput
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
              <ASwitch
                checked={editForm.preferred}
                onCheckedChange={(v) =>
                  setEditForm({ ...editForm, preferred: v })
                }
              />
              Fournisseur préféré
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditOpen(false)}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy || !editForm.legalName.trim()}
                onClick={() => void onSaveEdit()}
              >
                {LAYOUT_ACTIONS.save}
              </AButton>
            </div>
          </div>
        )}
      </ADrawer>

      <ADrawer
        open={contactOpen}
        onOpenChange={setContactOpen}
        title="Nouveau contact"
      >
        <div className="space-y-3">
          {contactError && (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {contactError}
            </p>
          )}
          <Field label="Nom">
            <AInput
              value={contactForm.name}
              onChange={(e) =>
                setContactForm({ ...contactForm, name: e.target.value })
              }
            />
          </Field>
          <Field label="Téléphone">
            <AInput
              value={contactForm.phone}
              onChange={(e) =>
                setContactForm({ ...contactForm, phone: e.target.value })
              }
            />
          </Field>
          <Field label="WhatsApp">
            <AInput
              value={contactForm.whatsapp}
              onChange={(e) =>
                setContactForm({
                  ...contactForm,
                  whatsapp: e.target.value,
                })
              }
            />
          </Field>
          <Field label="E-mail">
            <AInput
              value={contactForm.email}
              onChange={(e) =>
                setContactForm({ ...contactForm, email: e.target.value })
              }
            />
          </Field>
          <Field label="Rôle">
            <AInput
              value={contactForm.role}
              onChange={(e) =>
                setContactForm({ ...contactForm, role: e.target.value })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
            <ASwitch
              checked={contactForm.isPrimary}
              onCheckedChange={(v) =>
                setContactForm({ ...contactForm, isPrimary: v })
              }
            />
            Contact principal
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setContactOpen(false)}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !contactForm.name.trim()}
              onClick={() => void onAddContact()}
            >
              Ajouter
            </AButton>
          </div>
        </div>
      </ADrawer>
    </>
  );
}
