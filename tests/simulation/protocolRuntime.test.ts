import { describe, expect, it } from 'vitest';

import type {
  ProtocolActionRequest,
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolEdge,
  ProtocolLiteral,
  ProtocolNode,
} from '../../src/game/domain/protocol/Protocol';
import { PHASE_FIVE_PROTOCOL_LIMITS, PHASE_THREE_BASELINE_CONFIG, type SimulationConfig } from '../../src/game/simulation/SimulationConfig';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import { compileProtocol, type ExecutableProtocol } from '../../src/game/simulation/protocol/protocolCompiler';
import { ProtocolRuntime, type ProtocolSensorReader } from '../../src/game/simulation/protocol/protocolRuntime';

function edge(id: string, fromNodeId: string, fromPort: string, toNodeId: string, toPort: string): ProtocolEdge {
  return { from: { nodeId: fromNodeId, port: fromPort }, id, to: { nodeId: toNodeId, port: toPort } };
}

function capabilities(): ProtocolCapabilities {
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

function protocolOf(id: string, nodes: readonly ProtocolNode[], edges: readonly ProtocolEdge[]): ExecutableProtocol {
  const definition: ProtocolDefinition = { edges, id, lifecycle: 'active', name: id, nodes, priority: 'high', version: 1 };
  const result = compileProtocol(definition, capabilities());
  if (result.status !== 'compiled') throw new Error(`fixture must compile: ${JSON.stringify(result.report.findings)}`);
  return result.protocol;
}

/** Trigger → Action; en kısa yürütme zinciri. */
function directProtocol(): ExecutableProtocol {
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
function delayedProtocol(durationMinutes: number): ExecutableProtocol {
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

interface Harness {
  readonly requestsOf: (steps: number) => readonly ProtocolActionRequest[];
  readonly runtime: ProtocolRuntime;
  readonly simTime: () => number;
}

function harness(protocols: readonly ExecutableProtocol[], readSensor: ProtocolSensorReader): Harness {
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

function worldReader(world: Record<string, ProtocolLiteral>): ProtocolSensorReader {
  return (sensorId) => world[sensorId];
}

describe('protocol runtime - trigger crossing (spec §13.1)', () => {
  it('pulses only on the crossing and does not re-arm until the threshold is crossed back', () => {
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 50 };
    const scenario = harness([directProtocol()], worldReader(world));

    expect(scenario.requestsOf(3)).toEqual([]);

    world['energy-level'] = 25;
    expect(scenario.requestsOf(1)).toHaveLength(1);

    // Eşik altında kalmak yeni pulse üretmez: koşul her tick doğru olsa da re-arm yok.
    world['energy-level'] = 20;
    expect(scenario.requestsOf(5)).toEqual([]);

    // Karşı tarafa geçiş yalnız re-arm eder, kendisi pulse üretmez.
    world['energy-level'] = 40;
    expect(scenario.requestsOf(2)).toEqual([]);

    world['energy-level'] = 10;
    expect(scenario.requestsOf(1)).toHaveLength(1);
  });

  it('does not fire when the condition is already true without an observed crossing', () => {
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 25 };
    const scenario = harness([directProtocol()], worldReader(world));

    expect(scenario.requestsOf(5)).toEqual([]);

    world['energy-level'] = 50;
    expect(scenario.requestsOf(1)).toEqual([]);

    world['energy-level'] = 25;
    expect(scenario.requestsOf(1)).toHaveLength(1);
  });

  it('leaves the arm state untouched while the sensor cannot be read', () => {
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 50 };
    const scenario = harness([directProtocol()], (sensorId) => world[sensorId]);

    expect(scenario.requestsOf(1)).toEqual([]);
    delete world['energy-level'];
    expect(scenario.requestsOf(3)).toEqual([]);

    world['energy-level'] = 10;
    expect(scenario.requestsOf(1)).toHaveLength(1);
  });
});

describe('protocol runtime - snapshot evaluation (spec §13.2)', () => {
  /** İki condition aynı sensörü okur; okuma başına artan sayaç tutarsızlığı ele verir. */
  function twinReadProtocol(): ExecutableProtocol {
    return protocolOf(
      'twin-read',
      [
        { id: 't1', kind: 'trigger', operator: '<', sensorId: 'gate', threshold: 1 },
        { facilityId: 'reactor-01', id: 's1', kind: 'sensor', sensorId: 'energy-level' },
        { facilityId: 'reactor-01', id: 's2', kind: 'sensor', sensorId: 'energy-level' },
        { id: 'c1', kind: 'compare', operator: '=' },
        { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'eco' },
        { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a2', kind: 'action', value: 'boost' },
      ],
      [
        edge('e1', 't1', 'out', 'c1', 'in'),
        edge('e2', 's1', 'value', 'c1', 'left'),
        edge('e3', 's2', 'value', 'c1', 'right'),
        edge('e4', 'c1', 'whenTrue', 'a1', 'in'),
        edge('e5', 'c1', 'whenFalse', 'a2', 'in'),
      ],
    );
  }

  it('reads one consistent world snapshot for every condition inside a single execution', () => {
    const world: Record<string, ProtocolLiteral> = { gate: 5 };
    let energyReads = 0;
    const scenario = harness([twinReadProtocol()], (sensorId) => {
      if (sensorId !== 'energy-level') return world[sensorId];
      energyReads += 1;
      return energyReads * 10;
    });

    expect(scenario.requestsOf(1)).toEqual([]);
    world['gate'] = 0;
    const requests = scenario.requestsOf(1);

    expect(energyReads).toBe(1);
    expect(requests.map((request) => request.value)).toEqual(['eco']);
  });

  it('evaluates a condition after a delay against the current state, not the old snapshot', () => {
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 50, gate: 5 };
    const delayedCondition = protocolOf(
      'delayed-condition',
      [
        { id: 't1', kind: 'trigger', operator: '<', sensorId: 'gate', threshold: 1 },
        { durationMinutes: 5, id: 'd1', kind: 'delay' },
        { facilityId: 'reactor-01', id: 's1', kind: 'sensor', sensorId: 'energy-level' },
        { comparand: 30, id: 'c1', kind: 'compare', operator: '<' },
        { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'eco' },
        { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a2', kind: 'action', value: 'boost' },
      ],
      [
        edge('e1', 't1', 'out', 'd1', 'in'),
        edge('e2', 'd1', 'out', 'c1', 'in'),
        edge('e3', 's1', 'value', 'c1', 'left'),
        edge('e4', 'c1', 'whenTrue', 'a1', 'in'),
        edge('e5', 'c1', 'whenFalse', 'a2', 'in'),
      ],
    );
    const scenario = harness([delayedCondition], worldReader(world));

    expect(scenario.requestsOf(1)).toEqual([]);
    world['gate'] = 0;
    expect(scenario.requestsOf(1)).toEqual([]);

    // Tetikleme anında 50 (koşul yanlış) idi; delay dolmadan güncel state 10 olur.
    world['energy-level'] = 10;
    const requests = scenario.requestsOf(5);
    expect(requests.map((request) => request.value)).toEqual(['eco']);
  });
});

describe('protocol runtime - logic nodes (spec §13.3)', () => {
  function andProtocol(): ExecutableProtocol {
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

  it('routes the FALSE path when one AND input is false and carries no hidden memory', () => {
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 10, 'facility-condition': 80, gate: 5 };
    const scenario = harness([andProtocol()], worldReader(world));

    expect(scenario.requestsOf(1)).toEqual([]);
    world['gate'] = 0;
    expect(scenario.requestsOf(1).map((request) => request.value)).toEqual(['boost']);

    // Yeni crossing, her iki koşul da doğru: TRUE path.
    world['gate'] = 5;
    expect(scenario.requestsOf(1)).toEqual([]);
    world['facility-condition'] = 20;
    world['gate'] = 0;
    expect(scenario.requestsOf(1).map((request) => request.value)).toEqual(['eco']);

    // Bir sonraki execution'da koşul yeniden bozulunca AND önceki TRUE'yu hatırlamaz.
    world['gate'] = 5;
    expect(scenario.requestsOf(1)).toEqual([]);
    world['energy-level'] = 90;
    world['gate'] = 0;
    expect(scenario.requestsOf(1).map((request) => request.value)).toEqual(['boost']);
  });
});

describe('protocol runtime - delay (spec §13.5)', () => {
  it('waits on simulation time and fires exactly when the scheduled minutes elapse', () => {
    const world: Record<string, ProtocolLiteral> = { gate: 5 };
    const scenario = harness([delayedProtocol(5)], worldReader(world));

    expect(scenario.requestsOf(1)).toEqual([]);
    world['gate'] = 0;
    // Tetikleyen tick + 4 tick daha: 5 sim. dakikası dolmadan hiçbir şey üretilmez.
    expect(scenario.requestsOf(5)).toEqual([]);

    const requests = scenario.requestsOf(1);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.simTime).toBe(scenario.simTime());
    expect(scenario.simTime()).toBe(7);
  });

  it('serializes the remaining delay and resumes it after a restore', () => {
    const world: Record<string, ProtocolLiteral> = { gate: 5 };
    const scenario = harness([delayedProtocol(10)], worldReader(world));
    expect(scenario.requestsOf(1)).toEqual([]);
    world['gate'] = 0;
    expect(scenario.requestsOf(4)).toEqual([]);

    const state = scenario.runtime.exportState();
    expect(state.scheduled).toEqual([{ delayNodeId: 'd1', protocolExecutionId: 'protocol-execution-000001', protocolId: 'delayed', remainingMinutes: 7 }]);

    const restored = new ProtocolRuntime();
    restored.restoreState(JSON.parse(JSON.stringify(state)) as typeof state);
    const tickOf = (simTime: number): readonly ProtocolActionRequest[] =>
      restored.tick({ protocols: [delayedProtocol(10)], readSensor: worldReader(world), simTime, stepMinutes: 1 });

    expect([...tickOf(6), ...tickOf(7), ...tickOf(8), ...tickOf(9), ...tickOf(10), ...tickOf(11)]).toEqual([]);
    expect(tickOf(12)).toHaveLength(1);
  });
});

describe('protocol runtime - execution identity (spec §53.5)', () => {
  it('gives every pulse a new deterministic id and hosts concurrent executions', () => {
    const run = (): readonly ProtocolActionRequest[] => {
      const world: Record<string, ProtocolLiteral> = { gate: 5 };
      const scenario = harness([delayedProtocol(4)], worldReader(world));
      scenario.requestsOf(1);
      world['gate'] = 0;
      scenario.requestsOf(1);
      // Delay beklerken yeni bir crossing ikinci execution'ı başlatır.
      world['gate'] = 5;
      scenario.requestsOf(1);
      world['gate'] = 0;
      return scenario.requestsOf(6);
    };

    const requests = run();
    expect(requests.map((request) => request.protocolExecutionId)).toEqual(['protocol-execution-000001', 'protocol-execution-000002']);
    expect(run()).toEqual(requests);
  });
});

describe('protocol runtime - action requests (spec §13.11, §53.6)', () => {
  it('emits the arbitration contract shape without applying anything', () => {
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 50 };
    const scenario = harness([directProtocol()], worldReader(world));
    scenario.requestsOf(1);
    world['energy-level'] = 10;
    const requests = scenario.requestsOf(1);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({
      actuator: 'set-mode',
      facilityId: 'reactor-01',
      priority: 'high',
      protocolExecutionId: 'protocol-execution-000001',
      protocolId: 'direct',
      simTime: scenario.simTime(),
      value: 'eco',
    });
    expect(Object.isFrozen(requests[0])).toBe(true);
  });
});

