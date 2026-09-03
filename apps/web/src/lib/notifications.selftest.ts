import assert from "node:assert/strict";
import {
  SEED_NOTIFICATIONS,
  isP0,
  markAllRead,
  markRead,
  unreadCount,
  upsertNotification,
} from "./notifications";

assert.equal(unreadCount(SEED_NOTIFICATIONS), 2);

const one = markRead(SEED_NOTIFICATIONS, "n-seed-1");
assert.equal(unreadCount(one), 1);
assert.ok(one.find((n) => n.id === "n-seed-1")?.read);

const all = markAllRead(SEED_NOTIFICATIONS);
assert.equal(unreadCount(all), 0);

const p0 = SEED_NOTIFICATIONS.find((n) => n.id === "n-seed-1");
assert.ok(p0 && isP0(p0));

const upserted = upsertNotification(SEED_NOTIFICATIONS, {
  id: "n-seed-1",
  type: "danger",
  title: "Updated",
  body: "x",
  createdAt: new Date().toISOString(),
  read: false,
  priority: "p0",
});
assert.equal(upserted.find((n) => n.id === "n-seed-1")?.title, "Updated");
assert.equal(upserted.length, SEED_NOTIFICATIONS.length);

const added = upsertNotification(SEED_NOTIFICATIONS, {
  id: "n-new",
  type: "info",
  title: "New",
  body: "y",
  createdAt: new Date().toISOString(),
  read: false,
  priority: "p2",
});
assert.equal(added.length, SEED_NOTIFICATIONS.length + 1);
assert.equal(added[0]?.id, "n-new");

console.log("notifications helpers OK");
