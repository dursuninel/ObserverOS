import { describe, expect, it } from 'vitest';

import { STARTER_PROTOCOLS } from '../../src/game/content/protocols/starterProtocols';
import {
  PROTOCOL_NODE_KINDS,
  type ProtocolDefinition,
  type ProtocolNodeKind,
} from '../../src/game/domain/protocol/Protocol';
import { PHASE_FIVE_PROTOCOL_LIMITS } from '../../src/game/simulation/SimulationConfig';
import { validateProtocol } from '../../src/game/simulation/protocol/protocolValidator';
import {
  connectableTargetPorts,
  evaluateProtocolConnection,
  PROTOCOL_CONNECTION_REJECTIONS,
} from '../../src/game/ui/protocols/graph/protocolConnectionRules';
import {
  addProtocolNode,
  connectProtocolNodes,
  createEditorNode,
  disconnectProtocolEdge,
  nextEdgeId,
  nextNodeId,
  removeProtocolNode,
} from '../../src/game/ui/protocols/graph/protocolEditorModel';
import { buildProtocolFlowView, edgeClassOf } from '../../src/game/ui/protocols/graph/protocolFlowView';
import {
  layoutProtocolGraph,
  nextFreePlacement,
  PROTOCOL_LAYOUT_MARGIN,
} from '../../src/game/ui/protocols/graph/protocolGraphLayout';
import {
  nodeCardHeight,
  orderedInputPorts,
  orderedOutputPorts,
  PROTOCOL_NODE_PALETTE,
  PROTOCOL_NODE_SUMMARY_LINES,
  PROTOCOL_NODE_SUMMARY_STEP,
  portOffsetY,
} from '../../src/game/ui/protocols/graph/protocolNodePresentation';
import { i18n } from '../../src/localization/i18n';

const t = (key: string, params?: Readonly<Record<string, string | number>>): string => i18n.t(key, params ?? {});

const LIMITS = PHASE_FIVE_PROTOCOL_LIMITS;

/** Düzenleyici testleri için minimum protokol iskeleti. */
function emptyDefinition(): ProtocolDefinition {
  return {
    edges: [],
    id: 'test-protocol',
    lifecycle: 'draft',
    name: 'Test Protokolü',
    nodes: [],
    priority: 'normal',
    version: 1,
  };
}

function withNodes(kinds: readonly ProtocolNodeKind[]): ProtocolDefinition {
  return kinds.reduce<ProtocolDefinition>(
    (definition, kind) => addProtocolNode(definition, createEditorNode(kind, kind, LIMITS)),
    emptyDefinition(),
  );
}

function protocolById(id: string): ProtocolDefinition {
  const definition = STARTER_PROTOCOLS.find((entry) => entry.id === id);
  if (definition === undefined) throw new Error(`missing starter protocol: ${id}`);
  return definition;
}

describe('graph editor node palette', () => {
  it('carries exactly the six canonical nodes and nothing else', () => {
    expect(PROTOCOL_NODE_PALETTE).toHaveLength(6);
    expect(PROTOCOL_NODE_PALETTE.map((entry) => entry.kind)).toEqual([...PROTOCOL_NODE_KINDS]);
  });

  it('never offers a node kind the protocol model does not define', () => {
    for (const forbidden of ['or', 'not', 'timer', 'cooldown', 'counter', 'splitter']) {
      expect(PROTOCOL_NODE_PALETTE.some((entry) => entry.kind === (forbidden as ProtocolNodeKind))).toBe(false);
    }
  });

  it('creates a placeable node for every palette entry', () => {
    for (const entry of PROTOCOL_NODE_PALETTE) {
      const node = createEditorNode(entry.kind, `${entry.kind}-1`, LIMITS);
      expect(node.kind).toBe(entry.kind);
      expect(node.id).toBe(`${entry.kind}-1`);
    }
  });

  it('takes the new delay duration from the limits data layer, not a hard-coded number', () => {
    const delay = createEditorNode('delay', 'delay-1', LIMITS);
    expect(delay.kind === 'delay' ? delay.durationMinutes : -1).toBe(LIMITS.delayMinimumMinutes);
  });

  it('leaves measurement and setting unselected instead of inventing a canonical id', () => {
    const trigger = createEditorNode('trigger', 'trigger-1', LIMITS);
    const action = createEditorNode('action', 'action-1', LIMITS);
    expect(trigger.kind === 'trigger' ? trigger.sensorId : 'x').toBe('');
    expect(action.kind === 'action' ? action.actionId : 'x').toBe('');
  });
});

