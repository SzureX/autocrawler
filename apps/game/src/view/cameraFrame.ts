/**
 * The raid camera: it hangs this far above and behind the point it looks at. The dungeon map
 * uses the same numbers when it zooms into a room, so the two views line up at the hand-over.
 */
export const RAID_CAMERA_OFFSET = { y: 7.6, z: 6.8 };
export const RAID_FOV = 45;
/** Distance from the camera to the point it looks at. */
export const RAID_DISTANCE = Math.hypot(RAID_CAMERA_OFFSET.y, RAID_CAMERA_OFFSET.z);
/** Height of the point the raid camera looks at. */
export const RAID_LOOK_HEIGHT = 0.3;
/** Where the raid camera looks while the hero stands outside the west door of the first room. */
export const RAID_START_FOCUS = { x: -2.5, z: 0 };
