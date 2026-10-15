import { PerspectiveCamera, Vector3 } from 'three';
import { WALL_HEIGHT, roomRect } from './mapLayout';
import type { BoardSize } from './layout';

/**
 * The raid camera: it looks down at the room from the south, at this angle (the same offset
 * ratio the game always used). It never follows the hero; it shows the whole room.
 */
export const RAID_CAMERA_OFFSET = { y: 7.6, z: 6.8 };
export const RAID_FOV = 45;
/** Height of the point the camera looks at. */
export const RAID_LOOK_HEIGHT = 0.3;
/** Wall pieces reach about this high, so the frame has to leave room for them. */
const FRAME_WALL_HEIGHT = Math.max(WALL_HEIGHT, 2);

export interface WholeRoomFrame {
  /** Distance from the camera to the point it looks at. */
  distance: number;
  /** Camera position relative to the room centre: height and distance to the south. */
  height: number;
  back: number;
}

/**
 * The smallest distance at which the whole room (floor and walls, with a little margin) fits in a
 * view of the given aspect ratio, looking along the raid camera's direction at the room centre.
 */
export function wholeRoomFrame(board: BoardSize, aspect: number): WholeRoomFrame {
  const rect = roomRect('0,0', board);
  const corners: Vector3[] = [];
  for (const x of [rect.minX, rect.maxX]) {
    for (const z of [rect.minZ, rect.maxZ]) {
      corners.push(new Vector3(x, 0, z), new Vector3(x, FRAME_WALL_HEIGHT, z));
    }
  }
  const length = Math.hypot(RAID_CAMERA_OFFSET.y, RAID_CAMERA_OFFSET.z);
  const dir = new Vector3(0, RAID_CAMERA_OFFSET.y / length, RAID_CAMERA_OFFSET.z / length);
  const target = new Vector3(0, RAID_LOOK_HEIGHT, 0);
  const probe = new PerspectiveCamera(RAID_FOV, aspect, 0.1, 200);
  let lo = 3;
  let hi = 80;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    probe.position.copy(target).addScaledVector(dir, mid);
    probe.lookAt(target);
    probe.updateMatrixWorld(true);
    const fits = corners.every((c) => {
      const p = c.clone().project(probe);
      return Math.abs(p.x) <= 0.96 && Math.abs(p.y) <= 0.96 && p.z < 1;
    });
    if (fits) hi = mid;
    else lo = mid;
  }
  return { distance: hi, height: RAID_LOOK_HEIGHT + dir.y * hi, back: dir.z * hi };
}
