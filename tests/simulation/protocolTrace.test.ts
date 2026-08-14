import { describe, expect, it } from 'vitest';

import type {
  ProtocolExecutionTrace,
  ProtocolLiteral,
  ProtocolNode,
} from '../../src/game/domain/protocol/Protocol';
import { PHASE_THREE_BASELINE_CONFIG } from '../../src/game/simulation/SimulationConfig';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import type { ExecutableProtocol } from '../../src/game/simulation/protocol/protocolCompiler';
import { ProtocolRuntime, type ProtocolRuntimeState } from '../../src/game/simulation/protocol/protocolRuntime';
import {
  andProtocol,
  delayedProtocol,
  directProtocol,
  edge,
  harness,
  protocolOf,
  worldReader,
} from '../fixtures/protocolFixtures';

/**
 * Execution trace (spec §53.5) — Faz 5'in VERİ katmanı.
 *
 * İz, Faz 7 Debugger'ının "protokolüm neden çalışmadı?" sorusunu cevaplayacağı tek
 * kaynaktır: her trigger pulse'ı kendi `protocolExecutionId`'siyle, ziyaret ettiği
 * node'lar ve ölçülen değerlerle kaydedilir. Bu dosya izin SÖZLEŞMESİNİ kilitler;
 * sunum/kurgu Faz 7'nin işidir.
 */

/** Adımları okunur bir imzaya indirger: [kind, nodeId, port]. */
function shapeOf(trace: ProtocolExecutionTrace | undefined): readonly (readonly [string, string, string])[] {
  return (trace?.steps ?? []).map((step) => [step.nodeKind, step.nodeId, step.port] as const);
}

function tracesOf(runtime: ProtocolRuntime, protocolExecutionId: string): readonly ProtocolExecutionTrace[] {
  return runtime.getExecutionTraces().filter((trace) => trace.protocolExecutionId === protocolExecutionId);
}

describe('protocol execution trace - execution identity (spec §53.5)', () => {
  it('gives every trigger pulse its own trace with the crossing measurement inside', () => {
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 50 };
    const scenario = harness([directProtocol()], worldReader(world));

    scenario.requestsOf(1);
    world['energy-level'] = 10;
    scenario.requestsOf(1);
    // Eşiğin üstüne dönüş yalnız re-arm eder; iz üretmez.
    world['energy-level'] = 50;
    scenario.requestsOf(1);
    world['energy-level'] = 12;
    scenario.requestsOf(1);

    const traces = scenario.runtime.getExecutionTraces();
    expect(traces.map((trace) => trace.protocolExecutionId)).toEqual(['protocol-execution-000001', 'protocol-execution-000002']);
    expect(traces[0]).toMatchObject({ completedAt: 2, priority: 'high', protocolId: 'direct', triggeredAt: 2 });
    expect(traces[1]).toMatchObject({ completedAt: 4, triggeredAt: 4 });

    expect(shapeOf(traces[0])).toEqual([['trigger', 't1', 'out'], ['action', 'a1', 'in']]);
    // Tetikleyen ÖLÇÜM izdedir: iki pulse farklı değerle tetiklendi.
    expect(traces[0]?.steps[0]?.sensorValue).toBe(10);
    expect(traces[1]?.steps[0]?.sensorValue).toBe(12);
    expect(traces.every((trace) => trace.steps.every((step) => step.timestamp === trace.triggeredAt))).toBe(true);
  });

  it('keeps two concurrent executions of the same protocol in separate traces', () => {
    const world: Record<string, ProtocolLiteral> = { gate: 5 };
    const scenario = harness([delayedProtocol(4)], worldReader(world));

    scenario.requestsOf(1);
    world['gate'] = 0;
    scenario.requestsOf(1); // 2. dk: 1. execution delay'e girer
    world['gate'] = 5;
    scenario.requestsOf(1);
    world['gate'] = 0;
    scenario.requestsOf(1); // 4. dk: 2. execution, 1.'si hâlâ beklerken başlar

    // İki execution AYNI ANDA bekliyor: eşzamanlılık kanıtı (§53.5).
    scenario.requestsOf(1);
    expect(scenario.runtime.exportState().scheduled.map((entry) => entry.protocolExecutionId))
      .toEqual(['protocol-execution-000001', 'protocol-execution-000002']);

    scenario.requestsOf(3); // 6. dk: 1. execution, 8. dk: 2. execution eylemi
    const first = tracesOf(scenario.runtime, 'protocol-execution-000001');
    const second = tracesOf(scenario.runtime, 'protocol-execution-000002');

    // Her execution iki segment bırakır: delay'e kadar, delay'den sonra.
    expect(first.map((trace) => shapeOf(trace))).toEqual([
      [['trigger', 't1', 'out'], ['delay', 'd1', 'in']],
      [['action', 'a1', 'in']],
    ]);
    expect(second.map((trace) => shapeOf(trace))).toEqual([
      [['trigger', 't1', 'out'], ['delay', 'd1', 'in']],
      [['action', 'a1', 'in']],
    ]);
    expect(first.map((trace) => trace.triggeredAt)).toEqual([2, 6]);
    expect(second.map((trace) => trace.triggeredAt)).toEqual([4, 8]);
  });
});

