import {
  FACILITY_MODES,
  type FacilityCommandRequest,
  type FacilityCommandResult,
  type FacilityDefinition,
  type FacilityInstanceState,
  type FacilityMode,
  type FacilityOperatingState,
  type Priority,
  type SafetyInterlock,
} from '../../domain/facilities/Facility';

export interface MutableFacilityState {
  assignedWorkforce: number;
  condition: number;
  conditionBand: FacilityInstanceState['conditionBand'];
  energyPriority: Priority;
  effectiveWorkforce: number;
  id: string;
  maintenancePriority: Priority;
  mode: FacilityMode | null;
  requiredBoostWorkforce: number | null;
  requiredMinimumWorkforce: number;
  requiredNominalWorkforce: number;
  setpoints: Record<string, number | string | boolean>;
  state: FacilityOperatingState;
  typeId: string;
  wearRatePerHour: number;
  workPriority: Priority;
}

/** Oyuncunun (ve protokolün) doğrudan hedefleyebildiği çalışma durumları. */
export const PLAYER_OPERATING_TARGETS: readonly FacilityOperatingState[] = ['offline', 'online', 'standby'];

function isFacilityMode(value: unknown): value is FacilityMode {
  return typeof value === 'string' && FACILITY_MODES.includes(value as FacilityMode);
}

function isPriority(value: unknown): value is Priority {
  return value === 'low' || value === 'normal' || value === 'high' || value === 'critical';
}

function isOperatingTarget(value: unknown): value is FacilityOperatingState {
  return typeof value === 'string' && PLAYER_OPERATING_TARGETS.includes(value as FacilityOperatingState);
}

export const defaultSafetyInterlock: SafetyInterlock = Object.freeze({
  evaluate(request: FacilityCommandRequest, state: FacilityInstanceState, definition: FacilityDefinition) {
    if (state.state === 'failed' && request.actuator !== 'set-maintenance-priority') return { allowed: false, reasonCode: 'facility.failed' };
    if (state.state === 'maintenance') return { allowed: false, reasonCode: 'facility.maintenance-active' };
    if (state.state === 'interlocked' && request.actuator !== 'set-energy-priority' && request.actuator !== 'set-setpoint') {
      return { allowed: false, reasonCode: 'facility.safety-interlocked' };
    }
    if (request.actuator === 'set-mode' && definition.safety?.requiresRampedModeChange === true && request.value !== state.mode) {
      return { allowed: false, reasonCode: 'facility.ramp-config-required' };
    }
    if (request.actuator === 'set-mode' && request.value === 'boost') {
      const minimum = definition.safety?.boostConditionMinimum;
      if (minimum !== undefined && state.condition < minimum) return { allowed: false, reasonCode: 'facility.condition-blocks-boost' };
      const requiredBoost = definition.workforce?.boost;
      if (requiredBoost !== undefined && state.effectiveWorkforce < requiredBoost) return { allowed: false, reasonCode: 'facility.workforce-blocks-boost' };
    }
    return { allowed: true };
  },
});

export function createFacilityState(definition: FacilityDefinition): MutableFacilityState {
  return {
    assignedWorkforce: 0,
    condition: definition.initialCondition,
    conditionBand: definition.initialCondition === 0 ? 'failed' : definition.initialCondition < 40 ? 'critical' : definition.initialCondition < 70 ? 'worn' : 'healthy',
    energyPriority: 'normal',
    effectiveWorkforce: 0,
    id: definition.id,
    maintenancePriority: 'normal',
    mode: definition.initialMode ?? null,
    requiredBoostWorkforce: definition.workforce?.boost ?? null,
    requiredMinimumWorkforce: definition.workforce?.minimum ?? 0,
    requiredNominalWorkforce: definition.workforce?.nominal ?? 0,
    setpoints: {},
    state: definition.initialState,
    typeId: definition.typeId,
    wearRatePerHour: 0,
    workPriority: 'normal',
  };
}

export function applyFacilityCommand(
  request: FacilityCommandRequest,
  state: MutableFacilityState,
  definition: FacilityDefinition,
  interlock: SafetyInterlock,
): FacilityCommandResult {
  const decision = interlock.evaluate(request, state, definition);
  if (!decision.allowed) return {
    ...(decision.reasonCode === undefined ? {} : { reasonCode: decision.reasonCode }),
    requestId: request.id,
    status: 'blocked',
  };

  if (request.actuator === 'set-mode') {
    if (!isFacilityMode(request.value) || definition.modes?.[request.value] === undefined) {
      return { reasonCode: 'facility.mode-unsupported', requestId: request.id, status: 'failed' };
    }
    state.mode = request.value;
    return { appliedValue: request.value, requestId: request.id, status: 'applied' };
  }

  if (request.actuator === 'set-operating-state') {
    if (!isOperatingTarget(request.value)) return { reasonCode: 'facility.state-target-unsupported', requestId: request.id, status: 'failed' };
    state.state = request.value;
    return { appliedValue: request.value, requestId: request.id, status: 'applied' };
  }

  if (request.actuator === 'set-energy-priority') {
    if (!isPriority(request.value)) return { reasonCode: 'facility.priority-invalid', requestId: request.id, status: 'failed' };
    state.energyPriority = request.value;
    return { appliedValue: request.value, requestId: request.id, status: 'applied' };
  }

  if (request.actuator === 'set-work-priority' || request.actuator === 'set-maintenance-priority') {
    if (!isPriority(request.value)) return { reasonCode: 'facility.priority-invalid', requestId: request.id, status: 'failed' };
    if (request.actuator === 'set-work-priority') state.workPriority = request.value;
    else state.maintenancePriority = request.value;
    return { appliedValue: request.value, requestId: request.id, status: 'applied' };
  }

  if (request.actuator === 'set-condition') {
    if (typeof request.value !== 'number' || !Number.isFinite(request.value) || request.value < 0 || request.value > 100) {
      return { reasonCode: 'facility.condition-invalid', requestId: request.id, status: 'failed' };
    }
    state.condition = request.value;
    state.conditionBand = request.value === 0 ? 'failed' : request.value < 40 ? 'critical' : request.value < 70 ? 'worn' : 'healthy';
    if (request.value === 0) state.state = 'failed';
    return { appliedValue: request.value, requestId: request.id, status: 'applied' };
  }

  if (typeof request.value !== 'object' || request.value === null || !('key' in request.value) || !('value' in request.value)) {
    return { reasonCode: 'facility.setpoint-invalid', requestId: request.id, status: 'failed' };
  }
  const { key, value } = request.value as { readonly key: unknown; readonly value: unknown };
  if (typeof key !== 'string' || (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean')) {
    return { reasonCode: 'facility.setpoint-invalid', requestId: request.id, status: 'failed' };
  }
  state.setpoints[key] = value;
  return { appliedValue: Object.freeze({ key, value }), requestId: request.id, status: 'applied' };
}

export function toReadonlyFacilityState(state: MutableFacilityState): FacilityInstanceState {
  return Object.freeze({ ...state, setpoints: Object.freeze({ ...state.setpoints }) });
}
