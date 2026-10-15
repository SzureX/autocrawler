import { roomLayoutSchema, type RoomLayoutDef } from '@loch/data';

const ENDPOINT = '/__dev/room-layouts';

/** Saved room layouts, read from the development server (the file the game bundles). */
export async function fetchLayouts(): Promise<RoomLayoutDef[]> {
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return roomLayoutSchema.array().parse(await res.json());
}

/** Replaces all saved layouts (development server only). */
export async function saveLayouts(layouts: RoomLayoutDef[]): Promise<void> {
  const checked = roomLayoutSchema.array().parse(layouts);
  const res = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checked),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
