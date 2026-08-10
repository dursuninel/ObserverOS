import type { FacilityCommandRequest, FacilityCommandResult, FacilityDefinition, SafetyInterlock } from '../domain/facilities/Facility';
import { PHASE_TWO_BASELINE_CONFIG, type SimulationConfig } from './SimulationConfig';
import { SimulationClock, type SimulationSpeed } from './SimulationClock';
import type { SimulationEvent } from './SimulationEvent';
import type { SimulationSnapshot } from './SimulationSnapshot';
import { applyFacilityCommand, createFacilityState, defaultSafetyInterlock, toReadonlyFacilityState, type MutableFacilityState } from './systems/facilityCommands';
import { createResourcePool, toReadonlyResourcePool, updateResourceLedger, type MutableResourcePoolState } from './systems/resourceLedger';

export interface SimulationEngineOptions {
  readonly config?: SimulationConfig;
  readonly safetyInterlock?: SafetyInterlock;
}

type SnapshotListener = () => void;

function validateConfig(config: SimulationConfig): void {
  if (!Number.isInteger(config.daylightDurationMinutes) || config.daylightDurationMinutes < 0 || config.daylightDurationMinutes > config.clock.localDayMinutes) {
    throw new Error('daylightDurationMinutes must be an integer within the local day.');
  }
  const ids = new Set<string>();
  for (const definition of config.facilities) {
    if (ids.has(definition.id)) throw new Error(`Duplicate facility id: ${definition.id}`);
    ids.add(definition.id);
    if (definition.initialCondition < 0 || definition.initialCondition > 100) throw new Error(`Facility ${definition.id} condition must be between 0 and 100.`);
  }
}

function frozenEvent(event: SimulationEvent): SimulationEvent {
  return Object.freeze({
    ...event,
    ...(event.causedByEventIds === undefined ? {} : { causedByEventIds: Object.freeze([...event.causedByEventIds]) }),
    ...(event.payload === undefined ? {} : { payload: Object.freeze({ ...event.payload }) }),
  });
}

/** Authoritative, deterministic and presentation-independent simulation core. */
export class SimulationEngine {
  readonly authority = 'simulation' as const;
  private readonly clock: SimulationClock;
  private readonly config: SimulationConfig;
  private readonly definitions: ReadonlyMap<string, FacilityDefinition>;
  private readonly events: SimulationEvent[] = [];
  private readonly facilities = new Map<string, MutableFacilityState>();
  private readonly listeners = new Set<SnapshotListener>();
  private readonly processedCommandIds = new Set<string>();
  private readonly resources: MutableResourcePoolState;
  private readonly safetyInterlock: SafetyInterlock;
  private eventSequence = 0;
  private revision = 0;
  private snapshot: SimulationSnapshot;

  constructor(options: SimulationEngineOptions = {}) {
    this.config = options.config ?? PHASE_TWO_BASELINE_CONFIG;
    validateConfig(this.config);
    this.clock = new SimulationClock(this.config.clock, this.config.initialSpeed);
    this.safetyInterlock = options.safetyInterlock ?? defaultSafetyInterlock;
    this.definitions = new Map(this.config.facilities.map((definition) => [definition.id, definition]));
    for (const definition of this.config.facilities) this.facilities.set(definition.id, createFacilityState(definition));
    this.resources = createResourcePool(this.config.initialResources);
    updateResourceLedger(0, this.config.baseConsumptionPerHour, this.config.facilities, this.facilities, this.resources);
    this.snapshot = this.createSnapshot();
  }

  advanceWallTime(wallMilliseconds: number): number {
    const steps = this.clock.accumulateWallTime(wallMilliseconds);
    this.runFixedSteps(steps);
    return steps;
  }

  /** Explicit headless runner entry point; it advances authoritative ticks without a wall clock. */
  advanceFixedSteps(stepCount: number): void {
    if (!Number.isInteger(stepCount) || stepCount < 0) throw new Error('stepCount must be a non-negative integer.');
    if (this.clock.getSpeed() === 0) return;
    this.runFixedSteps(stepCount);
  }

  getEvents(): readonly SimulationEvent[] {
    return Object.freeze([...this.events]);
  }

