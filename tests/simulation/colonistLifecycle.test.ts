import { describe, expect, it } from 'vitest';

import type { FacilityDefinition } from '../../src/game/domain/facilities/Facility';
import { resolveTravelDuration } from '../../src/game/domain/workforce/TravelNetwork';
import { PHASE_THREE_TRAVEL_NETWORK, type SimulationConfig } from '../../src/game/simulation/SimulationConfig';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';

function command(engine: SimulationEngine, actuator: 'set-operating-state' | 'set-work-priority', facilityId: string, value: unknown, id: string) {
  return engine.submitFacilityCommand({ actuator, facilityId, id, priority: 'normal', simTime: engine.getSnapshot().time.elapsedMinutes, value });
}

function reassignmentConfig(): SimulationConfig {
  const facility = (id: string): FacilityDefinition => ({
    id, initialCondition: 100, initialMode: 'normal', initialState: 'online', modes: { normal: {} }, typeId: 'test', workforce: { minimum: 1, nominal: 1 },
  });
  return {
    baseConsumptionPerHour: {}, clock: { fixedStepMinutes: 1, localDayMinutes: 1_440, realSecondsPerSimulationHour: 25 }, daylightDurationMinutes: 840,
    facilities: [facility('a-facility'), facility('b-facility')], initialResources: { energy: 0, material: 0, oxygen: 0 }, initialSpeed: 1,
    population: { count: 1, restCycleMinutes: 1_440, restDurationMinutes: 0, restGroupCount: 1 },
    travelNetwork: {
      edges: [{ from: 'habitat', to: 'a' }, { from: 'a', to: 'b' }],
      locationNodes: { 'a-facility': 'a', 'b-facility': 'b', habitat: 'habitat' },
      nodes: [{ id: 'habitat', x: 0, z: 0 }, { id: 'a', x: 3, z: 0 }, { id: 'b', x: 9, z: 0 }],
      walkingSpeedUnitsPerSimulationMinute: 1,
    },
  };
}

