import { useEffect, useRef } from 'react';
import type { RoomTile } from '@loch/sim';
import { t } from '../i18n';
import { gameData } from '../store/gameStore';
import { RoomPreviewCanvas } from '../view/RoomPreviewCanvas';
import { roomTypeName } from './names';
import { SpawnList } from './TileView';

const PREVIEW_WIDTH = 250;
const PREVIEW_HEIGHT = 170;

/** Live 3D picture of the room a tile would build. */
function TilePreview({ tile }: { tile: RoomTile }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const preview = new RoomPreviewCanvas(host.current, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    void preview.init({
      roomTypeId: tile.roomTypeId,
      doors: tile.doors,
      layoutId: tile.layoutId,
    });
    return () => preview.destroy();
  }, [tile]);
  return <div ref={host} className="card-preview" data-testid={`preview-${tile.uid}`} />;
}

interface Props {
  tiles: readonly RoomTile[];
  title: string;
  /** The card the player took (it punches); the others fade out. Null while choosing. */
  chosen: string | null;
  /** The whole popup fades out (the room is flying to the map). */
  leaving: boolean;
  onChoose: (tile: RoomTile, card: HTMLElement) => void;
}

/** Popup over the map with one card per offered tile: room picture, name and description. */
export function TileOfferPopup({ tiles, title, chosen, leaving, onChoose }: Props) {
  return (
    <div
      className={`offer-popup${leaving ? ' leaving' : ''}`}
      data-testid="offer-popup"
      role="dialog"
      aria-label={title}
    >
      <h2>{title}</h2>
      <div className="offer-cards">
        {tiles.map((tile) => {
          const type = gameData.roomTypes[tile.roomTypeId];
          const state = chosen === null ? '' : chosen === tile.uid ? ' punched' : ' dismissed';
          return (
            <button
              key={tile.uid}
              type="button"
              className={`offer-card${state}`}
              disabled={chosen !== null}
              data-testid={`take-${tile.uid}`}
              onClick={(e) => onChoose(tile, e.currentTarget)}
            >
              <TilePreview tile={tile} />
              <strong className="offer-card-name">{roomTypeName(tile.roomTypeId)}</strong>
              <span className="offer-card-desc">{type ? t(type.descKey) : ''}</span>
              <span className="offer-card-spawns">
                {t('ui.tile.monsters')}: <SpawnList tile={tile} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