describe('protocol execution trace - node traversal (spec §53.5)', () => {
  it('records the visited nodes in causal order with the right kind, port and value', () => {
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 10, 'facility-condition': 20, gate: 5 };
    const scenario = harness([andProtocol()], worldReader(world));

    scenario.requestsOf(1);
    world['gate'] = 0;
    expect(scenario.requestsOf(1).map((request) => request.value)).toEqual(['eco']);

    const trace = scenario.runtime.getExecutionTraces()[0];
    // Operandlar kendi sonuçlarından ÖNCE gelir: iz nedensel zinciri korur.
    expect(shapeOf(trace)).toEqual([
      ['trigger', 't1', 'out'],
      ['sensor', 's1', 'value'],
      ['compare', 'c1', 'result'],
      ['sensor', 's2', 'value'],
      ['compare', 'c2', 'result'],
      ['and', 'and1', 'result'],
      ['action', 'a1', 'in'],
    ]);
    // İlk adım trigger'ın ölçümüdür (eşiği geçiren `gate` değeri), sonrakiler sensor node'lar.
    expect(trace?.steps.map((step) => step.sensorValue)).toEqual([0, 10, undefined, 20, undefined, undefined, undefined]);
    expect(trace?.steps.map((step) => step.evaluationResult))
      .toEqual([undefined, undefined, true, undefined, true, true, undefined]);
  });

  it('records the FALSE branch and the measurement that produced it', () => {
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 90, 'facility-condition': 20, gate: 5 };
    const scenario = harness([andProtocol()], worldReader(world));

    scenario.requestsOf(1);
    world['gate'] = 0;
    expect(scenario.requestsOf(1).map((request) => request.value)).toEqual(['boost']);

    const trace = scenario.runtime.getExecutionTraces()[0];
    expect(shapeOf(trace).at(-1)).toEqual(['action', 'a2', 'in']);
    expect(trace?.steps.find((step) => step.nodeId === 's1')?.sensorValue).toBe(90);
    expect(trace?.steps.find((step) => step.nodeId === 'c1')?.evaluationResult).toBe(false);
    expect(trace?.steps.find((step) => step.nodeId === 'and1')?.evaluationResult).toBe(false);
  });

  it('still traces the step when the sensor cannot be read and the execution dies there', () => {
    // Sensör okunamıyor: karşılaştırma belirsiz kalır, akış eyleme VARAMAZ.
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 10, gate: 5 };
    const scenario = harness([andProtocol()], worldReader(world));

    scenario.requestsOf(1);
    world['gate'] = 0;
    expect(scenario.requestsOf(1)).toEqual([]);

    const trace = scenario.runtime.getExecutionTraces()[0];
    expect(trace?.protocolExecutionId).toBe('protocol-execution-000001');
    expect(shapeOf(trace)).toEqual([
      ['trigger', 't1', 'out'],
      ['sensor', 's1', 'value'],
      ['compare', 'c1', 'result'],
      ['sensor', 's2', 'value'],
      ['compare', 'c2', 'result'],
      ['and', 'and1', 'result'],
    ]);

    // Okunamayan sensörün adımı da izdedir; yalnız değeri yoktur (§53.5 karar kaydı).
    const unreadable = trace?.steps.find((step) => step.nodeId === 's2');
    expect(unreadable).toBeDefined();
    expect(unreadable?.sensorValue).toBeUndefined();
    expect(trace?.steps.find((step) => step.nodeId === 'c2')?.evaluationResult).toBeUndefined();
    expect(trace?.steps.find((step) => step.nodeId === 'and1')?.evaluationResult).toBeUndefined();
    expect(trace?.steps.some((step) => step.nodeKind === 'action')).toBe(false);
  });

  it('keeps one step per node even when a sensor feeds two conditions (§13.2 snapshot)', () => {
    const twinRead = protocolOf(
      'twin-read',
      [
        { id: 't1', kind: 'trigger', operator: '<', sensorId: 'gate', threshold: 1 },
        { facilityId: 'reactor-01', id: 's1', kind: 'sensor', sensorId: 'energy-level' },
        { comparand: 30, id: 'c1', kind: 'compare', operator: '<' },
        { comparand: 90, id: 'c2', kind: 'compare', operator: '<' },
        { id: 'and1', kind: 'and' },
        { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'eco' },
      ],
      [
        edge('e1', 't1', 'out', 'and1', 'in'),
        edge('e2', 's1', 'value', 'c1', 'left'),
        edge('e3', 's1', 'value', 'c2', 'left'),
        edge('e4', 'c1', 'result', 'and1', 'a'),
        edge('e5', 'c2', 'result', 'and1', 'b'),
        edge('e6', 'and1', 'whenTrue', 'a1', 'in'),
      ],
    );
    const world: Record<string, ProtocolLiteral> = { 'energy-level': 10, gate: 5 };
    let energyReads = 0;
    const scenario = harness([twinRead], (sensorId) => {
      if (sensorId === 'energy-level') energyReads += 1;
      return world[sensorId];
    });

    scenario.requestsOf(1);
    world['gate'] = 0;
    expect(scenario.requestsOf(1)).toHaveLength(1);

    const trace = scenario.runtime.getExecutionTraces()[0];
    expect(energyReads).toBe(1);
    expect(shapeOf(trace).filter(([kind]) => kind === 'sensor')).toEqual([['sensor', 's1', 'value']]);
  });
});

