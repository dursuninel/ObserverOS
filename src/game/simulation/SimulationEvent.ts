export interface SimulationEvent {
  readonly causedByEventIds?: readonly string[];
  readonly category: 'external' | 'system' | 'protocol';
  readonly eventType: string;
  readonly facilityId?: string;
  readonly id: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly reasonCode?: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly simTime: number;
  readonly sourceEntityId?: string;
  readonly targetEntityId?: string;
}

