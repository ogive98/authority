"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { ASkipLink } from "@/components/a/a-skip-link";
import { CompanyBrandPlate } from "@/components/shell/company-brand-plate";
import {
  EMPLOYEE_PORTAL_API,
  EMPLOYEE_PORTAL_HOME_PATH,
} from "@/lib/employee-portal";

const DEMO_HINT =
  process.env.NODE_ENV === "development"
    ? { email: "demo@authority.local", password: "DemoPass123!" }
    : null;

function errorMessage(body: { message?: string | string[] }): string {
  if (Array.isArray(body.message)) return body.message.join(" ");
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }
  return "Connexion refusée.";
}

export default function EmployeePortalLoginPage() {
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
      const res = await fetch(EMPLOYEE_PORTAL_API.login, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(12_000),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
        realm?: string;
        code?: string;
      };
      if (res.ok && body.realm === "employee_portal") {
        router.replace(EMPLOYEE_PORTAL_HOME_PATH);
        router.refresh();
        return;
      }
      if (res.status === 403 && body.code === "IAM.LOCKED") {
        setError(
          "Compte verrouillé après trop d’échecs. Réessayez plus tard ou contactez un admin.",
        );
        return;
      }
      setError(errorMessage(body));
    } catch (err) {
      const timedOut =
        err instanceof DOMException && err.name === "TimeoutError";
      setError(
        timedOut
          ? "Délai dépassé — l’API ne répond pas. Vérifiez que le serveur AUTHORITY tourne."
          : "API indisponible. Vérifiez que le serveur AUTHORITY (API) tourne.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-a-surface-1 px-[var(--a-space-6)] text-a-fg">
      <ASkipLink href="#login" />
      <main
        id="login"
        className="flex w-full max-w-sm flex-col items-center space-y-[var(--a-space-5)]"
      >
        <CompanyBrandPlate variant="hero" href="/employee-portal/login" />
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.08em] text-a-fg-subtle">
          Employee Portal
        </p>
        <p className="text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
          Congés salarié · session séparée du login métier
        </p>

        <form
          onSubmit={submit}
          className="w-full space-y-4 rounded-[14px] bg-a-surface-2 p-[var(--a-space-5)]"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="employee-portal-email"
              className="text-[length:var(--a-text-sm)] font-medium"
            >
              E-mail
            </label>
            <AInput
              id="employee-portal-email"
              type="email"
              autoComplete="username"
              placeholder="vous@entreprise.tn"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
            <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
              Compte Identity lié à une fiche employé (HrEmployee.userId).
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="employee-portal-password"
              className="text-[length:var(--a-text-sm)] font-medium"
            >
              Mot de passe
            </label>
            <div className="relative">
              <AInput
                id="employee-portal-password"
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
          </div>

          {error ? (
            <p
              className="rounded-[10px] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg"
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
          <div className="w-full rounded-[10px] bg-a-surface-2/60 px-3 py-2.5 text-center text-[length:var(--a-text-xs)] text-a-fg-muted">
            <p className="font-medium text-a-fg">Démo locale</p>
            <p className="mt-1 a-mono">
              {DEMO_HINT.email} · {DEMO_HINT.password}
            </p>
            <p className="mt-1">
              Après <span className="a-mono">prisma db seed</span> — employé
              EMP-DEMO lié.
            </p>
            <p className="mt-2">
              <Link href="/portal/login" className="text-a-accent hover:underline">
                Customer Portal →
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-center text-[length:var(--a-text-xs)] text-a-fg-subtle">
            Accès réservé aux salariés liés Identity.
          </p>
        )}
      </main>
    </div>
  );
}
