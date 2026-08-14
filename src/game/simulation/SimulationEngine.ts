import type { FacilityCommandRequest, FacilityCommandResult, FacilityDefinition, FacilityInstanceState, SafetyInterlock } from '../domain/facilities/Facility';
import type { MaintenanceTaskState } from '../domain/maintenance/Maintenance';
import type { ProtocolActionRequest, ProtocolCommandOutcome, ProtocolExecutionTrace } from '../domain/protocol/Protocol';
import type { ColonistState } from '../domain/workforce/Workforce';
import { PHASE_THREE_BASELINE_CONFIG, type SimulationConfig } from './SimulationConfig';
import { SimulationClock, type SimulationClockState, type SimulationSpeed } from './SimulationClock';
import type { SimulationEvent } from './SimulationEvent';
import type { SimulationSnapshot } from './SimulationSnapshot';
import {
  arbitrateProtocolCommands,
  facilityReasonToOutcomeReason,
  identityActuatorResolver,
  protocolCommandOutcome,
  type ProtocolActuatorResolver,
  type ProtocolCommandConflict,
} from './protocol/protocolArbitration';
import type { ExecutableProtocol } from './protocol/protocolCompiler';
import { ProtocolRuntime, type ProtocolRuntimeState, type ProtocolSensorReader } from './protocol/protocolRuntime';
import { type ConditionTransition, applyFacilityWear } from './systems/conditionSystem';
import { applyFacilityCommand, createFacilityState, defaultSafetyInterlock, toReadonlyFacilityState, type MutableFacilityState } from './systems/facilityCommands';
import { compareMaintenanceTasks, refreshMaintenanceRequests, toReadonlyMaintenanceTask, updateMaintenanceTasks, type MaintenanceTransition, type MutableMaintenanceTaskState } from './systems/maintenanceSystem';
import { createResourcePool, toReadonlyResourcePool, updateResourceLedger, type MutableResourcePoolState } from './systems/resourceLedger';
import {
  allocateWorkforce,
  applyWorkforceAllocation,
  createColonists,
  createWorkforceRequests,
  progressTravelTasks,
  toReadonlyColonist,
  updateFacilityWorkforce,
  updateRestStates,
  workforceSummary,
  type MutableColonistState,
  type WorkforceTransition,
} from './systems/workforceSystem';

/**
 * Protocol runtime bağlantısı. Sensor kataloğu capability katmanından gelir; hangi
 * sensor'ün hangi değeri okuduğu engine içine gömülmez (spec §12).
 */
export interface SimulationProtocolOptions {
  readonly protocols: readonly ExecutableProtocol[];
  readonly readSensor: ProtocolSensorReader;
  /**
   * Action capability kimliğini tesis actuator'üne çözer. Verilmezse kimlik
   * eşlemesi kullanılır: capability id'si zaten bir actuator ise ona bağlanır,
   * değilse istek `CAPABILITY_NOT_AVAILABLE` ile başarısız olur.
   */
  readonly resolveActuator?: ProtocolActuatorResolver;
}

export interface SimulationEngineOptions {
  readonly config?: SimulationConfig;
  readonly protocols?: SimulationProtocolOptions;
  readonly safetyInterlock?: SafetyInterlock;
}

interface SerializedSimulationState {
  readonly activeShortageIds: readonly string[];
  readonly clock: SimulationClockState;
  readonly colonists: readonly ColonistState[];
  readonly events: readonly SimulationEvent[];
  readonly eventSequence: number;
  readonly facilities: readonly FacilityInstanceState[];
  readonly maintenanceTasks: readonly MaintenanceTaskState[];
  readonly processedCommandIds: readonly string[];
  readonly protocolExecutionTraces?: readonly ProtocolExecutionTrace[];
  readonly protocolRuntime?: ProtocolRuntimeState;
  readonly resources: SimulationSnapshot['resources'];
  readonly revision: number;
}

type SnapshotListener = () => void;

const EMPTY_PROTOCOL_OUTCOMES: readonly ProtocolCommandOutcome[] = Object.freeze([]);

