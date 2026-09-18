"use client";

import { useEffect, useState } from "react";
import { AButton, AInput } from "@/components/a";
import { useUiT } from "@/lib/i18n/route-labels";

export type BackupStepUpResult = {
  password: string;
  phrase: string;
};

type Props = {
  open: boolean;
  title: string;
  description: string;
  /** When set, user must type this exact phrase (e.g. RESTORE). */
  confirmPhrase?: string;
  busy?: boolean;
  error?: string | null;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (result: BackupStepUpResult) => void | Promise<void>;
};

/** Step-up password (+ optional phrase) for Backup restore gates (D305–D307). */
export function BackupStepUpDialog({
  open,
  title,
  description,
  confirmPhrase,
  busy,
  error,
  confirmLabel = "Confirmer",
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useUiT();
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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-a-fg/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-stepup-title"
    >
      <div className="a-card w-full max-w-md rounded-[var(--a-radius-lg)] p-5 shadow-[var(--a-shadow-panel)]">
        <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-danger">
          {t("Re-authentification")}
        </p>
        <h2
          id="backup-stepup-title"
          className="mt-1 text-[length:var(--a-text-lg)] font-medium tracking-tight"
        >
          {t(title)}
        </h2>
        <p className="mt-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
          {t(description)}
        </p>

        <label className="mt-4 block space-y-1.5">
          <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            {t("Mot de passe session")}
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
              {t("Tapez")}{" "}
              <span className="a-mono font-medium text-a-fg">{confirmPhrase}</span>{" "}
              {t("pour confirmer")}
            </span>
            <AInput
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={confirmPhrase}
              className="a-mono"
              autoComplete="off"
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
            {t("Annuler")}
          </AButton>
          <AButton
            type="button"
            variant="danger"
            disabled={busy || !password.trim() || !phraseOk}
            onClick={() =>
              void onConfirm({ password, phrase: phrase.trim() })
            }
          >
            {t(confirmLabel)}
          </AButton>
        </div>
      </div>
    </div>
  );
}
