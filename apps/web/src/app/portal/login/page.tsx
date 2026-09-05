"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { ASkipLink } from "@/components/a/a-skip-link";
import { PORTAL_API, PORTAL_HOME_PATH } from "@/lib/customer-portal";

const DEMO_HINT =
  process.env.NODE_ENV === "development"
    ? { email: "portal@authority.local", password: "PortalPass123!" }
    : null;

function errorMessage(body: { message?: string | string[] }): string {
  if (Array.isArray(body.message)) return body.message.join(" ");
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }
  return "Connexion refusée.";
}

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_HINT?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(PORTAL_API.login, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
        realm?: string;
      };
      if (res.ok && body.realm === "customer_portal") {
        router.replace(PORTAL_HOME_PATH);
        router.refresh();
        return;
      }
      setError(errorMessage(body));
    } catch {
      setError(
        "API indisponible. Vérifiez que le serveur AUTHORITY (API) tourne.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-a-surface-1 px-[var(--a-space-6)] text-a-fg">
      <ASkipLink href="#login" />
      <main id="login" className="w-full max-w-sm space-y-[var(--a-space-5)]">
        <p className="text-center text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
          Customer Portal
        </p>
        <h1 className="text-center text-[length:var(--a-text-xl)] font-medium tracking-tight">
          AUTHORITY <span className="text-a-accent">Portal</span>
        </h1>
        <p className="text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
          Espace client B2B · session séparée du login métier
        </p>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-[var(--a-space-5)]"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="portal-email"
              className="text-[length:var(--a-text-sm)] font-medium"
            >
              E-mail professionnel
            </label>
            <AInput
              id="portal-email"
              type="email"
              autoComplete="username"
              placeholder="vous@entreprise.tn"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
            <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
              Utilisez l’adresse fournie par votre commercial / ADV.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="portal-password"
                className="text-[length:var(--a-text-sm)] font-medium"
              >
                Mot de passe
              </label>
              <Link
                href="/portal/forgot-password"
                className="text-[length:var(--a-text-xs)] text-a-accent hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <AInput
                id="portal-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-10"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-a-fg-muted hover:text-a-fg"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
              Au moins 8 caractères. Conservez-le confidentiel.
            </p>
          </div>

          {error ? (
            <p
              className="text-[length:var(--a-text-sm)] text-a-danger"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <AButton type="submit" className="w-full" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </AButton>
        </form>

        {DEMO_HINT ? (
          <div className="rounded-[var(--a-radius-md)] border border-dashed border-a-border-subtle bg-a-surface-2/60 px-3 py-2.5 text-center text-[length:var(--a-text-xs)] text-a-fg-muted">
            <p className="font-medium text-a-fg">Démo locale</p>
            <p className="mt-1 a-mono">
              {DEMO_HINT.email} · {DEMO_HINT.password}
            </p>
            <p className="mt-1">
              Rempli après{" "}
              <span className="a-mono">prisma db seed</span> (API démarrée).
            </p>
          </div>
        ) : (
          <p className="text-center text-[length:var(--a-text-xs)] text-a-fg-subtle">
            Problème d’accès ? Contactez votre interlocuteur commercial.
          </p>
        )}
      </main>
    </div>
  );
}
