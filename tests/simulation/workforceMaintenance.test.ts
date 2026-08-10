import { describe, expect, it } from 'vitest';

import type { FacilityDefinition } from '../../src/game/domain/facilities/Facility';
import type { SimulationConfig } from '../../src/game/simulation/SimulationConfig';
import { PHASE_THREE_BASELINE_CONFIG, PHASE_THREE_MAINTENANCE_BASELINES, PHASE_THREE_WEAR_BASELINES, PHASE_THREE_WORKFORCE_BASELINES } from '../../src/game/simulation/SimulationConfig';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import { conditionPerformanceFactor } from '../../src/game/simulation/systems/conditionSystem';
import { workforcePerformanceFactor } from '../../src/game/simulation/systems/resourceLedger';

function command(engine: SimulationEngine, actuator: 'set-condition' | 'set-maintenance-priority' | 'set-mode' | 'set-operating-state' | 'set-work-priority', facilityId: string, value: unknown, id: string) {
  return engine.submitFacilityCommand({ actuator, facilityId, id, priority: 'normal', simTime: engine.getSnapshot().time.elapsedMinutes, value });
}

function population(count: number, operationTravelMinutes = 1) {
  return { count, maintenanceTravelMinutes: 1, operationTravelMinutes, restCycleMinutes: 1_440, restDurationMinutes: 0, restGroupCount: 1 } as const;
}

function assignmentConfig(count = 3, minimum = 1, nominal = 2): SimulationConfig {
  const facility = (id: string): FacilityDefinition => ({
    id,
    initialCondition: 100,
    initialMode: 'normal',
    initialState: 'online',
    modes: { normal: {} },
    typeId: 'test-operation',
    workforce: { minimum, nominal },
  });
  return {
    baseConsumptionPerHour: {},
    clock: { fixedStepMinutes: 1, localDayMinutes: 1_440, realSecondsPerSimulationHour: 25 },
    daylightDurationMinutes: 840,
    facilities: [facility('a-facility'), facility('b-facility')],
    initialResources: { energy: 0, material: 0, oxygen: 0 },
    initialSpeed: 1,
    maintenanceThreshold: 60,
    population: population(count),
    wearModeMultipliers: { eco: 0.5, normal: 1, boost: 2.5 },
  };
}

function maintenanceConfig(options: { condition?: number; duration?: number; material?: number; population?: number; workforce?: number } = {}): SimulationConfig {
  const condition = options.condition ?? 55;
  const target: FacilityDefinition = {
    id: 'mine-01',
    initialCondition: condition,
    initialMode: 'normal',
    initialState: condition === 0 ? 'failed' : 'online',
    maintenance: {
      durationMinutes: options.duration ?? 2,
      material: 6,
      offlineDuringMaintenance: true,
      restoreCondition: 95,
      workforce: options.workforce ?? 2,
    },
    modes: { normal: {} },
    typeId: 'mine',
    workforce: { minimum: 1, nominal: 1 },
  };
  return {
    baseConsumptionPerHour: {},
    clock: { fixedStepMinutes: 1, localDayMinutes: 1_440, realSecondsPerSimulationHour: 25 },
    daylightDurationMinutes: 840,
    facilities: [target, { id: 'material-storage-01', initialCondition: 100, initialState: 'standby', storageCapacity: { material: 100 }, typeId: 'material-storage' }],
    initialResources: { energy: 0, material: options.material ?? 6, oxygen: 0 },
    initialSpeed: 1,
    maintenanceThreshold: 60,
    population: population(options.population ?? 2),
    wearModeMultipliers: { eco: 0.5, normal: 1, boost: 2.5 },
  };
}

