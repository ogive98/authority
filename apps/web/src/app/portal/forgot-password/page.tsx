"use client";

import Link from "next/link";
import { AButton } from "@/components/a/a-button";
import { ASkipLink } from "@/components/a/a-skip-link";
import { CompanyBrandPlate } from "@/components/shell/company-brand-plate";
import { PORTAL_LOGIN_PATH } from "@/lib/customer-portal";

/**
 * Reset e-mail is not wired for portal. Honest contact ADV UX — no fake success.
 */
export default function PortalForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-a-surface-1 px-[var(--a-space-6)] text-a-fg">
      <ASkipLink href="#forgot" />
      <main
        id="forgot"
        className="flex w-full max-w-sm flex-col items-center space-y-[var(--a-space-5)]"
      >
        <CompanyBrandPlate variant="hero" href={PORTAL_LOGIN_PATH} />
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.08em] text-a-fg-subtle">
          Customer Portal
        </p>
        <p className="text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
          Mot de passe oublié
        </p>
        <div className="w-full space-y-4 rounded-[var(--a-radius-md)] bg-a-surface-2 p-[var(--a-space-5)]">
          <p className="text-[length:var(--a-text-md)] font-medium tracking-tight text-a-fg">
            Réinitialisation non disponible
          </p>
          <p className="text-[length:var(--a-text-sm)] leading-relaxed text-a-fg-muted">
            La réinitialisation automatique n’est pas encore branchée. Contactez
            votre commercial ou l’ADV pour réinitialiser l’accès.
          </p>
          <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
            En démo locale, utilisez le compte indiqué sur l’écran de connexion.
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