describe('graph editor port schema', () => {
  const expectedInputs: Readonly<Record<ProtocolNodeKind, readonly string[]>> = {
    action: ['in'],
    and: ['in', 'a', 'b'],
    compare: ['in', 'left'],
    delay: ['in'],
    sensor: [],
    trigger: [],
  };

  const expectedOutputs: Readonly<Record<ProtocolNodeKind, readonly string[]>> = {
    action: [],
    and: ['whenTrue', 'whenFalse', 'result'],
    compare: ['whenTrue', 'whenFalse', 'result'],
    delay: ['out'],
    sensor: ['value'],
    trigger: ['out'],
  };

  it('draws exactly the ports the Faz 5 validator defines', () => {
    for (const kind of PROTOCOL_NODE_KINDS) {
      const node = createEditorNode(kind, kind, LIMITS);
      expect(orderedInputPorts(node), kind).toEqual(expectedInputs[kind]);
      expect(orderedOutputPorts(node), kind).toEqual(expectedOutputs[kind]);
    }
  });

  it('opens the second value port only when the compare node has no constant', () => {
    const withConstant = createEditorNode('compare', 'compare-1', LIMITS);
    expect(orderedInputPorts(withConstant)).toEqual(['in', 'left']);
    const withoutConstant = { id: 'compare-2', kind: 'compare', operator: '<' } as const;
    expect(orderedInputPorts(withoutConstant)).toEqual(['in', 'left', 'right']);
  });

  it('keeps every port row inside its card and below the summary lines', () => {
    for (const kind of PROTOCOL_NODE_KINDS) {
      const node = createEditorNode(kind, kind, LIMITS);
      const rows = Math.max(orderedInputPorts(node).length, orderedOutputPorts(node).length);
      if (rows === 0) continue;
      // İlk port satırı, özet satırlarının bittiği yerin altında başlar (metin çakışması yok).
      expect(portOffsetY(0, kind), kind).toBeGreaterThanOrEqual(
        44 + PROTOCOL_NODE_SUMMARY_LINES[kind] * PROTOCOL_NODE_SUMMARY_STEP,
      );
      expect(portOffsetY(rows - 1, kind), kind).toBeLessThan(nodeCardHeight(node));
    }
  });
});

