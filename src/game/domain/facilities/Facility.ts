import type { ResourceId, ResourceRates } from '../resources/Resource';

export const PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const FACILITY_MODES = ['eco', 'normal', 'boost'] as const;
export type FacilityMode = (typeof FACILITY_MODES)[number];

export const FACILITY_OPERATING_STATES = [
  'offline', 'starting', 'online', 'standby', 'maintenance', 'interlocked', 'failed',
] as const;
export type FacilityOperatingState = (typeof FACILITY_OPERATING_STATES)[number];

export interface FacilityModeDefinition {
  readonly consumptionPerHour?: ResourceRates;
  readonly productionPerHour?: ResourceRates;
}

export interface FacilitySafetyDefinition {
  readonly boostConditionMinimum?: number;
  readonly requiresRampedModeChange?: boolean;
}

export interface FacilityDefinition {
  readonly id: string;
  readonly initialCondition: number;
  readonly initialMode?: FacilityMode;
  readonly initialState: FacilityOperatingState;
  readonly modes?: Readonly<Partial<Record<FacilityMode, FacilityModeDefinition>>>;
  readonly safety?: FacilitySafetyDefinition;
  readonly storageCapacity?: Readonly<Partial<Record<ResourceId, number>>>;
  readonly typeId: string;
}

export interface FacilityInstanceState {
  readonly condition: number;
  readonly energyPriority: Priority;
  readonly id: string;
  readonly maintenancePriority: Priority;
  readonly mode: FacilityMode | null;
  readonly setpoints: Readonly<Record<string, number | string | boolean>>;
  readonly state: FacilityOperatingState;
  readonly typeId: string;
  readonly workPriority: Priority;
}

export interface FacilityCommandRequest {
  readonly actuator: 'set-energy-priority' | 'set-mode' | 'set-operating-state' | 'set-setpoint';
  readonly facilityId: string;
  readonly id: string;
  readonly priority: Priority;
  readonly simTime: number;
  readonly value: unknown;
}

export interface FacilityCommandResult {
  readonly appliedValue?: unknown;
  readonly reasonCode?: string;
  readonly requestId: string;
  readonly status: 'applied' | 'blocked' | 'failed' | 'delayed';
}

export interface SafetyInterlockDecision {
  readonly allowed: boolean;
  readonly reasonCode?: string;
}

export interface SafetyInterlock {
  evaluate(
    request: FacilityCommandRequest,
    state: FacilityInstanceState,
    definition: FacilityDefinition,
  ): SafetyInterlockDecision;
}
