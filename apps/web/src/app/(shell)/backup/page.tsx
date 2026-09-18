"use client";

import { APageBody, AScreenHeader } from "@/components/a";
import { BackupWorkspace } from "@/components/backup/backup-workspace";
import { useUiT } from "@/lib/i18n/route-labels";

export default function BackupPage() {
  const { t } = useUiT();
  return (
    <>
      <AScreenHeader
        kicker="Backup & Recovery"
        title="Sauvegardes"
        description={t(
          "Politiques et artefacts AUTHORITY — manifeste, dump installable, rétention. Restore cluster bloqué ; apply logique société (D307).",
        )}
      />
      <APageBody>
        <BackupWorkspace />
      </APageBody>
    </>
  );
}
