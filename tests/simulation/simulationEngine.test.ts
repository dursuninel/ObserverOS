import { describe, expect, it } from 'vitest';

import type { FacilityCommandRequest, FacilityDefinition } from '../../src/game/domain/facilities/Facility';
import type { SimulationConfig } from '../../src/game/simulation/SimulationConfig';
import { PHASE_TWO_BASELINE_CONFIG } from '../../src/game/simulation/SimulationConfig';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import { simulationSnapshotToTimeOfDay } from '../../src/game/world/prototype/simulationWorldAdapter';

function modeCommand(engine: SimulationEngine, id: string, value: 'eco' | 'normal' | 'boost'): FacilityCommandRequest {
  return { actuator: 'set-mode', facilityId: 'mine-01', id, priority: 'normal', simTime: engine.getSnapshot().time.elapsedMinutes, value };
}

function priorityScenario(): SimulationConfig {
  const facilities: readonly FacilityDefinition[] = [
    { id: 'producer', initialCondition: 100, initialMode: 'normal', initialState: 'online', modes: { normal: { productionPerHour: { energy: 10 } } }, typeId: 'producer' },
    { id: 'a-consumer', initialCondition: 100, initialMode: 'normal', initialState: 'online', modes: { normal: { consumptionPerHour: { energy: 8 }, productionPerHour: { material: 1 } } }, typeId: 'consumer' },
    { id: 'b-consumer', initialCondition: 100, initialMode: 'normal', initialState: 'online', modes: { normal: { consumptionPerHour: { energy: 8 }, productionPerHour: { oxygen: 1 } } }, typeId: 'consumer' },
    { id: 'material-store', initialCondition: 100, initialState: 'standby', storageCapacity: { material: 10 }, typeId: 'material-storage' },
    { id: 'oxygen-store', initialCondition: 100, initialState: 'standby', storageCapacity: { oxygen: 10 }, typeId: 'oxygen-storage' },
  ];
  return {
    baseConsumptionPerHour: {},
    clock: { fixedStepMinutes: 60, localDayMinutes: 1_440, realSecondsPerSimulationHour: 25 },
    daylightDurationMinutes: 840,
    facilities,
    initialResources: { energy: 0, material: 0, oxygen: 0 },
    initialSpeed: 1,
  };
}

