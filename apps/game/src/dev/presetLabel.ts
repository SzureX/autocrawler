import { t } from '../i18n';
import type { RoomPreset } from '../view/roomBuilder';

/** Text of a door layout in the room builder lists (entrance and exit sides). */
export function presetLabel(p: RoomPreset): string {
  switch (p.kind) {
    case 'all':
      return t('dev.builder.preset.all');
    case 'start':
      return t('dev.builder.preset.start', { exit: t(`dir.${p.exit ?? 'E'}`) });
    case 'boss':
      return t('dev.builder.preset.boss', { entrance: t(`dir.${p.entrance ?? 'W'}`) });
    default:
      return t('dev.builder.preset.regular', {
        entrance: t(`dir.${p.entrance ?? 'W'}`),
        exit: t(`dir.${p.exit ?? 'E'}`),
      });
  }
}
