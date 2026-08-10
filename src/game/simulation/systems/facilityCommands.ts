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
  condition: number;
  energyPriority: Priority;
  id: string;
  maintenancePriority: Priority;
  mode: FacilityMode | null;
  setpoints: Record<string, number | string | boolean>;
  state: FacilityOperatingState;
  typeId: string;
  workPriority: Priority;
}

const PLAYER_OPERATING_TARGETS: readonly FacilityOperatingState[] = ['offline', 'online', 'standby'];

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
    if (state.state === 'failed') return { allowed: false, reasonCode: 'facility.failed' };
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
    }
    return { allowed: true };
  },
});

export function createFacilityState(definition: FacilityDefinition): MutableFacilityState {
  return {
    condition: definition.initialCondition,
    energyPriority: 'normal',
    id: definition.id,
    maintenancePriority: 'normal',
    mode: definition.initialMode ?? null,
    setpoints: {},
    state: definition.initialState,
    typeId: definition.typeId,
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
