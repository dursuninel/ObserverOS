import type { FacilityDefinition, Priority } from '../../domain/facilities/Facility';
import { RESOURCE_IDS, type ResourceId, type ResourcePoolState, type ResourceQuantityState, type ResourceRates } from '../../domain/resources/Resource';
import type { MutableFacilityState } from './facilityCommands';
import { conditionPerformanceFactor } from './conditionSystem';

export interface MutableResourceQuantityState {
  capacity: number;
  consumptionRate: number;
  productionRate: number;
  stored: number;
}

export type MutableResourcePoolState = Record<ResourceId, MutableResourceQuantityState>;

const PRIORITY_RANK: Readonly<Record<Priority, number>> = Object.freeze({ critical: 3, high: 2, low: 0, normal: 1 });

function rate(rates: ResourceRates | undefined, resource: ResourceId): number {
  return rates?.[resource] ?? 0;
}

function activeMode(definition: FacilityDefinition, state: MutableFacilityState) {
  if (state.state !== 'online' || state.mode === null) return undefined;
  return definition.modes?.[state.mode];
}

export function workforcePerformanceFactor(definition: FacilityDefinition, state: MutableFacilityState): number {
  const workforce = definition.workforce;
  if (workforce === undefined) return 1;
  if (state.effectiveWorkforce < workforce.minimum) return 0;
  const target = state.mode === 'boost' ? workforce.boost ?? workforce.nominal : workforce.nominal;
  if (target <= workforce.minimum || state.effectiveWorkforce >= target) return 1;
  return 0.6 + (state.effectiveWorkforce - workforce.minimum) / (target - workforce.minimum) * 0.4;
}

function facilityPerformanceFactor(definition: FacilityDefinition, state: MutableFacilityState): number {
  return workforcePerformanceFactor(definition, state) * conditionPerformanceFactor(state.condition);
}

function facilityRate(definition: FacilityDefinition, state: MutableFacilityState, resource: ResourceId, direction: 'consumption' | 'production'): number {
  const mode = activeMode(definition, state);
  const rates = direction === 'production' ? mode?.productionPerHour : mode?.consumptionPerHour;
  return rate(rates, resource) * facilityPerformanceFactor(definition, state);
}

function availableCapacity(
  resource: ResourceId,
  definitions: readonly FacilityDefinition[],
  states: ReadonlyMap<string, MutableFacilityState>,
): number {
  return definitions.reduce((total, definition) => {
    const state = states.get(definition.id);
    if (state?.state === 'failed') return total;
    return total + (definition.storageCapacity?.[resource] ?? 0);
  }, 0);
}

export function createResourcePool(initial: Readonly<Record<ResourceId, number>>): MutableResourcePoolState {
  return {
    energy: { capacity: 0, consumptionRate: 0, productionRate: 0, stored: initial.energy },
    material: { capacity: 0, consumptionRate: 0, productionRate: 0, stored: initial.material },
    oxygen: { capacity: 0, consumptionRate: 0, productionRate: 0, stored: initial.oxygen },
  };
}

export function updateResourceLedger(
  stepMinutes: number,
  baseConsumptionPerHour: ResourceRates,
  definitions: readonly FacilityDefinition[],
  states: ReadonlyMap<string, MutableFacilityState>,
  resources: MutableResourcePoolState,
): void {
  const hours = stepMinutes / 60;
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
  const onlineStates = [...states.values()].filter((state) => state.state === 'online');
  const energyProductionRate = onlineStates.reduce((total, state) => {
    const definition = definitionById.get(state.id);
    return total + (definition === undefined ? 0 : facilityRate(definition, state, 'energy', 'production'));
  }, 0);
  const baseEnergyNeed = rate(baseConsumptionPerHour, 'energy') * hours;
  const energyCapacity = availableCapacity('energy', definitions, states);
  let availableEnergy = Math.min(resources.energy.stored, energyCapacity) + energyProductionRate * hours;
  const allocatedBaseEnergy = Math.min(availableEnergy, baseEnergyNeed);
  availableEnergy -= allocatedBaseEnergy;

  const energyConsumers = onlineStates
    .map((state) => ({ definition: definitionById.get(state.id), state }))
    .filter((entry): entry is { definition: FacilityDefinition; state: MutableFacilityState } => entry.definition !== undefined)
    .filter(({ definition, state }) => facilityRate(definition, state, 'energy', 'consumption') > 0)
    .sort((left, right) => PRIORITY_RANK[right.state.energyPriority] - PRIORITY_RANK[left.state.energyPriority] || left.state.id.localeCompare(right.state.id));

  const supplied = new Set<string>();
  let allocatedFacilityEnergy = 0;
  for (const { definition, state } of energyConsumers) {
    const needed = facilityRate(definition, state, 'energy', 'consumption') * hours;
    if (availableEnergy + Number.EPSILON < needed) continue;
    availableEnergy -= needed;
    allocatedFacilityEnergy += needed;
    supplied.add(state.id);
  }

  const productionRates: Record<ResourceId, number> = { energy: energyProductionRate, material: 0, oxygen: 0 };
  const consumptionRates: Record<ResourceId, number> = {
    energy: hours === 0 ? 0 : (allocatedBaseEnergy + allocatedFacilityEnergy) / hours,
    material: rate(baseConsumptionPerHour, 'material'),
    oxygen: rate(baseConsumptionPerHour, 'oxygen'),
  };

  for (const state of onlineStates) {
    const definition = definitionById.get(state.id);
    if (definition === undefined) continue;
    const needsEnergy = facilityRate(definition, state, 'energy', 'consumption') > 0;
    if (needsEnergy && !supplied.has(state.id)) continue;
    productionRates.material += facilityRate(definition, state, 'material', 'production');
    productionRates.oxygen += facilityRate(definition, state, 'oxygen', 'production');
    consumptionRates.material += facilityRate(definition, state, 'material', 'consumption');
    consumptionRates.oxygen += facilityRate(definition, state, 'oxygen', 'consumption');
  }

  for (const resource of RESOURCE_IDS) {
    const capacity = availableCapacity(resource, definitions, states);
    const quantity = resources[resource];
    const requestedProduction = productionRates[resource] * hours;
    const requestedConsumption = consumptionRates[resource] * hours;
    const accessibleStored = Math.min(quantity.stored, capacity);
    const actualConsumption = Math.min(requestedConsumption, accessibleStored + requestedProduction);
    const storageHeadroom = Math.max(0, capacity - quantity.stored);
    const actualProduction = Math.min(requestedProduction, actualConsumption + storageHeadroom);
    quantity.capacity = capacity;
    quantity.productionRate = hours === 0 ? 0 : actualProduction / hours;
    quantity.consumptionRate = hours === 0 ? 0 : actualConsumption / hours;
    quantity.stored = Math.max(0, quantity.stored + actualProduction - actualConsumption);
  }
}

export function toReadonlyResourcePool(resources: MutableResourcePoolState): ResourcePoolState {
  const freezeQuantity = (quantity: MutableResourceQuantityState): ResourceQuantityState => Object.freeze({ ...quantity });
  return Object.freeze({
    energy: freezeQuantity(resources.energy),
    material: freezeQuantity(resources.material),
    oxygen: freezeQuantity(resources.oxygen),
  });
}
