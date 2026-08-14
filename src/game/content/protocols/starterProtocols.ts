import type { ProtocolDefinition, ProtocolEdge } from '../../domain/protocol/Protocol';

/**
 * Faz 6 başlangıç protokolleri (spec §14.1).
 *
 * Protocol Manager'ın gösterdiği liste bu tanımlardan gelir; kart özeti graph'tan
 * TÜRETİLİR, burada metin olarak tutulmaz. Yalnız hâlihazırda kanonik olan kimlikler
 * kullanılır:
 * - tesisler: `SimulationConfig` içindeki facility id'leri
 * - eylemler: `FACILITY_ACTUATORS` içindeki actuator id'leri
 * - ölçümler: Faz 5 runtime'ında zaten kullanılan sensor id'leri
 *
 * Yeni sensor kataloğu burada UYDURULMAZ (§12 capability katmanı, Faz 8 içeriği).
 * Protokol/node sayısı için yapay bir üst sınır yoktur (§14.1).
 *
 * Protokol adları oyuncu içeriğidir (düzenleyicide değiştirilir), UI metni değildir;
 * bu yüzden localization sözlüğünde değil veri katmanında dururlar.
 */

function edge(id: string, fromNodeId: string, fromPort: string, toNodeId: string, toPort: string): ProtocolEdge {
  return { from: { nodeId: fromNodeId, port: fromPort }, id, to: { nodeId: toNodeId, port: toPort } };
}

const STARTER_PROTOCOL_DEFINITIONS: readonly ProtocolDefinition[] = [
  {
    edges: [edge('e1', 't1', 'out', 'a1', 'in')],
    id: 'reactor-condition-guard',
    lifecycle: 'active',
    name: 'Reaktör Kondisyon Koruması',
    nodes: [
      { facilityId: 'reactor-01', id: 't1', kind: 'trigger', operator: '<', sensorId: 'facility-condition', threshold: 45 },
      { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'eco' },
    ],
    priority: 'high',
    version: 3,
  },
  {
    edges: [edge('e1', 't1', 'out', 'd1', 'in'), edge('e2', 'd1', 'out', 'a1', 'in')],
    id: 'mine-critical-shutdown',
    lifecycle: 'active',
    name: 'Maden Kritik Kapatma',
    nodes: [
      { facilityId: 'mine-01', id: 't1', kind: 'trigger', operator: '<', sensorId: 'facility-condition', threshold: 25 },
      { durationMinutes: 30, id: 'd1', kind: 'delay' },
      { actionId: 'set-operating-state', facilityId: 'mine-01', id: 'a1', kind: 'action', value: 'offline' },
    ],
    priority: 'critical',
    version: 1,
  },
  {
    edges: [
      edge('e1', 't1', 'out', 'and1', 'in'),
      edge('e2', 's1', 'value', 'c1', 'left'),
      edge('e3', 's2', 'value', 'c2', 'left'),
      edge('e4', 'c1', 'result', 'and1', 'a'),
      edge('e5', 'c2', 'result', 'and1', 'b'),
      edge('e6', 'and1', 'whenTrue', 'a1', 'in'),
    ],
    id: 'oxygen-energy-saving',
    lifecycle: 'draft',
    name: 'Oksijen Enerji Tasarrufu',
    nodes: [
      { id: 't1', kind: 'trigger', operator: '<', sensorId: 'energy-level', threshold: 60 },
      { facilityId: 'oxygen-processor-01', id: 's1', kind: 'sensor', sensorId: 'facility-condition' },
      { facilityId: 'reactor-01', id: 's2', kind: 'sensor', sensorId: 'facility-condition' },
      { comparand: 50, id: 'c1', kind: 'compare', operator: '>=' },
      { comparand: 40, id: 'c2', kind: 'compare', operator: '>=' },
      { id: 'and1', kind: 'and' },
      { actionId: 'set-mode', facilityId: 'oxygen-processor-01', id: 'a1', kind: 'action', value: 'eco' },
    ],
    priority: 'normal',
    version: 1,
  },
  {
    edges: [edge('e1', 't1', 'out', 'a1', 'in')],
    id: 'mine-maintenance-escalation',
    lifecycle: 'validated',
    name: 'Maden Bakım Yükseltmesi',
    nodes: [
      { facilityId: 'mine-01', id: 't1', kind: 'trigger', operator: '<', sensorId: 'facility-condition', threshold: 70 },
      { actionId: 'set-maintenance-priority', facilityId: 'mine-01', id: 'a1', kind: 'action', value: 'high' },
    ],
    priority: 'normal',
    version: 2,
  },
  {
    edges: [edge('e1', 't1', 'out', 'a1', 'in')],
    id: 'reactor-night-boost',
    lifecycle: 'disabled',
    name: 'Reaktör Gece Takviyesi',
    nodes: [
      { id: 't1', kind: 'trigger', operator: '<', sensorId: 'energy-level', threshold: 40 },
      { actionId: 'set-mode', facilityId: 'reactor-01', id: 'a1', kind: 'action', value: 'boost' },
    ],
    priority: 'low',
    version: 5,
  },
];

export const STARTER_PROTOCOLS: readonly ProtocolDefinition[] = Object.freeze(
  STARTER_PROTOCOL_DEFINITIONS.map((definition) => Object.freeze({
    ...definition,
    edges: Object.freeze([...definition.edges]),
    nodes: Object.freeze([...definition.nodes]),
  })),
);
