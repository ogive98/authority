"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Inbox,
  Lock,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import {
  ADegradedBanner,
  ADemoWatermark,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AMaintenanceBanner,
  AOfflineBanner,
  ASkeleton,
  ASkeletonCard,
} from "@/components/a";
import { ThemeToggle } from "@/components/shell";

export default function DevStatesPage() {
  const [showDemo, setShowDemo] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  return (
    <div className="relative min-h-screen bg-a-surface-1 text-a-fg">
      {showDemo ? <ADemoWatermark /> : null}

      <header className="flex items-center justify-between gap-4 border-b border-a-border-subtle px-[var(--a-space-6)] py-[var(--a-space-4)]">
        <div>
          <p className="a-mono text-[length:var(--a-text-xs)] uppercase tracking-widest text-a-fg-subtle">
            UI-05 · States
          </p>
          <h1 className="mt-1 text-[length:var(--a-text-xl)] font-semibold">
            États UI
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setShowDemo((v) => !v)}
            className="rounded-[var(--a-radius-md)] border border-a-border-subtle px-3 py-1.5 text-[length:var(--a-text-sm)] text-a-fg-muted hover:bg-a-surface-3"
          >
            {showDemo ? "Masquer DEMO" : "Watermark DEMO"}
          </button>
          <Link
            href="/"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-accent"
          >
            Shell
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-[var(--a-space-7)] px-[var(--a-space-6)] py-[var(--a-space-7)]">
        <section className="space-y-3">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">
            Bannières
          </h2>
          <AOfflineBanner />
          <AOfflineBanner sseLost />
          <ADegradedBanner />
          <AMaintenanceBanner moduleName="Sales" />
        </section>

        <section className="space-y-3">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">
            Skeleton
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <ASkeletonCard />
            <div className="a-card space-y-3 p-4">
              <ASkeleton className="h-8 w-8 rounded-[var(--a-radius-sm)]" />
              <ASkeleton lines={4} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">Empty</h2>
          <AEmptyState
            icon={<Inbox className="h-5 w-5" strokeWidth={1.75} />}
            title="Aucun lot"
            description="Aucun lot ouvert pour ce site. Créez un lot si vous en avez la permission."
            actionLabel="Nouveau lot"
            onAction={() => undefined}
            canAct
          />
          <AEmptyState
            title="Aucun résultat"
            description="CTA masqué — permission refusée (canAct=false)."
            actionLabel="Créer"
            onAction={() => undefined}
            canAct={false}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">
            Error + correlationId
          </h2>
          <AErrorState
            icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.75} />}
            message="Impossible de charger le stock. Réessayez ou contactez le support avec l’identifiant ci-dessous."
            correlationId="corr_ui05_demo_9f3a2c"
            retryable
            onRetry={() => setRetryCount((n) => n + 1)}
            detail={`stack: InventoryService.list\nretries: ${retryCount}\ncode: INV.TIMEOUT`}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">403</h2>
          <AForbiddenState
            icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
            message="Les salaires sont masqués pour votre rôle. Demandez l’accès RH si nécessaire."
          />
        </section>

        <p className="flex items-center gap-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
          <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Tokens only · pas de hex · shell reste utilisable si un widget est en
          erreur
        </p>
      </main>
    </div>
  );
}