describe('protocol execution trace - determinism and persistence (spec §53.5, §13.5)', () => {
  /** Delay bekleyen bir execution + tamamlanmış bir iz üreten senaryo. */
  function runScenario(runtime: ProtocolRuntime, steps: number): void {
    const world: Record<string, ProtocolLiteral> = { gate: 5 };
    const protocols = [delayedProtocol(10)];
    for (let index = 1; index <= steps; index += 1) {
      if (index === 2) world['gate'] = 0;
      if (index === 4) world['gate'] = 5;
      if (index === 6) world['gate'] = 0;
      runtime.tick({ protocols, readSensor: worldReader(world), simTime: index, stepMinutes: 1 });
    }
  }

  it('produces a byte-identical trace for the same input twice', () => {
    const first = new ProtocolRuntime();
    const second = new ProtocolRuntime();
    runScenario(first, 20);
    runScenario(second, 20);

    expect(first.getExecutionTraces()).toEqual(second.getExecutionTraces());
    expect(first.getExecutionTraces().length).toBeGreaterThan(0);
    expect(first.exportState()).toEqual(second.exportState());
  });

  it('carries the trace of a delay-pending execution across serialize/restore unchanged', () => {
    const interrupted = new ProtocolRuntime();
    runScenario(interrupted, 5);

    const state = interrupted.exportState();
    expect(state.scheduled).toHaveLength(1);
    expect(state.traces).toHaveLength(1);

    const restored = new ProtocolRuntime();
    restored.restoreState(JSON.parse(JSON.stringify(state)) as ProtocolRuntimeState);
    expect(restored.getExecutionTraces()).toEqual(state.traces);

    // Restore edilen runtime kesintisiz koşanla AYNI izi tamamlar.
    const world: Record<string, ProtocolLiteral> = { gate: 5 };
    const protocols = [delayedProtocol(10)];
    for (let index = 6; index <= 20; index += 1) {
      if (index === 6) world['gate'] = 0;
      restored.tick({ protocols, readSensor: worldReader(world), simTime: index, stepMinutes: 1 });
    }

    const straight = new ProtocolRuntime();
    runScenario(straight, 20);
    expect(restored.getExecutionTraces()).toEqual(straight.getExecutionTraces());
    expect(restored.exportState()).toEqual(straight.exportState());
  });

  it('survives a JSON round trip without losing a single step', () => {
    const runtime = new ProtocolRuntime();
    runScenario(runtime, 20);

    const exported = runtime.exportState();
    const restored = new ProtocolRuntime();
    restored.restoreState(JSON.parse(JSON.stringify(exported)) as ProtocolRuntimeState);
    expect(restored.exportState()).toEqual(exported);
  });
});

