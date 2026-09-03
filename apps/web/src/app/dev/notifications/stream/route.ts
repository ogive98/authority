import { SEED_NOTIFICATIONS, nextStreamNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Mock SSE for UI-09 gate — path outside /api so Next does not rewrite to Nest.
 * Query `?once=1` sends one event then closes (auto-disconnect test).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const once = url.searchParams.get("once") === "1";
  const encoder = new TextEncoder();
  let seq = 0;
  let closed = false;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );
      };

      send({
        kind: "snapshot",
        items: SEED_NOTIFICATIONS,
      });

      if (once) {
        send({
          kind: "notification",
          item: nextStreamNotification(seq++),
        });
        closed = true;
        controller.close();
        return;
      }

      intervalId = setInterval(() => {
        send({
          kind: "notification",
          item: nextStreamNotification(seq++),
        });
      }, 4_000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        if (intervalId) clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