describe('protocol runtime - SimulationEngine integration', () => {
  /** Maden aşınması kondisyonu düşürür; trigger gerçek authoritative state üzerinden çalışır. */
  function conditionProtocol(delayMinutes?: number): ExecutableProtocol {
    const nodes: ProtocolNode[] = [
      { facilityId: 'mine-01', id: 't1', kind: 'trigger', operator: '<', sensorId: 'facility-condition', threshold: 99.9 },
      { actionId: 'set-mode', facilityId: 'mine-01', id: 'a1', kind: 'action', value: 'eco' },
    ];
    if (delayMinutes === undefined) return protocolOf('condition-watch', nodes, [edge('e1', 't1', 'out', 'a1', 'in')]);
    return protocolOf(
      'condition-watch',
      [...nodes, { durationMinutes: delayMinutes, id: 'd1', kind: 'delay' }],
      [edge('e1', 't1', 'out', 'd1', 'in'), edge('e2', 'd1', 'out', 'a1', 'in')],
    );
  }

  function engineWith(protocols: readonly ExecutableProtocol[], serialized?: string): SimulationEngine {
    // Sensor okuması authoritative snapshot'a bağlıdır; runtime tick'i yalnız
    // advanceFixedSteps içinde çalıştığı için engine o anda kurulmuş olur.
    const readSensor = (sensorId: string, facilityId: string | undefined): number | undefined => {
      if (sensorId !== 'facility-condition' || facilityId === undefined) return undefined;
      return engine.getSnapshot().facilities.find((facility) => facility.id === facilityId)?.condition;
    };
    const options = { config: PHASE_THREE_BASELINE_CONFIG, protocols: { protocols, readSensor } };
    const engine = serialized === undefined ? new SimulationEngine(options) : SimulationEngine.fromSerializedState(serialized, options);
    return engine;
  }

  it('produces the request from authoritative state without changing the facility', () => {
    const engine = engineWith([conditionProtocol()]);
    const fired: number[] = [];
    for (let step = 0; step < 40; step += 1) {
      engine.advanceFixedSteps(1);
      if (engine.getProtocolActionRequests().length > 0) fired.push(engine.getSnapshot().time.elapsedMinutes);
    }

    // 0.25/sa. aşınmayla kondisyon 25. dakikada 99.9'un altına iner.
    expect(fired).toEqual([25]);
    expect(engine.getSnapshot().facilities.find((facility) => facility.id === 'mine-01')?.mode).toBe('normal');
  });

  it('does not advance a pending delay while the simulation is paused', () => {
    const engine = engineWith([conditionProtocol(10)]);
    engine.advanceFixedSteps(26);
    engine.setSpeed(0);
    engine.advanceFixedSteps(50);
    expect(engine.advanceWallTime(60_000)).toBe(0);
    expect(engine.getProtocolActionRequests()).toEqual([]);
    expect(engine.getSnapshot().time.elapsedMinutes).toBe(26);

    engine.setSpeed(1);
    const fired: number[] = [];
    for (let step = 0; step < 12; step += 1) {
      engine.advanceFixedSteps(1);
      if (engine.getProtocolActionRequests().length > 0) fired.push(engine.getSnapshot().time.elapsedMinutes);
    }
    expect(fired).toEqual([35]);
  });

  it('keeps the pending delay across serialization and stays deterministic', () => {
    const straight = engineWith([conditionProtocol(10)]);
    straight.advanceFixedSteps(35);

    const interrupted = engineWith([conditionProtocol(10)]);
    interrupted.advanceFixedSteps(30);
    const restored = engineWith([conditionProtocol(10)], interrupted.serializeAuthoritativeState());
    restored.advanceFixedSteps(4);
    expect(restored.getProtocolActionRequests()).toEqual([]);
    restored.advanceFixedSteps(1);

    expect(restored.getProtocolActionRequests()).toEqual(straight.getProtocolActionRequests());
    expect(restored.getProtocolActionRequests()).toHaveLength(1);
    expect(restored.serializeAuthoritativeState()).toBe(straight.serializeAuthoritativeState());
  });

  it('runs no protocol when the engine is created without a protocol binding', () => {
    const engine = new SimulationEngine();
    engine.advanceFixedSteps(40);
    expect(engine.getProtocolActionRequests()).toEqual([]);
  });

  it('rejects protocol limits that are not a usable range', () => {
    const broken: SimulationConfig = {
      ...PHASE_THREE_BASELINE_CONFIG,
      protocolLimits: { delayMaximumMinutes: 10, delayMinimumMinutes: 20, longDelayMinutes: 15, thresholdOscillationMargin: 2 },
    };
    expect(() => new SimulationEngine({ config: broken })).toThrow();
  });
});
