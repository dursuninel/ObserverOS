import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { STARTER_PROTOCOLS } from '../../src/game/content/protocols/starterProtocols';
import type { ProtocolDefinition } from '../../src/game/domain/protocol/Protocol';
import { PHASE_FIVE_PROTOCOL_LIMITS, PHASE_THREE_BASELINE_CONFIG } from '../../src/game/simulation/SimulationConfig';
import { compileProtocol } from '../../src/game/simulation/protocol/protocolCompiler';
import {
  EMPTY_PROTOCOL_EXECUTION_LOG,
  reduceProtocolExecutionLog,
  type ProtocolExecutionLog,
} from '../../src/game/state/protocolExecutionLog';
import {
  createProtocolCards,
  filterProtocolCards,
  formatLastExecution,
  formatSimulationTime,
  isProtocolFilterActive,
  protocolFacilityOptions,
  EMPTY_PROTOCOL_FILTER,
} from '../../src/game/ui/protocols/protocolManagerModel';
import { affectedFacilityIds, describeProtocol } from '../../src/game/ui/protocols/protocolSummary';
import { i18n } from '../../src/localization/i18n';

const t = (key: string, params?: Readonly<Record<string, string | number>>): string => i18n.t(key, params ?? {});

function cardsOf(log: ProtocolExecutionLog = EMPTY_PROTOCOL_EXECUTION_LOG) {
  return createProtocolCards(STARTER_PROTOCOLS, log, t);
}

function protocolById(id: string): ProtocolDefinition {
  const definition = STARTER_PROTOCOLS.find((entry) => entry.id === id);
  if (definition === undefined) throw new Error(`missing starter protocol: ${id}`);
  return definition;
}

describe('protocol manager cards', () => {
  it('fills every card field required by the manager screen', () => {
    for (const card of cardsOf()) {
      expect(card.name.length, card.id).toBeGreaterThan(0);
      expect(['active', 'archived', 'disabled', 'draft', 'validated']).toContain(card.lifecycle);
      expect(['critical', 'high', 'low', 'normal']).toContain(card.priority);
      expect(card.summary.endsWith('.'), card.id).toBe(true);
      expect(card.affectedFacilityIds.length, card.id).toBeGreaterThan(0);
      expect(card.lastExecution).toBeNull();
    }
  });

  it('never leaks a raw localization key into a card', () => {
    for (const card of cardsOf()) {
      expect(card.summary.includes('protocolManager.'), card.id).toBe(false);
      expect(card.summary.includes('{{'), card.id).toBe(false);
      for (const label of card.affectedFacilityLabels) expect(label.includes('-0')).toBe(false);
    }
  });

  it('sorts by lifecycle, then priority, then name', () => {
    expect(cardsOf().map((card) => card.id)).toEqual([
      'mine-critical-shutdown',
      'reactor-condition-guard',
      'mine-maintenance-escalation',
      'oxygen-energy-saving',
      'reactor-night-boost',
    ]);
  });
});

describe('automatic protocol summary', () => {
  it('describes a trigger and its action as one natural Turkish sentence', () => {
    expect(describeProtocol(protocolById('reactor-condition-guard'), t)).toBe(
      'Reaktör kondisyonu 45 değerinin altına düştüğünde Reaktör tesisini Eco moduna alır.',
    );
  });

  it('places the delay between the trigger and the action', () => {
    expect(describeProtocol(protocolById('mine-critical-shutdown'), t)).toBe(
      'Maden kondisyonu 25 değerinin altına düştüğünde 30 dakika sonra Maden tesisini Devre dışı durumuna getirir.',
    );
  });

  it('joins compare conditions to the trigger clause', () => {
    expect(describeProtocol(protocolById('oxygen-energy-saving'), t)).toBe(
      'Koloni enerji seviyesi 60 değerinin altına düştüğünde ve Oksijen İşleyici kondisyonu en az 50 ise'
      + ' ve Reaktör kondisyonu en az 40 ise Oksijen İşleyici tesisini Eco moduna alır.',
    );
  });

  it('uses the colony-wide wording when the measurement has no facility', () => {
    expect(describeProtocol(protocolById('reactor-night-boost'), t)).toBe(
      'Koloni enerji seviyesi 40 değerinin altına düştüğünde Reaktör tesisini Boost moduna alır.',
    );
  });

  it('is derived from the graph, so editing a threshold changes the sentence', () => {
    const base = protocolById('reactor-condition-guard');
    const edited: ProtocolDefinition = {
      ...base,
      nodes: base.nodes.map((node) => (node.kind === 'trigger' ? { ...node, threshold: 12 } : node)),
    };
    expect(describeProtocol(edited, t)).toContain('12 değerinin altına düştüğünde');
    expect(describeProtocol(edited, t)).not.toBe(describeProtocol(base, t));
  });

  it('explains a protocol that cannot start on its own instead of failing', () => {
    const withoutTrigger: ProtocolDefinition = {
      edges: [], id: 'no-trigger', lifecycle: 'draft', name: 'Taslak',
      nodes: [{ actionId: 'set-mode', facilityId: 'mine-01', id: 'a1', kind: 'action', value: 'eco' }],
      priority: 'normal', version: 1,
    };
    expect(describeProtocol(withoutTrigger, t)).toBe('Bu protokolde başlangıç tetikleyicisi yok; kendiliğinden çalışamaz.');
  });

  it('lists acting facilities before observed ones', () => {
    expect(affectedFacilityIds(protocolById('oxygen-energy-saving'))).toEqual(['oxygen-processor-01', 'reactor-01']);
  });
});

