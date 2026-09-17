"use client";

import { AButton } from "@/components/a/a-button";

/** Session may still be valid; API briefly unreachable (Nest restart). */
export function AuthApiUnavailable({
  title = "API temporairement indisponible",
  message = "Le serveur AUTHORITY redémarre ou ne répond pas. Votre session n’a pas été annulée — réessayez.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-a-surface-1 px-[var(--a-space-6)] text-a-fg">
      <div
        className="a-underlay w-full max-w-md space-y-4 rounded-[var(--a-radius-md)] p-[var(--a-space-6)]"
        role="alert"
      >
        <h1 className="text-[length:var(--a-text-lg)] font-semibold">{title}</h1>
        <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">{message}</p>
        <AButton type="button" onClick={() => window.location.reload()}>
          Réessayer
        </AButton>
      </div>
    </div>
  );
}
