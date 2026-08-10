import type { FacilityCommandResult } from '../../domain/facilities/Facility';
import { RESOURCE_IDS } from '../../domain/resources/Resource';
import type { SimulationEngine } from '../../simulation/SimulationEngine';
import type { SimulationSnapshot } from '../../simulation/SimulationSnapshot';

export type MineDiagnosticCommand = 'boost' | 'eco' | 'normal' | 'offline' | 'online';

export function createSimulationDiagnosticView(snapshot: SimulationSnapshot) {
  const mine = snapshot.facilities.find(({ id }) => id === 'mine-01') ?? null;
  const hours = Math.floor(snapshot.time.localMinute / 60).toString().padStart(2, '0');
  const minutes = (snapshot.time.localMinute % 60).toString().padStart(2, '0');
  return Object.freeze({
    elapsedMinutes: snapshot.time.elapsedMinutes,
    localTime: `${hours}:${minutes}`,
    mine,
    resources: Object.freeze(RESOURCE_IDS.map((id) => {
      const resource = snapshot.resources[id];
      return Object.freeze({ ...resource, id, netRate: resource.productionRate - resource.consumptionRate });
    })),
    speed: snapshot.clock.speed,
    time: snapshot.time,
  });
}

export function submitMineDiagnosticCommand(
  engine: SimulationEngine,
  command: MineDiagnosticCommand,
  requestId: string,
): FacilityCommandResult {
  const modeCommand = command === 'eco' || command === 'normal' || command === 'boost';
  return engine.submitFacilityCommand({
    actuator: modeCommand ? 'set-mode' : 'set-operating-state',
    facilityId: 'mine-01',
    id: requestId,
    priority: 'normal',
    simTime: engine.getSnapshot().time.elapsedMinutes,
    value: modeCommand ? command : command,
  });
}

