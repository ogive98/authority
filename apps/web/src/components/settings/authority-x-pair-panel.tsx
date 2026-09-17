"use client";

import { useCallback, useEffect, useState } from "react";
import { ABadge, AButton } from "@/components/a";
import {
  fetchAuthorityXDevices,
  pairAuthorityXDevice,
  revokeAuthorityXDevice,
  type AuthorityXDevice,
} from "@/lib/identity-devices";
import { useUiT } from "@/lib/i18n/route-labels";

/** Prefs Poste — generate a one-time pairing code for AUTHORITY X (D274). */
export function AuthorityXPairPanel() {
  const { t } = useUiT();
  const [items, setItems] = useState<AuthorityXDevice[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await fetchAuthorityXDevices());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onPair() {
    setBusy(true);
    setError(null);
    try {
      const result = await pairAuthorityXDevice();
      setCode(result.code);
      setExpiresAt(result.expiresAt);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      await revokeAuthorityXDevice(id);
      if (code) {
        setCode(null);
        setExpiresAt(null);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-3 pt-4">
      <p className="text-[length:var(--a-text-sm)] font-medium text-a-accent">
        {t("AUTHORITY X")}
      </p>
      <p className="text-[length:var(--a-text-xs)] leading-snug text-a-fg-muted">
        {t(
          "Générez un code à coller dans le companion desktop. Le jeton reste dans le keyring OS — jamais d’écriture métier silencieuse.",
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <AButton
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => void onPair()}
        >
          Générer un code
        </AButton>
        {code ? (
          <AButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void onCopy()}
          >
            Copier
          </AButton>
        ) : null}
      </div>
      {code ? (
        <div className="space-y-1">
          <p className="a-mono text-[length:var(--a-text-lg)] tracking-widest text-a-fg">
            {code}
          </p>
          {expiresAt ? (
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              {t("Valable 10 min")}
              {" · "}
              {new Date(expiresAt).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="text-[length:var(--a-text-xs)] text-a-danger">{error}</p>
      ) : null}
      <ul className="space-y-1">
        {items.length === 0 ? (
          <li className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
            {t("Aucun appareil appairé")}
          </li>
        ) : (
          items.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 py-1"
            >
              <div className="min-w-0">
                <p className="truncate text-[length:var(--a-text-sm)] text-a-fg">
                  {d.name ?? "AUTHORITY X"}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {d.pending
                    ? t("En attente")
                    : d.lastSeenAt
                      ? new Date(d.lastSeenAt).toLocaleString()
                      : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {d.pending ? (
                  <ABadge tone="warning">{t("En attente")}</ABadge>
                ) : (
                  <ABadge tone="success">{t("Appairé")}</ABadge>
                )}
                <AButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void onRevoke(d.id)}
                >
                  Révoquer
                </AButton>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
