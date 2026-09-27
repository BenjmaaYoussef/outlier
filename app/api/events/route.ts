import { getPost } from "@/lib/db";
import { bus, type BusEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** Server-sent events: pushes post changes so the feed updates live. */
export function GET(req: Request) {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      const onEvent = (e: BusEvent) => {
        if (e.type === "post") {
          const post = getPost(e.id);
          if (post) send({ type: "post", post });
        } else send(e);
      };
      bus.on("event", onEvent);
      const ping = setInterval(() => controller.enqueue(enc.encode(": ping\n\n")), 15_000);
      send({ type: "hello" });
      cleanup = () => {
        clearInterval(ping);
        bus.off("event", onEvent);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
