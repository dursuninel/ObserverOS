import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PRIORITIES } from '../../src/game/domain/facilities/Facility';
import { COMPARE_OPERATORS, PROTOCOL_LIFECYCLES } from '../../src/game/domain/protocol/Protocol';
import { i18n } from '../../src/localization/i18n';

const OPERATOR_KEYS = ['above', 'atLeast', 'atMost', 'below', 'equal', 'notEqual'] as const;

describe('protocol manager localization', () => {
  it('translates every lifecycle and priority shown on a card', () => {
    for (const lifecycle of PROTOCOL_LIFECYCLES) {
      expect(i18n.exists(`protocolManager.lifecycle.${lifecycle}`, { lng: 'tr' }), lifecycle).toBe(true);
    }
    for (const priority of PRIORITIES) {
      expect(i18n.exists(`protocolManager.priority.${priority}`, { lng: 'tr' }), priority).toBe(true);
    }
  });

  it('has a trigger and a condition wording for every compare operator', () => {
    expect(OPERATOR_KEYS).toHaveLength(COMPARE_OPERATORS.length);
    for (const key of OPERATOR_KEYS) {
      expect(i18n.exists(`protocolManager.summary.trigger.${key}`, { lng: 'tr' }), key).toBe(true);
      expect(i18n.exists(`protocolManager.summary.condition.${key}`, { lng: 'tr' }), key).toBe(true);
    }
  });

  it('translates every execution status the last-run field can show', () => {
    for (const status of ['applied', 'blocked', 'delayed', 'failed', 'triggered']) {
      expect(i18n.exists(`protocolManager.lastRun.status.${status}`, { lng: 'tr' }), status).toBe(true);
    }
  });

  it('keeps every manager label the screen needs', () => {
    for (const key of [
      'protocolManager.title', 'protocolManager.intro', 'protocolManager.search.label',
      'protocolManager.search.placeholder', 'protocolManager.filters.label', 'protocolManager.filters.lifecycle',
      'protocolManager.filters.priority', 'protocolManager.filters.facility', 'protocolManager.filters.clear',
      'protocolManager.filters.allFacilities', 'protocolManager.results.count', 'protocolManager.results.empty',
      'protocolManager.results.emptyLibrary', 'protocolManager.card.summary', 'protocolManager.card.affected',
      'protocolManager.card.lastRun', 'protocolManager.card.priority', 'protocolManager.card.scale',
      'protocolManager.card.noFacility', 'protocolManager.lastRun.never', 'protocolManager.lastRun.at', 'protocolManager.lastRun.entry',
      'protocolManager.summary.noAction', 'protocolManager.summary.noTrigger', 'protocolManager.summary.sentence',
      'protocolManager.create.action', 'protocolManager.create.defaultName',
    ]) {
      expect(i18n.exists(key, { lng: 'tr' }), key).toBe(true);
    }
  });

  it('does not hard-code Turkish manager copy in the components or model', () => {
    for (const file of [
      'src/game/ui/protocols/ProtocolManager.tsx',
      'src/game/ui/protocols/ProtocolsWorkspace.tsx',
      'src/game/ui/protocols/protocolSummary.ts',
      'src/game/ui/protocols/protocolManagerModel.ts',
    ]) {
      const source = readFileSync(resolve(file), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const phrase of ['olduğunda', 'düştüğünde', 'moduna alır', 'Henüz çalışmadı', 'Aktif', 'Taslak', 'Tümü']) {
        expect(code.includes(phrase), `${file} :: ${phrase}`).toBe(false);
      }
    }
  });
});
