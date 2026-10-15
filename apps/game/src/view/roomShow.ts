import type { Dir } from '@loch/sim';
import { gameData } from '../store/gameStore';
import type { ModelLibrary } from './models';
import type { RoomStage } from './roomStage';

export interface RoomLook {
  roomTypeId: string;
  doors: readonly Dir[];
  layoutId?: string | undefined;
}

/** Everything a room needs to look like it does in the raid: type tint, doorways, layout. */
export function showRoom(
  stage: RoomStage,
  models: ModelLibrary,
  look: RoomLook,
  alive: () => boolean = () => true,
): void {
  stage.setTheme(look.roomTypeId);
  stage.setDoors(look.doors);
  const layout = look.layoutId ? (gameData.roomLayouts[look.layoutId] ?? null) : null;
  if (!layout) {
    stage.setLayout(null);
    return;
  }
  if (stage.canShow(layout)) {
    stage.setLayout(layout);
    return;
  }
  stage.setLayout(null);
  const keys = [
    ...layout.floors.map((f) => `floor:${f.id}`),
    ...layout.props.map((p) => `prop:${p.id}`),
  ];
  void models.load(keys, { animations: false }).then(() => {
    if (alive()) stage.setLayout(layout);
  });
}
