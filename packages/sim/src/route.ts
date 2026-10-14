import { connectedNeighbors } from './dungeon';
import type { DungeonState } from './types';

export interface RaidRoute {
  /** Room keys in clearing order: DFS preorder over regular rooms, then the boss (if any). */
  stops: string[];
  /** paths[i] = shortest walk from stops[i-1] to stops[i], both ends included; paths[0] = [start]. */
  paths: string[][];
}

/** Shortest path (BFS, neighbours in N,E,S,W order); the boss is only ever a destination. */
function shortestPath(dungeon: DungeonState, from: string, to: string): string[] {
  if (from === to) return [from];
  const prev: Record<string, string> = {};
  const seen: Record<string, boolean> = { [from]: true };
  const queue: string[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === undefined) break;
    for (const next of connectedNeighbors(dungeon, cur)) {
      if (seen[next]) continue;
      if (dungeon.rooms[next]?.isBoss && next !== to) continue;
      seen[next] = true;
      prev[next] = cur;
      if (next === to) {
        const path = [to];
        let at = to;
        while (at !== from) {
          const p = prev[at];
          if (p === undefined) break;
          path.push(p);
          at = p;
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  throw new Error(`No path from ${from} to ${to}`);
}

/** Raid route (CLAUDE.md 6.2): DFS preorder from room #1, backtracking through cleared rooms, boss last. */
export function computeRaidRoute(dungeon: DungeonState): RaidRoute {
  const stops: string[] = [];
  const visited: Record<string, boolean> = {};
  const visit = (key: string): void => {
    visited[key] = true;
    stops.push(key);
    for (const next of connectedNeighbors(dungeon, key)) {
      if (visited[next] || dungeon.rooms[next]?.isBoss) continue;
      visit(next);
    }
  };
  visit(dungeon.startKey);
  const boss = Object.values(dungeon.rooms).find((r) => r.isBoss);
  if (boss) stops.push(`${boss.pos.x},${boss.pos.y}`);

  const paths: string[][] = [[dungeon.startKey]];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (a === undefined || b === undefined) continue;
    paths.push(shortestPath(dungeon, a, b));
  }
  return { stops, paths };
}
