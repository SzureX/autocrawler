/** Pure geometry helpers of the 3D raid view (no Three.js types, so they are easy to test). */
export interface BoardSize {
  width: number;
  height: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

/** One board cell is one world unit; the board is centred on the origin. */
export function cellToWorld(x: number, y: number, board: BoardSize): Vec2 {
  return { x: x - board.width / 2 + 0.5, z: y - board.height / 2 + 0.5 };
}

/** Keeps the camera focus inside the room so the camera never drifts far outside the walls. */
export function clampFocus(target: Vec2, board: BoardSize, marginCells = 2): Vec2 {
  const maxX = Math.max(0, board.width / 2 - marginCells);
  const maxZ = Math.max(0, board.height / 2 - marginCells);
  return {
    x: Math.min(maxX, Math.max(-maxX, target.x)),
    z: Math.min(maxZ, Math.max(-maxZ, target.z)),
  };
}

/** Frame-rate independent smoothing factor in [0, 1] for an exponential approach. */
export function smoothing(deltaSeconds: number, speed = 6): number {
  return 1 - Math.exp(-speed * Math.max(0, deltaSeconds));
}

/** Yaw (rotation around Y) that makes local +Z point along (dx, dz). */
export function facingAngle(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** Shortest signed angle difference from `from` to `to`, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Lunge distance of an attack animation: 0 outside the window, peaks in the middle. */
export function lungeAmount(ticksSinceAttack: number, windowTicks = 5, reach = 0.3): number {
  if (ticksSinceAttack < 0 || ticksSinceAttack >= windowTicks) return 0;
  return Math.sin((ticksSinceAttack / windowTicks) * Math.PI) * reach;
}