function validateConfig(config: SimulationConfig): void {
  if (!Number.isInteger(config.daylightDurationMinutes) || config.daylightDurationMinutes < 0 || config.daylightDurationMinutes > config.clock.localDayMinutes) {
    throw new Error('daylightDurationMinutes must be an integer within the local day.');
  }
  if (config.maintenanceThreshold !== undefined && (config.maintenanceThreshold <= 0 || config.maintenanceThreshold > 100)) {
    throw new Error('maintenanceThreshold must be within 1..100.');
  }
  if (config.protocolLimits !== undefined) {
    const limits = config.protocolLimits;
    if (limits.delayMinimumMinutes <= 0 || limits.delayMaximumMinutes < limits.delayMinimumMinutes) {
      throw new Error('Protocol delay limits must be positive and ordered.');
    }
    if (limits.longDelayMinutes < limits.delayMinimumMinutes || limits.longDelayMinutes > limits.delayMaximumMinutes) {
      throw new Error('longDelayMinutes must sit inside the allowed delay range.');
    }
  }
  if (config.population !== undefined) {
    const population = config.population;
    if (!Number.isInteger(population.count) || population.count < 0) throw new Error('Population count must be a non-negative integer.');
    if (!Number.isInteger(population.restGroupCount) || population.restGroupCount <= 0) throw new Error('restGroupCount must be a positive integer.');
    if (population.restDurationMinutes < 0 || population.restDurationMinutes >= population.restCycleMinutes) throw new Error('Rest duration must be shorter than its cycle.');
  }
  const ids = new Set<string>();
  for (const definition of config.facilities) {
    if (ids.has(definition.id)) throw new Error(`Duplicate facility id: ${definition.id}`);
    ids.add(definition.id);
    if (definition.initialCondition < 0 || definition.initialCondition > 100) throw new Error(`Facility ${definition.id} condition must be between 0 and 100.`);
    if (definition.workforce !== undefined && (definition.workforce.minimum <= 0 || definition.workforce.nominal < definition.workforce.minimum)) {
      throw new Error(`Facility ${definition.id} workforce requirements are invalid.`);
    }
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
  private readonly activeShortageIds = new Set<string>();
  private readonly clock: SimulationClock;
  private readonly colonists: MutableColonistState[];
  private readonly config: SimulationConfig;
  private readonly definitions: ReadonlyMap<string, FacilityDefinition>;
  private readonly events: SimulationEvent[] = [];
  private readonly facilities = new Map<string, MutableFacilityState>();
  private readonly listeners = new Set<SnapshotListener>();
  private readonly maintenanceTasks: MutableMaintenanceTaskState[] = [];
  private readonly processedCommandIds = new Set<string>();
  private readonly protocolOptions: SimulationProtocolOptions | undefined;
  private readonly protocolRuntime = new ProtocolRuntime();
  private readonly resources: MutableResourcePoolState;
  private readonly safetyInterlock: SafetyInterlock;
  private eventSequence = 0;
  private protocolActionRequests: readonly ProtocolActionRequest[] = Object.freeze([]);
  private protocolCommandOutcomes: readonly ProtocolCommandOutcome[] = EMPTY_PROTOCOL_OUTCOMES;
  private protocolExecutionTraces: readonly ProtocolExecutionTrace[] = Object.freeze([]);
  private revision = 0;
  private snapshot: SimulationSnapshot;

  constructor(options: SimulationEngineOptions = {}) {
    this.config = options.config ?? PHASE_THREE_BASELINE_CONFIG;
    this.protocolOptions = options.protocols;
    validateConfig(this.config);
    this.clock = new SimulationClock(this.config.clock, this.config.initialSpeed);
    this.safetyInterlock = options.safetyInterlock ?? defaultSafetyInterlock;
    this.definitions = new Map(this.config.facilities.map((definition) => [definition.id, definition]));
    for (const definition of this.config.facilities) this.facilities.set(definition.id, createFacilityState(definition));
    this.resources = createResourcePool(this.config.initialResources);
    this.colonists = createColonists(this.config);
    this.reallocateWorkforce(false, false);
    applyFacilityWear(0, this.config.facilities, this.facilities, this.config);
    updateResourceLedger(0, this.config.baseConsumptionPerHour, this.config.facilities, this.facilities, this.resources);
    this.snapshot = this.createSnapshot();
  }

  static fromSerializedState(serialized: string, options: SimulationEngineOptions = {}): SimulationEngine {
    const engine = new SimulationEngine(options);
    engine.restoreAuthoritativeState(JSON.parse(serialized) as SerializedSimulationState);
    return engine;
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

  /** En son fixed step'te protocol runtime'ın ürettiği action request'ler (§53.6). */
  getProtocolActionRequests(): readonly ProtocolActionRequest[] {
    return this.protocolActionRequests;
  }

  /**
   * En son fixed step'te arbitration'dan çıkan command sonuçları (§13.11).
   * Her action request'in tam olarak bir karşılığı vardır.
   */
  getProtocolCommandOutcomes(): readonly ProtocolCommandOutcome[] {
    return this.protocolCommandOutcomes;
  }

  /** Headless execution trace'leri (§53.5). Faz 5 data katmanı. */
  getProtocolExecutionTraces(): readonly ProtocolExecutionTrace[] {
    return this.protocolExecutionTraces;
  }

  getSnapshot(): SimulationSnapshot {
    return this.snapshot;
  }

  serializeAuthoritativeState(): string {
    return JSON.stringify(this.exportAuthoritativeState());
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
    const previousBand = facility?.conditionBand;
    const previousState = facility?.state;
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
    if (facility !== undefined && result.status === 'applied') {
      this.settleAppliedCommand(request.actuator, facility, previousBand, previousState);
    }
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
        realSecondsPerSimulationHour: this.config.clock.realSecondsPerSimulationHour,
        speed: this.clock.getSpeed(),
      }),
      colonists: Object.freeze([...this.colonists].sort((left, right) => left.id.localeCompare(right.id)).map(toReadonlyColonist)),
      eventCount: this.events.length,
      facilities: Object.freeze([...this.facilities.values()].sort((left, right) => left.id.localeCompare(right.id)).map(toReadonlyFacilityState)),
      maintenanceTasks: Object.freeze([...this.maintenanceTasks].sort(compareMaintenanceTasks).map(toReadonlyMaintenanceTask)),
      resources: toReadonlyResourcePool(this.resources),
      revision: this.revision,
      time,
      workforce: workforceSummary(this.colonists),
    });
  }

  private emitConditionTransition(transition: ConditionTransition): void {
    this.emitEvent({
      category: 'system',
      eventType: 'facility.condition-band-changed',
      facilityId: transition.facilityId,
      payload: { currentBand: transition.currentBand, previousBand: transition.previousBand },
      severity: transition.currentBand === 'failed' ? 'critical' : transition.currentBand === 'critical' ? 'warning' : 'info',
      sourceEntityId: transition.facilityId,
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

  private emitFacilityFailed(facilityId: string): void {
    this.emitEvent({ category: 'system', eventType: 'facility.failed', facilityId, severity: 'critical', sourceEntityId: facilityId });
  }

  private emitMaintenanceTransitions(transitions: readonly MaintenanceTransition[]): void {
    for (const transition of transitions) {
      const eventType = `maintenance.${transition.type}`;
      this.emitEvent({
        category: 'system',
        eventType,
        facilityId: transition.facilityId,
        ...(transition.reasonCode === undefined ? {} : { reasonCode: transition.reasonCode }),
        severity: transition.type === 'waiting' ? 'warning' : 'info',
        sourceEntityId: transition.taskId,
        targetEntityId: transition.facilityId,
      });
      if (transition.type === 'completed' && transition.recoveredFromFailure === true) {
        this.emitEvent({ category: 'system', eventType: 'facility.recovered', facilityId: transition.facilityId, severity: 'info', sourceEntityId: transition.taskId, targetEntityId: transition.facilityId });
      }
    }
  }

  private emitWorkforceTransitions(transitions: readonly WorkforceTransition[]): void {
    for (const transition of transitions) {
      this.emitEvent({
        category: 'system',
        eventType: `workforce.${transition.type}`,
        ...(transition.facilityId === undefined ? {} : { facilityId: transition.facilityId, targetEntityId: transition.facilityId }),
        payload: {
          colonistId: transition.colonistId,
          ...(transition.previousFacilityId === undefined ? {} : { previousFacilityId: transition.previousFacilityId }),
        },
        severity: 'info',
        sourceEntityId: transition.colonistId,
      });
    }
  }

  private exportAuthoritativeState(): SerializedSimulationState {
    return {
      activeShortageIds: [...this.activeShortageIds].sort(),
      clock: this.clock.exportState(),
      colonists: this.snapshot.colonists,
      events: this.events,
      eventSequence: this.eventSequence,
      facilities: this.snapshot.facilities,
      maintenanceTasks: this.snapshot.maintenanceTasks,
      processedCommandIds: [...this.processedCommandIds].sort(),
      protocolExecutionTraces: [...this.protocolExecutionTraces],
      protocolRuntime: this.protocolRuntime.exportState(),
      resources: this.snapshot.resources,
      revision: this.revision,
    };
  }

  private publish(): void {
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener();
  }

  private reallocateWorkforce(instantOnSite: boolean, emitTransitions: boolean): void {
    const requests = createWorkforceRequests(this.config.facilities, this.facilities, this.maintenanceTasks, this.resources.material.stored);
    const allocation = allocateWorkforce(requests, this.colonists);
    const transitions = applyWorkforceAllocation(requests, allocation, this.colonists, this.clock.getElapsedMinutes(), this.config, instantOnSite);
    updateFacilityWorkforce(this.facilities, this.colonists);
    if (emitTransitions) this.emitWorkforceTransitions(transitions);

    const shortages = new Set(requests.filter((request) => (allocation.get(request.id)?.length ?? 0) < request.desired).map(({ id }) => id));
    if (emitTransitions) {
      for (const request of requests) {
        if (!shortages.has(request.id) || this.activeShortageIds.has(request.id)) continue;
        this.emitEvent({
          category: 'system',
          eventType: 'workforce.shortage',
          facilityId: request.targetEntityId,
          payload: { assigned: allocation.get(request.id)?.length ?? 0, desired: request.desired, requestId: request.id, taskType: request.taskType },
          severity: request.priority === 'critical' ? 'critical' : 'warning',
          sourceEntityId: request.id,
          targetEntityId: request.targetEntityId,
        });
      }
    }
    this.activeShortageIds.clear();
    for (const id of shortages) this.activeShortageIds.add(id);
  }

  private restoreAuthoritativeState(state: SerializedSimulationState): void {
    this.clock.restoreState(state.clock);
    this.eventSequence = state.eventSequence;
    this.revision = state.revision;
    this.events.splice(0, this.events.length, ...state.events.map(frozenEvent));
    this.processedCommandIds.clear();
    for (const id of state.processedCommandIds) this.processedCommandIds.add(id);
    this.activeShortageIds.clear();
    for (const id of state.activeShortageIds) this.activeShortageIds.add(id);
    // Delay'de bekleyen execution'ların KALAN süresi save ile taşınır (§13.5).
    if (state.protocolRuntime !== undefined) this.protocolRuntime.restoreState(state.protocolRuntime);
    if (state.protocolExecutionTraces !== undefined) this.protocolExecutionTraces = [...state.protocolExecutionTraces];
    for (const facility of state.facilities) {
      const target = this.facilities.get(facility.id);
      if (target === undefined) throw new Error(`Serialized facility is missing from config: ${facility.id}`);
      Object.assign(target, facility, { setpoints: { ...facility.setpoints } });
    }
    Object.assign(this.resources.energy, state.resources.energy);
    Object.assign(this.resources.material, state.resources.material);
    Object.assign(this.resources.oxygen, state.resources.oxygen);
    this.colonists.splice(0, this.colonists.length, ...state.colonists.map((colonist) => ({
      ...colonist,
      assignment: colonist.assignment === null ? null : { ...colonist.assignment },
      travel: colonist.travel === null ? null : { ...colonist.travel, routeNodeIds: [...colonist.travel.routeNodeIds] },
    })));
    this.maintenanceTasks.splice(0, this.maintenanceTasks.length, ...state.maintenanceTasks.map((task) => ({ ...task, workerIds: [...task.workerIds] })));
    this.snapshot = this.createSnapshot();
  }

  /**
   * §13.10 command arbitration + §13.4 action persistence.
   *
   * Kararlar tek bir arbitration-öncesi tesis görünümü üzerinden verilir, sonra
   * kazananlar `applyFacilityCommand` ile uygulanır — sonuç KALICIDIR, protokol
   * geri alma mekanizması yoktur. Her request tam olarak bir outcome üretir (§13.11).
   */
  private applyProtocolActionRequests(requests: readonly ProtocolActionRequest[]): readonly ProtocolCommandOutcome[] {
    if (requests.length === 0) return EMPTY_PROTOCOL_OUTCOMES;
    const plan = arbitrateProtocolCommands({
      definitions: this.definitions,
      facilities: new Map([...this.facilities].map(([id, facility]) => [id, toReadonlyFacilityState(facility)] as const)),
      interlock: this.safetyInterlock,
      requests,
      resolveActuator: this.protocolOptions?.resolveActuator ?? identityActuatorResolver,
    });

    const outcomes: ProtocolCommandOutcome[] = [...plan.rejections];
    for (const conflict of plan.conflicts) this.emitCommandConflict(conflict);

    for (const planned of plan.commands) {
      const facility = this.facilities.get(planned.command.facilityId);
      const definition = this.definitions.get(planned.command.facilityId);
      if (facility === undefined || definition === undefined) continue;
      const previousBand = facility.conditionBand;
      const previousState = facility.state;
      const result = applyFacilityCommand(planned.command, facility, definition, this.safetyInterlock);
      if (result.status === 'applied') this.settleAppliedCommand(planned.command.actuator, facility, previousBand, previousState);
      for (const request of planned.requests) {
        outcomes.push(protocolCommandOutcome(
          request,
          { actuator: planned.command.actuator, ...(planned.setpointKey === undefined ? {} : { setpointKey: planned.setpointKey }) },
          result.status,
          facilityReasonToOutcomeReason(result.reasonCode),
          result.appliedValue,
        ));
      }
    }

    outcomes.sort((left, right) => left.protocolExecutionId.localeCompare(right.protocolExecutionId)
      || left.actuator.localeCompare(right.actuator)
      || (left.setpointKey ?? '').localeCompare(right.setpointKey ?? ''));
    for (const outcome of outcomes) this.emitCommandOutcome(outcome);
    return Object.freeze(outcomes);
  }

  private emitCommandConflict(conflict: ProtocolCommandConflict): void {
    this.emitEvent({
      category: 'protocol',
      eventType: 'protocol.command-conflict',
      facilityId: conflict.facilityId,
      payload: {
        actuator: conflict.actuator,
        priority: conflict.priority,
        protocolExecutionIds: conflict.protocolExecutionIds,
        protocolIds: conflict.protocolIds,
        requestedValues: conflict.requestedValues,
        ...(conflict.setpointKey === undefined ? {} : { setpointKey: conflict.setpointKey }),
      },
      reasonCode: 'COMMAND_CONFLICT_EQUAL_PRIORITY',
      severity: 'warning',
      targetEntityId: conflict.facilityId,
    });
  }

  private emitCommandOutcome(outcome: ProtocolCommandOutcome): void {
    this.emitEvent({
      category: 'protocol',
      eventType: 'protocol.command-result',
      ...(outcome.facilityId === undefined ? {} : { facilityId: outcome.facilityId, targetEntityId: outcome.facilityId }),
      payload: {
        actuator: outcome.actuator,
        ...(outcome.appliedValue === undefined ? {} : { appliedValue: outcome.appliedValue }),
        ...(outcome.facilityReasonCode === undefined ? {} : { facilityReasonCode: outcome.facilityReasonCode }),
        protocolId: outcome.protocolId,
        ...(outcome.requestedValue === undefined ? {} : { requestedValue: outcome.requestedValue }),
        ...(outcome.setpointKey === undefined ? {} : { setpointKey: outcome.setpointKey }),
        status: outcome.status,
      },
      ...(outcome.reasonCode === undefined ? {} : { reasonCode: outcome.reasonCode }),
      severity: outcome.status === 'applied' || outcome.status === 'delayed' ? 'info' : 'warning',
      sourceEntityId: outcome.protocolExecutionId,
    });
  }

  private runFixedSteps(stepCount: number): void {
    if (stepCount === 0) return;
    for (let index = 0; index < stepCount; index += 1) {
      this.clock.advanceFixedStep();
      const stepMinutes = this.config.clock.fixedStepMinutes;
      const elapsedMinutes = this.clock.getElapsedMinutes();
      this.emitWorkforceTransitions(updateRestStates(this.colonists, elapsedMinutes, this.config));
      const newMaintenanceRequests = refreshMaintenanceRequests(
        this.config.facilities,
        this.facilities,
        this.maintenanceTasks,
        elapsedMinutes,
        this.config.maintenanceThreshold ?? 60,
      );
      this.emitMaintenanceTransitions(newMaintenanceRequests);
      this.reallocateWorkforce(false, true);
      this.emitWorkforceTransitions(progressTravelTasks(this.colonists, stepMinutes));
      updateFacilityWorkforce(this.facilities, this.colonists);
      const maintenanceTransitions = updateMaintenanceTasks(
        stepMinutes,
        elapsedMinutes,
        this.definitions,
        this.facilities,
        this.colonists,
        this.resources,
        this.maintenanceTasks,
      );
      this.emitMaintenanceTransitions(maintenanceTransitions);
      if (maintenanceTransitions.some(({ type }) => type === 'completed')) this.reallocateWorkforce(false, true);
      updateResourceLedger(stepMinutes, this.config.baseConsumptionPerHour, this.config.facilities, this.facilities, this.resources);
      const conditionTransitions = applyFacilityWear(stepMinutes, this.config.facilities, this.facilities, this.config);
      for (const transition of conditionTransitions) {
        this.emitConditionTransition(transition);
        if (transition.currentBand === 'failed') this.emitFacilityFailed(transition.facilityId);
      }
      const postWearRequests = refreshMaintenanceRequests(
        this.config.facilities,
        this.facilities,
        this.maintenanceTasks,
        elapsedMinutes,
        this.config.maintenanceThreshold ?? 60,
      );
      this.emitMaintenanceTransitions(postWearRequests);
      if (conditionTransitions.length > 0 || postWearRequests.length > 0) {
        this.reallocateWorkforce(false, true);
      }
      if (this.protocolOptions !== undefined) {
        // Protocol runtime bu tick'in authoritative state'ini okur; snapshot adım
        // sonunda tazelenir, listener'lar hâlâ yalnız publish() ile uyarılır.
        this.snapshot = this.createSnapshot();
        this.protocolActionRequests = this.protocolRuntime.tick({
          protocols: this.protocolOptions.protocols,
          readSensor: this.protocolOptions.readSensor,
          simTime: elapsedMinutes,
          stepMinutes,
        });
        this.protocolExecutionTraces = this.protocolRuntime.getExecutionTraces();
        // §53.6: arbitration BÜTÜN request'ler toplandıktan sonra, tek seferde.
        this.protocolCommandOutcomes = this.applyProtocolActionRequests(this.protocolActionRequests);
      }
      this.revision += 1;
    }
    this.publish();
  }

  /**
   * Uygulanmış bir komuttan sonraki zorunlu düzeltmeler. Oyuncu komutu ile
   * protokol komutu AYNI yoldan geçer; aksi hâlde protokolün yaptığı değişiklik
   * bakım/iş gücü sonuçlarını doğurmazdı.
   */
  private settleAppliedCommand(
    actuator: FacilityCommandRequest['actuator'],
    facility: MutableFacilityState,
    previousBand: FacilityInstanceState['conditionBand'] | undefined,
    previousState: FacilityInstanceState['state'] | undefined,
  ): void {
    if (actuator === 'set-maintenance-priority') {
      for (const task of this.maintenanceTasks) if (task.facilityId === facility.id && task.status !== 'completed') task.priority = facility.maintenancePriority;
    }
    if (previousBand !== undefined && previousBand !== facility.conditionBand) this.emitConditionTransition({ currentBand: facility.conditionBand, facilityId: facility.id, previousBand });
    if (previousState !== 'failed' && facility.state === 'failed') this.emitFacilityFailed(facility.id);
    this.emitMaintenanceTransitions(refreshMaintenanceRequests(
      this.config.facilities,
      this.facilities,
      this.maintenanceTasks,
      this.clock.getElapsedMinutes(),
      this.config.maintenanceThreshold ?? 60,
    ));
    this.reallocateWorkforce(false, true);
    this.emitMaintenanceTransitions(updateMaintenanceTasks(
      0,
      this.clock.getElapsedMinutes(),
      this.definitions,
      this.facilities,
      this.colonists,
      this.resources,
      this.maintenanceTasks,
    ));
    updateFacilityWorkforce(this.facilities, this.colonists);
  }
}
