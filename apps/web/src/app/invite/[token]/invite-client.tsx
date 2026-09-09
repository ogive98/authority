"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { ASkipLink } from "@/components/a/a-skip-link";

type Peek =
  | { kind: "loading" }
  | { kind: "ok"; email: string; displayName: string; expiresAt: string }
  | { kind: "error"; message: string };

export default function InviteAcceptClient() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [peek, setPeek] = useState<Peek>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/identity/invites/${encodeURIComponent(token)}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          setPeek({
            kind: "error",
            message:
              typeof body.message === "string"
                ? body.message
                : "Invitation invalide ou expirée.",
          });
          return;
        }
        const data = (await res.json()) as {
          email: string;
          displayName: string;
          expiresAt: string;
        };
        setPeek({ kind: "ok", ...data });
      } catch {
        if (!cancelled) {
          setPeek({ kind: "error", message: "Réseau indisponible." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Mot de passe : 8 caractères minimum.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/identity/invites/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(
          typeof body.message === "string"
            ? body.message
            : `HTTP ${res.status}`,
        );
        return;
      }
      const data = (await res.json()) as { email?: string };
      const q = new URLSearchParams();
      q.set("invited", "1");
      if (data.email) q.set("email", data.email);
      router.replace(`/login?${q.toString()}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-a-surface-1 px-[var(--a-space-6)] text-a-fg">
      <ASkipLink href="#invite" />
      <main id="invite" className="w-full max-w-sm space-y-[var(--a-space-5)]">
        <p className="text-center text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
          Invitation
        </p>
        <h1 className="text-center text-[length:var(--a-text-xl)] font-medium tracking-tight">
          AUTHORITY
        </h1>

        {peek.kind === "loading" ? (
          <p className="text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
            Vérification du lien…
          </p>
        ) : null}

        {peek.kind === "error" ? (
          <p className="text-center text-[length:var(--a-text-sm)] text-a-danger">
            {peek.message}
          </p>
        ) : null}

        {peek.kind === "ok" ? (
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="space-y-4 rounded-[14px] bg-a-surface-2 p-[var(--a-space-5)]"
          >
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Bonjour <span className="text-a-fg">{peek.displayName}</span>
              {" · "}
              {peek.email}
            </p>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Choisissez votre mot de passe pour activer le compte.
            </p>
            <div className="space-y-1.5">
              <label
                htmlFor="inv-pass"
                className="text-[length:var(--a-text-sm)] font-medium"
              >
                Mot de passe
              </label>
              <AInput
                id="inv-pass"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="inv-confirm"
                className="text-[length:var(--a-text-sm)] font-medium"
              >
                Confirmer
              </label>
              <AInput
                id="inv-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            </div>
            {error ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {error}
              </p>
            ) : null}
            <AButton type="submit" className="w-full" disabled={busy}>
              {busy ? "Activation…" : "Activer mon compte"}
            </AButton>
          </form>
        ) : null}
      </main>
    </div>
  );
}
