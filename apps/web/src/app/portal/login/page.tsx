"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { ASkipLink } from "@/components/a/a-skip-link";
import { PORTAL_API, PORTAL_HOME_PATH } from "@/lib/customer-portal";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        message?: string;
        realm?: string;
      };
      if (res.ok && body.realm === "customer_portal") {
        router.replace(PORTAL_HOME_PATH);
        router.refresh();
        return;
      }
      setError(body.message ?? "Connexion refusée.");
    } catch {
      setError("API indisponible.");
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
          AUTHORITY{" "}
          <span className="text-a-accent">Portal</span>
        </h1>
        <p className="text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
          Accès client · cookie distinct · pas le login métier
        </p>
        <form
          onSubmit={submit}
          className="space-y-4 rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-[var(--a-space-5)]"
        >
          <div className="space-y-1.5">
            <label htmlFor="portal-email" className="text-[length:var(--a-text-sm)]">
              E-mail
            </label>
            <AInput
              id="portal-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="portal-password" className="text-[length:var(--a-text-sm)]">
              Mot de passe
            </label>
            <AInput
              id="portal-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger" role="alert">
              {error}
            </p>
          ) : null}
          <AButton type="submit" className="w-full" disabled={busy}>
            {busy ? "…" : "Connexion"}
          </AButton>
        </form>
      </main>
    </div>
  );
}
