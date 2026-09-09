"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AButton,
  AErrorState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  fetchBusinessMeClient,
  updateBusinessMe,
  type BusinessMe,
} from "@/lib/business-auth";

export default function AccountPage() {
  const [me, setMe] = useState<BusinessMe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetchBusinessMeClient();
    if (!res.ok) {
      setLoadError(res.message);
      setMe(null);
      return;
    }
    setMe(res.data);
    setDisplayName(res.data.displayName);
    setLocale(res.data.locale);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveProfile() {
    if (!me) return;
    setBusy(true);
    setFormError(null);
    setToast(null);
    const res = await updateBusinessMe({
      displayName: displayName.trim(),
      locale: locale.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setMe(res.data);
    setToast("Profil enregistré.");
  }

  async function onSavePassword() {
    if (!me) return;
    setBusy(true);
    setFormError(null);
    setToast(null);
    if (password.trim().length < 8) {
      setBusy(false);
      setFormError("Le nouveau mot de passe doit faire au moins 8 caractères.");
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

  return (
    <>
      <AScreenHeader
        kicker="Identité"
        title="Mon compte"
        description="Modifier votre profil et votre mot de passe"
      />

      <div className="mx-auto max-w-lg space-y-8 px-6 pb-16 pt-2 md:px-10">
        {loadError ? (
          <AErrorState message={loadError} retryable onRetry={() => void load()} />
        ) : null}
        {!me && !loadError ? <ASkeleton className="h-48 w-full" /> : null}

        {me ? (
          <>
            <section className="space-y-4 rounded-[14px] bg-a-surface-2 p-5">
              <h2 className="text-[15px] font-medium text-a-fg">Profil</h2>
              <p className="a-mono text-[12px] text-a-fg-subtle">{me.email}</p>
              <div className="space-y-1">
                <label
                  htmlFor="acc-name"
                  className="text-[13px] text-a-fg-muted"
                >
                  Nom affiché
                </label>
                <AInput
                  id="acc-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="acc-locale"
                  className="text-[13px] text-a-fg-muted"
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
              <AButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || !displayName.trim()}
                onClick={() => void onSaveProfile()}
              >
                {busy ? "…" : "Enregistrer le profil"}
              </AButton>
            </section>

            <section className="space-y-4 rounded-[14px] bg-a-surface-2 p-5">
              <h2 className="text-[15px] font-medium text-a-fg">
                Mot de passe
              </h2>
              <div className="space-y-1">
                <label
                  htmlFor="acc-cur"
                  className="text-[13px] text-a-fg-muted"
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
                  className="text-[13px] text-a-fg-muted"
                >
                  Nouveau mot de passe
                </label>
                <AInput
                  id="acc-new"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="acc-confirm"
                  className="text-[13px] text-a-fg-muted"
                >
                  Confirmer
                </label>
                <AInput
                  id="acc-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  minLength={8}
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

        {formError ? (
          <p className="text-[13px] text-a-danger" role="alert">
            {formError}
          </p>
        ) : null}
        {toast ? (
          <p className="text-[13px] text-a-fg-muted" role="status">
            {toast}
          </p>
        ) : null}
      </div>
    </>
  );
}
