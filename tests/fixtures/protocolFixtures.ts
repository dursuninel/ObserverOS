import type { Priority } from '../../src/game/domain/facilities/Facility';
import type {
  ProtocolActionRequest,
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolEdge,
  ProtocolLiteral,
  ProtocolNode,
} from '../../src/game/domain/protocol/Protocol';
import { PHASE_FIVE_PROTOCOL_LIMITS } from '../../src/game/simulation/SimulationConfig';
import { compileProtocol, type ExecutableProtocol } from '../../src/game/simulation/protocol/protocolCompiler';
import { ProtocolRuntime, type ProtocolSensorReader } from '../../src/game/simulation/protocol/protocolRuntime';

/**
 * Protocol runtime fixture'ları — runtime davranışı ve execution trace testleri
 * AYNI grafikleri paylaşır, böylece iki dosya birbirinden kayan bir dünya kurmaz.
 */

export function edge(id: string, fromNodeId: string, fromPort: string, toNodeId: string, toPort: string): ProtocolEdge {
  return { from: { nodeId: fromNodeId, port: fromPort }, id, to: { nodeId: toNodeId, port: toPort } };
}

export function capabilities(): ProtocolCapabilities {
  return {
    actions: [{ allowedValues: ['eco', 'normal', 'boost'], id: 'set-mode', requiresTarget: true, requiresValue: true, valueType: 'enum:facility-mode' }],
    facilities: [
      { actionIds: ['set-mode'], id: 'mine-01', sensorIds: ['facility-condition'] },
      { actionIds: ['set-mode'], id: 'reactor-01', sensorIds: ['energy-level', 'facility-condition'] },
    ],
    limits: PHASE_FIVE_PROTOCOL_LIMITS,
    sensors: [
      { id: 'energy-level', valueType: 'number' },
      { id: 'facility-condition', valueType: 'number' },
      { id: 'gate', valueType: 'number' },
    ],
  };
}

export function protocolOf(
  id: string,
  nodes: readonly ProtocolNode[],
  edges: readonly ProtocolEdge[],
  priority: Priority = 'high',
): ExecutableProtocol {
  const definition: ProtocolDefinition = { edges, id, lifecycle: 'active', name: id, nodes, priority, version: 1 };
  const result = compileProtocol(definition, capabilities());
  if (result.status !== 'compiled') throw new Error(`fixture must compile: ${JSON.stringify(result.report.findings)}`);
  return result.protocol;
}

/** Trigger → Action; en kısa yürütme zinciri. */
export function directProtocol(): ExecutableProtocol {
  return protocolOf(
    'direct',
    [
      { id: 't1', kind: 'trigger', operator: '<', sensorId: 'energy-level', threshold: 30 },
      { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'eco' },
    ],
    [edge('e1', 't1', 'out', 'a1', 'in')],
  );
}

/** Trigger → Delay → Action. */
export function delayedProtocol(durationMinutes: number): ExecutableProtocol {
  return protocolOf(
    'delayed',
    [
      { id: 't1', kind: 'trigger', operator: '<', sensorId: 'gate', threshold: 1 },
      { durationMinutes, id: 'd1', kind: 'delay' },
      { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'eco' },
    ],
    [edge('e1', 't1', 'out', 'd1', 'in'), edge('e2', 'd1', 'out', 'a1', 'in')],
  );
}

/** Trigger → AND(Compare(energy), Compare(condition)) → iki ayrı Action. */
export function andProtocol(): ExecutableProtocol {
  return protocolOf(
    'and-branch',
    [
      { id: 't1', kind: 'trigger', operator: '<', sensorId: 'gate', threshold: 1 },
      { facilityId: 'reactor-01', id: 's1', kind: 'sensor', sensorId: 'energy-level' },
      { facilityId: 'reactor-01', id: 's2', kind: 'sensor', sensorId: 'facility-condition' },
      { comparand: 30, id: 'c1', kind: 'compare', operator: '<' },
      { comparand: 50, id: 'c2', kind: 'compare', operator: '<' },
      { id: 'and1', kind: 'and' },
      { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'eco' },
      { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a2', kind: 'action', value: 'boost' },
    ],
    [
      edge('e1', 't1', 'out', 'and1', 'in'),
      edge('e2', 's1', 'value', 'c1', 'left'),
      edge('e3', 's2', 'value', 'c2', 'left'),
      edge('e4', 'c1', 'result', 'and1', 'a'),
      edge('e5', 'c2', 'result', 'and1', 'b'),
      edge('e6', 'and1', 'whenTrue', 'a1', 'in'),
      edge('e7', 'and1', 'whenFalse', 'a2', 'in'),
    ],
  );
}

export interface Harness {
  readonly requestsOf: (steps: number) => readonly ProtocolActionRequest[];
  readonly runtime: ProtocolRuntime;
  readonly simTime: () => number;
}

/** Tick'i 1 sim. dakikalık sabit adımlarla sürer; simTime ilk tick'te 1'dir. */
export function harness(protocols: readonly ExecutableProtocol[], readSensor: ProtocolSensorReader): Harness {
  const runtime = new ProtocolRuntime();
  let simTime = 0;
  return {
    requestsOf(steps: number): readonly ProtocolActionRequest[] {
      const produced: ProtocolActionRequest[] = [];
      for (let index = 0; index < steps; index += 1) {
        simTime += 1;
        produced.push(...runtime.tick({ protocols, readSensor, simTime, stepMinutes: 1 }));
      }
      return produced;
    },
    runtime,
    simTime: () => simTime,
  };
}

export function worldReader(world: Record<string, ProtocolLiteral>): ProtocolSensorReader {
  return (sensorId) => world[sensorId];
}