describe('protocol search and filters', () => {
  it('matches the name case-insensitively with Turkish casing', () => {
    const result = filterProtocolCards(cardsOf(), { ...EMPTY_PROTOCOL_FILTER, search: 'MADEN' });
    expect(result.map((card) => card.id)).toEqual(['mine-critical-shutdown', 'mine-maintenance-escalation']);
  });

  it('matches text that only appears inside the generated summary', () => {
    const result = filterProtocolCards(cardsOf(), { ...EMPTY_PROTOCOL_FILTER, search: 'boost moduna' });
    expect(result.map((card) => card.id)).toEqual(['reactor-night-boost']);
  });

  it('filters by lifecycle', () => {
    const result = filterProtocolCards(cardsOf(), { ...EMPTY_PROTOCOL_FILTER, lifecycles: ['draft'] });
    expect(result.map((card) => card.id)).toEqual(['oxygen-energy-saving']);
  });

  it('filters by priority', () => {
    const result = filterProtocolCards(cardsOf(), { ...EMPTY_PROTOCOL_FILTER, priorities: ['critical'] });
    expect(result.map((card) => card.id)).toEqual(['mine-critical-shutdown']);
  });

  it('filters by affected facility', () => {
    const result = filterProtocolCards(cardsOf(), { ...EMPTY_PROTOCOL_FILTER, facilityIds: ['oxygen-processor-01'] });
    expect(result.map((card) => card.id)).toEqual(['oxygen-energy-saving']);
  });

  it('combines search with filters instead of replacing them', () => {
    const result = filterProtocolCards(cardsOf(), { ...EMPTY_PROTOCOL_FILTER, lifecycles: ['active'], search: 'maden' });
    expect(result.map((card) => card.id)).toEqual(['mine-critical-shutdown']);
  });

  it('returns an empty list rather than falling back to everything', () => {
    expect(filterProtocolCards(cardsOf(), { ...EMPTY_PROTOCOL_FILTER, search: 'zzz-yok' })).toEqual([]);
  });

  it('does not cap the list with an artificial maximum', () => {
    const many: ProtocolDefinition[] = Array.from({ length: 240 }, (_, index) => ({
      ...protocolById('reactor-condition-guard'),
      id: `bulk-${index.toString().padStart(3, '0')}`,
      name: `Toplu Protokol ${index.toString()}`,
    }));
    const cards = createProtocolCards(many, EMPTY_PROTOCOL_EXECUTION_LOG, t);
    expect(cards).toHaveLength(240);
    expect(filterProtocolCards(cards, EMPTY_PROTOCOL_FILTER)).toHaveLength(240);
  });

  it('offers facility options drawn from the listed protocols only', () => {
    expect(protocolFacilityOptions(cardsOf(), t)).toEqual([
      { id: 'mine-01', label: 'Maden' },
      { id: 'oxygen-processor-01', label: 'Oksijen İşleyici' },
      { id: 'reactor-01', label: 'Reaktör' },
    ]);
  });

  it('knows when filters are active', () => {
    expect(isProtocolFilterActive(EMPTY_PROTOCOL_FILTER)).toBe(false);
    expect(isProtocolFilterActive({ ...EMPTY_PROTOCOL_FILTER, search: '  ' })).toBe(false);
    expect(isProtocolFilterActive({ ...EMPTY_PROTOCOL_FILTER, priorities: ['low'] })).toBe(true);
  });
});