function wearConfig(mode: 'boost' | 'eco' | 'normal'): SimulationConfig {
  return {
    baseConsumptionPerHour: {},
    clock: { fixedStepMinutes: 60, localDayMinutes: 1_440, realSecondsPerSimulationHour: 25 },
    daylightDurationMinutes: 840,
    facilities: [{
      id: 'wear-facility', initialCondition: 100, initialMode: mode, initialState: 'online', modes: { boost: {}, eco: {}, normal: {} },
      typeId: 'wear-test', wear: { basePerHour: 1 }, workforce: { minimum: 1, nominal: 1, boost: 1 },
    }],
    initialResources: { energy: 0, material: 0, oxygen: 0 },
    initialSpeed: 1,
    maintenanceThreshold: 1,
    population: population(1),
    wearModeMultipliers: { eco: 0.5, normal: 1, boost: 2.5 },
  };
}

describe('Phase 3 workforce foundation', () => {
  it('keeps all canonical facility-specific workforce and wear baselines in config', () => {
    expect(PHASE_THREE_WORKFORCE_BASELINES).toMatchObject({
      'fusion-reactor': { minimum: 2, nominal: 3, boost: 4 }, mine: { minimum: 1, nominal: 3, boost: 3 },
      'oxygen-processor': { minimum: 1, nominal: 2, boost: 3 }, 'thermal-control': { minimum: 1, nominal: 2, boost: 3 },
    });
    expect(PHASE_THREE_WEAR_BASELINES['thermal-control'].basePerHour).toBe(0.18);
    expect(PHASE_THREE_MAINTENANCE_BASELINES['thermal-control']).toMatchObject({ workforce: 1, material: 5, durationMinutes: 120 });
  });

  it('produces the same assignment for the same input', () => {
    expect(new SimulationEngine().serializeAuthoritativeState()).toBe(new SimulationEngine().serializeAuthoritativeState());
  });

  it('orders Critical before lower priorities after minimum crew is safe', () => {
    const engine = new SimulationEngine({ config: assignmentConfig() });
    command(engine, 'set-work-priority', 'b-facility', 'critical', 'priority-b');
    const facilities = engine.getSnapshot().facilities;
    expect(facilities.find(({ id }) => id === 'a-facility')?.assignedWorkforce).toBe(1);
    expect(facilities.find(({ id }) => id === 'b-facility')?.assignedWorkforce).toBe(2);
  });

  it('uses stable facility id for equal-priority nominal allocation', () => {
    const engine = new SimulationEngine({ config: assignmentConfig() });
    expect(engine.getSnapshot().facilities.map(({ assignedWorkforce, id }) => [id, assignedWorkforce])).toEqual([
      ['a-facility', 2], ['b-facility', 1],
    ]);
  });

  it('fills every safe minimum before any nominal surplus', () => {
    const engine = new SimulationEngine({ config: assignmentConfig(4, 2, 3) });
    expect(engine.getSnapshot().facilities.map(({ assignedWorkforce }) => assignedWorkforce)).toEqual([2, 2]);
  });

  it('does not grant output factor above nominal workforce', () => {
    const definition = assignmentConfig().facilities[0] as FacilityDefinition;
    const base = new SimulationEngine({ config: assignmentConfig(5) }).getSnapshot().facilities[0];
    if (base === undefined) throw new Error('Expected workforce facility.');
    expect(workforcePerformanceFactor(definition, { ...base, assignedWorkforce: 5, effectiveWorkforce: 5, setpoints: {} })).toBe(1);
  });

  it('makes workforce shortage deterministic and does not churn valid assignments', () => {
    const run = () => {
      const engine = new SimulationEngine({ config: assignmentConfig(2, 1, 2) });
      engine.advanceFixedSteps(2);
      return engine;
    };
    const first = run();
    const second = run();
    expect(first.serializeAuthoritativeState()).toBe(second.serializeAuthoritativeState());
    expect(first.getEvents().filter(({ eventType }) => eventType === 'workforce.assigned' || eventType === 'workforce.reassigned')).toHaveLength(0);
  });

  it('separates Population, Active, Assigned, Available and Resting', () => {
    const summary = new SimulationEngine().getSnapshot().workforce;
    expect(summary).toEqual({ population: 11, active: 8, assigned: 8, available: 0, resting: 3 });
    expect(summary.active + summary.resting).toBe(summary.population);
    expect(summary.assigned + summary.available).toBe(summary.active);
  });

  it('uses staggered rest without dropping all active workforce at once', () => {
    const engine = new SimulationEngine();
    for (const step of [1, 239, 48, 240, 48, 240, 48, 240, 48, 240]) {
      engine.advanceFixedSteps(step);
      expect(engine.getSnapshot().workforce.active).toBeGreaterThan(0);
    }
  });

  it('keeps travel task plain serializable and freezes it during Pause', () => {
    const config = { ...assignmentConfig(3), population: population(3, 12) };
    const engine = new SimulationEngine({ config });
    command(engine, 'set-operating-state', 'a-facility', 'offline', 'offline-a');
    engine.advanceFixedSteps(1);
    command(engine, 'set-operating-state', 'a-facility', 'online', 'online-a');
    const traveling = engine.getSnapshot().colonists.find(({ assignment }) => assignment?.facilityId === 'a-facility');
    expect(traveling?.assignment?.travel).toMatchObject({ durationMinutes: 12, elapsedMinutes: 0, targetFacilityId: 'a-facility', taskType: 'operate' });
    expect(JSON.parse(JSON.stringify(traveling?.assignment?.travel))).toEqual(traveling?.assignment?.travel);
    engine.setSpeed(0);
    engine.advanceWallTime(25_000);
    expect(engine.getSnapshot().colonists.find(({ id }) => id === traveling?.id)?.assignment?.travel?.elapsedMinutes).toBe(0);
  });

  it('scales travel progression deterministically at ×1/×2/×4', () => {
    const progress = (speed: 1 | 2 | 4) => {
      const config = { ...assignmentConfig(3), population: population(3, 300) };
      const engine = new SimulationEngine({ config });
      command(engine, 'set-operating-state', 'a-facility', 'offline', `offline-${speed}`);
      engine.advanceFixedSteps(1);
      command(engine, 'set-operating-state', 'a-facility', 'online', `online-${speed}`);
      engine.setSpeed(speed);
      engine.advanceWallTime(25_000);
      return engine.getSnapshot().colonists.find(({ assignment }) => assignment?.facilityId === 'a-facility')?.assignment?.travel?.elapsedMinutes;
    };
    expect([progress(1), progress(2), progress(4)]).toEqual([60, 120, 240]);
  });
});

