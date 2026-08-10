import type { AnimationAction, AnimationClip, AnimationMixer, Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import type { ColonistState } from '../../src/game/domain/workforce/Workforce';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import { getAuthoritativeColonistPose } from '../../src/game/world/prototype/authoritativeColonistPresentation';
import { getHabitatPresentationPoints, getRoadNode, type Point2 } from '../../src/game/world/prototype/prototypeLayout';
import { ColonistMotionInterpolator, interpolateFacing, shortestAngleDelta } from '../../src/game/world/presentation/ColonistMotionInterpolator';
import { CharacterAnimationController } from '../../src/game/world/renderer/CharacterAnimationController';

const fixedStepSeconds = 25 / 60;

function distanceToSegment(point: Point2, start: Point2, end: Point2): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared));
  return Math.hypot(point[0] - (start[0] + dx * ratio), point[1] - (start[1] + dz * ratio));
}

function firstTravelingColonist(engine: SimulationEngine): ColonistState {
  const colonist = engine.getSnapshot().colonists.find(({ travel }) => travel !== null);
  if (colonist === undefined) throw new Error('Expected a traveling colonist.');
  return colonist;
}

describe('continuous authoritative motion presentation', () => {
  it('advances authoritative travel monotonically on consecutive fixed steps', () => {
    const engine = new SimulationEngine();
    const initial = firstTravelingColonist(engine);
    const elapsed = [initial.travel?.elapsedMinutes ?? 0];
    for (let step = 0; step < 4; step += 1) {
      engine.advanceFixedSteps(1);
      const colonist = engine.getSnapshot().colonists.find(({ id }) => id === initial.id);
      elapsed.push(colonist?.travel?.elapsedMinutes ?? Number.POSITIVE_INFINITY);
    }
    expect(elapsed).toEqual([...elapsed].sort((left, right) => left - right));
  });

  it('creates monotonic intermediate route positions between consecutive authoritative ticks', () => {
    const engine = new SimulationEngine();
    const initial = firstTravelingColonist(engine);
    const motion = new ColonistMotionInterpolator(initial);
    engine.advanceFixedSteps(1);
    motion.observe(engine.getSnapshot().colonists.find(({ id }) => id === initial.id) as ColonistState);
    const positions = [0, 0.08, 0.08, 0.08, 0.08, 0.08].map((delta) => getAuthoritativeColonistPose(motion.advance(delta, fixedStepSeconds)).position);
    expect(new Set(positions.map((position) => position.map((value) => value.toFixed(5)).join(':'))).size).toBeGreaterThan(3);
    const origin = positions[0] as readonly [number, number, number];
    const distances = positions.map((position) => Math.hypot(position[0] - origin[0], position[2] - origin[2]));
    expect(distances).toEqual([...distances].sort((left, right) => left - right));
  });

  it('keeps interpolation on the authoritative road polyline through corners', () => {
    const engine = new SimulationEngine();
    const colonist = engine.getSnapshot().colonists.find(({ id }) => id === 'colonist-003');
    const travel = colonist?.travel;
    if (colonist === undefined || travel === null || travel === undefined) throw new Error('Expected colonist-003 travel.');
    const source = getHabitatPresentationPoints().departurePoints[2] as Point2;
    const points = [source, ...travel.routeNodeIds.map((id) => getRoadNode(id).position), getRoadNode('oxygen-entrance').position];
    for (let step = 0; step <= 40; step += 1) {
      const sample: ColonistState = { ...colonist, travel: { ...travel, elapsedMinutes: travel.durationMinutes * step / 40 } };
      const [x, , z] = getAuthoritativeColonistPose(sample).position;
      const distance = Math.min(...points.slice(1).map((point, index) => distanceToSegment([x, z], points[index] as Point2, point)));
      expect(distance).toBeLessThan(0.001);
    }
  });

  it('is FPS-independent for equal presentation time and freezes on zero delta', () => {
    const engine = new SimulationEngine();
    const initial = firstTravelingColonist(engine);
    engine.advanceFixedSteps(1);
    const current = engine.getSnapshot().colonists.find(({ id }) => id === initial.id) as ColonistState;
    const sample = (fps: number) => {
      const motion = new ColonistMotionInterpolator(initial);
      motion.observe(current);
      for (let frame = 0; frame < fps; frame += 1) motion.advance(fixedStepSeconds / fps, fixedStepSeconds);
      return getAuthoritativeColonistPose(motion.sample()).position;
    };
    const at30 = sample(30);
    const at60 = sample(60);
    const at144 = sample(144);
    for (let index = 0; index < 3; index += 1) {
      expect(at30[index]).toBeCloseTo(at60[index] ?? 0);
      expect(at60[index]).toBeCloseTo(at144[index] ?? 0);
    }
    const paused = new ColonistMotionInterpolator(initial);
    paused.observe(current);
    const before = paused.sample();
    expect(paused.advance(0, fixedStepSeconds)).toEqual(before);
  });

  it('hands travel completion to the terminal pose without a position jump', () => {
    const engine = new SimulationEngine();
    const initial = firstTravelingColonist(engine);
    const duration = initial.travel?.durationMinutes ?? 0;
    engine.advanceFixedSteps(duration - 1);
    const penultimate = engine.getSnapshot().colonists.find(({ id }) => id === initial.id) as ColonistState;
    const motion = new ColonistMotionInterpolator(penultimate);
    engine.advanceFixedSteps(1);
    const terminal = engine.getSnapshot().colonists.find(({ id }) => id === initial.id) as ColonistState;
    motion.observe(terminal);
    const positions = [0, 0.1, 0.1, 0.1, 0.1, 0.1].map((delta) => getAuthoritativeColonistPose(motion.advance(delta, fixedStepSeconds)).position);
    const final = positions.at(-1) as readonly [number, number, number];
    const terminalPosition = getAuthoritativeColonistPose(terminal).position;
    expect(final).toEqual(terminalPosition);
    expect(Math.max(...positions.slice(1).map((position, index) => Math.hypot(position[0] - (positions[index]?.[0] ?? position[0]), position[2] - (positions[index]?.[2] ?? position[2]))))).toBeLessThan(0.5);
  });

  it('preserves position continuity through Habitat arrival', () => {
    const engine = new SimulationEngine();
    engine.advanceFixedSteps(72);
    const returning = engine.getSnapshot().colonists.find(({ travel }) => travel?.purpose === 'return-to-habitat');
    if (returning?.travel === null || returning?.travel === undefined) throw new Error('Expected a returning colonist.');
    engine.advanceFixedSteps(returning.travel.durationMinutes - returning.travel.elapsedMinutes - 1);
    const penultimate = engine.getSnapshot().colonists.find(({ id }) => id === returning.id) as ColonistState;
    const motion = new ColonistMotionInterpolator(penultimate);
    engine.advanceFixedSteps(1);
    const resting = engine.getSnapshot().colonists.find(({ id }) => id === returning.id) as ColonistState;
    motion.observe(resting);
    const positions = [0, 0.1, 0.1, 0.1, 0.1, 0.1].map((delta) => getAuthoritativeColonistPose(motion.advance(delta, fixedStepSeconds)).position);
    expect(positions.at(-1)).toEqual(getAuthoritativeColonistPose(resting).position);
    expect(Math.max(...positions.slice(1).map((position, index) => Math.hypot(position[0] - (positions[index]?.[0] ?? position[0]), position[2] - (positions[index]?.[2] ?? position[2]))))).toBeLessThan(0.5);
    expect(resting).toMatchObject({ locationId: 'habitat', state: 'resting', travel: null });
  });

  it('hands maintenance arrival to an active Idle work-point pose continuously', () => {
    const engine = new SimulationEngine();
    const template = firstTravelingColonist(engine);
    const travel = template.travel;
    if (travel === null) throw new Error('Expected travel template.');
    const penultimate: ColonistState = {
      ...template,
      assignment: { facilityId: 'mine-01', id: 'work-maintenance-mine-01', phase: 'traveling', taskType: 'maintenance' },
      travel: { ...travel, durationMinutes: 34, elapsedMinutes: 33, targetLocationId: 'mine-01', taskType: 'maintenance' },
    };
    const onSite: ColonistState = {
      ...penultimate,
      assignment: { ...penultimate.assignment!, phase: 'on-site' },
      locationId: 'mine-01',
      travel: null,
    };
    const motion = new ColonistMotionInterpolator(penultimate);
    motion.observe(onSite);
    const positions = [0, 0.1, 0.1, 0.1, 0.1, 0.1].map((delta) => getAuthoritativeColonistPose(motion.advance(delta, fixedStepSeconds)).position);
    expect(positions.at(-1)).toEqual(getAuthoritativeColonistPose(onSite).position);
    expect(getAuthoritativeColonistPose(motion.sample())).toMatchObject({ activity: true, animation: 'Idle', visible: true });
  });

  it('uses shortest-angle facing interpolation and freezes rotation on Pause', () => {
    expect(Math.abs(shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1))).toBeCloseTo(0.2);
    expect(interpolateFacing(1, 2, 0)).toBe(1);
    expect(interpolateFacing(Math.PI - 0.1, -Math.PI + 0.1, 0.1)).toBeGreaterThan(Math.PI - 0.1);
  });
});

