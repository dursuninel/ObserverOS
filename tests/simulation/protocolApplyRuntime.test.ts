import { describe, expect, it } from 'vitest';

import type { ProtocolDefinition } from '../../src/game/domain/protocol/Protocol';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import { PHASE_FIVE_PROTOCOL_LIMITS, PHASE_THREE_BASELINE_CONFIG } from '../../src/game/simulation/SimulationConfig';
import {
  buildProtocolCapabilities,
  createProtocolSensorReader,
} from '../../src/game/simulation/protocol/protocolCapabilityBridge';
import { compileActiveProtocols } from '../../src/game/ui/protocols/protocolDraftModel';

/**
 * `Uygula` akışının motor ucu (spec §14.2 satır 1060, Faz 6 çıkışı satır 3237).
 *
 * Düzenleyicinin kullandığı yolun AYNISI sürülür: capability köprüsü → derleme →
 * `setProtocolPrograms`. Böylece "ekranda çalışıyor gibi görünüyor ama motora
 * bağlanmamış" durumu testle imkânsızlaşır.
 */

function protocolWatchingMine(mode: 'boost' | 'eco'): ProtocolDefinition {
  return {
    edges: [{ from: { nodeId: 't1', port: 'out' }, id: 'e1', to: { nodeId: 'a1', port: 'in' } }],
    id: 'maden-kondisyon',
    lifecycle: 'active',
    name: 'Maden Kondisyon',
    nodes: [
      { facilityId: 'mine-01', id: 't1', kind: 'trigger', operator: '<', sensorId: 'facility-condition', threshold: 99.9 },
      { actionId: 'set-mode', facilityId: 'mine-01', id: 'a1', kind: 'action', value: mode },
    ],
    priority: 'high',
    version: 1,
  };
}

function engineWithSensors(): SimulationEngine {
  const host: { created?: SimulationEngine } = {};
  const readSensor = createProtocolSensorReader(() => host.created?.getSnapshot());
  host.created = new SimulationEngine({ config: PHASE_THREE_BASELINE_CONFIG, protocols: { protocols: [], readSensor } });
  return host.created;
}

function programsFor(engine: SimulationEngine, protocols: readonly ProtocolDefinition[]) {
  const capabilities = buildProtocolCapabilities({
    definitions: PHASE_THREE_BASELINE_CONFIG.facilities,
    limits: PHASE_FIVE_PROTOCOL_LIMITS,
    protocols,
    states: engine.getSnapshot().facilities,
  });
  const library = compileActiveProtocols(protocols, capabilities);
  expect(library.rejectedIds).toEqual([]);
  return library.programs;
}

function modeOf(engine: SimulationEngine): string | null {
  return engine.getSnapshot().facilities.find((facility) => facility.id === 'mine-01')?.mode ?? null;
}

describe('applying a protocol into the running simulation', () => {
  it('starts running a protocol that was applied mid-run', () => {
    const engine = engineWithSensors();
    engine.advanceFixedSteps(10);
    expect(engine.getProtocolPrograms()).toEqual([]);
    expect(modeOf(engine)).toBe('normal');

    engine.setProtocolPrograms(programsFor(engine, [protocolWatchingMine('eco')]));
    expect(engine.getProtocolPrograms()).toHaveLength(1);

    engine.advanceFixedSteps(20);
    // Kondisyon 0,25/sa. aşınmayla 25. dakikada eşiğin altına iner ve komut uygulanır.
    expect(engine.getSnapshot().time.elapsedMinutes).toBe(30);
    expect(modeOf(engine)).toBe('eco');
    expect(engine.getProtocolCommandOutcomes().length + engine.getProtocolExecutionTraces().length).toBeGreaterThan(0);
  });

  it('does not pause or resume the simulation when programs change (satır 1060)', () => {
    const engine = engineWithSensors();
    engine.advanceFixedSteps(5);
    const before = engine.getSnapshot();

    engine.setProtocolPrograms(programsFor(engine, [protocolWatchingMine('eco')]));

    const after = engine.getSnapshot();
    expect(after.clock.paused).toBe(before.clock.paused);
    expect(after.clock.speed).toBe(before.clock.speed);
    expect(after.time.elapsedMinutes).toBe(before.time.elapsedMinutes);
    // Uygulama zamanı ilerletmez de: tek başına hiçbir tick üretmez.
    expect(after.revision).toBe(before.revision);

    engine.advanceFixedSteps(1);
    expect(engine.getSnapshot().time.elapsedMinutes).toBe(before.time.elapsedMinutes + 1);
  });

  it('leaves a paused simulation paused', () => {
    const engine = engineWithSensors();
    engine.setSpeed(0);
    engine.setProtocolPrograms(programsFor(engine, [protocolWatchingMine('eco')]));
    expect(engine.getSnapshot().clock.paused).toBe(true);
    expect(engine.advanceWallTime(60_000)).toBe(0);
    expect(engine.getSnapshot().time.elapsedMinutes).toBe(0);
  });

  it('stops running a protocol that was removed from the applied set', () => {
    const engine = engineWithSensors();
    engine.setProtocolPrograms(programsFor(engine, [protocolWatchingMine('eco')]));
    engine.advanceFixedSteps(20);
    engine.setProtocolPrograms([]);
    engine.advanceFixedSteps(20);
    expect(engine.getProtocolActionRequests()).toEqual([]);
    expect(modeOf(engine)).toBe('normal');
  });

  it('refuses to hold programs on an engine that cannot read measurements', () => {
    const engine = new SimulationEngine();
    expect(engine.canRunProtocols()).toBe(false);
    expect(() => engine.setProtocolPrograms([])).toThrow(/sensor reader/i);
  });

  it('keeps the applied program list frozen against later mutation of the caller array', () => {
    const engine = engineWithSensors();
    const programs = [...programsFor(engine, [protocolWatchingMine('eco')])];
    engine.setProtocolPrograms(programs);
    programs.length = 0;
    expect(engine.getProtocolPrograms()).toHaveLength(1);
  });
});
