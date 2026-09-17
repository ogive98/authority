"use client";

import {
  pullThunderMonitorOnce,
  sleepThunderMonitorBus,
} from "@/hooks/use-thunder-cc-snapshot";
import { useThunderCcPowerStore } from "@/stores/thunder-cc-power-store";

function wait(ms: number) {
  return new Promise<void>((r) => {
    window.setTimeout(r, ms);
  });
}

let bootLock: Promise<void> | null = null;

/**
 * Wake Command Center from sleep: staged progress + first monitor pull.
 * Polling starts only after markOn via React hook (live).
 */
export function runThunderCcBootSequence(): Promise<void> {
  if (bootLock) return bootLock;

  const power = useThunderCcPowerStore.getState().power;
  if (power === "on") return Promise.resolve();

  bootLock = (async () => {
    const { requestBoot, setBootProgress, markOn } =
      useThunderCcPowerStore.getState();
    requestBoot();

    try {
      setBootProgress(8, "Mise sous tension…");
      await wait(180);

      setBootProgress(22, "Préparation Command Center…");
      await wait(160);

      setBootProgress(40, "Connexion monitor…");
      await wait(120);

      setBootProgress(58, "Premier snapshot…");
      await pullThunderMonitorOnce();

      setBootProgress(78, "Hydratation widgets…");
      await wait(220);

      setBootProgress(92, "Vérification…");
      await wait(140);

      setBootProgress(100, "Opérationnel");
      await wait(180);
      markOn();
    } catch {
      setBootProgress(100, "Démarrage partiel — mode dégradé");
      await wait(200);
      markOn();
    }
  })().finally(() => {
    bootLock = null;
  });

  return bootLock;
}

/** Leave /thunder → stop CC poll bus and free snapshot RAM. */
export function sleepThunderCc(): void {
  bootLock = null;
  sleepThunderMonitorBus();
  useThunderCcPowerStore.getState().shutdown();
}
