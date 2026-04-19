import { EventEmitter } from "node:events";

declare global {
  // eslint-disable-next-line no-var
  var __crestHouseAccessBus: EventEmitter | undefined;
}

/** Process-wide pub/sub for live dashboard updates (SSE fan-out). */
export function getBus(): EventEmitter {
  if (!globalThis.__crestHouseAccessBus) {
    const b = new EventEmitter();
    b.setMaxListeners(0); // no artificial cap — one listener per SSE client
    globalThis.__crestHouseAccessBus = b;
  }
  return globalThis.__crestHouseAccessBus;
}

export type BusEventName =
  | "session.opened"
  | "session.closed"
  | "session.flagged"
  | "contractor.updated"
  | "log.created";

export function emit(name: BusEventName, data: unknown) {
  getBus().emit("evt", { name, data });
}
