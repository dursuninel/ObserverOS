import { describe, expect, it } from 'vitest';

import { STARTER_PROTOCOLS } from '../../src/game/content/protocols/starterProtocols';
import { FACILITY_ACTUATORS } from '../../src/game/domain/facilities/Facility';
import type { ProtocolDefinition } from '../../src/game/domain/protocol/Protocol';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import { PHASE_FIVE_PROTOCOL_LIMITS, PHASE_THREE_BASELINE_CONFIG } from '../../src/game/simulation/SimulationConfig';
import {
  PROTOCOL_ACTION_CATALOG,
  PROTOCOL_SENSOR_CATALOG,
  buildProtocolCapabilities,
  createProtocolSensorReader,
} from '../../src/game/simulation/protocol/protocolCapabilityBridge';
import { validateProtocol } from '../../src/game/simulation/protocol/protocolValidator';

/**
 * Capability köprüsü — Faz 6/3.
 *
 * En önemli iddia: köprü YENİ kimlik uydurmaz. Ölçüm listesi Faz 5'te zaten kullanılan
 * iki kimlikle sınırlıdır, eylem listesi `FACILITY_ACTUATORS`'ın alt kümesidir.
 */

function capabilities(states?: SimulationEngine) {
  return buildProtocolCapabilities({
    definitions: PHASE_THREE_BASELINE_CONFIG.facilities,
    limits: PHASE_FIVE_PROTOCOL_LIMITS,
    protocols: STARTER_PROTOCOLS,
    ...(states === undefined ? {} : { states: states.getSnapshot().facilities }),
  });
}

describe('protocol capability bridge', () => {
  it('exposes only the measurement ids Phase 5 already runs on', () => {
    expect(PROTOCOL_SENSOR_CATALOG.map((sensor) => sensor.id)).toEqual(['energy-level', 'facility-condition']);
    const used = new Set(STARTER_PROTOCOLS.flatMap((protocol) => protocol.nodes
      .filter((node) => node.kind === 'sensor' || node.kind === 'trigger')
      .map((node) => (node.kind === 'sensor' || node.kind === 'trigger' ? node.sensorId : ''))));
    for (const sensorId of used) {
      expect(PROTOCOL_SENSOR_CATALOG.some((sensor) => sensor.id === sensorId), sensorId).toBe(true);
    }
  });

  it('derives every action from a real facility actuator and leaves set-setpoint out', () => {
    for (const action of PROTOCOL_ACTION_CATALOG) {
      expect(FACILITY_ACTUATORS.includes(action.id as (typeof FACILITY_ACTUATORS)[number]), action.id).toBe(true);
    }
    expect(PROTOCOL_ACTION_CATALOG.some((action) => action.id === 'set-setpoint')).toBe(false);
  });

  it('offers the operating mode action only where the facility defines modes', () => {
    const built = capabilities();
    const actionsOf = (id: string): readonly string[] => built.facilities.find((facility) => facility.id === id)?.actionIds ?? [];
    expect(actionsOf('reactor-01')).toContain('set-mode');
    expect(actionsOf('mine-01')).toContain('set-mode');
    expect(actionsOf('battery-01')).not.toContain('set-mode');
    expect(actionsOf('material-storage-01')).not.toContain('set-mode');
    expect(actionsOf('battery-01')).toContain('set-maintenance-priority');
  });

  it('validates every shipped protocol without a capability error', () => {
    const built = capabilities();
    for (const protocol of STARTER_PROTOCOLS) {
      const report = validateProtocol(protocol, built);
      const errors = report.findings.filter((finding) => finding.severity === 'error');
      expect(errors, `${protocol.id}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('claims actions only for active protocols', () => {
    const claims = capabilities().activeActionClaims ?? [];
    const activeIds = new Set(STARTER_PROTOCOLS.filter((protocol) => protocol.lifecycle === 'active').map((protocol) => protocol.id));
    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) expect(activeIds.has(claim.protocolId), claim.protocolId).toBe(true);
    expect(claims.some((claim) => claim.protocolId === 'oxygen-energy-saving')).toBe(false);
  });

  it('reads the current value of every facility from authoritative state', () => {
    const engine = new SimulationEngine();
    const built = capabilities(engine);
    const reactor = built.facilities.find((facility) => facility.id === 'reactor-01');
    expect(reactor?.currentActionValues?.['set-mode']).toBe('normal');
    expect(reactor?.currentActionValues?.['set-operating-state']).toBe('online');
    expect(reactor?.currentActionValues?.['set-condition']).toBe(100);
    // Modu olmayan tesiste mod anahtarı hiç yazılmaz — "zaten bu değerde" uyarısı üretilemez.
    expect(built.facilities.find((facility) => facility.id === 'battery-01')?.currentActionValues?.['set-mode']).toBeUndefined();
  });

  it('warns when an action sets a facility to the value it already has (§53.3)', () => {
    const engine = new SimulationEngine();
    const definition: ProtocolDefinition = {
      edges: [{ from: { nodeId: 't1', port: 'out' }, id: 'e1', to: { nodeId: 'a1', port: 'in' } }],
      id: 'already-normal',
      lifecycle: 'draft',
      name: 'Zaten normal',
      nodes: [
        { facilityId: 'mine-01', id: 't1', kind: 'trigger', operator: '<', sensorId: 'facility-condition', threshold: 50 },
        { actionId: 'set-mode', facilityId: 'mine-01', id: 'a1', kind: 'action', value: 'normal' },
      ],
      priority: 'normal',
      version: 1,
    };
    const report = validateProtocol(definition, capabilities(engine));
    expect(report.valid).toBe(true);
    expect(report.findings.map((finding) => finding.code)).toContain('protocol.warning.action-value-unchanged');
  });

  it('builds an identical capability set twice (deterministic)', () => {
    expect(capabilities()).toEqual(capabilities());
  });

  it('resolves measurements from the authoritative snapshot only', () => {
    const engine = new SimulationEngine();
    const read = createProtocolSensorReader(() => engine.getSnapshot());
    expect(read('facility-condition', 'mine-01')).toBe(100);
    // Koloni geneli kondisyon diye bir ölçü uydurulmaz.
    expect(read('facility-condition', undefined)).toBeUndefined();
    expect(read('bilinmeyen-olcum', 'mine-01')).toBeUndefined();

    const energy = engine.getSnapshot().resources.energy;
    expect(read('energy-level', undefined)).toBeCloseTo((energy.stored / energy.capacity) * 100, 10);
  });

  it('returns nothing before the engine exists', () => {
    expect(createProtocolSensorReader(() => undefined)('energy-level', undefined)).toBeUndefined();
  });
});
