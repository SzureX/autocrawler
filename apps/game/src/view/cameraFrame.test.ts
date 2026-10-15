import { describe, expect, it } from 'vitest';
import { RAID_CAMERA_OFFSET, wholeRoomFrame } from './cameraFrame';

const board = { width: 9, height: 7 };

describe('whole-room camera frame', () => {
  it('keeps the raid camera angle and stays south of the room, looking down', () => {
    const f = wholeRoomFrame(board, 1000 / 680);
    expect(f.height).toBeGreaterThan(0);
    expect(f.back).toBeGreaterThan(0);
    expect((f.height - 0.3) / f.back).toBeCloseTo(RAID_CAMERA_OFFSET.y / RAID_CAMERA_OFFSET.z, 3);
  });

  it('a narrower view needs a larger distance to show the whole room', () => {
    const wide = wholeRoomFrame(board, 1.6).distance;
    const narrow = wholeRoomFrame(board, 1.1).distance;
    expect(narrow).toBeGreaterThanOrEqual(wide);
  });

  it('shows more than the room itself: the distance is larger than the room is deep', () => {
    expect(wholeRoomFrame(board, 1000 / 680).distance).toBeGreaterThan(board.height);
  });
});