describe('Phase 3 condition, wear and maintenance', () => {
  it('maps canonical Condition bands to deterministic performance factors', () => {
    expect([conditionPerformanceFactor(100), conditionPerformanceFactor(70)]).toEqual([1, 1]);
    expect(conditionPerformanceFactor(40)).toBeCloseTo(0.85);
    expect(conditionPerformanceFactor(69)).toBeGreaterThan(0.99);
    expect(conditionPerformanceFactor(1)).toBeCloseTo(0.6);
    expect(conditionPerformanceFactor(39)).toBeLessThan(0.85);
    expect(conditionPerformanceFactor(0)).toBe(0);
  });

  it('applies Eco ×0.5, Normal ×1 and Boost ×2.5 deterministic wear', () => {
    const conditionAfterHour = (mode: 'boost' | 'eco' | 'normal') => {
      const engine = new SimulationEngine({ config: wearConfig(mode) });
      engine.advanceFixedSteps(1);
      return engine.getSnapshot().facilities[0]?.condition;
    };
    expect(conditionAfterHour('eco')).toBeCloseTo(99.5);
    expect(conditionAfterHour('normal')).toBeCloseTo(99);
    expect(conditionAfterHour('boost')).toBeCloseTo(97.5);
  });

  it('does not progress wear while paused', () => {
    const engine = new SimulationEngine({ config: wearConfig('normal') });
    engine.setSpeed(0);
    engine.advanceWallTime(100_000);
    engine.advanceFixedSteps(10);
    expect(engine.getSnapshot().facilities[0]?.condition).toBe(100);
  });

  it('creates one maintenance request below 60 and blocks Boost below 30', () => {
    const engine = new SimulationEngine();
    expect(command(engine, 'set-condition', 'mine-01', 59, 'mine-59').status).toBe('applied');
    expect(engine.getSnapshot().maintenanceTasks).toHaveLength(1);
    command(engine, 'set-condition', 'mine-01', 29, 'mine-29');
    expect(command(engine, 'set-mode', 'mine-01', 'boost', 'mine-boost').reasonCode).toBe('facility.condition-blocks-boost');
  });

  it('marks Condition 0 Failed and prevents output', () => {
    const config = maintenanceConfig({ condition: 0, material: 0, population: 2 });
    const engine = new SimulationEngine({ config });
    engine.advanceFixedSteps(60);
    expect(engine.getSnapshot().facilities.find(({ id }) => id === 'mine-01')).toMatchObject({ condition: 0, conditionBand: 'failed', state: 'failed' });
    expect(engine.getSnapshot().resources.material.productionRate).toBe(0);
  });

  it('orders maintenance by priority then stable facility id', () => {
    const base = maintenanceConfig({ material: 20, population: 4 });
    const second = { ...(base.facilities[0] as FacilityDefinition), id: 'reactor-01', maintenance: { workforce: 2, material: 10, durationMinutes: 180, restoreCondition: 95, offlineDuringMaintenance: true } };
    const config = { ...base, facilities: [base.facilities[0] as FacilityDefinition, second, base.facilities[1] as FacilityDefinition] };
    const priority = new SimulationEngine({ config });
    command(priority, 'set-maintenance-priority', 'reactor-01', 'critical', 'reactor-critical');
    expect(priority.getSnapshot().maintenanceTasks.map(({ facilityId }) => facilityId)).toEqual(['reactor-01', 'mine-01']);
    const equal = new SimulationEngine({ config });
    equal.advanceFixedSteps(1);
    expect(equal.getSnapshot().maintenanceTasks.map(({ facilityId }) => facilityId)).toEqual(['mine-01', 'reactor-01']);
  });

  it('uses canonical Mine and Reactor maintenance requirements', () => {
    const engine = new SimulationEngine();
    command(engine, 'set-condition', 'mine-01', 59, 'mine-request');
    command(engine, 'set-condition', 'reactor-01', 59, 'reactor-request');
    const mine = engine.getSnapshot().maintenanceTasks.find(({ facilityId }) => facilityId === 'mine-01');
    const reactor = engine.getSnapshot().maintenanceTasks.find(({ facilityId }) => facilityId === 'reactor-01');
    expect(mine).toMatchObject({ workforceRequired: 2, materialRequired: 6, durationMinutes: 120 });
    expect(reactor).toMatchObject({ workforceRequired: 2, materialRequired: 10, durationMinutes: 180 });
  });

  it('consumes Material exactly once and never makes stock negative', () => {
    const enough = new SimulationEngine({ config: maintenanceConfig() });
    enough.advanceFixedSteps(1);
    expect(enough.getSnapshot().resources.material.stored).toBe(0);
    enough.advanceFixedSteps(1);
    expect(enough.getSnapshot().resources.material.stored).toBe(0);
    const insufficient = new SimulationEngine({ config: maintenanceConfig({ material: 5 }) });
    insufficient.advanceFixedSteps(1);
    expect(insufficient.getSnapshot().resources.material.stored).toBe(5);
    expect(insufficient.getSnapshot().maintenanceTasks[0]).toMatchObject({ status: 'waiting-resources', reasonCode: 'maintenance.material-insufficient' });
  });

  it('does not create workers when maintenance workforce is insufficient', () => {
    const engine = new SimulationEngine({ config: maintenanceConfig({ population: 1, workforce: 2 }) });
    engine.advanceFixedSteps(1);
    expect(engine.getSnapshot().workforce.population).toBe(1);
    expect(engine.getSnapshot().maintenanceTasks[0]).toMatchObject({ status: 'waiting-workforce', workerIds: [] });
  });

  it('pulls maintenance workers from the real shared workforce pool', () => {
    const config = { ...PHASE_THREE_BASELINE_CONFIG, initialResources: { ...PHASE_THREE_BASELINE_CONFIG.initialResources, material: 6 } };
    const engine = new SimulationEngine({ config });
    const before = engine.getSnapshot().facilities.map(({ assignedWorkforce, id }) => [id, assignedWorkforce]);
    command(engine, 'set-condition', 'mine-01', 59, 'mine-maintenance-request');
    command(engine, 'set-maintenance-priority', 'mine-01', 'high', 'mine-maintenance-high');
    const task = engine.getSnapshot().maintenanceTasks[0];
    expect(task?.workerIds).toHaveLength(2);
    expect(engine.getSnapshot().workforce.population).toBe(11);
    expect(engine.getSnapshot().facilities.map(({ assignedWorkforce, id }) => [id, assignedWorkforce])).not.toEqual(before);
  });

  it('completes maintenance, restores Healthy Condition and releases workers', () => {
    const engine = new SimulationEngine({ config: maintenanceConfig() });
    engine.advanceFixedSteps(3);
    expect(engine.getSnapshot().maintenanceTasks[0]).toMatchObject({ status: 'completed', remainingMinutes: 0, workerIds: [] });
    expect(engine.getSnapshot().facilities.find(({ id }) => id === 'mine-01')).toMatchObject({ condition: 95, conditionBand: 'healthy', state: 'online' });
  });

  it('freezes maintenance remaining time during Pause and resumes continuously', () => {
    const engine = new SimulationEngine({ config: maintenanceConfig({ duration: 10 }) });
    engine.advanceFixedSteps(2);
    const before = engine.getSnapshot().maintenanceTasks[0]?.remainingMinutes;
    engine.setSpeed(0);
    engine.advanceWallTime(100_000);
    engine.advanceFixedSteps(100);
    expect(engine.getSnapshot().maintenanceTasks[0]?.remainingMinutes).toBe(before);
    engine.setSpeed(1);
    engine.advanceFixedSteps(1);
    expect(engine.getSnapshot().maintenanceTasks[0]?.remainingMinutes).toBe((before ?? 0) - 1);
  });

  it('recovers a Failed facility through maintenance without permanent destruction', () => {
    const engine = new SimulationEngine({ config: maintenanceConfig({ condition: 0 }) });
    engine.advanceFixedSteps(3);
    expect(engine.getSnapshot().facilities.find(({ id }) => id === 'mine-01')).toMatchObject({ condition: 95, conditionBand: 'healthy', state: 'online' });
    expect(engine.getEvents().some(({ eventType }) => eventType === 'facility.recovered')).toBe(true);
  });

  it('serializes and restores an active task with deterministic continuation', () => {
    const config = maintenanceConfig({ duration: 6 });
    const first = new SimulationEngine({ config });
    first.advanceFixedSteps(3);
    const restored = SimulationEngine.fromSerializedState(first.serializeAuthoritativeState(), { config });
    first.advanceFixedSteps(6);
    restored.advanceFixedSteps(6);
    expect(restored.serializeAuthoritativeState()).toBe(first.serializeAuthoritativeState());
  });

  it('emits stable semantic workforce, maintenance, condition and recovery events', () => {
    const engine = new SimulationEngine({ config: maintenanceConfig({ condition: 100 }) });
    command(engine, 'set-condition', 'mine-01', 0, 'fail-mine');
    engine.advanceFixedSteps(3);
    const eventTypes = engine.getEvents().map(({ eventType }) => eventType);
    expect(eventTypes).toEqual(expect.arrayContaining([
      'facility.condition-band-changed', 'facility.failed', 'maintenance.requested',
      'workforce.reassigned', 'maintenance.started', 'maintenance.completed', 'facility.recovered',
    ]));
  });
});
