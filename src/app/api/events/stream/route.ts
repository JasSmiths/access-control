import { getSession } from "@/lib/auth";
import { getBus } from "@/lib/events-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const bus = getBus();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (name: string, data: unknown) => {
        if (closed) return;
        const chunk = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // initial comment to open the stream on some proxies
      controller.enqueue(encoder.encode(": connected\n\n"));

      const listener = (e: { name: string; data: unknown }) => send(e.name, e.data);
      bus.on("evt", listener);

      // periodic keep-alive
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 25_000);

      const onAbort = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        bus.off("evt", listener);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };
      request.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
