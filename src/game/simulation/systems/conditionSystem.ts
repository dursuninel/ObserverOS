import type { FacilityDefinition, FacilityInstanceState, FacilityMode } from '../../domain/facilities/Facility';
import type { SimulationConfig } from '../SimulationConfig';
import type { MutableFacilityState } from './facilityCommands';

export type ConditionBand = FacilityInstanceState['conditionBand'];

export interface ConditionTransition {
  readonly currentBand: ConditionBand;
  readonly facilityId: string;
  readonly previousBand: ConditionBand;
}

export function conditionBand(condition: number): ConditionBand {
  if (condition <= 0) return 'failed';
  if (condition < 40) return 'critical';
  if (condition < 70) return 'worn';
  return 'healthy';
}

export function conditionPerformanceFactor(condition: number): number {
  if (condition <= 0) return 0;
  if (condition < 40) return 0.6 + (condition - 1) / 39 * 0.25;
  if (condition < 70) return 0.85 + (condition - 40) / 30 * 0.15;
  return 1;
}

export function modeWearMultiplier(mode: FacilityMode | null, config: SimulationConfig): number {
  const multipliers = config.wearModeMultipliers ?? { eco: 0.5, normal: 1, boost: 2.5 };
  return mode === null ? 1 : multipliers[mode];
}

export function facilityWearRate(definition: FacilityDefinition, state: MutableFacilityState, config: SimulationConfig): number {
  if (definition.wear === undefined || state.state !== 'online') return 0;
  return definition.wear.basePerHour * modeWearMultiplier(state.mode, config);
}

export function applyFacilityWear(
  stepMinutes: number,
  definitions: readonly FacilityDefinition[],
  facilities: ReadonlyMap<string, MutableFacilityState>,
  config: SimulationConfig,
): ConditionTransition[] {
  const transitions: ConditionTransition[] = [];
  for (const definition of definitions) {
    const state = facilities.get(definition.id);
    if (state === undefined) continue;
    const previousBand = conditionBand(state.condition);
    state.wearRatePerHour = facilityWearRate(definition, state, config);
    if (state.wearRatePerHour > 0) state.condition = Math.max(0, state.condition - state.wearRatePerHour * stepMinutes / 60);
    state.conditionBand = conditionBand(state.condition);
    if (state.condition === 0) state.state = 'failed';
    if (state.conditionBand !== previousBand) transitions.push({ currentBand: state.conditionBand, facilityId: state.id, previousBand });
  }
  return transitions;
}

export function setFacilityCondition(state: MutableFacilityState, value: number): ConditionTransition | null {
  const previousBand = conditionBand(state.condition);
  state.condition = Math.min(100, Math.max(0, value));
  state.conditionBand = conditionBand(state.condition);
  if (state.condition === 0) state.state = 'failed';
  const currentBand = state.conditionBand;
  return currentBand === previousBand ? null : { currentBand, facilityId: state.id, previousBand };
}
