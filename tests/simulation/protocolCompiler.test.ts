import { describe, expect, it } from 'vitest';

import {
  PROTOCOL_ERROR_CODES,
  PROTOCOL_WARNING_CODES,
  type ProtocolCapabilities,
  type ProtocolDefinition,
  type ProtocolEdge,
  type ProtocolNode,
  type ProtocolValidationReport,
} from '../../src/game/domain/protocol/Protocol';
import { compileProtocol } from '../../src/game/simulation/protocol/protocolCompiler';
import { validateProtocol } from '../../src/game/simulation/protocol/protocolValidator';
import { i18n } from '../../src/localization/i18n';

function edge(id: string, fromNodeId: string, fromPort: string, toNodeId: string, toPort: string): ProtocolEdge {
  return { from: { nodeId: fromNodeId, port: fromPort }, id, to: { nodeId: toNodeId, port: toPort } };
}

function capabilities(): ProtocolCapabilities {
  return {
    actions: [{ allowedValues: ['eco', 'normal', 'boost'], id: 'set-mode', requiresTarget: true, requiresValue: true, valueType: 'enum:facility-mode' }],
    facilities: [{ actionIds: ['set-mode'], currentActionValues: { 'set-mode': 'normal' }, id: 'reactor-01', sensorIds: ['energy-level', 'facility-condition'] }],
    limits: { delayMaximumMinutes: 1_440, delayMinimumMinutes: 1, longDelayMinutes: 720, thresholdOscillationMargin: 2 },
    sensors: [{ id: 'energy-level', valueType: 'number' }, { id: 'facility-condition', valueType: 'number' }],
  };
}

function definition(): ProtocolDefinition {
  return {
    edges: [
      edge('e1', 't1', 'out', 'and1', 'in'),
      edge('e2', 's1', 'value', 'c1', 'left'),
      edge('e3', 's2', 'value', 'c2', 'left'),
      edge('e4', 'c1', 'result', 'and1', 'a'),
      edge('e5', 'c2', 'result', 'and1', 'b'),
      edge('e6', 'and1', 'whenTrue', 'd1', 'in'),
      edge('e7', 'd1', 'out', 'a1', 'in'),
    ],
    id: 'protocol-1',
    lifecycle: 'draft',
    name: 'Reaktör koruması',
    nodes: [
      { id: 't1', kind: 'trigger', operator: '<', sensorId: 'energy-level', threshold: 30 },
      { facilityId: 'reactor-01', id: 's1', kind: 'sensor', sensorId: 'facility-condition' },
      { facilityId: 'reactor-01', id: 's2', kind: 'sensor', sensorId: 'energy-level' },
      { comparand: 50, id: 'c1', kind: 'compare', operator: '<' },
      { comparand: 80, id: 'c2', kind: 'compare', operator: '<' },
      { id: 'and1', kind: 'and' },
      { durationMinutes: 10, id: 'd1', kind: 'delay' },
      { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'eco' },
    ],
    priority: 'high',
    version: 1,
  };
}

function withNodes(mutate: (nodes: ProtocolNode[]) => ProtocolNode[]): ProtocolDefinition {
  const base = definition();
  return { ...base, nodes: mutate([...base.nodes]) };
}

function withEdges(mutate: (edges: ProtocolEdge[]) => ProtocolEdge[]): ProtocolDefinition {
  const base = definition();
  return { ...base, edges: mutate([...base.edges]) };
}

function replaceNode(nodes: ProtocolNode[], node: ProtocolNode): ProtocolNode[] {
  return nodes.map((candidate) => (candidate.id === node.id ? node : candidate));
}

function codesOf(report: ProtocolValidationReport, severity: 'error' | 'warning'): readonly string[] {
  return report.findings.filter((finding) => finding.severity === severity).map((finding) => finding.code);
}