describe('last execution field', () => {
  it('reports a trace as triggered until a command outcome lands', () => {
    const log = reduceProtocolExecutionLog(EMPTY_PROTOCOL_EXECUTION_LOG, [{
      priority: 'high', protocolExecutionId: 'x-1', protocolId: 'reactor-condition-guard', steps: [], triggeredAt: 90,
    }], []);
    expect(log['reactor-condition-guard']).toEqual({ protocolExecutionId: 'x-1', simTime: 90, status: 'triggered' });
  });

  it('lets the command outcome of the same tick win over the trace', () => {
    const log = reduceProtocolExecutionLog(
      EMPTY_PROTOCOL_EXECUTION_LOG,
      [{ priority: 'high', protocolExecutionId: 'x-1', protocolId: 'reactor-condition-guard', steps: [], triggeredAt: 90 }],
      [{ actuator: 'set-mode', protocolExecutionId: 'x-1', protocolId: 'reactor-condition-guard', simTime: 90, status: 'blocked' }],
    );
    expect(log['reactor-condition-guard']?.status).toBe('blocked');
  });

  it('keeps the newest record when older data arrives afterwards', () => {
    const first = reduceProtocolExecutionLog(
      EMPTY_PROTOCOL_EXECUTION_LOG,
      [],
      [{ actuator: 'set-mode', protocolExecutionId: 'x-2', protocolId: 'mine-critical-shutdown', simTime: 500, status: 'applied' }],
    );
    const second = reduceProtocolExecutionLog(
      first,
      [{ priority: 'critical', protocolExecutionId: 'x-1', protocolId: 'mine-critical-shutdown', steps: [], triggeredAt: 120 }],
      [],
    );
    expect(second['mine-critical-shutdown']).toEqual({ protocolExecutionId: 'x-2', simTime: 500, status: 'applied' });
  });

  it('surfaces the record on the matching card', () => {
    const log = reduceProtocolExecutionLog(
      EMPTY_PROTOCOL_EXECUTION_LOG,
      [],
      [{ actuator: 'set-mode', protocolExecutionId: 'x-9', protocolId: 'reactor-condition-guard', simTime: 1_530, status: 'applied' }],
    );
    const card = cardsOf(log).find((entry) => entry.id === 'reactor-condition-guard');
    expect(card?.lastExecution?.status).toBe('applied');
    expect(formatSimulationTime(1_530, PHASE_THREE_BASELINE_CONFIG.clock.localDayMinutes, t)).toBe('2. gün 01:30');
    expect(formatLastExecution(card?.lastExecution ?? null, PHASE_THREE_BASELINE_CONFIG.clock.localDayMinutes, t))
      .toBe('Uygulandı · 2. gün 01:30');
  });

  it('says so plainly when a protocol has never run', () => {
    expect(formatLastExecution(null, PHASE_THREE_BASELINE_CONFIG.clock.localDayMinutes, t)).toBe('Henüz çalışmadı');
  });

  it('renders a blocked run with its own wording', () => {
    expect(formatLastExecution(
      { protocolExecutionId: 'x-3', simTime: 45, status: 'blocked' },
      PHASE_THREE_BASELINE_CONFIG.clock.localDayMinutes,
      t,
    )).toBe('Engellendi · 1. gün 00:45');
  });
});

describe('/protocols route surface', () => {
  it('renders the manager, not the graph editor (spec 14.1)', () => {
    const workspace = readFileSync(resolve('src/game/ui/protocols/ProtocolsWorkspace.tsx'), 'utf8');
    expect(workspace).toContain('ProtocolManager');
    expect(workspace.includes('ProtocolFlowBoundary')).toBe(false);
    expect(workspace.includes('ReactFlow')).toBe(false);
  });

  it('keeps /protocols pointed at the protocol workspace', () => {
    const app = readFileSync(resolve('src/app/App.tsx'), 'utf8');
    expect(app).toContain('path="protocols" element={<ProtocolsWorkspace />}');
  });

  it('has no folder or protocol-group concept in the manager (MVP)', () => {
    const model = readFileSync(resolve('src/game/ui/protocols/protocolManagerModel.ts'), 'utf8');
    const manager = readFileSync(resolve('src/game/ui/protocols/ProtocolManager.tsx'), 'utf8');
    for (const source of [model, manager]) {
      expect(/\bfolder\b/i.test(source.replace(/\/\*[\s\S]*?\*\//g, ''))).toBe(false);
      expect(/\bgroupId\b/.test(source)).toBe(false);
    }
  });
});

describe('starter protocol content', () => {
  it('only targets facilities that exist in the simulation config', () => {
    const known = new Set(PHASE_THREE_BASELINE_CONFIG.facilities.map(({ id }) => id));
    for (const definition of STARTER_PROTOCOLS) {
      for (const facilityId of affectedFacilityIds(definition)) expect(known.has(facilityId), facilityId).toBe(true);
    }
  });

  it('compiles with the Phase 5 compiler, so the manager lists runnable graphs', () => {
    const facilities = PHASE_THREE_BASELINE_CONFIG.facilities.map(({ id }) => ({
      actionIds: ['set-maintenance-priority', 'set-mode', 'set-operating-state'],
      id,
      sensorIds: ['energy-level', 'facility-condition'],
    }));
    const capabilities = {
      actions: [
        { allowedValues: ['high', 'low', 'normal', 'critical'], id: 'set-maintenance-priority', requiresTarget: true, requiresValue: true, valueType: 'enum:priority' as const },
        { allowedValues: ['boost', 'eco', 'normal'], id: 'set-mode', requiresTarget: true, requiresValue: true, valueType: 'enum:facility-mode' as const },
        { allowedValues: ['offline', 'online'], id: 'set-operating-state', requiresTarget: true, requiresValue: true, valueType: 'enum:facility-state' as const },
      ],
      facilities,
      limits: PHASE_FIVE_PROTOCOL_LIMITS,
      sensors: [
        { id: 'energy-level', valueType: 'number' as const },
        { id: 'facility-condition', valueType: 'number' as const },
      ],
    };
    for (const definition of STARTER_PROTOCOLS) {
      const result = compileProtocol(definition, capabilities);
      expect(result.status, `${definition.id}: ${JSON.stringify(result.report.findings)}`).toBe('compiled');
    }
  });
});
