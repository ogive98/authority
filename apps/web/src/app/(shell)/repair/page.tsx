"use client";

import { AScreenHeader } from "@/components/a";
import { RepairWorkspace } from "@/components/repair/repair-workspace";

export default function RepairPage() {
  return (
    <>
      <AScreenHeader
        kicker="Ops"
        title="Scan & Repair"
        description="Scan, diagnostic et réparation allowlistée du logiciel — aucune mutation métier (facture, paiement, stock)."
      />
      <RepairWorkspace />
    </>
  );
}
