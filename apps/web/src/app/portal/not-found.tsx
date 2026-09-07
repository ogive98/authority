import Link from "next/link";
import { PORTAL_LOGIN_PATH } from "@/lib/customer-portal";

export default function PortalNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-a-surface-1 px-6 text-a-fg">
      <h1 className="text-[length:var(--a-text-xl)] font-medium">
        Page introuvable
      </h1>
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Ressource absente ou accès refusé.
      </p>
      <Link
        href={PORTAL_LOGIN_PATH}
        className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
      >
        Connexion portal →
      </Link>
    </div>
  );
}