  getSnapshot(): SimulationSnapshot {
    return this.snapshot;
  }

  serializeAuthoritativeState(): string {
    return JSON.stringify({
      clock: this.clock.exportState(),
      eventSequence: this.eventSequence,
      facilities: this.snapshot.facilities,
      processedCommandIds: [...this.processedCommandIds].sort(),
      resources: this.snapshot.resources,
      revision: this.revision,
    });
  }

  setSpeed(speed: SimulationSpeed): void {
    const previous = this.clock.getSpeed();
    if (previous === speed) return;
    this.clock.setSpeed(speed);
    this.revision += 1;
    this.emitEvent({
      category: 'system',
      eventType: 'simulation.speed-changed',
      payload: { currentSpeed: speed, previousSpeed: previous },
      severity: 'info',
    });
    this.publish();
  }

  submitFacilityCommand(request: FacilityCommandRequest): FacilityCommandResult {
    let result: FacilityCommandResult;
    const facility = this.facilities.get(request.facilityId);
    const definition = this.definitions.get(request.facilityId);
    if (this.processedCommandIds.has(request.id)) {
      result = { reasonCode: 'command.duplicate-id', requestId: request.id, status: 'failed' };
    } else if (request.simTime !== this.clock.getElapsedMinutes()) {
      result = { reasonCode: 'command.stale-simulation-time', requestId: request.id, status: 'failed' };
    } else if (facility === undefined || definition === undefined) {
      result = { reasonCode: 'facility.not-found', requestId: request.id, status: 'failed' };
    } else {
      result = applyFacilityCommand(request, facility, definition, this.safetyInterlock);
    }
    this.processedCommandIds.add(request.id);
    this.revision += 1;
    this.emitEvent({
      category: 'system',
      eventType: 'facility.command-result',
      facilityId: request.facilityId,
      payload: {
        actuator: request.actuator,
        requestId: request.id,
        status: result.status,
        ...(result.appliedValue === undefined ? {} : { appliedValue: result.appliedValue }),
      },
      ...(result.reasonCode === undefined ? {} : { reasonCode: result.reasonCode }),
      severity: result.status === 'applied' ? 'info' : 'warning',
      sourceEntityId: request.id,
      targetEntityId: request.facilityId,
    });
    this.publish();
    return Object.freeze({ ...result });
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private createSnapshot(): SimulationSnapshot {
    const elapsedMinutes = this.clock.getElapsedMinutes();
    const localMinute = this.clock.getLocalMinute();
    const localDayMinutes = this.config.clock.localDayMinutes;
    const time = Object.freeze({
      cycleProgress: localMinute / localDayMinutes,
      dayIndex: Math.floor(elapsedMinutes / localDayMinutes),
      dayPhase: localMinute < this.config.daylightDurationMinutes ? 'day' as const : 'night' as const,
      elapsedMinutes,
      localMinute,
    });
    return Object.freeze({
      clock: Object.freeze({
        fixedStepMinutes: this.config.clock.fixedStepMinutes,
        paused: this.clock.getSpeed() === 0,
        speed: this.clock.getSpeed(),
      }),
      eventCount: this.events.length,
      facilities: Object.freeze([...this.facilities.values()].sort((left, right) => left.id.localeCompare(right.id)).map(toReadonlyFacilityState)),
      resources: toReadonlyResourcePool(this.resources),
      revision: this.revision,
      time,
    });
  }

  private emitEvent(event: Omit<SimulationEvent, 'id' | 'simTime'>): void {
    this.eventSequence += 1;
    this.events.push(frozenEvent({
      ...event,
      id: `event-${this.eventSequence.toString().padStart(6, '0')}`,
      simTime: this.clock.getElapsedMinutes(),
    }));
  }

  private publish(): void {
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener();
  }

  private runFixedSteps(stepCount: number): void {
    if (stepCount === 0) return;
    for (let index = 0; index < stepCount; index += 1) {
      this.clock.advanceFixedStep();
      updateResourceLedger(
        this.config.clock.fixedStepMinutes,
        this.config.baseConsumptionPerHour,
        this.config.facilities,
        this.facilities,
        this.resources,
      );
      this.revision += 1;
    }
    this.publish();
  }
}
