"use client";

import Link from "next/link";
import { AButton } from "@/components/a/a-button";
import { ASkipLink } from "@/components/a/a-skip-link";
import { PORTAL_LOGIN_PATH } from "@/lib/customer-portal";

/**
 * Reset e-mail is not wired (no SMTP). Honest contact ADV UX — no fake success.
 */
export default function PortalForgotPasswordPage() {
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
        <div className="space-y-4 rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-[var(--a-space-5)]">
          <p className="text-[length:var(--a-text-sm)] text-a-fg">
            La réinitialisation automatique n’est pas encore disponible.
          </p>
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Contactez votre commercial ou l’ADV pour réinitialiser l’accès.
            En démo, utilisez le compte indiqué sur l’écran de connexion.
          </p>
          <Link href={PORTAL_LOGIN_PATH} className="block">
            <AButton type="button" className="w-full">
              Retour à la connexion
            </AButton>
          </Link>
        </div>
      </main>
    </div>
  );
}
