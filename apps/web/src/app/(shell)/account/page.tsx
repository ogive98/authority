"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ABadge,
  AButton,
  AErrorState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { AccountAvatarCrop } from "./account-avatar-crop";
import {
  BUSINESS_LOGIN_PATH,
  clearBusinessAvatar,
  fetchBusinessContext,
  fetchBusinessMeClient,
  fetchMySessions,
  initialsFromName,
  listAssignedCompanies,
  resolveAvatarSrc,
  revokeMySession,
  setBusinessCompanyContext,
  updateBusinessMe,
  uploadBusinessAvatar,
  type BusinessCompany,
  type BusinessMe,
  type BusinessSession,
} from "@/lib/business-auth";

function statusTone(
  status: string,
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "INVITED":
      return "info";
    case "LOCKED":
      return "danger";
    case "DISABLED":
      return "neutral";
    default:
      return "neutral";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Actif";
    case "INVITED":
      return "Invité";
    case "LOCKED":
      return "Verrouillé";
    case "DISABLED":
      return "Désactivé";
    default:
      return status;
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fr-TN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Tunis",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

function shortUa(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return ua.slice(0, 48);
}

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<BusinessMe | null>(null);
  const [companies, setCompanies] = useState<BusinessCompany[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<BusinessSession[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("");
  const [timezone, setTimezone] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const minPwd = Math.max(6, me?.minPasswordLength ?? 8);
  const initials = me ? initialsFromName(me.displayName, me.email) : "?";
  const photoSrc = me ? resolveAvatarSrc(me) : null;

  const load = useCallback(async () => {
    setLoadError(null);
    const [res, cos, ctx, sess] = await Promise.all([
      fetchBusinessMeClient(),
      listAssignedCompanies(),
      fetchBusinessContext(),
      fetchMySessions(),
    ]);
    if (!res.ok) {
      setLoadError(res.message);
      setMe(null);
      return;
    }
    setMe(res.data);
    setDisplayName(res.data.displayName);
    setLocale(res.data.locale);
    setTimezone(res.data.timezone);
    setExternalUrl(
      res.data.avatarUrl?.startsWith("https://") ? res.data.avatarUrl : "",
    );
    if (cos.ok) setCompanies(cos.data);
    else setCompanies([]);
    setCompanyId(ctx.ok ? ctx.data.companyId : null);
    setSessions(sess.ok ? sess.data.items : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function onSaveProfile() {
    if (!me) return;
    setBusy(true);
    setFormError(null);
    setToast(null);
    const res = await updateBusinessMe({
      displayName: displayName.trim(),
      locale: locale.trim() || undefined,
      timezone: timezone.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setMe(res.data);
    setTimezone(res.data.timezone);
    setToast("Profil enregistré.");
  }

  async function onSaveExternalUrl() {
    if (!me) return;
    setAvatarBusy(true);
    setFormError(null);
    setToast(null);
    const raw = externalUrl.trim();
    const res = await updateBusinessMe({
      avatarUrl: raw || "",
    });
    setAvatarBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setMe(res.data);
    setToast(raw ? "URL photo enregistrée." : "Photo externe retirée.");
  }

  async function onSavePassword() {
    if (!me) return;
    setBusy(true);
    setFormError(null);
    setToast(null);
    if (password.trim().length < minPwd) {
      setBusy(false);
      setFormError(
        `Le nouveau mot de passe doit faire au moins ${minPwd} caractères.`,
      );
      return;
    }
    if (password !== passwordConfirm) {
      setBusy(false);
      setFormError("La confirmation ne correspond pas.");
      return;
    }
    if (!currentPassword.trim()) {
      setBusy(false);
      setFormError("Indiquez le mot de passe actuel.");
      return;
    }
    const res = await updateBusinessMe({
      currentPassword: currentPassword.trim(),
      password: password.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCurrentPassword("");
    setPassword("");
    setPasswordConfirm("");
    setToast("Mot de passe mis à jour.");
  }

  async function onCropped(blob: Blob) {
    setCropFile(null);
    setAvatarBusy(true);
    setFormError(null);
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const res = await uploadBusinessAvatar(file);
    setAvatarBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setMe(res.data);
    setExternalUrl("");
    setToast("Photo mise à jour.");
  }

  async function onClearAvatar() {
    setAvatarBusy(true);
    setFormError(null);
    const res = await clearBusinessAvatar();
    setAvatarBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setMe(res.data);
    setExternalUrl("");
    setToast("Photo retirée — Gravatar / initiales.");
  }

  async function onCompanyChange(nextId: string) {
    setBusy(true);
    setFormError(null);
    const res = await setBusinessCompanyContext(nextId);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCompanyId(nextId);
    setToast("Société active mise à jour.");
    void load();
    router.refresh();
  }

  async function onRevokeSession(row: BusinessSession) {
    setFormError(null);
    const res = await revokeMySession(row.id);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    if (row.current) {
      router.replace(BUSINESS_LOGIN_PATH);
      router.refresh();
      return;
    }
    setToast("Session révoquée.");
    const sess = await fetchMySessions();
    if (sess.ok) setSessions(sess.data.items);
  }

  return (
    <>
      <AScreenHeader
        kicker="Identité"
        title="Mon compte"
        description="Photo, société, sessions et sécurité."
        actions={
          me?.roleLabel || me?.roleCode ? (
            <ABadge tone="info" title={me.roleCode ?? undefined}>
              {me.roleLabel ?? me.roleCode}
            </ABadge>
          ) : null
        }
      />

      {cropFile ? (
        <AccountAvatarCrop
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCropped={(b) => void onCropped(b)}
        />
      ) : null}

      <div className="mx-auto max-w-lg space-y-6 px-6 pb-16 pt-2 md:px-10">
        {loadError ? (
          <AErrorState
            message={loadError}
            retryable
            onRetry={() => void load()}
          />
        ) : null}
        {!me && !loadError ? <ASkeleton className="h-48 w-full" /> : null}

        {toast ? (
          <p
            className="rounded-[10px] bg-a-success-soft px-3 py-2 text-center text-[length:var(--a-text-sm)] text-a-success-fg"
            role="status"
          >
            {toast}
          </p>
        ) : null}
        {formError ? (
          <p
            className="rounded-[10px] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        {me ? (
          <>
            <section className="space-y-5 a-underlay rounded-md p-5">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="relative shrink-0">
                  {photoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoSrc}
                      alt=""
                      className="h-24 w-24 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span
                      className="flex h-24 w-24 items-center justify-center rounded-full bg-a-accent-muted text-[length:var(--a-text-lg)] font-semibold tracking-tight text-a-accent"
                      aria-hidden
                    >
                      {initials}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <p className="text-[length:var(--a-text-lg)] font-medium text-a-fg">
                      {me.displayName}
                    </p>
                    <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                      {me.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <ABadge tone={statusTone(me.status)}>
                      {statusLabel(me.status)}
                    </ABadge>
                    <ABadge tone={me.mfaEnabled ? "success" : "neutral"}>
                      {me.mfaEnabled ? "MFA actif" : "MFA off"}
                    </ABadge>
                    {!me.avatarUrl && me.gravatarUrl ? (
                      <ABadge tone="neutral">Gravatar</ABadge>
                    ) : null}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) setCropFile(f);
                    }}
                  />
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <AButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={avatarBusy}
                      onClick={() => fileRef.current?.click()}
                    >
                      {avatarBusy ? "…" : "Changer la photo"}
                    </AButton>
                    {me.avatarUrl ? (
                      <AButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={avatarBusy}
                        onClick={() => void onClearAvatar()}
                      >
                        Retirer
                      </AButton>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="acc-avatar-url"
                  className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                >
                  URL photo (https)
                </label>
                <div className="flex flex-wrap gap-2">
                  <AInput
                    id="acc-avatar-url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://…"
                    className="a-mono min-w-0 flex-1"
                  />
                  <AButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={avatarBusy}
                    onClick={() => void onSaveExternalUrl()}
                  >
                    Appliquer
                  </AButton>
                </div>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  Sinon fichier local (crop) · sinon Gravatar · sinon initiales.
                </p>
              </div>

              <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2.5 text-[length:var(--a-text-sm)]">
                <dt className="text-a-fg-muted">Rôle</dt>
                <dd className="text-a-fg">
                  {me.roleLabel ?? me.roleCode ?? "—"}
                </dd>
                <dt className="text-a-fg-muted">Membre depuis</dt>
                <dd className="a-mono text-a-fg">
                  {formatWhen(me.createdAt)}
                </dd>
                <dt className="text-a-fg-muted">Dernière connexion</dt>
                <dd className="text-a-fg">
                  <span className="a-mono">{formatWhen(me.lastLoginAt)}</span>
                  {me.lastLoginIp ? (
                    <span className="a-mono text-a-fg-subtle">
                      {" "}
                      · {me.lastLoginIp}
                    </span>
                  ) : null}
                </dd>
              </dl>
            </section>

            {companies.length > 0 ? (
              <section className="space-y-3 a-underlay rounded-md p-5">
                <h2 className="text-[length:var(--a-text-md)] font-medium text-a-fg">
                  Société active
                </h2>
                {companies.length === 1 ? (
                  <p className="text-[length:var(--a-text-sm)] text-a-fg">
                    {companies[0]!.legalName || companies[0]!.code}
                  </p>
                ) : (
                  <select
                    className="h-9 w-full rounded-[10px] bg-a-surface-3 px-3 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2"
                    value={companyId ?? ""}
                    disabled={busy}
                    onChange={(e) => void onCompanyChange(e.target.value)}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.legalName || c.code}
                      </option>
                    ))}
                  </select>
                )}
              </section>
            ) : null}

            <section className="space-y-4 a-underlay rounded-md p-5">
              <h2 className="text-[length:var(--a-text-md)] font-medium text-a-fg">
                Informations
              </h2>
              <div className="space-y-1">
                <label
                  htmlFor="acc-name"
                  className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                >
                  Nom affiché
                </label>
                <AInput
                  id="acc-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="acc-locale"
                    className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                  >
                    Locale
                  </label>
                  <AInput
                    id="acc-locale"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    placeholder="fr-TN"
                    className="a-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="acc-tz"
                    className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                  >
                    Fuseau
                  </label>
                  <AInput
                    id="acc-tz"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Africa/Tunis"
                    className="a-mono"
                  />
                </div>
              </div>
              <AButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || !displayName.trim() || !timezone.trim()}
                onClick={() => void onSaveProfile()}
              >
                {busy ? "…" : "Enregistrer"}
              </AButton>
            </section>

            <section className="space-y-3 a-underlay rounded-md p-5">
              <h2 className="text-[length:var(--a-text-md)] font-medium text-a-fg">
                Sessions actives
              </h2>
              {sessions.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucune session listée.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-a-surface-3/80 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[length:var(--a-text-sm)] text-a-fg">
                          {shortUa(s.userAgent)}
                          {s.current ? (
                            <ABadge tone="success" className="ml-2">
                              Cet appareil
                            </ABadge>
                          ) : null}
                        </p>
                        <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                          {s.ip ?? "—"} · {formatWhen(s.createdAt)}
                        </p>
                      </div>
                      <AButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void onRevokeSession(s)}
                      >
                        Révoquer
                      </AButton>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3 a-underlay rounded-md p-5">
              <h2 className="text-[length:var(--a-text-md)] font-medium text-a-fg">
                Raccourcis
              </h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/settings"
                  className="rounded-[10px] bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg hover:bg-a-surface-4"
                >
                  Préférences
                </Link>
                <Link
                  href="/settings"
                  className="rounded-[10px] bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg hover:bg-a-surface-4"
                >
                  Apparence / densité
                </Link>
              </div>
            </section>

            <section className="space-y-4 a-underlay rounded-md p-5">
              <div>
                <h2 className="text-[length:var(--a-text-md)] font-medium text-a-fg">
                  Mot de passe
                </h2>
                <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  Minimum {minPwd} caractères (Préférences → Envois).
                </p>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="acc-cur"
                  className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                >
                  Mot de passe actuel
                </label>
                <AInput
                  id="acc-cur"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="acc-new"
                  className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                >
                  Nouveau mot de passe
                </label>
                <AInput
                  id="acc-new"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={minPwd}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="acc-confirm"
                  className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                >
                  Confirmer
                </label>
                <AInput
                  id="acc-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  minLength={minPwd}
                />
              </div>
              <AButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void onSavePassword()}
              >
                {busy ? "…" : "Changer le mot de passe"}
              </AButton>
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
