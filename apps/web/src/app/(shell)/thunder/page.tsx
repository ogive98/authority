"use client";

import { ThunderCommandCenter } from "@/components/thunder/thunder-command-center";

/**
 * Thunder Core Command Center — orchestration + monitoring (D058 / D294).
 * Data: GET /api/v1/thunder/monitor/snapshot (+ signals / adapters).
 */
export default function ThunderPage() {
  return <ThunderCommandCenter />;
}
