"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { ASkipLink } from "@/components/a/a-skip-link";
import {
  initialsFromName,
  listAssignedCompanies,
  loginBusiness,
  safeBusinessNext,
  setBusinessCompanyContext,
  type BusinessCompany,
} from "@/lib/business-auth";

const DEMO_HINT =
  process.env.NODE_ENV === "development"
    ? { email: "demo@authority.local", password: "DemoPass123!" }
    : null;

type Step = "credentials" | "company";

export default function BusinessLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = useMemo(
    () => safeBusinessNext(search.get("next")),
    [search],
  );

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState(DEMO_HINT?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companies, setCompanies] = useState<BusinessCompany[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userLabel, setUserLabel] = useState<string | null>(null);

  async function finishWithCompany(companyId: string) {
    const ctx = await setBusinessCompanyContext(companyId);
    if (!ctx.ok) {
      setError(ctx.message);
      return;
    }
    router.replace(nextPath);
    router.refresh();
  }

  async function afterLogin() {
    const cos = await listAssignedCompanies();
    if (!cos.ok) {
      setError(cos.message);
      return;
    }
    if (cos.data.length === 0) {
      setError("Aucune société assignée à ce compte.");
      return;
    }
    if (cos.data.length === 1) {
      await finishWithCompany(cos.data[0]!.id);
      return;
    }
    setCompanies(cos.data);
    setStep("company");
  }

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await loginBusiness({ email, password });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setUserLabel(
        `${res.data.user.displayName} · ${initialsFromName(res.data.user.displayName, res.data.user.email)}`,
      );
      await afterLogin();
    } finally {
      setBusy(false);
    }
  }

  async function pickCompany(companyId: string) {
    setBusy(true);
    setError(null);
    try {
      await finishWithCompany(companyId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-a-surface-1 px-[var(--a-space-6)] text-a-fg">
      <ASkipLink href="#login" />
      <main id="login" className="w-full max-w-sm space-y-[var(--a-space-5)]">
        <p className="text-center text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
          Espace métier
        </p>
        <h1 className="text-center text-[length:var(--a-text-xl)] font-medium tracking-tight">
          AUTHORITY
        </h1>
        <p className="text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
          {step === "credentials"
            ? "Connexion session métier · modules selon société"
            : "Choisissez la société active"}
        </p>

        {step === "credentials" ? (
          <form
            onSubmit={(e) => void submitCredentials(e)}
            className="space-y-4 rounded-[14px] bg-a-surface-2 p-[var(--a-space-5)]"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="biz-email"
                className="text-[length:var(--a-text-sm)] font-medium"
              >
                E-mail
              </label>
              <AInput
                id="biz-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="biz-password"
                className="text-[length:var(--a-text-sm)] font-medium"
              >
                Mot de passe
              </label>
              <div className="relative">
                <AInput
                  id="biz-password"
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
        ) : (
          <div className="space-y-3 rounded-[14px] bg-a-surface-2 p-[var(--a-space-5)]">
            {userLabel ? (
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Connecté · {userLabel}
              </p>
            ) : null}
            <ul className="space-y-1">
              {companies.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void pickCompany(c.id)}
                    className="flex w-full flex-col rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-a-surface-3 disabled:opacity-50"
                  >
                    <span className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                      {c.legalName}
                    </span>
                    <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                      {c.code}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {error ? (
              <p
                className="text-[length:var(--a-text-sm)] text-a-danger"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>
        )}

        {DEMO_HINT && step === "credentials" ? (
          <div className="rounded-[10px] bg-a-surface-2/60 px-3 py-2.5 text-center text-[length:var(--a-text-xs)] text-a-fg-muted">
            <p className="font-medium text-a-fg">Démo locale</p>
            <p className="mt-1 a-mono">
              {DEMO_HINT.email} · {DEMO_HINT.password}
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
