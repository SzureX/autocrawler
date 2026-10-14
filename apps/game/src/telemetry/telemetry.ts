/** Local telemetry: events stay in an in-memory buffer (no network); exported as JSON in the debug overlay. */
export type TelemetryProps = Record<string, string | number | boolean | null | string[]>;

export interface TelemetryEvent {
  event: string;
  /** Order of the event in this session (no wall clock, so it is reproducible). */
  index: number;
  props: TelemetryProps;
}

const MAX_EVENTS = 5000;
let buffer: TelemetryEvent[] = [];
let counter = 0;

export function track(event: string, props: TelemetryProps = {}): void {
  buffer.push({ event, index: counter++, props });
  if (buffer.length > MAX_EVENTS) buffer = buffer.slice(buffer.length - MAX_EVENTS);
}

export function getEvents(): readonly TelemetryEvent[] {
  return buffer;
}

export function clearEvents(): void {
  buffer = [];
  counter = 0;
}

export function exportTelemetryJson(): string {
  return JSON.stringify(buffer, null, 2);
}
