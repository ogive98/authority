"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  AListUtilities,
  APageBody,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  ASwitch,
  erpListDescription,
} from "@/components/a";
import { softSelect } from "@/lib/soft-glass-ui";
import { ATabs } from "@/components/a/a-tabs";
import {
  STATUS_LABELS,
  createCompanyUser,
  fetchBusinessRoles,
  fetchCompanyUsers,
  fetchUserGrants,
  inviteCompanyUser,
  fetchMailStatus,
  putUserGrants,
  reinviteCompanyUser,
  updateCompanyUser,
  type BusinessRole,
  type CompanyUser,
  type CompanyUserStatus,
  type InviteIssue,
  type MailStatus,
  type UserGrants,
} from "@/lib/users";

const STATUS_FILTERS: { id: "" | CompanyUserStatus; label: string }[] = [
  { id: "", label: "Tous" },
  { id: "INVITED", label: "Invités" },
  { id: "ACTIVE", label: "Actifs" },
  { id: "LOCKED", label: "Verrouillés" },
  { id: "DISABLED", label: "Désactivés" },
];

const FALLBACK_ROLES: BusinessRole[] = [
  {
    code: "admin",
    label: "Administrateur",
    description: "Utilisateurs et Préférences société",
  },
  {
    code: "accountant",
    label: "Comptable",
    description: "Finance / compta — pas users ni Préférences",
  },
  {
    code: "operator",
    label: "Opérateur",
    description: "Stock / livraison — pas users ni Préférences",
  },
];

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
  const [statusFilter, setStatusFilter] = useState<"" | CompanyUserStatus>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyUser | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [grantsMeta, setGrantsMeta] = useState<UserGrants | null>(null);
  const [grantKeys, setGrantKeys] = useState<Set<string>>(new Set());
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [createMode, setCreateMode] = useState<"invite" | "password">(
    "invite",
  );
  const [inviteResult, setInviteResult] = useState<InviteIssue | null>(null);
  const [copied, setCopied] = useState(false);
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null);

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
    void (async () => {
      const res = await fetchMailStatus();
      if (res.ok) setMailStatus(res.data);
    })();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setGrantsMeta(null);
    setGrantKeys(new Set());
    setCreateMode("invite");
    setInviteResult(null);
    setCopied(false);
    setDrawerOpen(true);
  }

  async function openEdit(row: CompanyUser) {
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
    setInviteResult(null);
    setGrantsLoading(true);
    const g = await fetchUserGrants(row.id);
    setGrantsLoading(false);
    if (g.ok) {
      setGrantsMeta(g.data);
      setGrantKeys(new Set(g.data.companyUserAllow));
    } else {
      setGrantsMeta(null);
      setGrantKeys(new Set());
    }
  }

  async function onSave() {
    if (!form) return;
    setBusy(true);
    setFormError(null);
    try {
      if (!editing) {
        if (createMode === "invite") {
          const res = await inviteCompanyUser({
            email: form.email.trim(),
            displayName: form.displayName.trim(),
            roleCode: form.roleCode,
          });
          if (!res.ok) {
            setFormError(res.message);
            return;
          }
          setInviteResult(res.data);
          setCopied(false);
          await load(q);
          return;
        }
        if (
          !form.password.trim() ||
          form.password.trim().length <
            (mailStatus?.minPasswordLength ?? 8)
        ) {
          setFormError(
            `Mot de passe obligatoire (${mailStatus?.minPasswordLength ?? 8} caractères min.).`,
          );
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
        if (
          form.password.trim() &&
          form.password.trim().length <
            (mailStatus?.minPasswordLength ?? 8)
        ) {
          setFormError(
            `Mot de passe : ${mailStatus?.minPasswordLength ?? 8} caractères min.`,
          );
          return;
        }
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
        if (grantsMeta) {
          const gRes = await putUserGrants(editing.id, [...grantKeys]);
          if (!gRes.ok) {
            setFormError(gRes.message);
            return;
          }
        }
      }
      setDrawerOpen(false);
      await load(q);
    } finally {
      setBusy(false);
    }
  }

  async function onReinvite(row: CompanyUser) {
    setBusy(true);
    setFormError(null);
    try {
      const res = await reinviteCompanyUser(row.id);
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setEditing(null);
      setForm({
        email: row.email,
        displayName: row.displayName,
        password: "",
        roleCode: row.roleCode ?? "operator",
        status: row.status,
      });
      setInviteResult(res.data);
      setCopied(false);
      setDrawerOpen(true);
    } finally {
      setBusy(false);
    }
  }

  function toggleGrant(key: string, on: boolean) {
    setGrantKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  const roleLabel = (code: string | null) =>
    roles.find((r) => r.code === code)?.label ??
    FALLBACK_ROLES.find((r) => r.code === code)?.label ??
    code ??
    "—";

  const roleTone = (
    code: string | null,
  ): "success" | "warning" | "danger" | "neutral" => {
    switch (code) {
      case "admin":
        return "warning";
      case "accountant":
        return "success";
      case "operator":
        return "neutral";
      default:
        return "neutral";
    }
  };

  const visibleItems = useMemo(() => {
    if (state.kind !== "ok") return [];
    if (!statusFilter) return state.items;
    return state.items.filter((u) => u.status === statusFilter);
  }, [state, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { "": 0 };
    for (const s of [
      "INVITED",
      "ACTIVE",
      "LOCKED",
      "DISABLED",
    ] as CompanyUserStatus[]) {
      counts[s] = 0;
    }
    if (state.kind !== "ok") return counts;
    counts[""] = state.items.length;
    for (const u of state.items) {
      counts[u.status] = (counts[u.status] ?? 0) + 1;
    }
    return counts;
  }, [state]);

  return (
    <>
      <AScreenHeader
        kicker="Identité"
        title="Utilisateurs"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "invitation lien / mot de passe · Admin / Comptable / Opérateur",
        )}
        status={
          mailStatus ? (
            <ABadge
              tone={mailStatus.configured ? "success" : "neutral"}
              title={
                mailStatus.configured
                  ? [
                      mailStatus.host,
                      mailStatus.port != null ? `:${mailStatus.port}` : "",
                      mailStatus.from ? ` · ${mailStatus.from}` : "",
                      mailStatus.autoSend ? " · auto-send" : " · auto-send off",
                      ` · TTL ${mailStatus.ttlDays}j`,
                    ].join("")
                  : `SMTP off · mailto · TTL ${mailStatus.ttlDays}j`
              }
            >
              {mailStatus.configured
                ? `${mailStatus.from ? `SMTP · ${mailStatus.from}` : `SMTP · ${mailStatus.host}`}${
                    mailStatus.autoSend ? "" : " · manuel"
                  }`
                : "SMTP off · mailto"}
            </ABadge>
          ) : null
        }
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouvel utilisateur
          </AButton>
        }
      />

      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="users-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="E-mail ou nom"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          }
          filters={
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                setStatusFilter(
                  (id === "all" ? "" : id) as "" | CompanyUserStatus,
                );
              }}
              items={STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label:
                  state.kind === "ok"
                    ? `${chip.label} (${statusCounts[chip.id] ?? 0})`
                    : chip.label,
              }))}
            />
          }
          utilities={<AListUtilities onFilter={() => void load(q)} />}
        />

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
            description="Créez un compte avec e-mail, rôle et mot de passe initial."
            actionLabel="Nouvel utilisateur"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" &&
        state.items.length > 0 &&
        visibleItems.length === 0 ? (
          <AEmptyState
            title="Aucun résultat"
            description="Aucun compte pour ce filtre de statut."
          />
        ) : null}

        {state.kind === "ok" && visibleItems.length > 0 ? (
          <ASoftTable className="min-w-[40rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>Nom</ASoftTh>
                <ASoftTh>E-mail</ASoftTh>
                <ASoftTh>Rôle</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh>Actions</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {visibleItems.map((row) => (
                <ASoftTr key={row.id}>
                  <ASoftTd className="font-medium text-a-fg">
                    {row.displayName}
                  </ASoftTd>
                  <ASoftTd className="a-mono text-a-fg-muted">
                    {row.email}
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={roleTone(row.roleCode)}>
                      {roleLabel(row.roleCode)}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd>
                    <div className="space-y-0.5">
                      <ABadge
                        tone={
                          row.status === "INVITED" &&
                          row.inviteExpiresAt &&
                          Date.parse(row.inviteExpiresAt) < Date.now()
                            ? "danger"
                            : statusTone(row.status)
                        }
                      >
                        {STATUS_LABELS[row.status]}
                      </ABadge>
                      {row.status === "INVITED" && row.inviteExpiresAt ? (
                        <p className="text-[11px] text-a-fg-muted">
                          {Date.parse(row.inviteExpiresAt) < Date.now()
                            ? "Lien expiré"
                            : `Expire le ${new Date(
                                row.inviteExpiresAt,
                              ).toLocaleDateString("fr-TN")}`}
                        </p>
                      ) : null}
                    </div>
                  </ASoftTd>
                  <ASoftTd>
                    <div className="flex flex-wrap gap-2">
                      <AButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(row)}
                      >
                        Éditer
                      </AButton>
                      {row.status === "INVITED" ? (
                        <AButton
                          type="button"
                          variant={
                            row.inviteExpiresAt &&
                            Date.parse(row.inviteExpiresAt) < Date.now()
                              ? "primary"
                              : "secondary"
                          }
                          size="sm"
                          disabled={busy}
                          onClick={() => void onReinvite(row)}
                        >
                          {row.inviteExpiresAt &&
                          Date.parse(row.inviteExpiresAt) < Date.now()
                            ? "Renvoyer (expiré)"
                            : "Renvoyer"}
                        </AButton>
                      ) : null}
                    </div>
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setInviteResult(null);
        }}
        title={
          inviteResult
            ? "Lien d’invitation"
            : editing
              ? "Éditer utilisateur"
              : "Nouvel utilisateur"
        }
        description={
          inviteResult
            ? "Copiez le lien, Outlook, ou e-mail SMTP si configuré"
            : "Affectation à la société active · rôles Admin / Comptable / Opérateur"
        }
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setDrawerOpen(false);
                setInviteResult(null);
              }}
            >
              {inviteResult ? "Fermer" : "Annuler"}
            </AButton>
            {!inviteResult ? (
              <AButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || !form}
                onClick={() => void onSave()}
              >
                {busy
                  ? "…"
                  : !editing && createMode === "invite"
                    ? "Inviter"
                    : "Enregistrer"}
              </AButton>
            ) : null}
          </div>
        }
      >
        {inviteResult ? (
          <div className="space-y-4 p-4">
            {inviteResult.alreadyActive ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg">
                Compte déjà actif — affecté à la société (pas de nouvelle
                invitation).
              </p>
            ) : (
              <>
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  {inviteResult.user.displayName} · {inviteResult.user.email}
                </p>
                {inviteResult.emailSent ? (
                  <p
                    className="rounded-[8px] bg-a-success-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-success-fg"
                    role="status"
                  >
                    {mailStatus?.from
                      ? `E-mail d’invitation envoyé depuis ${mailStatus.from}.`
                      : "E-mail d’invitation envoyé via SMTP."}
                  </p>
                ) : inviteResult.smtpConfigured && inviteResult.emailError ? (
                  <p
                    className="rounded-[8px] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg"
                    role="alert"
                  >
                    SMTP configuré
                    {mailStatus?.from ? ` (${mailStatus.from})` : ""} mais envoi
                    échoué : {inviteResult.emailError}. Utilisez Copier /
                    Outlook.
                  </p>
                ) : (
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    SMTP non configuré — Copier le lien ou Ouvrir Outlook.
                    (Variables SMTP_* dans .env)
                  </p>
                )}
                {inviteResult.inviteUrl ? (
                  <p className="a-mono break-all rounded-[8px] bg-a-surface-3 px-3 py-2 text-[12px] text-a-fg">
                    {inviteResult.inviteUrl}
                  </p>
                ) : null}
                {inviteResult.expiresAt ? (
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Valide jusqu’au{' '}
                    {new Date(inviteResult.expiresAt).toLocaleString('fr-TN')}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {inviteResult.inviteUrl ? (
                    <AButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(inviteResult.inviteUrl!)
                          .then(() => setCopied(true));
                      }}
                    >
                      {copied ? "Copié" : "Copier le lien"}
                    </AButton>
                  ) : null}
                  {inviteResult.mailtoHref ? (
                    <AButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        window.location.href = inviteResult.mailtoHref!;
                      }}
                    >
                      Ouvrir Outlook
                    </AButton>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : form ? (
          <div className="space-y-4 p-4">
            {!editing ? (
              <Field label="Mode">
                <select
                  className={softSelect}
                  value={createMode}
                  onChange={(e) =>
                    setCreateMode(e.target.value as "invite" | "password")
                  }
                >
                  <option value="invite">Invitation (lien + Outlook)</option>
                  <option value="password">Mot de passe immédiat</option>
                </select>
              </Field>
            ) : null}
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
                className={softSelect}
                value={form.roleCode}
                onChange={(e) =>
                  setForm({ ...form, roleCode: e.target.value })
                }
              >
                {(roles.length ? roles : FALLBACK_ROLES).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            {editing ? (
              <Field label="Statut">
                <select
                  className={softSelect}
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as CompanyUserStatus,
                    })
                  }
                >
                  {(
                    [
                      "ACTIVE",
                      "LOCKED",
                      "DISABLED",
                      ...(form.status === "INVITED"
                        ? (["INVITED"] as const)
                        : []),
                    ] as CompanyUserStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {editing || createMode === "password" ? (
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
                  minLength={
                    editing
                      ? undefined
                      : (mailStatus?.minPasswordLength ?? 8)
                  }
                />
                {!editing ? (
                  <p className="mt-1.5 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Vous définissez le mot de passe ici (
                    {mailStatus?.minPasswordLength ?? 8} caractères min.) et le
                    transmettez à la personne.
                  </p>
                ) : form.status === "INVITED" ? (
                  <p className="mt-1.5 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Saisir un mot de passe active le compte et invalide le lien
                    d’invitation.
                  </p>
                ) : null}
              </Field>
            ) : (
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Un lien d’activation (
                {mailStatus?.ttlDays ?? 7} jours) sera généré. Envoi SMTP selon
                Préférences → Envois (auto-send
                {mailStatus?.autoSend === false ? " désactivé" : ""}
                ) — sinon Copier / Outlook.
              </p>
            )}

            {editing ? (
              <div className="space-y-3 border-t border-transparent pt-4">
                <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                  Droits société (USER)
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Les droits du rôle ({roleLabel(form.roleCode)}) s’ajoutent
                  automatiquement. Cases = droits directs sur cette société.
                </p>
                {grantsLoading ? <ASkeleton className="h-24 w-full" /> : null}
                {!grantsLoading && grantsMeta ? (
                  <ul className="max-h-[40vh] space-y-1 overflow-y-auto">
                    {grantsMeta.catalog.map((key) => {
                      const protectedKey =
                        grantsMeta.protectedKeys.includes(key);
                      const viaRole = grantsMeta.roleAllow.includes(key);
                      const checked = grantKeys.has(key) || protectedKey;
                      return (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 hover:bg-a-surface-3"
                        >
                          <span className="min-w-0">
                            <span className="a-mono block text-[12px] text-a-fg">
                              {key}
                            </span>
                            {viaRole ? (
                              <span className="text-[10px] text-a-fg-subtle">
                                via rôle
                              </span>
                            ) : null}
                            {protectedKey ? (
                              <span className="text-[10px] text-a-fg-subtle">
                                protégé
                              </span>
                            ) : null}
                          </span>
                          <ASwitch
                            size="sm"
                            label={key}
                            checked={checked}
                            disabled={protectedKey || busy}
                            onCheckedChange={(on) => toggleGrant(key, on)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}

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