interface FakeAction extends Partial<AnimationAction> {
  clampWhenFinished: boolean;
  crossFades: string[];
  effectiveWeight: number;
  enabled: boolean;
  name: string;
  plays: number;
  resets: number;
  running: boolean;
}

function fakeAction(name: string, sequence: string[]): FakeAction {
  const action: FakeAction = {
    clampWhenFinished: true, crossFades: [], effectiveWeight: 1, enabled: false, name, plays: 0, resets: 0, running: false,
    crossFadeTo(next) { action.crossFades.push((next as unknown as FakeAction).name); sequence.push(`crossfade:${name}->${(next as unknown as FakeAction).name}`); return action as AnimationAction; },
    getEffectiveWeight() { return action.effectiveWeight; },
    isRunning() { return action.running; },
    play() { action.plays += 1; action.running = true; sequence.push(`play:${name}`); return action as AnimationAction; },
    reset() { action.resets += 1; sequence.push(`reset:${name}`); return action as AnimationAction; },
    setLoop() { sequence.push(`loop:${name}`); return action as AnimationAction; },
    setEffectiveTimeScale() { return action as AnimationAction; },
    setEffectiveWeight(weight) { action.effectiveWeight = weight; return action as AnimationAction; },
  };
  return action;
}

describe('stable character animation lifecycle', () => {
  it('crossfades without an action gap and does not reset repeated Walk snapshots', () => {
    const sequence: string[] = [];
    const idle = fakeAction('Idle', sequence);
    const walk = fakeAction('Walk', sequence);
    const actions = new Map([['Idle', idle], ['Walk', walk]]);
    const mixer = {
      clipAction: (clip: AnimationClip) => actions.get(clip.name) as AnimationAction,
      stopAllAction: () => sequence.push('stop-all'), update: () => undefined,
    } as unknown as AnimationMixer;
    const controller = new CharacterAnimationController(mixer, [{ name: 'Idle' }, { name: 'Walk' }] as AnimationClip[], {} as Object3D);
    controller.activate('Idle');
    controller.activate('Walk');
    controller.activate('Walk');
    expect(sequence.indexOf('play:Walk')).toBeLessThan(sequence.indexOf('crossfade:Idle->Walk'));
    expect(walk.resets).toBe(1);
    expect(walk.plays).toBe(1);
    expect(sequence).not.toContain('stop-all');
    expect(controller.getActiveName()).toBe('Walk');
    controller.activate('Idle');
    expect(sequence).toContain('crossfade:Walk->Idle');
    expect(controller.getActiveName()).toBe('Idle');
    expect(controller.isReady()).toBe(true);
  });

  it('keeps a positive enabled action through ten Idle/Walk transitions', () => {
    const idle = fakeAction('Idle', []);
    const walk = fakeAction('Walk', []);
    const actions = new Map([['Idle', idle], ['Walk', walk]]);
    const updates: number[] = [];
    const mixer = {
      clipAction: (clip: AnimationClip) => actions.get(clip.name) as AnimationAction,
      stopAllAction: () => undefined,
      update: (delta: number) => updates.push(delta),
    } as unknown as AnimationMixer;
    const controller = new CharacterAnimationController(mixer, [{ name: 'Idle' }, { name: 'Walk' }] as AnimationClip[], {} as Object3D);
    for (let index = 0; index < 10; index += 1) {
      const name = index % 2 === 0 ? 'Idle' : 'Walk';
      controller.activate(name);
      expect(controller.getActiveState()).toMatchObject({ effectiveWeight: 1, enabled: true, name, running: true });
    }
    expect(updates).toEqual(Array.from({ length: 10 }, () => 0));
  });

  it('fails fast for invalid clips and scales mixer time only through presentation delta', () => {
    const updates: number[] = [];
    const action = fakeAction('Idle', []);
    const mixer = { clipAction: () => action as AnimationAction, stopAllAction: () => undefined, update: (delta: number) => updates.push(delta) } as unknown as AnimationMixer;
    const controller = new CharacterAnimationController(mixer, [{ name: 'Idle' }] as AnimationClip[], {} as Object3D);
    expect(() => controller.activate('Walk')).toThrow(/missing/);
    controller.activate('Idle');
    controller.update(0);
    controller.update(0.2);
    controller.update(0.4);
    expect(updates).toEqual([0, 0, 0.2, 0.4]);
  });
});
