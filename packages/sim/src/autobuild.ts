import type { GameData } from '@loch/data';
import { grantArtifact } from './artifacts';
import { legalPlacements, placeTile } from './dungeon';
import { equip } from './inventory';
import { createRng } from './rng';
import { createRun } from './run';
import { chooseTile, generateTileOffer } from './tiles';
import type { RunState } from './types';

/**
 * Builds a dungeon at random (random offered tile, random legal position, one wave at a time)
 * and returns every state that holds a fresh offer. Used by tools and tests, never by the game.
 */
export function randomBuildStates(
  data: GameData,
  seed: number,
  classId: string,
  waves: number,
): RunState[] {
  const rng = createRng(seed).fork('autobuild');
  let run = createRun(data, seed, classId);
  const states: RunState[] = [run];
  for (let w = 0; w < waves; w++) {
    const pick = rng.pick(run.tileOffer);
    run = chooseTile(run, pick.uid);
    const spots = legalPlacements(data, run.dungeon, pick);
    if (spots.length === 0) break;
    run = placeTile(data, run, pick.uid, rng.pick(spots));
    run = generateTileOffer(data, { ...run, wavesWon: run.wavesWon + 1, phase: 'TileOffer' });
    states.push(run);
  }
  return states;
}

/** A Prep-phase run with `waves` built rooms and `artifactCount` random artifacts equipped. */
export function randomRaidReadyRun(
  data: GameData,
  seed: number,
  classId: string,
  waves: number,
  artifactCount: number,
): RunState {
  const states = randomBuildStates(data, seed, classId, waves);
  const last = states[states.length - 1];
  if (!last) throw new Error('no build state');
  let run: RunState = { ...last, phase: 'Prep', wavesWon: waves, tileOffer: [] };
  const rng = createRng(seed).fork('autoequip');
  const ids = Object.keys(data.artifacts);
  const count = Math.min(9, artifactCount);
  for (let i = 0; i < count; i++) run = grantArtifact(data, run, rng.pick(ids));
  for (let i = 0; i < count; i++) {
    const inst = run.backpack[0];
    if (inst) run = equip(run, inst.uid, i);
  }
  return run;
}
