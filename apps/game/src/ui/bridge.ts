/**
 * A picture handed from one screen to the next so the change blends in: the screen that is
 * leaving stores the last frame it drew, the one that arrives fades it out over its own picture.
 */
export interface Bridge {
  image: string;
  /** Room the camera was in when the picture was taken (null: not about a room). */
  roomKey: string | null;
  madeAt: number;
}

/** A picture older than this is stale (the player went somewhere else in between). */
const MAX_AGE_MS = 4000;

let pending: Bridge | null = null;

export function setBridge(image: string | null, roomKey: string | null): void {
  pending = image ? { image, roomKey, madeAt: Date.now() } : null;
}

/** The stored picture, when there is one and it is fresh (reading does not remove it). */
export function peekBridge(): Bridge | null {
  return pending && Date.now() - pending.madeAt < MAX_AGE_MS ? pending : null;
}

/** Forgets the stored picture (the arriving screen calls this once it has taken it). */
export function clearBridge(): void {
  pending = null;
}
