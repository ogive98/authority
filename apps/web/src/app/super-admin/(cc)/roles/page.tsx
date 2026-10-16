"use client";

import { useEffect, useState } from "react";
import {
  AButton,
  AErrorState,
  AScreenHeader,
  ASkeleton,
  ASwitch,
} from "@/components/a";
import { groupPermissionsByModule } from "@/lib/permission-groups";
import {
  fetchSaRoleGrants,
  fetchSaRoles,
  putSaRoleGrants,
  type SaRoleGrants,
  type SaRoleSummary,
} from "@/lib/super-admin-roles";
import { cn } from "@/lib/utils";

type RolesLoad =
  | { kind: "loading" }
  | { kind: "ok"; items: SaRoleSummary[] }
  | { kind: "error"; message: string };

export default function SuperAdminRolesPage() {
  const [roles, setRoles] = useState<RolesLoad>({ kind: "loading" });
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [grants, setGrants] = useState<SaRoleGrants | null>(null);
  const [grantKeys, setGrantKeys] = useState<Set<string>>(new Set());
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantsBusy, setGrantsBusy] = useState(false);
  const [grantsMsg, setGrantsMsg] = useState<string | null>(null);
  const [grantsError, setGrantsError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetchSaRoles();
      if (!res.ok) {
        setRoles({ kind: "error", message: res.message });
        return;
      }
      setRoles({ kind: "ok", items: res.data.items });
      setSelectedRole(res.data.items[0]?.code ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    let cancelled = false;
    void (async () => {
      setGrantsLoading(true);
      setGrantsError(null);
      setGrantsMsg(null);
      const res = await fetchSaRoleGrants(selectedRole);
      if (cancelled) return;
      if (!res.ok) {
        setGrants(null);
        setGrantKeys(new Set());
        setGrantsError(res.message);
      } else {
        setGrants(res.data);
        setGrantKeys(new Set(res.data.globalAllow));
      }
      setGrantsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRole]);

  function toggleGrant(key: string, on: boolean) {
    if (!grants) return;
    if (grants.protectedKeys.includes(key)) return;
    setGrantsMsg(null);
    setGrantsError(null);
    setGrantKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function onSave() {
    if (!grants || !selectedRole || grantsBusy) return;
    setGrantsBusy(true);
    setGrantsMsg(null);
    setGrantsError(null);
    const res = await putSaRoleGrants(selectedRole, [...grantKeys]);
    if (!res.ok) {
      setGrantsError(res.message);
    } else {
      setGrants(res.data);
      setGrantKeys(new Set(res.data.globalAllow));
      setGrantsMsg(
        `Pack global « ${res.data.label} » enregistré (${res.data.globalAllow.length} permissions).`,
      );
    }
    setGrantsBusy(false);
  }

  return (
    <>
      <AScreenHeader
        kicker="Control Center"
        title="Rôles"
        description="Packs de permissions globaux par rôle — base héritée par toutes les sociétés (l’admin société peut ensuite restreindre par société)."
      />
      <div className="space-y-[var(--a-space-6)] p-[var(--a-space-6)]">
        {roles.kind === "loading" ? (
          <ASkeleton className="h-32 w-full" />
        ) : roles.kind === "error" ? (
          <AErrorState message={roles.message} />
        ) : (
          <div className="grid gap-[var(--a-space-6)] lg:grid-cols-[260px_1fr]">
            <section className="a-card space-y-2 p-[var(--a-space-4)]">
              <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                Rôles métier
              </h2>
              <ul className="space-y-1">
                {roles.items.map((r) => (
                  <li key={r.code}>
                    <button
                      type="button"
                      onClick={() => setSelectedRole(r.code)}
                      className={cn(
                        "flex w-full flex-col rounded-[var(--a-radius-md)] px-3 py-2 text-left transition-colors",
                        selectedRole === r.code
                          ? "bg-a-surface-3 font-medium text-a-fg"
                          : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                      )}
                    >
                      <span className="text-[length:var(--a-text-sm)]">
                        {r.label}
                      </span>
                      <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                        {r.code} · {r.globalAllowCount} permissions
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="a-card space-y-3 p-[var(--a-space-4)]">
              {!selectedRole || grantsLoading ? (
                <ASkeleton className="h-48 w-full" />
              ) : grantsError ? (
                <AErrorState message={grantsError} />
              ) : grants ? (
                <>
                  <div>
                    <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                      Pack global — {grants.label}
                    </h2>
                    <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      {grants.description} ·{" "}
                      <span className="a-mono">
                        {grantKeys.size}/{grants.catalog.length}
                      </span>{" "}
                      permissions. Les clés protégées (login / session) sont
                      fixes.
                    </p>
                  </div>
                  <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                    {groupPermissionsByModule(grants.catalog).map((group) => {
                      const activeCount = group.keys.filter((k) =>
                        grantKeys.has(k),
                      ).length;
                      return (
                        <details
                          key={group.moduleKey}
                          className="rounded-[var(--a-radius-md)] bg-a-surface-2"
                        >
                          <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[length:var(--a-text-sm)] font-medium text-a-fg hover:bg-a-surface-3">
                            <span>{group.label}</span>
                            <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                              {activeCount}/{group.keys.length}
                            </span>
                          </summary>
                          <ul className="space-y-1 px-3 pb-2">
                            {group.keys.map((key) => {
                              const protectedKey =
                                grants.protectedKeys.includes(key);
                              const checked = grantKeys.has(key) || protectedKey;
                              return (
                                <li
                                  key={key}
                                  className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 hover:bg-a-surface-3"
                                >
                                  <span className="min-w-0">
                                    <span className="a-mono block text-[12px] text-a-fg">
                                      {key}
                                    </span>
                                    {protectedKey ? (
                                      <span className="text-[10px] text-a-fg-subtle">
                                        protégé
                                      </span>
                                    ) : null}
                                  </span>
                                  <ASwitch
                                    size="sm"
                                    label={key}
                                    checked={checked}
                                    disabled={protectedKey || grantsBusy}
                                    onCheckedChange={(on) =>
                                      toggleGrant(key, on)
                                    }
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3">
                    <AButton
                      onClick={() => void onSave()}
                      disabled={grantsBusy || grantsLoading}
                    >
                      {grantsBusy ? "Enregistrement…" : "Enregistrer le pack global"}
                    </AButton>
                    {grantsMsg ? (
                      <p className="text-[length:var(--a-text-xs)] text-a-success">
                        {grantsMsg}
                      </p>
                    ) : null}
                    {grantsError ? (
                      <p className="text-[length:var(--a-text-xs)] text-a-danger">
                        {grantsError}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
