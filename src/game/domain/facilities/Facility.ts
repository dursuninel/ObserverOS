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

export interface FacilityWorkforceDefinition {
  readonly boost?: number;
  readonly minimum: number;
  readonly nominal: number;
}

export interface FacilityWearDefinition {
  readonly basePerHour: number;
}

export interface FacilityMaintenanceDefinition {
  readonly durationMinutes: number;
  readonly material: number;
  readonly offlineDuringMaintenance: boolean;
  readonly restoreCondition: number;
  readonly workforce: number;
}

export interface FacilityDefinition {
  readonly id: string;
  readonly initialCondition: number;
  readonly initialMode?: FacilityMode;
  readonly initialState: FacilityOperatingState;
  readonly modes?: Readonly<Partial<Record<FacilityMode, FacilityModeDefinition>>>;
  readonly maintenance?: FacilityMaintenanceDefinition;
  readonly safety?: FacilitySafetyDefinition;
  readonly storageCapacity?: Readonly<Partial<Record<ResourceId, number>>>;
  readonly typeId: string;
  readonly wear?: FacilityWearDefinition;
  readonly workforce?: FacilityWorkforceDefinition;
}

export interface FacilityInstanceState {
  readonly assignedWorkforce: number;
  readonly condition: number;
  readonly conditionBand: 'healthy' | 'worn' | 'critical' | 'failed';
  readonly energyPriority: Priority;
  readonly effectiveWorkforce: number;
  readonly id: string;
  readonly maintenancePriority: Priority;
  readonly mode: FacilityMode | null;
  readonly requiredBoostWorkforce: number | null;
  readonly requiredMinimumWorkforce: number;
  readonly requiredNominalWorkforce: number;
  readonly setpoints: Readonly<Record<string, number | string | boolean>>;
  readonly state: FacilityOperatingState;
  readonly typeId: string;
  readonly wearRatePerHour: number;
  readonly workPriority: Priority;
}

export const FACILITY_ACTUATORS = [
  'set-condition', 'set-energy-priority', 'set-maintenance-priority', 'set-mode',
  'set-operating-state', 'set-setpoint', 'set-work-priority',
] as const;
export type FacilityActuator = (typeof FACILITY_ACTUATORS)[number];

export interface FacilityCommandRequest {
  readonly actuator: FacilityActuator;
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
