"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { ASkipLink } from "@/components/a/a-skip-link";
import { SA_REPAIR_PATH, safeSuperAdminNext } from "@/lib/super-admin-portal";

type Step = "password" | "mfa";

function SuperAdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => safeSuperAdminNext(searchParams.get("next") ?? SA_REPAIR_PATH),
    [searchParams],
  );
  const [email, setEmail] = useState("superadmin@authority.local");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function goIn() {
    router.replace(nextPath);
    router.refresh();
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
        mfaToken?: string;
        realm?: string;
      };
      if (res.ok && body.realm === "super_admin") {
        goIn();
        return;
      }
      if (
        res.status === 401 &&
        body.code === "IAM.MFA_REQUIRED" &&
        body.mfaToken
      ) {
        setMfaToken(body.mfaToken);
        setStep("mfa");
        return;
      }
      setError(body.message ?? "Connexion refusée.");
    } catch {
      setError("API indisponible.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/v1/auth/mfa/verify", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mfaToken, code }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        realm?: string;
      };
      if (res.ok && body.realm === "super_admin") {
        goIn();
        return;
      }
      setError(body.message ?? "Code MFA refusé.");
    } catch {
      setError("API indisponible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form
        onSubmit={step === "password" ? submitPassword : submitMfa}
        className="a-card space-y-4 p-[var(--a-space-5)]"
      >
        {step === "password" ? (
          <>
            <div className="space-y-1.5">
              <label
                htmlFor="sa-email"
                className="text-[length:var(--a-text-sm)]"
              >
                E-mail
              </label>
              <AInput
                id="sa-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="sa-password"
                className="text-[length:var(--a-text-sm)]"
              >
                Mot de passe
              </label>
              <AInput
                id="sa-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
              />
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="sa-mfa" className="text-[length:var(--a-text-sm)]">
              Code TOTP
            </label>
            <AInput
              id="sa-mfa"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(ev) => setCode(ev.target.value)}
              required
              minLength={6}
              maxLength={8}
            />
          </div>
        )}
        {error ? (
          <p
            className="text-[length:var(--a-text-sm)] text-a-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <AButton type="submit" className="w-full" disabled={busy}>
          {busy ? "…" : step === "mfa" ? "Vérifier MFA" : "Entrer"}
        </AButton>
      </form>
      <p className="text-center text-[length:var(--a-text-xs)] text-a-fg-subtle">
        Démo locale :{" "}
        <span className="a-mono">superadmin@authority.local</span>
        {" · "}
        <span className="a-mono">SuperAdminPass123!</span>
        <br />
        Après connexion →{" "}
        <span className="a-mono text-a-accent">{SA_REPAIR_PATH}</span>
      </p>
    </>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-[var(--a-space-6)]">
      <ASkipLink href="#login" />
      <main id="login" className="w-full max-w-sm space-y-[var(--a-space-5)]">
        <p className="a-mono text-center text-[length:var(--a-text-xs)] tracking-[0.2em] text-a-spectre">
          CONTROL CENTER
        </p>
        <h1 className="text-center text-[length:var(--a-text-xl)] font-semibold">
          Super Admin
        </h1>
        <p className="text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
          Portail séparé · cookie distinct · pas le login métier
        </p>
        <Suspense
          fallback={
            <div className="a-card p-[var(--a-space-5)] text-center text-a-fg-muted">
              Chargement…
            </div>
          }
        >
          <SuperAdminLoginForm />
        </Suspense>
      </main>
    </div>
  );
}
