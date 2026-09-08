"use client";

import { AScreenHeader } from "@/components/a";
import { RepairWorkspace } from "@/components/repair/repair-workspace";

export default function RepairPage() {
  return (
    <>
      <AScreenHeader
        kicker="Thunder Shield"
        title="Scan & Repair"
        description="Diagnostiquer et réparer AUTHORITY — schémas, scan L0–L4, réparation allowlistée. Aucune mutation métier (facture, paiement, stock)."
      />
      <RepairWorkspace />
    </>
  );
}