describe('authoritative colonist lifecycle', () => {
  it('starts a new simulation with visible distance-based assignment travel instead of instant on-site workers', () => {
    const snapshot = new SimulationEngine().getSnapshot();
    expect(snapshot.workforce).toMatchObject({ population: 11, active: 8, assigned: 8, resting: 3, traveling: 8 });
    expect(snapshot.colonists.filter(({ travel }) => travel?.purpose === 'to-assignment')).toHaveLength(8);
    expect(Math.min(...snapshot.colonists.flatMap(({ travel }) => travel === null ? [] : [travel.durationMinutes]))).toBeGreaterThan(1);
  });

  it('turns an on-site worker into a real return-to-habitat task without teleporting to Resting', () => {
    const engine = new SimulationEngine();
    engine.advanceFixedSteps(71);
    const before = engine.getSnapshot().colonists.filter(({ restGroup, state }) => restGroup === 1 && state === 'working');
    expect(before.length).toBeGreaterThan(0);
    engine.advanceFixedSteps(1);
    const returning = engine.getSnapshot().colonists.find(({ id }) => id === before[0]?.id);
    expect(returning).toMatchObject({ assignment: null, restDue: true, state: 'working' });
    expect(returning?.locationId).not.toBe('habitat');
    expect(returning?.travel).toMatchObject({ purpose: 'return-to-habitat', targetLocationId: 'habitat' });
  });

  it('does not enter Resting or habitat final location until return travel arrives', () => {
    const engine = new SimulationEngine();
    engine.advanceFixedSteps(72);
    const returning = engine.getSnapshot().colonists.find(({ travel }) => travel?.purpose === 'return-to-habitat');
    if (returning?.travel === null || returning?.travel === undefined) throw new Error('Expected a returning colonist.');
    const remaining = returning.travel.durationMinutes - returning.travel.elapsedMinutes;
    engine.advanceFixedSteps(remaining - 1);
    expect(engine.getSnapshot().colonists.find(({ id }) => id === returning.id)).toMatchObject({ restDue: true, state: 'working' });
    engine.advanceFixedSteps(1);
    expect(engine.getSnapshot().colonists.find(({ id }) => id === returning.id)).toMatchObject({ assignment: null, locationId: 'habitat', state: 'resting', travel: null });
  });

  it('ends rest through Available and creates a real habitat-to-facility departure', () => {
    const engine = new SimulationEngine();
    const initiallyResting = engine.getSnapshot().colonists.find(({ state }) => state === 'resting');
    engine.advanceFixedSteps(72);
    const departed = engine.getSnapshot().colonists.find(({ id }) => id === initiallyResting?.id);
    expect(departed).toMatchObject({ restDue: false, state: 'working' });
    expect(departed?.travel).toMatchObject({ purpose: 'to-assignment', sourceLocationId: 'habitat' });
  });

  it('creates facility A to facility B travel for reassignment and does not churn the same assignment', () => {
    const engine = new SimulationEngine({ config: reassignmentConfig() });
    engine.advanceFixedSteps(3);
    const before = engine.getSnapshot().colonists[0];
    expect(before).toMatchObject({ locationId: 'a-facility', travel: null });
    engine.advanceFixedSteps(1);
    expect(engine.getSnapshot().colonists[0]?.travel).toBeNull();
    command(engine, 'set-operating-state', 'a-facility', 'offline', 'offline-a');
    const reassigned = engine.getSnapshot().colonists[0];
    expect(reassigned?.assignment?.facilityId).toBe('b-facility');
    expect(reassigned?.travel).toMatchObject({ purpose: 'to-assignment', sourceLocationId: 'a-facility', targetLocationId: 'b-facility' });
  });

  it('derives longer deterministic travel duration from a longer route', () => {
    const toOxygen = resolveTravelDuration(PHASE_THREE_TRAVEL_NETWORK, 'habitat', 'oxygen-processor-01');
    const toReactor = resolveTravelDuration(PHASE_THREE_TRAVEL_NETWORK, 'habitat', 'reactor-01');
    expect(toReactor.durationMinutes).toBeGreaterThan(toOxygen.durationMinutes);
    expect(resolveTravelDuration(PHASE_THREE_TRAVEL_NETWORK, 'habitat', 'reactor-01')).toEqual(toReactor);
  });

  it('serializes and restores return travel without changing its deterministic continuation', () => {
    const original = new SimulationEngine();
    original.advanceFixedSteps(72);
    const restored = SimulationEngine.fromSerializedState(original.serializeAuthoritativeState());
    original.advanceFixedSteps(12);
    restored.advanceFixedSteps(12);
    expect(restored.serializeAuthoritativeState()).toBe(original.serializeAuthoritativeState());
  });

  it('preserves restored on-site workers instead of resetting them to habitat', () => {
    const original = new SimulationEngine();
    original.advanceFixedSteps(40);
    const before = original.getSnapshot().colonists.filter(({ assignment }) => assignment?.phase === 'on-site').map(({ id, locationId }) => [id, locationId]);
    const restored = SimulationEngine.fromSerializedState(original.serializeAuthoritativeState());
    expect(restored.getSnapshot().colonists.filter(({ assignment }) => assignment?.phase === 'on-site').map(({ id, locationId }) => [id, locationId])).toEqual(before);
  });

  it('keeps rest groups staggered and produces natural turnover in the tuned baseline', () => {
    const engine = new SimulationEngine();
    const initialResting = engine.getSnapshot().colonists.filter(({ state }) => state === 'resting').map(({ restGroup }) => restGroup);
    expect(new Set(initialResting)).toEqual(new Set([0]));
    engine.advanceFixedSteps(72);
    const snapshot = engine.getSnapshot();
    expect(snapshot.workforce.active).toBeGreaterThan(0);
    expect(snapshot.workforce.travelingToRest).toBeGreaterThan(0);
    expect(snapshot.colonists.some(({ restGroup, restDue }) => restGroup === 1 && restDue)).toBe(true);
  });
});
