"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Inbox,
  Lock,
  WifiOff,
} from "lucide-react";
import {
  AButton,
  ADegradedBanner,
  ADemoWatermark,
  ADevPage,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AMaintenanceBanner,
  AOfflineBanner,
  ASkeleton,
  ASkeletonCard,
} from "@/components/a";

export default function DevStatesPage() {
  const [showDemo, setShowDemo] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  return (
    <ADevPage
      className="relative"
      kicker="UI-05 · States"
      title="États UI"
      extraActions={
        <AButton
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setShowDemo((v) => !v)}
        >
          {showDemo ? "Masquer DEMO" : "Watermark DEMO"}
        </AButton>
      }
      overlay={showDemo ? <ADemoWatermark /> : null}
      mainClassName="mx-auto max-w-3xl space-y-[var(--a-space-7)] px-[var(--a-space-6)] py-[var(--a-space-7)]"
    >
      <section className="space-y-3">
        <h2 className="text-[length:var(--a-text-lg)] font-medium">Bannières</h2>
        <AOfflineBanner />
        <AOfflineBanner sseLost />
        <ADegradedBanner />
        <AMaintenanceBanner moduleName="Sales" />
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--a-text-lg)] font-medium">Skeleton</h2>
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
    </ADevPage>
  );
}
