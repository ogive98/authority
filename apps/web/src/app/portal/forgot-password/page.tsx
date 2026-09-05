"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { ASkipLink } from "@/components/a/a-skip-link";
import { PORTAL_LOGIN_PATH } from "@/lib/customer-portal";

export default function PortalForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Stub P1 — pas d’envoi SMTP en démo ; message neutre anti-énumération
    await new Promise((r) => setTimeout(r, 400));
    setSent(true);
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-a-surface-1 px-[var(--a-space-6)] text-a-fg">
      <ASkipLink href="#forgot" />
      <main id="forgot" className="w-full max-w-sm space-y-[var(--a-space-5)]">
        <p className="text-center text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
          Customer Portal
        </p>
        <h1 className="text-center text-[length:var(--a-text-xl)] font-medium tracking-tight">
          Mot de passe oublié
        </h1>
        <p className="text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
          Indiquez l’e-mail de votre compte portal. Si un compte existe, les
          instructions de réinitialisation seront envoyées.
        </p>

        {sent ? (
          <div className="space-y-4 rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-[var(--a-space-5)]">
            <p className="text-[length:var(--a-text-sm)] text-a-fg">
              Si un compte est associé à{" "}
              <span className="font-medium">{email}</span>, vous recevrez un
              message sous peu.
            </p>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              En environnement démo, l’e-mail n’est pas encore branché. Demandez
              une réinitialisation à votre commercial / ADV, ou utilisez le
              compte de démonstration sur l’écran de connexion.
            </p>
            <Link
              href={PORTAL_LOGIN_PATH}
              className="inline-flex w-full justify-center text-[length:var(--a-text-sm)] text-a-accent hover:underline"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="space-y-4 rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-[var(--a-space-5)]"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="forgot-email"
                className="text-[length:var(--a-text-sm)] font-medium"
              >
                E-mail professionnel
              </label>
              <AInput
                id="forgot-email"
                type="email"
                autoComplete="username"
                placeholder="vous@entreprise.tn"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>
            <AButton type="submit" className="w-full" disabled={busy}>
              {busy ? "Envoi…" : "Envoyer le lien"}
            </AButton>
            <p className="text-center text-[length:var(--a-text-xs)] text-a-fg-subtle">
              <Link
                href={PORTAL_LOGIN_PATH}
                className="text-a-accent hover:underline"
              >
                Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
