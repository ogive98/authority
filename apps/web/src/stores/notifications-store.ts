"use client";

import { create } from "zustand";
import {
  markAllRead,
  markRead,
  unreadCount,
  upsertNotification,
  type NotificationItem,
} from "@/lib/notifications";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  syncNotifications,
} from "@/lib/notifications-api";

export type SseStatus = "idle" | "connecting" | "connected" | "disconnected";

type NotificationsState = {
  items: NotificationItem[];
  hydrated: boolean;
  loading: boolean;
  sseStatus: SseStatus;
  inboxOpen: boolean;
  /** When true, mock SSE hook must not open EventSource. */
  ssePaused: boolean;
  sseGeneration: number;
  setInboxOpen: (open: boolean) => void;
  setSseStatus: (status: SseStatus) => void;
  applySnapshot: (items: NotificationItem[]) => void;
  pushItem: (item: NotificationItem) => void;
  markItemRead: (id: string) => void;
  markAllItemsRead: () => void;
  pauseSse: () => void;
  resumeSse: () => void;
  /** Sync métier sources then list (D247). */
  hydrateFromApi: () => Promise<void>;
  unread: () => number;
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  hydrated: false,
  loading: false,
  sseStatus: "idle",
  inboxOpen: false,
  ssePaused: true,
  sseGeneration: 0,
  setInboxOpen: (open) => {
    set({ inboxOpen: open });
    if (open) void get().hydrateFromApi();
  },
  setSseStatus: (sseStatus) => set({ sseStatus }),
  applySnapshot: (items) => set({ items, hydrated: true }),
  pushItem: (item) =>
    set((s) => ({ items: upsertNotification(s.items, item) })),
  markItemRead: (id) => {
    set((s) => ({ items: markRead(s.items, id) }));
    void markNotificationRead(id);
  },
  markAllItemsRead: () => {
    set((s) => ({ items: markAllRead(s.items) }));
    void markAllNotificationsRead();
  },
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
  hydrateFromApi: async () => {
    if (get().loading) return;
    set({ loading: true });
    const synced = await syncNotifications();
    if (synced.ok) {
      set({
        items: synced.data.items,
        hydrated: true,
        loading: false,
        sseStatus: "connected",
      });
      return;
    }
    const listed = await fetchNotifications();
    if (listed.ok) {
      set({
        items: listed.data.items,
        hydrated: true,
        loading: false,
        sseStatus: "disconnected",
      });
      return;
    }
    set({ loading: false, sseStatus: "disconnected" });
  },
  unread: () => unreadCount(get().items),
}));