describe('graph editor connection rules', () => {
  it('accepts a flow connection between trigger and action', () => {
    const definition = withNodes(['trigger', 'action']);
    const verdict = evaluateProtocolConnection(definition, {
      from: { nodeId: 'trigger', port: 'out' },
      to: { nodeId: 'action', port: 'in' },
    });
    expect(verdict.allowed).toBe(true);
  });

  it('blocks a flow output dropped on a value input', () => {
    const definition = withNodes(['trigger', 'compare']);
    const verdict = evaluateProtocolConnection(definition, {
      from: { nodeId: 'trigger', port: 'out' },
      to: { nodeId: 'compare', port: 'left' },
    });
    expect(verdict).toEqual({ allowed: false, rejection: 'type-mismatch' });
  });

  it('blocks a measurement output dropped on a flow input', () => {
    const definition = withNodes(['sensor', 'action']);
    const verdict = evaluateProtocolConnection(definition, {
      from: { nodeId: 'sensor', port: 'value' },
      to: { nodeId: 'action', port: 'in' },
    });
    expect(verdict).toEqual({ allowed: false, rejection: 'type-mismatch' });
  });

  it('accepts a measurement feeding a compare operand', () => {
    const definition = withNodes(['sensor', 'compare']);
    expect(evaluateProtocolConnection(definition, {
      from: { nodeId: 'sensor', port: 'value' },
      to: { nodeId: 'compare', port: 'left' },
    }).allowed).toBe(true);
  });

  it('blocks a node connecting to itself', () => {
    const definition = withNodes(['delay']);
    expect(evaluateProtocolConnection(definition, {
      from: { nodeId: 'delay', port: 'out' },
      to: { nodeId: 'delay', port: 'in' },
    })).toEqual({ allowed: false, rejection: 'self-connection' });
  });

  it('blocks a drop on an output instead of an input', () => {
    const definition = withNodes(['trigger', 'delay']);
    expect(evaluateProtocolConnection(definition, {
      from: { nodeId: 'trigger', port: 'out' },
      to: { nodeId: 'delay', port: 'out' },
    })).toEqual({ allowed: false, rejection: 'direction' });
  });

  it('blocks a second source on an input that is already fed', () => {
    const first = connectProtocolNodes(withNodes(['trigger', 'delay', 'action']), {
      from: { nodeId: 'trigger', port: 'out' },
      to: { nodeId: 'action', port: 'in' },
    });
    expect(evaluateProtocolConnection(first.definition, {
      from: { nodeId: 'delay', port: 'out' },
      to: { nodeId: 'action', port: 'in' },
    })).toEqual({ allowed: false, rejection: 'input-occupied' });
  });

  it('blocks the same connection twice', () => {
    const first = connectProtocolNodes(withNodes(['trigger', 'action']), {
      from: { nodeId: 'trigger', port: 'out' },
      to: { nodeId: 'action', port: 'in' },
    });
    expect(evaluateProtocolConnection(first.definition, {
      from: { nodeId: 'trigger', port: 'out' },
      to: { nodeId: 'action', port: 'in' },
    })).toEqual({ allowed: false, rejection: 'duplicate' });
  });

  it('blocks a connection that would close a loop', () => {
    const chain = connectProtocolNodes(withNodes(['delay', 'compare']), {
      from: { nodeId: 'delay', port: 'out' },
      to: { nodeId: 'compare', port: 'in' },
    });
    expect(chain.verdict.allowed).toBe(true);
    expect(evaluateProtocolConnection(chain.definition, {
      from: { nodeId: 'compare', port: 'whenTrue' },
      to: { nodeId: 'delay', port: 'in' },
    })).toEqual({ allowed: false, rejection: 'cycle' });
  });

  it('blocks a connection to a node that no longer exists', () => {
    const definition = withNodes(['trigger']);
    expect(evaluateProtocolConnection(definition, {
      from: { nodeId: 'trigger', port: 'out' },
      to: { nodeId: 'ghost', port: 'in' },
    })).toEqual({ allowed: false, rejection: 'unknown-port' });
  });

  it('leaves the protocol untouched when a connection is rejected', () => {
    const definition = withNodes(['trigger', 'compare']);
    const result = connectProtocolNodes(definition, {
      from: { nodeId: 'trigger', port: 'out' },
      to: { nodeId: 'compare', port: 'left' },
    });
    expect(result.definition).toBe(definition);
    expect(result.definition.edges).toHaveLength(0);
  });

  it('offers only reachable targets while dragging from a flow output', () => {
    const definition = withNodes(['trigger', 'delay', 'action', 'sensor']);
    const targets = connectableTargetPorts(definition, { nodeId: 'trigger', port: 'out' });
    expect(targets.map((target) => `${target.nodeId}.${target.port}`)).toEqual(['action.in', 'delay.in']);
  });

  it('never rejects a connection that already exists in a shipped protocol', () => {
    for (const protocol of STARTER_PROTOCOLS) {
      let rebuilt: ProtocolDefinition = { ...protocol, edges: [] };
      for (const edge of protocol.edges) {
        const verdict = evaluateProtocolConnection(rebuilt, { from: edge.from, to: edge.to });
        expect(verdict, `${protocol.id}/${edge.id}`).toEqual({ allowed: true });
        rebuilt = connectProtocolNodes(rebuilt, { from: edge.from, to: edge.to }).definition;
      }
      const report = validateProtocol(rebuilt);
      expect(report.findings.some((finding) => finding.code === 'protocol.error.edge-port-incompatible'), protocol.id).toBe(false);
    }
  });
});

