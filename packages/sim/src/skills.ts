import type { GameData, SkillNodeDef, SkillTreeDef } from '@loch/data';
import { earnedSkillPoints } from './xp';
import type { RunPhase, RunState } from './types';

/** Phases in which the skill tree can be used: the Prep screen (also while a tile is offered). */
const SKILL_PHASES: readonly RunPhase[] = ['Prep', 'TileOffer', 'BossOffer'];

/** Why a node cannot be bought right now (null: it can). */
export type SkillBlock = 'locked' | 'maxed' | 'noPoints' | 'phase';

export interface SkillNodeStatus {
  node: SkillNodeDef;
  /** Levels bought so far. */
  level: number;
  /** Cost of the next level (null when maxed). */
  cost: number | null;
  /** Names the first missing requirement (node ids) when the node is locked. */
  missing: string[];
  block: SkillBlock | null;
}

/** The skill tree of the run's class (undefined: the class has none). */
export function skillTreeFor(data: GameData, classId: string): SkillTreeDef | undefined {
  return data.skillTrees[classId];
}

/** Points already spent: the cost of every bought level of every node. */
export function spentSkillPoints(
  data: GameData,
  run: Pick<RunState, 'classId' | 'skills'>,
): number {
  const tree = skillTreeFor(data, run.classId);
  if (!tree) return 0;
  let spent = 0;
  for (const node of tree.nodes) {
    const level = run.skills[node.id] ?? 0;
    for (const l of node.levels) if (l.level <= level) spent += l.cost;
  }
  return spent;
}

/** Points to spend: one per level above the first, minus what is spent. */
export function availableSkillPoints(
  data: GameData,
  run: Pick<RunState, 'classId' | 'skills' | 'level'>,
): number {
  return Math.max(0, earnedSkillPoints(run) - spentSkillPoints(data, run));
}

/** State of one node for the UI and for `buySkill`. */
export function skillNodeStatus(data: GameData, run: RunState, nodeId: string): SkillNodeStatus {
  const tree = skillTreeFor(data, run.classId);
  const node = tree?.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Unknown skill node: ${nodeId}`);
  const level = run.skills[node.id] ?? 0;
  const next = node.levels.find((l) => l.level === level + 1);
  const missing = node.requires.filter((r) => (run.skills[r] ?? 0) < 1);
  let block: SkillBlock | null = null;
  if (!SKILL_PHASES.includes(run.phase)) block = 'phase';
  else if (!next) block = 'maxed';
  else if (missing.length > 0) block = 'locked';
  else if (availableSkillPoints(data, run) < next.cost) block = 'noPoints';
  return { node, level, cost: next?.cost ?? null, missing, block };
}

/**
 * Buys the next level of a node. A node needs every node it requires to be bought first; the
 * points are never returned (a bought skill stays bought for the run).
 */
export function buySkill(data: GameData, run: RunState, nodeId: string): RunState {
  const status = skillNodeStatus(data, run, nodeId);
  if (status.block !== null) throw new Error(`Cannot buy ${nodeId}: ${status.block}`);
  return { ...run, skills: { ...run.skills, [nodeId]: status.level + 1 } };
}
