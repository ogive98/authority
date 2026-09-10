"use client";

import { useEffect, useState } from "react";
import { AButton, AInput } from "@/components/a";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmPhrase?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (password: string) => void | Promise<void>;
};

/** Step-up password gate for critical Repair actions (pack SECURITY). */
export function RepairStepUpDialog({
  open,
  title,
  description,
  confirmPhrase,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");

  useEffect(() => {
    if (!open) {
      setPassword("");
      setPhrase("");
    }
  }, [open]);

  if (!open) return null;

  const phraseOk = !confirmPhrase || phrase.trim() === confirmPhrase;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-a-fg/25 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repair-stepup-title"
    >
      <div className="w-full max-w-md a-underlay rounded-md p-5 shadow-[0_20px_50px_rgb(0_0_0_/0.18)]">
        <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-danger">
          Re-authentification
        </p>
        <h2
          id="repair-stepup-title"
          className="mt-1 text-[length:var(--a-text-lg)] font-semibold tracking-tight"
        >
          {title}
        </h2>
        <p className="mt-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
          {description}
        </p>

        <label className="mt-4 block space-y-1.5">
          <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            Mot de passe session
          </span>
          <AInput
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {confirmPhrase ? (
          <label className="mt-3 block space-y-1.5">
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Tapez <span className="a-mono font-medium">{confirmPhrase}</span>{" "}
              pour confirmer
            </span>
            <AInput
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={confirmPhrase}
              className="a-mono"
            />
          </label>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <AButton
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Annuler
          </AButton>
          <AButton
            type="button"
            disabled={busy || !password.trim() || !phraseOk}
            onClick={() => void onConfirm(password)}
          >
            Confirmer
          </AButton>
        </div>
      </div>
    </div>
  );
}