describe('graph editor edit operations', () => {
  it('does not mutate the protocol it edits', () => {
    const definition = withNodes(['trigger']);
    const before = JSON.stringify(definition);
    addProtocolNode(definition, createEditorNode('action', 'action-1', LIMITS));
    removeProtocolNode(definition, 'trigger');
    expect(JSON.stringify(definition)).toBe(before);
  });

  it('drops every connection attached to a deleted node', () => {
    const connected = connectProtocolNodes(withNodes(['trigger', 'action']), {
      from: { nodeId: 'trigger', port: 'out' },
      to: { nodeId: 'action', port: 'in' },
    }).definition;
    expect(connected.edges).toHaveLength(1);
    const pruned = removeProtocolNode(connected, 'action');
    expect(pruned.nodes.map((node) => node.id)).toEqual(['trigger']);
    expect(pruned.edges).toHaveLength(0);
  });

  it('removes only the disconnected edge', () => {
    const definition = protocolById('mine-critical-shutdown');
    const pruned = disconnectProtocolEdge(definition, 'e1');
    expect(pruned.edges.map((edge) => edge.id)).toEqual(['e2']);
  });

  it('generates ids that do not collide with the existing graph', () => {
    const definition = protocolById('oxygen-energy-saving');
    expect(definition.nodes.some((node) => node.id === nextNodeId(definition, 'delay'))).toBe(false);
    expect(definition.edges.some((edge) => edge.id === nextEdgeId(definition))).toBe(false);
  });
});

describe('graph editor layout', () => {
  it('is deterministic: the same protocol always lands on the same coordinates', () => {
    for (const protocol of STARTER_PROTOCOLS) {
      expect(layoutProtocolGraph(protocol), protocol.id).toEqual(layoutProtocolGraph(protocol));
    }
  });

  it('keeps every card inside the canvas margin', () => {
    for (const protocol of STARTER_PROTOCOLS) {
      for (const placement of layoutProtocolGraph(protocol)) {
        expect(placement.x, protocol.id).toBeGreaterThanOrEqual(PROTOCOL_LAYOUT_MARGIN);
        expect(placement.y, protocol.id).toBeGreaterThanOrEqual(PROTOCOL_LAYOUT_MARGIN);
      }
    }
  });

  it('places a node before the node it feeds', () => {
    const protocol = protocolById('mine-critical-shutdown');
    const placements = new Map(layoutProtocolGraph(protocol).map((placement) => [placement.nodeId, placement]));
    const trigger = placements.get('t1');
    const delay = placements.get('d1');
    const action = placements.get('a1');
    expect(trigger?.x ?? 0).toBeLessThan(delay?.x ?? 0);
    expect(delay?.x ?? 0).toBeLessThan(action?.x ?? 0);
  });

  it('never overlaps two cards in the same column', () => {
    for (const protocol of STARTER_PROTOCOLS) {
      const placements = layoutProtocolGraph(protocol);
      for (const column of new Set(placements.map((placement) => placement.x))) {
        const rows = placements.filter((placement) => placement.x === column).sort((left, right) => left.y - right.y);
        for (let index = 1; index < rows.length; index += 1) {
          const previous = rows[index - 1];
          const current = rows[index];
          if (previous === undefined || current === undefined) continue;
          expect(current.y, protocol.id).toBeGreaterThanOrEqual(previous.y + previous.height);
        }
      }
    }
  });

  it('terminates and places every node even when the graph has a loop', () => {
    const looped: ProtocolDefinition = {
      ...withNodes(['delay', 'compare']),
      edges: [
        { from: { nodeId: 'delay', port: 'out' }, id: 'e1', to: { nodeId: 'compare', port: 'in' } },
        { from: { nodeId: 'compare', port: 'whenTrue' }, id: 'e2', to: { nodeId: 'delay', port: 'in' } },
      ],
    };
    expect(layoutProtocolGraph(looped)).toHaveLength(2);
  });

  it('puts a newly added node in a free column to the right', () => {
    const placements = layoutProtocolGraph(protocolById('mine-critical-shutdown'));
    const point = nextFreePlacement(placements);
    expect(point.x).toBeGreaterThan(Math.max(...placements.map((placement) => placement.x)));
    expect(point.y).toBe(PROTOCOL_LAYOUT_MARGIN);
  });
});

