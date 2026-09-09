"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  STATUS_LABELS,
  createCompanyUser,
  fetchBusinessRoles,
  fetchCompanyUsers,
  updateCompanyUser,
  type BusinessRole,
  type CompanyUser,
  type CompanyUserStatus,
} from "@/lib/users";

const selectClass =
  "flex h-9 w-full rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-3 text-[length:var(--a-text-sm)] text-a-fg";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: CompanyUser[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  email: string;
  displayName: string;
  password: string;
  roleCode: string;
  status: CompanyUserStatus;
};

function statusTone(
  status: CompanyUserStatus,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "INVITED":
      return "warning";
    case "LOCKED":
    case "DISABLED":
      return "danger";
    default:
      return "neutral";
  }
}

export default function UsersPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyUser | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emptyForm = useCallback(
    (): FormState => ({
      email: "",
      displayName: "",
      password: "",
      roleCode: "operator",
      status: "ACTIVE",
    }),
    [],
  );

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchCompanyUsers(query);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", items: res.data.items });
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      const res = await fetchBusinessRoles();
      if (res.ok) setRoles(res.data.items);
    })();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(row: CompanyUser) {
    setEditing(row);
    setForm({
      email: row.email,
      displayName: row.displayName,
      password: "",
      roleCode: row.roleCode ?? "operator",
      status: row.status,
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  async function onSave() {
    if (!form) return;
    setBusy(true);
    setFormError(null);
    try {
      if (!editing) {
        if (!form.password.trim() || form.password.trim().length < 8) {
          setFormError("Mot de passe obligatoire (8 caractères min.).");
          return;
        }
        const res = await createCompanyUser({
          email: form.email.trim(),
          displayName: form.displayName.trim(),
          password: form.password,
          roleCode: form.roleCode,
        });
        if (!res.ok) {
          setFormError(res.message);
          return;
        }
      } else {
        const res = await updateCompanyUser(editing.id, {
          displayName: form.displayName.trim(),
          status: form.status,
          roleCode: form.roleCode,
          ...(form.password.trim()
            ? { password: form.password.trim() }
            : {}),
        });
        if (!res.ok) {
          setFormError(res.message);
          return;
        }
      }
      setDrawerOpen(false);
      await load(q);
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = (code: string | null) =>
    roles.find((r) => r.code === code)?.label ?? code ?? "—";

  return (
    <>
      <AScreenHeader
        kicker="Identité"
        title="Utilisateurs"
        description="Comptes métier de la société active · rôles admin / opérateur"
        actions={
          <AButton type="button" size="sm" variant="secondary" onClick={openCreate}>
            Nouvel utilisateur
          </AButton>
        }
      />

      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="users-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="users-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="E-mail ou nom"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          </div>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(q)}
          >
            Filtrer
          </AButton>
        </div>

        {state.kind === "loading" ? (
          <div className="space-y-2">
            <ASkeleton className="h-10 w-full" />
            <ASkeleton className="h-10 w-full" />
          </div>
        ) : null}

        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}

        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(q)}
          />
        ) : null}

        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun utilisateur"
            description="Créez le premier compte pour cette société."
            actionLabel="Nouvel utilisateur"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)]">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="bg-a-surface-2 text-a-fg-muted">
                <tr>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Nom
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    E-mail
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Rôle
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Statut
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr key={row.id} className="hover:bg-a-surface-3/60">
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium text-a-fg">
                      {row.displayName}
                    </td>
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg-muted">
                      {row.email}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg">
                      {roleLabel(row.roleCode)}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <ABadge tone={statusTone(row.status)}>
                        {STATUS_LABELS[row.status]}
                      </ABadge>
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <AButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(row)}
                      >
                        Éditer
                      </AButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={editing ? "Éditer utilisateur" : "Nouvel utilisateur"}
        description="Affectation à la société active · rôle fixe admin / opérateur"
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDrawerOpen(false)}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || !form}
              onClick={() => void onSave()}
            >
              {busy ? "…" : "Enregistrer"}
            </AButton>
          </div>
        }
      >
        {form ? (
          <div className="space-y-4 p-4">
            {!editing ? (
              <Field label="E-mail">
                <AInput
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </Field>
            ) : (
              <p className="a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
                {form.email}
              </p>
            )}
            <Field label="Nom affiché">
              <AInput
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
              />
            </Field>
            <Field label="Rôle">
              <select
                className={selectClass}
                value={form.roleCode}
                onChange={(e) =>
                  setForm({ ...form, roleCode: e.target.value })
                }
              >
                {(roles.length
                  ? roles
                  : [
                      { code: "admin", label: "Administrateur" },
                      { code: "operator", label: "Opérateur" },
                    ]
                ).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            {editing ? (
              <Field label="Statut">
                <select
                  className={selectClass}
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as CompanyUserStatus,
                    })
                  }
                >
                  {(
                    Object.keys(STATUS_LABELS) as CompanyUserStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field
              label={
                editing
                  ? "Nouveau mot de passe (optionnel)"
                  : "Mot de passe initial"
              }
            >
              <AInput
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                minLength={editing ? undefined : 8}
              />
            </Field>
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
