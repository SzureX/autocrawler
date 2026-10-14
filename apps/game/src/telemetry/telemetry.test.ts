import { beforeEach, describe, expect, it } from 'vitest';
import { loadSpecGameData } from '@loch/data';
import { createRun, resolveRaid, startRaid, simulateRaid, type RunState } from '@loch/sim';
import { clearEvents, exportTelemetryJson, getEvents, track } from './telemetry';
import { trackRunTransition } from './runEvents';

const data = loadSpecGameData();

describe('telemetry buffer', () => {
  beforeEach(clearEvents);

  it('keeps events in order and exports valid JSON', () => {
    track('a', { n: 1 });
    track('b', { list: ['x', 'y'] });
    expect(getEvents().map((e) => e.event)).toEqual(['a', 'b']);
    const parsed = JSON.parse(exportTelemetryJson()) as { event: string; index: number }[];
    expect(parsed.map((e) => e.index)).toEqual([0, 1]);
  });

  it('caps the buffer', () => {
    for (let i = 0; i < 6000; i++) track('x', { i });
    expect(getEvents()).toHaveLength(5000);
    expect(getEvents()[0]?.props['i']).toBe(1000);
  });
});

describe('run transitions', () => {
  beforeEach(clearEvents);

  it('records run start, raid result (wave, lives, class, equipment, cause) and run end', () => {
    const start: RunState = createRun(data, 4, 'mage');
    trackRunTransition(null, start);
    const prep: RunState = { ...start, phase: 'Prep', tileOffer: [] };
    const action = startRaid(prep);
    const result = simulateRaid(data, action);
    const resolved = resolveRaid(action, {
      ...result,
      won: false,
      reason: 'died',
      death: { roomKey: '4,4', killerMonsterId: 'rat' },
    });
    trackRunTransition(action, resolved);
    const over: RunState = { ...resolved, phase: 'GameOver', lives: 0 };
    trackRunTransition(resolved, over);
    const names = getEvents().map((e) => e.event);
    expect(names).toEqual(['run_started', 'raid_resolved', 'run_ended']);
    expect(getEvents()[1]?.props).toMatchObject({
      classId: 'mage',
      won: false,
      killer: 'rat',
      lives: 4,
      wavesWon: 0,
      equipment: [],
    });
    expect(getEvents()[2]?.props).toMatchObject({ outcome: 'GameOver' });
  });
});