describe('SimulationEngine Phase 2 core', () => {
  it('runs headless fixed steps and publishes a deeply read-only snapshot', () => {
    const engine = new SimulationEngine();
    engine.advanceFixedSteps(60);
    const snapshot = engine.getSnapshot();
    expect(snapshot.time.elapsedMinutes).toBe(60);
    expect(snapshot.resources.energy.stored).toBeCloseTo(202.9);
    expect(snapshot.resources.oxygen.stored).toBeCloseTo(135.833333);
    expect(snapshot.resources.material.stored).toBeCloseTo(5.4);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.time)).toBe(true);
    expect(Object.isFrozen(snapshot.resources.energy)).toBe(true);
    expect(Object.isFrozen(snapshot.facilities)).toBe(true);
    expect(Object.isFrozen(snapshot.facilities[0]?.setpoints)).toBe(true);
  });

  it('produces identical authoritative serialization for identical inputs', () => {
    const run = () => {
      const engine = new SimulationEngine();
      engine.advanceWallTime(1_000);
      engine.submitFacilityCommand(modeCommand(engine, 'command-001', 'eco'));
      engine.advanceWallTime(2_000);
      engine.setSpeed(2);
      engine.advanceWallTime(500);
      return engine.serializeAuthoritativeState();
    };
    expect(run()).toBe(run());
  });

  it('is independent of render-frame chunking', () => {
    const smallFrames = new SimulationEngine();
    const largeFrames = new SimulationEngine();
    for (let index = 0; index < 100; index += 1) smallFrames.advanceWallTime(10);
    for (let index = 0; index < 10; index += 1) largeFrames.advanceWallTime(100);
    expect(smallFrames.serializeAuthoritativeState()).toBe(largeFrames.serializeAuthoritativeState());
  });

  it('makes Pause/x1/x2/x4 authoritative rather than labels', () => {
    const progression = (speed: 0 | 1 | 2 | 4) => {
      const engine = new SimulationEngine();
      engine.setSpeed(speed);
      engine.advanceWallTime(25_000);
      return engine.getSnapshot().time.elapsedMinutes;
    };
    expect([progression(0), progression(1), progression(2), progression(4)]).toEqual([0, 60, 120, 240]);
  });

  it('prevents explicit authoritative fixed steps while paused', () => {
    const engine = new SimulationEngine();
    engine.setSpeed(0);
    engine.advanceFixedSteps(60);
    expect(engine.getSnapshot().time.elapsedMinutes).toBe(0);
  });

  it('applies a Mine Eco command to real state and resource output', () => {
    const normal = new SimulationEngine();
    const eco = new SimulationEngine();
    expect(eco.submitFacilityCommand(modeCommand(eco, 'command-eco', 'eco')).status).toBe('applied');
    normal.advanceFixedSteps(60);
    eco.advanceFixedSteps(60);
    expect(normal.getSnapshot().resources.material.stored).toBeCloseTo(5.4);
    expect(eco.getSnapshot().resources.material.stored).toBeCloseTo(2.7);
    expect(eco.getSnapshot().resources.energy.stored).toBeCloseTo(207.4);
    expect(eco.getSnapshot().facilities.find(({ id }) => id === 'mine-01')?.mode).toBe('eco');
  });

  it('applies the facility operating-state machine to resource production', () => {
    const engine = new SimulationEngine();
    expect(engine.submitFacilityCommand({
      actuator: 'set-operating-state', facilityId: 'mine-01', id: 'offline-command', priority: 'normal', simTime: 0, value: 'offline',
    }).status).toBe('applied');
    engine.advanceFixedSteps(60);
    expect(engine.getSnapshot().resources.material.stored).toBe(0);
    expect(engine.getSnapshot().facilities.find(({ id }) => id === 'mine-01')?.state).toBe('offline');
  });

  it('blocks Boost through the SafetyInterlock condition contract', () => {
    const facilities = PHASE_TWO_BASELINE_CONFIG.facilities.map((definition) => definition.id === 'mine-01' ? { ...definition, initialCondition: 20 } : definition);
    const engine = new SimulationEngine({ config: { ...PHASE_TWO_BASELINE_CONFIG, facilities } });
    const result = engine.submitFacilityCommand(modeCommand(engine, 'command-boost', 'boost'));
    expect(result).toEqual({ reasonCode: 'facility.condition-blocks-boost', requestId: 'command-boost', status: 'blocked' });
    expect(engine.getSnapshot().facilities.find(({ id }) => id === 'mine-01')?.mode).toBe('normal');
  });

  it('does not invent an instantaneous Reactor transition without canonical ramp config', () => {
    const engine = new SimulationEngine();
    const result = engine.submitFacilityCommand({
      actuator: 'set-mode', facilityId: 'reactor-01', id: 'reactor-eco', priority: 'normal', simTime: 0, value: 'eco',
    });
    expect(result).toEqual({ reasonCode: 'facility.ramp-config-required', requestId: 'reactor-eco', status: 'blocked' });
    expect(engine.getSnapshot().facilities.find(({ id }) => id === 'reactor-01')?.mode).toBe('normal');
  });

  it('respects resource capacities without deleting stock when capacity becomes unavailable', () => {
    const engine = new SimulationEngine();
    engine.advanceFixedSteps(10_000);
    const { resources } = engine.getSnapshot();
    expect(resources.energy.stored).toBeLessThanOrEqual(resources.energy.capacity);
    expect(resources.oxygen.stored).toBeLessThanOrEqual(resources.oxygen.capacity);
    expect(resources.material.stored).toBeLessThanOrEqual(resources.material.capacity);
    expect(resources.energy.stored).toBeGreaterThanOrEqual(0);
    expect(resources.oxygen.productionRate).toBe(0);
    expect(resources.material.productionRate).toBe(0);
  });

  it('preserves but does not allocate stock above usable storage capacity', () => {
    const base = priorityScenario();
    const facilities = base.facilities.filter(({ id }) => id !== 'producer' && id !== 'oxygen-store');
    const engine = new SimulationEngine({
      config: { ...base, facilities, initialResources: { energy: 5, material: 0, oxygen: 0 } },
    });
    engine.advanceFixedSteps(1);
    expect(engine.getSnapshot().resources.energy).toMatchObject({ capacity: 0, stored: 5 });
    expect(engine.getSnapshot().resources.material.stored).toBe(0);
  });

  it('allocates constrained Energy by priority then stable facility id', () => {
    const engine = new SimulationEngine({ config: priorityScenario() });
    engine.advanceFixedSteps(1);
    const resources = engine.getSnapshot().resources;
    expect(resources.material.stored).toBe(1);
    expect(resources.oxygen.stored).toBe(0);
  });

  it('lets a higher EnergyPriority win before stable-id tie breaking', () => {
    const engine = new SimulationEngine({ config: priorityScenario() });
    expect(engine.submitFacilityCommand({
      actuator: 'set-energy-priority', facilityId: 'b-consumer', id: 'priority-command', priority: 'normal', simTime: 0, value: 'critical',
    }).status).toBe('applied');
    engine.advanceFixedSteps(1);
    const resources = engine.getSnapshot().resources;
    expect(resources.material.stored).toBe(0);
    expect(resources.oxygen.stored).toBe(1);
  });

  it('emits only structured Phase 2 speed and command events with deterministic ids', () => {
    const engine = new SimulationEngine();
    engine.setSpeed(2);
    engine.submitFacilityCommand(modeCommand(engine, 'command-event', 'eco'));
    expect(engine.getEvents()).toEqual([
      expect.objectContaining({ eventType: 'simulation.speed-changed', id: 'event-000001', simTime: 0 }),
      expect.objectContaining({ eventType: 'facility.command-result', facilityId: 'mine-01', id: 'event-000002', simTime: 0 }),
    ]);
    expect(Object.isFrozen(engine.getEvents()[0])).toBe(true);
  });

  it('maps immutable clock state into presentation without renderer authority', () => {
    const engine = new SimulationEngine();
    engine.advanceFixedSteps(360);
    expect(simulationSnapshotToTimeOfDay(engine.getSnapshot())).toBe(0.25);
  });

  it('derives day/night and operational-cycle progress from simulation time', () => {
    const engine = new SimulationEngine();
    engine.advanceFixedSteps(840);
    expect(engine.getSnapshot().time).toMatchObject({ cycleProgress: 840 / 1_440, dayIndex: 0, dayPhase: 'night', localMinute: 840 });
    engine.advanceFixedSteps(600);
    expect(engine.getSnapshot().time).toMatchObject({ cycleProgress: 0, dayIndex: 1, dayPhase: 'day', localMinute: 0 });
  });

  it('notifies snapshot consumers without transferring state ownership', () => {
    const engine = new SimulationEngine();
    let publications = 0;
    const unsubscribe = engine.subscribe(() => { publications += 1; });
    engine.advanceFixedSteps(1);
    engine.setSpeed(2);
    unsubscribe();
    engine.advanceFixedSteps(1);
    expect(publications).toBe(2);
  });
});
