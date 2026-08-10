export const RESOURCE_IDS = ['energy', 'oxygen', 'material'] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];

export interface ResourceQuantityState {
  readonly capacity: number;
  readonly consumptionRate: number;
  readonly productionRate: number;
  readonly stored: number;
}

export type ResourcePoolState = Readonly<Record<ResourceId, ResourceQuantityState>>;

export type ResourceRates = Readonly<Partial<Record<ResourceId, number>>>;

