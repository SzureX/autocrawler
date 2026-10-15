/** True when the player asked the system for less motion (the game then skips flourishes). */
export function reducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