describe('graph editor canvas view', () => {
  function viewOf(protocol: ProtocolDefinition) {
    const positions = new Map(layoutProtocolGraph(protocol).map((placement) => [placement.nodeId, { x: placement.x, y: placement.y }]));
    return buildProtocolFlowView(protocol, positions, t);
  }

  it('never leaks a raw localization key onto a card', () => {
    for (const protocol of STARTER_PROTOCOLS) {
      for (const node of viewOf(protocol).nodes) {
        expect(node.typeLabel.includes('protocolEditor.'), node.id).toBe(false);
        for (const line of node.lines) {
          expect(line.includes('protocolEditor.'), `${protocol.id}/${node.id}`).toBe(false);
          expect(line.includes('protocolManager.'), `${protocol.id}/${node.id}`).toBe(false);
          expect(line.includes('{{'), `${protocol.id}/${node.id}`).toBe(false);
          expect(line.length, `${protocol.id}/${node.id}`).toBeGreaterThan(0);
        }
        for (const port of [...node.inputs, ...node.outputs]) {
          expect(port.label.includes('protocolEditor.'), port.port).toBe(false);
        }
      }
    }
  });

  it('gives the AND node no summary line and the action node two', () => {
    const view = viewOf(protocolById('oxygen-energy-saving'));
    expect(view.nodes.find((node) => node.id === 'and1')?.lines).toEqual([]);
    expect(view.nodes.find((node) => node.id === 'a1')?.lines).toHaveLength(2);
  });

  it('separates the yes path from the no path by class and label, not colour alone', () => {
    expect(edgeClassOf({ from: { nodeId: 'c1', port: 'whenTrue' }, id: 'e', to: { nodeId: 'a1', port: 'in' } })).toBe('yes');
    expect(edgeClassOf({ from: { nodeId: 'c1', port: 'whenFalse' }, id: 'e', to: { nodeId: 'a1', port: 'in' } })).toBe('no');
    expect(edgeClassOf({ from: { nodeId: 's1', port: 'value' }, id: 'e', to: { nodeId: 'c1', port: 'left' } })).toBe('value');
    expect(edgeClassOf({ from: { nodeId: 't1', port: 'out' }, id: 'e', to: { nodeId: 'a1', port: 'in' } })).toBe('flow');

    const view = viewOf(protocolById('oxygen-energy-saving'));
    const yesEdge = view.edges.find((edge) => edge.id === 'e6');
    expect(yesEdge?.edgeClass).toBe('yes');
    expect(yesEdge?.label).toBe(i18n.t('protocolEditor.edge.yes'));
    expect(view.edges.find((edge) => edge.id === 'e1')?.label).toBeUndefined();
  });

  it('shows an unselected measurement as words instead of an empty card line', () => {
    const definition = withNodes(['trigger', 'action']);
    const view = buildProtocolFlowView(definition, new Map(), t);
    const trigger = view.nodes.find((node) => node.id === 'trigger');
    expect(trigger?.lines[0]).toBe(i18n.t('protocolEditor.card.unsetMeasurement'));
    expect(view.nodes.find((node) => node.id === 'action')?.lines[1]).toContain(i18n.t('protocolEditor.card.unsetSetting'));
  });

  it('carries a rejection wording for every connection rule', () => {
    for (const rejection of PROTOCOL_CONNECTION_REJECTIONS) {
      expect(i18n.exists(`protocolEditor.connection.${rejection}`, { lng: 'tr' }), rejection).toBe(true);
    }
  });
});
