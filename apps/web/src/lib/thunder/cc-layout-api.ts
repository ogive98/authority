/** Client helpers for Thunder Command Center layout (USER scoped). */

export type ThunderCcLayoutWidgetDto = {
  id: string;
  widgetDefinitionId: string;
  position: { x: number; y: number; w: number; h: number };
  visibility: boolean;
  order: number;
};

export type ThunderCcLayoutDto = {
  v: 1;
  widgets: ThunderCcLayoutWidgetDto[];
  compact?: boolean;
  thresholds?: Record<string, number>;
  updatedAt?: string;
};

export async function fetchThunderCcLayout(): Promise<ThunderCcLayoutDto | null> {
  try {
    const res = await fetch("/api/v1/thunder/cc/layout", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { layout?: ThunderCcLayoutDto | null };
    return data.layout ?? null;
  } catch {
    return null;
  }
}

export async function saveThunderCcLayout(
  payload: ThunderCcLayoutDto,
): Promise<{ ok: boolean; layout?: ThunderCcLayoutDto; error?: string }> {
  try {
    const res = await fetch("/api/v1/thunder/cc/layout", {
      method: "PUT",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { layout: ThunderCcLayoutDto };
    return { ok: true, layout: data.layout };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "network error",
    };
  }
}
