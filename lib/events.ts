import { EventEmitter } from "node:events";

/** In-process bus that pushes post updates to the browser over SSE. */
const g = globalThis as unknown as { __outlierBus?: EventEmitter };
export const bus = g.__outlierBus ?? (g.__outlierBus = new EventEmitter().setMaxListeners(100));

export type BusEvent =
  | { type: "post"; id: number }
  | { type: "removed"; id: number }
  | { type: "reset" };

export function emit(e: BusEvent) {
  bus.emit("event", e);
}