describe('protocol execution trace - SimulationEngine integration', () => {
  function conditionProtocol(): ExecutableProtocol {
    const nodes: readonly ProtocolNode[] = [
      { facilityId: 'mine-01', id: 't1', kind: 'trigger', operator: '<', sensorId: 'facility-condition', threshold: 99.9 },
      { facilityId: 'mine-01', id: 's1', kind: 'sensor', sensorId: 'facility-condition' },
      { comparand: 50, id: 'c1', kind: 'compare', operator: '<' },
      { actionId: 'set-mode', facilityId: 'mine-01', id: 'a1', kind: 'action', value: 'eco' },
      { actionId: 'set-mode', facilityId: 'mine-01', id: 'a2', kind: 'action', value: 'normal' },
    ];
    return protocolOf('condition-watch', nodes, [
      edge('e1', 't1', 'out', 'c1', 'in'),
      edge('e2', 's1', 'value', 'c1', 'left'),
      edge('e3', 'c1', 'whenTrue', 'a1', 'in'),
      edge('e4', 'c1', 'whenFalse', 'a2', 'in'),
    ]);
  }

  function engineWith(serialized?: string): SimulationEngine {
    const readSensor = (sensorId: string, facilityId: string | undefined): number | undefined => {
      if (sensorId !== 'facility-condition' || facilityId === undefined) return undefined;
      return engine.getSnapshot().facilities.find((facility) => facility.id === facilityId)?.condition;
    };
    const options = { config: PHASE_THREE_BASELINE_CONFIG, protocols: { protocols: [conditionProtocol()], readSensor } };
    const engine = serialized === undefined ? new SimulationEngine(options) : SimulationEngine.fromSerializedState(serialized, options);
    return engine;
  }

  it('exposes the trace of the authoritative run with the measured condition', () => {
    // 25. dk. tetikleme tick'idir; aşınma sürdüğü için ölçüm ancak O tick'te
    // snapshot'la karşılaştırılabilir.
    const engine = engineWith();
    engine.advanceFixedSteps(25);

    const traces = engine.getProtocolExecutionTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ protocolExecutionId: 'protocol-execution-000001', protocolId: 'condition-watch', triggeredAt: 25 });
    expect(shapeOf(traces[0])).toEqual([
      ['trigger', 't1', 'out'],
      ['sensor', 's1', 'value'],
      ['compare', 'c1', 'result'],
      ['action', 'a2', 'in'],
    ]);
    // Maden 25. dk.'da 99.9'un altına iner; ölçüm izdeki değerle birebir aynıdır.
    expect(traces[0]?.steps[1]?.sensorValue).toBe(engine.getSnapshot().facilities.find((facility) => facility.id === 'mine-01')?.condition);
    expect(traces[0]?.steps[2]?.evaluationResult).toBe(false);
  });

  it('keeps the trace identical across serialize/restore of the whole simulation', () => {
    const straight = engineWith();
    straight.advanceFixedSteps(30);

    const interrupted = engineWith();
    interrupted.advanceFixedSteps(20);
    const restored = engineWith(interrupted.serializeAuthoritativeState());
    restored.advanceFixedSteps(10);

    expect(restored.getProtocolExecutionTraces()).toEqual(straight.getProtocolExecutionTraces());
    expect(restored.getProtocolExecutionTraces()).toHaveLength(1);
    expect(restored.serializeAuthoritativeState()).toBe(straight.serializeAuthoritativeState());
  });
});