describe('protocol validation - blocking errors (spec §53.2)', () => {
  it('accepts the canonical baseline protocol without any finding', () => {
    const report = validateProtocol(definition(), capabilities());
    expect(report.findings).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it('rejects a protocol without a trigger', () => {
    const target = withEdges((edges) => edges.filter((candidate) => candidate.id !== 'e1'));
    const report = validateProtocol({ ...target, nodes: target.nodes.filter((node) => node.id !== 't1') }, capabilities());
    expect(codesOf(report, 'error')).toContain('protocol.error.trigger-missing');
    expect(report.valid).toBe(false);
  });

  it('rejects more than one independent root trigger', () => {
    const target = withNodes((nodes) => [...nodes, { id: 't2', kind: 'trigger', operator: '>', sensorId: 'energy-level', threshold: 90 }]);
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.multiple-root-triggers');
  });

  it('rejects an action whose required value is missing', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action' }));
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.action-required-field-missing');
  });

  it('rejects an action whose required target is missing', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { actionId: 'set-mode', id: 'a1', kind: 'action', value: 'eco' }));
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.action-required-field-missing');
  });

  it('rejects an action value outside the declared value domain', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'turbo' }));
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.action-value-type');
  });

  it('rejects a compare whose operands have incompatible types', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { comparand: true, id: 'c1', kind: 'compare', operator: '<' }));
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.compare-operand-type');
  });

  it('rejects a compare whose operand is left unconnected (runtime cannot evaluate it)', () => {
    const openLeft = withEdges((edges) => edges.filter((candidate) => candidate.id !== 'e2'));
    const openRight = withNodes((nodes) => replaceNode(nodes, { id: 'c1', kind: 'compare', operator: '<' }));
    expect(codesOf(validateProtocol(openLeft, capabilities()), 'error')).toContain('protocol.error.compare-operand-missing');
    expect(codesOf(validateProtocol(openRight, capabilities()), 'error')).toContain('protocol.error.compare-operand-missing');
    expect(codesOf(validateProtocol(definition(), capabilities()), 'error')).toEqual([]);
  });

  it('rejects an ordering trigger whose threshold is not numeric', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { id: 't1', kind: 'trigger', operator: '<', sensorId: 'energy-level', threshold: 'low' }));
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.compare-operand-type');
  });

  it('rejects an AND node with a missing condition input', () => {
    const target = withEdges((edges) => edges.filter((candidate) => candidate.id !== 'e5'));
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.and-input-missing');
  });

  it('rejects a graph cycle (spec §13.9)', () => {
    const target = withEdges((edges) => [...edges, edge('e8', 'd1', 'out', 'and1', 'in')]);
    const report = validateProtocol(target, capabilities());
    expect(codesOf(report, 'error')).toContain('protocol.error.graph-cycle');
    expect(compileProtocol(target, capabilities()).status).toBe('rejected');
  });

  it('rejects a delay duration of zero and a duration outside the schema range', () => {
    const zero = withNodes((nodes) => replaceNode(nodes, { durationMinutes: 0, id: 'd1', kind: 'delay' }));
    const tooLong = withNodes((nodes) => replaceNode(nodes, { durationMinutes: 5_000, id: 'd1', kind: 'delay' }));
    expect(codesOf(validateProtocol(zero, capabilities()), 'error')).toContain('protocol.error.delay-duration-out-of-range');
    expect(codesOf(validateProtocol(tooLong, capabilities()), 'error')).toContain('protocol.error.delay-duration-out-of-range');
  });

  it('rejects an edge attached to an incompatible port', () => {
    const numberIntoBoolean = withEdges((edges) => [...edges.filter((candidate) => candidate.id !== 'e4'), edge('e4', 's1', 'value', 'and1', 'a')]);
    const unknownPort = withEdges((edges) => [...edges, edge('e9', 'd1', 'out', 'a1', 'value')]);
    expect(codesOf(validateProtocol(numberIntoBoolean, capabilities()), 'error')).toContain('protocol.error.edge-port-incompatible');
    expect(codesOf(validateProtocol(unknownPort, capabilities()), 'error')).toContain('protocol.error.edge-port-incompatible');
  });

  it('rejects a sensor that the current capability set does not provide', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { id: 't1', kind: 'trigger', operator: '<', sensorId: 'hull-integrity', threshold: 30 }));
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.capability-unavailable');
  });

  it('rejects an action that the current capability set does not provide', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { actionId: 'vent-atmosphere', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'eco' }));
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.capability-unavailable');
  });

  it('rejects a hard reference to a deleted facility instance', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { facilityId: 'reactor-99', id: 's1', kind: 'sensor', sensorId: 'facility-condition' }));
    expect(codesOf(validateProtocol(target, capabilities()), 'error')).toContain('protocol.error.deleted-facility-reference');
  });

  it('covers every declared blocking error code with at least one case', () => {
    const produced = new Set<string>();
    const cases: readonly ProtocolDefinition[] = [
      { ...definition(), nodes: definition().nodes.filter((node) => node.id !== 't1'), edges: definition().edges.filter((candidate) => candidate.id !== 'e1') },
      withNodes((nodes) => [...nodes, { id: 't2', kind: 'trigger', operator: '>', sensorId: 'energy-level', threshold: 90 }]),
      withNodes((nodes) => replaceNode(nodes, { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action' })),
      withNodes((nodes) => replaceNode(nodes, { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'turbo' })),
      withNodes((nodes) => replaceNode(nodes, { comparand: true, id: 'c1', kind: 'compare', operator: '<' })),
      withEdges((edges) => edges.filter((candidate) => candidate.id !== 'e2')),
      withEdges((edges) => edges.filter((candidate) => candidate.id !== 'e5')),
      withEdges((edges) => [...edges, edge('e8', 'd1', 'out', 'and1', 'in')]),
      withNodes((nodes) => replaceNode(nodes, { durationMinutes: 0, id: 'd1', kind: 'delay' })),
      withEdges((edges) => [...edges, edge('e9', 'd1', 'out', 'a1', 'value')]),
      withNodes((nodes) => replaceNode(nodes, { id: 't1', kind: 'trigger', operator: '<', sensorId: 'hull-integrity', threshold: 30 })),
      withNodes((nodes) => replaceNode(nodes, { facilityId: 'reactor-99', id: 's1', kind: 'sensor', sensorId: 'facility-condition' })),
    ];

    for (const target of cases) for (const code of codesOf(validateProtocol(target, capabilities()), 'error')) produced.add(code);
    for (const code of PROTOCOL_ERROR_CODES) expect(produced.has(code), code).toBe(true);
  });
});

describe('protocol validation - warnings (spec §53.3)', () => {
  it('warns when the action sets a facility to the value it already holds', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'normal' }));
    const report = validateProtocol(target, capabilities());
    expect(codesOf(report, 'warning')).toContain('protocol.warning.action-value-unchanged');
    expect(report.valid).toBe(true);
  });

  it('warns when no current facility can be affected', () => {
    const base = definition();
    const target: ProtocolDefinition = {
      ...base,
      nodes: base.nodes.map((node) => (node.kind === 'sensor'
        ? { id: node.id, kind: 'sensor' as const, sensorId: node.sensorId }
        : node.kind === 'action' ? { actionId: node.actionId, id: node.id, kind: 'action' as const, value: 'eco' } : node)),
    };
    const futureOnly: ProtocolCapabilities = {
      ...capabilities(),
      actions: [{ allowedValues: ['eco', 'normal', 'boost'], id: 'set-mode', requiresTarget: false, requiresValue: false, valueType: 'enum:facility-mode' }],
      facilities: [],
    };
    const report = validateProtocol(target, futureOnly);
    expect(codesOf(report, 'error')).toEqual([]);
    expect(codesOf(report, 'warning')).toContain('protocol.warning.no-affected-facility');
  });

  it('warns about a potential conflict with another active protocol', () => {
    const claimed: ProtocolCapabilities = {
      ...capabilities(),
      activeActionClaims: [{ actionId: 'set-mode', facilityId: 'reactor-01', protocolId: 'protocol-2' }],
    };
    const report = validateProtocol(definition(), claimed);
    expect(codesOf(report, 'warning')).toContain('protocol.warning.potential-conflict');
    expect(report.valid).toBe(true);
  });

  it('warns about oscillation risk when two thresholds on the same sensor are very close', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { comparand: 31, id: 'c2', kind: 'compare', operator: '<' }));
    expect(codesOf(validateProtocol(target, capabilities()), 'warning')).toContain('protocol.warning.threshold-oscillation-risk');
  });

  it('warns about a delay longer than the mission cycle', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { durationMinutes: 900, id: 'd1', kind: 'delay' }));
    const report = validateProtocol(target, capabilities());
    expect(codesOf(report, 'warning')).toContain('protocol.warning.long-delay');
    expect(report.valid).toBe(true);
  });

  it('never blocks apply because of a warning', () => {
    const target = withNodes((nodes) => replaceNode(nodes, { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'normal' }));
    const result = compileProtocol(target, capabilities());
    expect(result.status).toBe('compiled');
    expect(codesOf(result.report, 'warning').length).toBeGreaterThan(0);
  });
});

