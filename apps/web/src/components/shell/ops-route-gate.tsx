"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AEmptyState } from "@/components/a";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { resolveOpsRouteBlock } from "@/lib/ops-route-block";
import { usePrefsStore } from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";

/**
 * Blocks deep URLs for GHOST-hidden features / PATCH-GHOST delivery / accounting partial (D208).
 * Does not 403 the API.
 */
export function OpsRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [loc, setLoc] = useState({ pathname, search: "", hash: "" });
  const ghostEnabled = useShellStore((s) => s.ghostEnabled);
  const patchEnabled = useShellStore((s) => s.patchEnabled);
  const prefs = usePrefsStore((s) => s.opsVisibility);
  const { unfiltered } = useMeRegistry();

  useEffect(() => {
    const sync = () => {
      setLoc({
        pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [pathname]);

  const block = resolveOpsRouteBlock(loc, unfiltered, {
    ghostEnabled,
    patchEnabled,
    prefs,
  });

  if (block) {
    return (
      <div className="p-[var(--a-space-6)]">
        <AEmptyState title={block.title} description={block.message} />
      </div>
    );
  }

  return children;
}
