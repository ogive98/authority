"use client";

import { create } from "zustand";
import {
  SEED_NOTIFICATIONS,
  markAllRead,
  markRead,
  unreadCount,
  upsertNotification,
  type NotificationItem,
} from "@/lib/notifications";

export type SseStatus = "idle" | "connecting" | "connected" | "disconnected";

type NotificationsState = {
  items: NotificationItem[];
  sseStatus: SseStatus;
  inboxOpen: boolean;
  /** When true, hook must not open EventSource (gate cut). */
  ssePaused: boolean;
  /** Bump to force hook reconnect. */
  sseGeneration: number;
  setInboxOpen: (open: boolean) => void;
  setSseStatus: (status: SseStatus) => void;
  applySnapshot: (items: NotificationItem[]) => void;
  pushItem: (item: NotificationItem) => void;
  markItemRead: (id: string) => void;
  markAllItemsRead: () => void;
  pauseSse: () => void;
  resumeSse: () => void;
  unread: () => number;
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: SEED_NOTIFICATIONS,
  sseStatus: "idle",
  inboxOpen: false,
  ssePaused: false,
  sseGeneration: 0,
  setInboxOpen: (open) => set({ inboxOpen: open }),
  setSseStatus: (sseStatus) => set({ sseStatus }),
  applySnapshot: (items) => set({ items }),
  pushItem: (item) =>
    set((s) => ({ items: upsertNotification(s.items, item) })),
  markItemRead: (id) => set((s) => ({ items: markRead(s.items, id) })),
  markAllItemsRead: () => set((s) => ({ items: markAllRead(s.items) })),
  pauseSse: () =>
    set((s) => ({
      ssePaused: true,
      sseStatus: "disconnected",
      sseGeneration: s.sseGeneration + 1,
    })),
  resumeSse: () =>
    set((s) => ({
      ssePaused: false,
      sseStatus: "connecting",
      sseGeneration: s.sseGeneration + 1,
    })),
  unread: () => unreadCount(get().items),
}));
