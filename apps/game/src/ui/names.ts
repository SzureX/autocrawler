import { t } from '../i18n';
import { gameData } from '../store/gameStore';

export function monsterName(id: string): string {
  const def = gameData.monsters[id] ?? gameData.bosses[id];
  return t(def?.nameKey ?? id);
}

export function artifactName(id: string): string {
  return t(gameData.artifacts[id]?.nameKey ?? id);
}

export function upgradeName(id: string): string {
  return t(gameData.roomUpgrades[id]?.nameKey ?? id);
}

export function roomTypeName(id: string): string {
  return t(gameData.roomTypes[id]?.nameKey ?? id);
}
