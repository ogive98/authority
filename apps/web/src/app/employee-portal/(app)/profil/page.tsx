"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AErrorState,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  EMPLOYEE_PORTAL_API,
  type PortalEmployeeProfile,
} from "@/lib/employee-portal";

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

  return (
    <>
      <AScreenHeader
        kicker="Portail employé"
        title="Mon profil"
        description="Lecture seule — modifications via RH / ADV."
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
            <APageSection title="Banque (masqué)">
              <FieldGrid>
                <Field label="Banque" value={state.profile.bankName} />
                <Field label="Agence" value={state.profile.bankAgency} />
                <Field
                  label="Compte"
                  value={state.profile.bankAccountMasked}
                />
              </FieldGrid>
              <p className="mt-3 text-[length:var(--a-text-xs)] text-a-fg-subtle">
                Compte masqué pour la confidentialité. Contactez RH pour une
                correction.
              </p>
            </APageSection>
          </>
        ) : null}
      </APageBody>
    </>
  );
}
