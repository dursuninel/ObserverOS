import type { FacilityCommandResult } from '../../domain/facilities/Facility';
import type { Priority } from '../../domain/facilities/Facility';
import { RESOURCE_IDS } from '../../domain/resources/Resource';
import type { SimulationEngine } from '../../simulation/SimulationEngine';
import type { SimulationSnapshot } from '../../simulation/SimulationSnapshot';
import { PHASE_THREE_BASELINE_CONFIG } from '../../simulation/SimulationConfig';

export type MineDiagnosticCommand = 'boost' | 'eco' | 'normal' | 'offline' | 'online';

export function createSimulationDiagnosticView(snapshot: SimulationSnapshot) {
  const mine = snapshot.facilities.find(({ id }) => id === 'mine-01') ?? null;
  const hours = Math.floor(snapshot.time.localMinute / 60).toString().padStart(2, '0');
  const minutes = (snapshot.time.localMinute % 60).toString().padStart(2, '0');
  return Object.freeze({
    elapsedMinutes: snapshot.time.elapsedMinutes,
    facilities: snapshot.facilities.filter(({ requiredNominalWorkforce, wearRatePerHour }) => requiredNominalWorkforce > 0 || wearRatePerHour > 0),
    localTime: `${hours}:${minutes}`,
    mine,
    maintenanceTasks: snapshot.maintenanceTasks,
    resources: Object.freeze(RESOURCE_IDS.map((id) => {
      const resource = snapshot.resources[id];
      return Object.freeze({ ...resource, id, netRate: resource.productionRate - resource.consumptionRate });
    })),
    simStepMinutes: PHASE_THREE_BASELINE_CONFIG.clock.fixedStepMinutes,
    speed: snapshot.clock.speed,
    time: snapshot.time,
    worldPresentation: snapshot.clock.speed === 0 ? 'PAUSED' : 'RUNNING',
    workforce: snapshot.workforce,
    x1RealSecondsPerSimulationMinute: PHASE_THREE_BASELINE_CONFIG.clock.realSecondsPerSimulationHour / 60,
  });
}

export function submitMineConditionCommand(engine: SimulationEngine, condition: number, requestId: string): FacilityCommandResult {
  return engine.submitFacilityCommand({
    actuator: 'set-condition', facilityId: 'mine-01', id: requestId, priority: 'normal',
    simTime: engine.getSnapshot().time.elapsedMinutes, value: condition,
  });
}

export function submitMineMaintenancePriorityCommand(engine: SimulationEngine, priority: Priority, requestId: string): FacilityCommandResult {
  return engine.submitFacilityCommand({
    actuator: 'set-maintenance-priority', facilityId: 'mine-01', id: requestId, priority: 'normal',
    simTime: engine.getSnapshot().time.elapsedMinutes, value: priority,
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