describe('protocol compiler (spec §53.4)', () => {
  it('compiles a valid protocol into a topologically ordered executable representation', () => {
    const result = compileProtocol(definition(), capabilities());
    expect(result.status).toBe('compiled');
    if (result.status !== 'compiled') return;

    const order = result.protocol.nodes.map((node) => node.id);
    expect(result.protocol.rootTriggerId).toBe('t1');
    expect(order.indexOf('and1')).toBeGreaterThan(order.indexOf('t1'));
    expect(order.indexOf('and1')).toBeGreaterThan(order.indexOf('c1'));
    expect(order.indexOf('d1')).toBeGreaterThan(order.indexOf('and1'));
    expect(order.indexOf('a1')).toBeGreaterThan(order.indexOf('d1'));
    expect(order).toHaveLength(definition().nodes.length);
  });

  it('produces an identical hash when the same definition is compiled twice', () => {
    const first = compileProtocol(definition(), capabilities());
    const second = compileProtocol(definition(), capabilities());
    if (first.status !== 'compiled' || second.status !== 'compiled') throw new Error('baseline protocol must compile');
    expect(first.protocol.compiledHash).toBe(second.protocol.compiledHash);
    expect(first.protocol).toEqual(second.protocol);
  });

  it('produces the same executable protocol when node and edge order is shuffled', () => {
    const base = definition();
    const shuffled: ProtocolDefinition = { ...base, edges: [...base.edges].reverse(), nodes: [...base.nodes].reverse() };
    const straight = compileProtocol(base, capabilities());
    const mixed = compileProtocol(shuffled, capabilities());
    if (straight.status !== 'compiled' || mixed.status !== 'compiled') throw new Error('baseline protocol must compile');
    expect(mixed.protocol).toEqual(straight.protocol);
    expect(mixed.protocol.compiledHash).toBe(straight.protocol.compiledHash);
  });

  it('changes the hash when protocol semantics change', () => {
    const changed = withNodes((nodes) => nodes.map((node) => (node.kind === 'delay' ? { durationMinutes: 11, id: node.id, kind: 'delay' as const } : node)));
    const base = compileProtocol(definition(), capabilities());
    const other = compileProtocol(changed, capabilities());
    if (base.status !== 'compiled' || other.status !== 'compiled') throw new Error('both protocols must compile');
    expect(other.protocol.compiledHash).not.toBe(base.protocol.compiledHash);
  });

  it('never carries editor presentation fields into the executable protocol', () => {
    const base = definition();
    const polluted: ProtocolDefinition = {
      ...base,
      nodes: base.nodes.map((node) => ({ ...node, color: '#0ff', position: { x: 12, y: 34 }, selected: true } as unknown as ProtocolNode)),
    };
    const result = compileProtocol(polluted, capabilities());
    const reference = compileProtocol(base, capabilities());
    if (result.status !== 'compiled' || reference.status !== 'compiled') throw new Error('baseline protocol must compile');

    const serialized = JSON.stringify(result.protocol);
    for (const field of ['position', 'selected', 'color']) expect(serialized.includes(field), field).toBe(false);
    expect(result.protocol.compiledHash).toBe(reference.protocol.compiledHash);
  });

  it('refuses to compile a definition that still has blocking errors', () => {
    const target = withEdges((edges) => edges.filter((candidate) => candidate.id !== 'e5'));
    const result = compileProtocol(target, capabilities());
    expect(result.status).toBe('rejected');
    expect(codesOf(result.report, 'error')).toContain('protocol.error.and-input-missing');
  });
});

describe('protocol finding localization', () => {
  it('resolves every finding code to natural Turkish text outside the engine', () => {
    for (const code of [...PROTOCOL_ERROR_CODES, ...PROTOCOL_WARNING_CODES]) {
      expect(i18n.exists(code, { lng: 'tr' }), code).toBe(true);
      expect(i18n.t(code).length, code).toBeGreaterThan(0);
    }
  });
});
