"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  AErrorState,
  AInput,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  EMPLOYEE_PORTAL_API,
  type PortalEmployeeProfile,
} from "@/lib/employee-portal";
import { formatRibDisplay, ribFieldHint } from "@/lib/rib-tn";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ok";
      profile: PortalEmployeeProfile;
      loginEmail: string;
    }
  | { kind: "error"; message: string };

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wide text-a-fg-muted">
        {label}
      </p>
      <p className="text-[length:var(--a-text-sm)] text-a-fg">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

export default function EmployeePortalProfilPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(EMPLOYEE_PORTAL_API.me, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        setState({
          kind: "error",
          message: "Impossible de charger le profil.",
        });
        return;
      }
      const body = (await res.json()) as {
        user: { email: string };
        profile: PortalEmployeeProfile;
      };
      setBankName(body.profile.bankName ?? "");
      setBankAgency(body.profile.bankAgency ?? "");
      setBankAccount(
        body.profile.bankAccountFormatted ??
          body.profile.bankAccount ??
          "",
      );
      setState({
        kind: "ok",
        profile: body.profile,
        loginEmail: body.user.email,
      });
    } catch {
      setState({ kind: "error", message: "API indisponible." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ribHint = ribFieldHint(bankAccount);

  async function onSaveBank() {
    if (ribHint) {
      setFormError(ribHint);
      return;
    }
    setBusy(true);
    setFormError(null);
    setSavedOk(false);
    try {
      const res = await fetch(EMPLOYEE_PORTAL_API.bank, {
        method: "PATCH",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bankName: bankName.trim() || null,
          bankAgency: bankAgency.trim() || null,
          bankAccount: bankAccount.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        setFormError(
          Array.isArray(body.message)
            ? body.message.join(", ")
            : body.message || "Enregistrement refusé",
        );
        setBusy(false);
        return;
      }
      const body = (await res.json()) as { profile: PortalEmployeeProfile };
      setBankAccount(
        body.profile.bankAccountFormatted ??
          body.profile.bankAccount ??
          "",
      );
      setState((prev) =>
        prev.kind === "ok"
          ? { ...prev, profile: body.profile }
          : prev,
      );
      setSavedOk(true);
      setBusy(false);
    } catch {
      setBusy(false);
      setFormError("API indisponible.");
    }
  }

  return (
    <>
      <AScreenHeader
        kicker="Portail employé"
        title="Mon profil"
        description="Identité en lecture seule — coordonnées bancaires modifiables (RIB TN validé)."
      />
      <APageBody>
        {state.kind === "loading" ? (
          <ASkeleton className="h-48 w-full" />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}
        {state.kind === "ok" ? (
          <>
            <APageSection title="Identité">
              <FieldGrid>
                <Field label="Matricule" value={state.profile.matricule} />
                <Field label="Nom affiché" value={state.profile.displayName} />
                <Field label="Statut" value={state.profile.status} />
                <Field label="Poste" value={state.profile.jobTitle} />
                <Field label="Département" value={state.profile.department} />
                <Field label="Site" value={state.profile.siteName} />
                <Field label="Embauche" value={state.profile.hiredAt} />
                <Field label="CIN" value={state.profile.cinNo} />
              </FieldGrid>
            </APageSection>
            <APageSection title="Coordonnées">
              <FieldGrid>
                <Field label="E-mail RH" value={state.profile.email} />
                <Field label="Login" value={state.loginEmail} />
                <Field label="Adresse" value={state.profile.address} />
              </FieldGrid>
            </APageSection>
            <APageSection
              title="Banque / RIB"
              action={
                <AButton
                  type="button"
                  size="sm"
                  disabled={busy || Boolean(ribHint && bankAccount.trim())}
                  onClick={() => void onSaveBank()}
                >
                  Enregistrer
                </AButton>
              }
            >
              {formError ? (
                <p className="mb-3 rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
                  {formError}
                </p>
              ) : null}
              {savedOk ? (
                <p className="mb-3 text-[length:var(--a-text-sm)] text-a-success-fg">
                  Coordonnées bancaires enregistrées.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[length:var(--a-text-sm)] font-medium">
                    Banque
                  </span>
                  <AInput
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[length:var(--a-text-sm)] font-medium">
                    Agence
                  </span>
                  <AInput
                    value={bankAgency}
                    onChange={(e) => setBankAgency(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="flex items-center gap-2 text-[length:var(--a-text-sm)] font-medium">
                    N° compte / RIB
                    {state.profile.bankAccount ? (
                      <ABadge
                        tone={
                          state.profile.bankAccountValid
                            ? "success"
                            : "danger"
                        }
                      >
                        {state.profile.bankAccountValid
                          ? "RIB valide"
                          : "RIB invalide"}
                      </ABadge>
                    ) : null}
                  </span>
                  <AInput
                    value={bankAccount}
                    onChange={(e) => {
                      setBankAccount(e.target.value);
                      setSavedOk(false);
                    }}
                    onBlur={() => {
                      const n = bankAccount.replace(/[\s\-_.]/g, "");
                      if (/^\d{20}$/.test(n)) {
                        setBankAccount(formatRibDisplay(n));
                      }
                    }}
                    placeholder="07 040 0058101111296 53"
                    className="a-mono"
                  />
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    {ribHint ??
                      "20 chiffres Tunisie (clé mod 97) ou IBAN TN… — pas d’annuaire inventé."}
                  </span>
                </label>
              </div>
            </APageSection>
          </>
        ) : null}
      </APageBody>
    </>
  );
}
