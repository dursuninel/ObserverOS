import { describe, expect, it } from 'vitest';

import {
  type FacilityDefinition,
  type FacilityInstanceState,
  type Priority,
  type SafetyInterlock,
} from '../../src/game/domain/facilities/Facility';
import {
  PROTOCOL_COMMAND_REASON_CODES,
  type ProtocolActionRequest,
  type ProtocolCapabilities,
  type ProtocolDefinition,
  type ProtocolEdge,
  type ProtocolNode,
} from '../../src/game/domain/protocol/Protocol';
import { PHASE_FIVE_PROTOCOL_LIMITS, PHASE_THREE_BASELINE_CONFIG } from '../../src/game/simulation/SimulationConfig';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import {
  arbitrateProtocolCommands,
  identityActuatorResolver,
  toProtocolReasonCode,
  type ProtocolActuatorResolver,
  type ProtocolArbitrationPlan,
} from '../../src/game/simulation/protocol/protocolArbitration';
import { compileProtocol, type ExecutableProtocol } from '../../src/game/simulation/protocol/protocolCompiler';
import { applyFacilityCommand, createFacilityState, defaultSafetyInterlock, toReadonlyFacilityState } from '../../src/game/simulation/systems/facilityCommands';
import { i18n } from '../../src/localization/i18n';

const MINE: FacilityDefinition = Object.freeze({
  id: 'mine-01',
  initialCondition: 100,
  initialMode: 'normal',
  initialState: 'online',
  modes: { boost: {}, eco: {}, normal: {} },
  safety: { boostConditionMinimum: 30 },
  typeId: 'mine',
  workforce: { boost: 3, minimum: 1, nominal: 3 },
});

/**
 * §13.10(1): Safety Interlock priority yarışından ÖNCE eler. `createFacilityState`
 * ekibi sahada saymaz (`effectiveWorkforce: 0`), o yüzden her `boost` isteği
 * `facility.workforce-blocks-boost` ile düşer ve priority/conflict senaryosu HİÇ
 * kurulamaz. Varsayılan durum bu yüzden maden ekibini sahada tutar; interlock'u
 * sınayan testler kendi override'ıyla (ör. düşük kondisyon) engeli kurar.
 */
function stateOf(overrides: Partial<FacilityInstanceState> = {}): FacilityInstanceState {
  return Object.freeze({
    ...toReadonlyFacilityState(createFacilityState(MINE)),
    assignedWorkforce: MINE.workforce?.nominal ?? 0,
    effectiveWorkforce: MINE.workforce?.boost ?? 0,
    ...overrides,
  });
}

function requestOf(overrides: Partial<ProtocolActionRequest> = {}): ProtocolActionRequest {
  return Object.freeze({
    actuator: 'set-mode',
    facilityId: 'mine-01',
    priority: 'normal',
    protocolExecutionId: 'protocol-execution-000001',
    protocolId: 'alpha',
    simTime: 10,
    value: 'eco',
    ...overrides,
  });
}

interface ArbitrateOptions {
  readonly interlock?: SafetyInterlock;
  readonly resolveActuator?: ProtocolActuatorResolver;
  readonly state?: FacilityInstanceState;
}

function arbitrate(requests: readonly ProtocolActionRequest[], options: ArbitrateOptions = {}): ProtocolArbitrationPlan {
  return arbitrateProtocolCommands({
    definitions: new Map([['mine-01', MINE]]),
    facilities: new Map([['mine-01', options.state ?? stateOf()]]),
    interlock: options.interlock ?? defaultSafetyInterlock,
    requests,
    resolveActuator: options.resolveActuator ?? identityActuatorResolver,
  });
}

/** Plan'ı sıraya bağımsız, karşılaştırılabilir bir özete indirger. */
function summarize(plan: ProtocolArbitrationPlan): unknown {
  return {
    applied: plan.commands.map((planned) => ({
      actuator: planned.command.actuator,
      executions: planned.requests.map((request) => request.protocolExecutionId).sort(),
      facilityId: planned.command.facilityId,
      value: planned.command.value,
    })),
    conflicts: plan.conflicts.map((conflict) => ({
      actuator: conflict.actuator,
      executions: [...conflict.protocolExecutionIds],
      values: [...conflict.requestedValues],
    })),
    rejected: [...plan.rejections]
      .map((outcome) => ({ execution: outcome.protocolExecutionId, reasonCode: outcome.reasonCode, status: outcome.status }))
      .sort((left, right) => left.execution.localeCompare(right.execution)),
  };
}

describe('protocol arbitration - command conflict order (spec §13.10)', () => {
  it('applies one command when two protocols request the SAME value (compatible, not a conflict)', () => {
    const plan = arbitrate([
      requestOf({ protocolExecutionId: 'protocol-execution-000001', protocolId: 'alpha', value: 'eco' }),
      requestOf({ protocolExecutionId: 'protocol-execution-000002', protocolId: 'beta', value: 'eco' }),
    ]);

    expect(plan.conflicts).toEqual([]);
    expect(plan.rejections).toEqual([]);
    expect(plan.commands).toHaveLength(1);
    expect(plan.commands[0]?.command.value).toBe('eco');
    // İkisi de karşılandı: tek komut iki isteği birden temsil eder (§13.11).
    expect(plan.commands[0]?.requests.map((request) => request.protocolExecutionId))
      .toEqual(['protocol-execution-000001', 'protocol-execution-000002']);
  });

  it('lets the highest protocol priority win and marks the loser superseded', () => {
    const plan = arbitrate([
      requestOf({ priority: 'low', protocolExecutionId: 'protocol-execution-000001', protocolId: 'alpha', value: 'boost' }),
      requestOf({ priority: 'critical', protocolExecutionId: 'protocol-execution-000002', protocolId: 'beta', value: 'eco' }),
    ]);

    expect(plan.conflicts).toEqual([]);
    expect(plan.commands).toHaveLength(1);
    expect(plan.commands[0]?.command.value).toBe('eco');
    expect(plan.rejections).toHaveLength(1);
    expect(plan.rejections[0]).toMatchObject({
      protocolExecutionId: 'protocol-execution-000001',
      reasonCode: 'COMMAND_SUPERSEDED_BY_PRIORITY',
      requestedValue: 'boost',
      status: 'blocked',
    });
  });

  it('applies NOTHING when equal priority protocols request incompatible values', () => {
    const plan = arbitrate([
      requestOf({ priority: 'high', protocolExecutionId: 'protocol-execution-000001', protocolId: 'alpha', value: 'eco' }),
      requestOf({ priority: 'high', protocolExecutionId: 'protocol-execution-000002', protocolId: 'beta', value: 'boost' }),
    ]);

    expect(plan.commands).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      actuator: 'set-mode',
      facilityId: 'mine-01',
      priority: 'high',
      protocolExecutionIds: ['protocol-execution-000001', 'protocol-execution-000002'],
      protocolIds: ['alpha', 'beta'],
      requestedValues: ['boost', 'eco'],
    });
    expect(plan.rejections.map((outcome) => outcome.reasonCode))
      .toEqual(['COMMAND_CONFLICT_EQUAL_PRIORITY', 'COMMAND_CONFLICT_EQUAL_PRIORITY']);
    expect(plan.rejections.every((outcome) => outcome.status === 'blocked')).toBe(true);
  });

  it('treats two executions of the SAME protocol exactly like two protocols (§13.10 does not look at the source)', () => {
    const plan = arbitrate([
      requestOf({ priority: 'normal', protocolExecutionId: 'protocol-execution-000001', protocolId: 'alpha', value: 'eco' }),
      requestOf({ priority: 'normal', protocolExecutionId: 'protocol-execution-000002', protocolId: 'alpha', value: 'boost' }),
    ]);

    expect(plan.commands).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]?.protocolIds).toEqual(['alpha']);
    expect(plan.rejections.map((outcome) => outcome.reasonCode))
      .toEqual(['COMMAND_CONFLICT_EQUAL_PRIORITY', 'COMMAND_CONFLICT_EQUAL_PRIORITY']);
  });

  it('resolves the conflict only among the top priority tier and supersedes the rest', () => {
    const plan = arbitrate([
      requestOf({ priority: 'low', protocolExecutionId: 'protocol-execution-000001', protocolId: 'alpha', value: 'boost' }),
      requestOf({ priority: 'high', protocolExecutionId: 'protocol-execution-000002', protocolId: 'beta', value: 'eco' }),
      requestOf({ priority: 'high', protocolExecutionId: 'protocol-execution-000003', protocolId: 'gamma', value: 'eco' }),
    ]);

    expect(plan.conflicts).toEqual([]);
    expect(plan.commands).toHaveLength(1);
    expect(plan.commands[0]?.requests.map((request) => request.protocolExecutionId))
      .toEqual(['protocol-execution-000002', 'protocol-execution-000003']);
    expect(plan.rejections.map((outcome) => outcome.reasonCode)).toEqual(['COMMAND_SUPERSEDED_BY_PRIORITY']);
  });

  it('keeps different actuators and different setpoint keys in separate conflict groups', () => {
    const setpointResolver: ProtocolActuatorResolver = (request) =>
      request.actuator.startsWith('setpoint:')
        ? { actuator: 'set-setpoint', setpointKey: request.actuator.slice('setpoint:'.length) }
        : identityActuatorResolver(request);

    const plan = arbitrate([
      requestOf({ actuator: 'set-mode', protocolExecutionId: 'protocol-execution-000001', value: 'eco' }),
      requestOf({ actuator: 'set-energy-priority', protocolExecutionId: 'protocol-execution-000002', value: 'high' }),
      requestOf({ actuator: 'setpoint:flow', protocolExecutionId: 'protocol-execution-000003', value: 4 }),
      requestOf({ actuator: 'setpoint:depth', protocolExecutionId: 'protocol-execution-000004', value: 9 }),
    ], { resolveActuator: setpointResolver });

    expect(plan.conflicts).toEqual([]);
    expect(plan.rejections).toEqual([]);
    expect(plan.commands).toHaveLength(4);
    expect(plan.commands.map((planned) => planned.command.value)).toContainEqual({ key: 'depth', value: 9 });
  });

  it('does conflict when two requests hit the SAME setpoint key with different values', () => {
    const setpointResolver: ProtocolActuatorResolver = () => ({ actuator: 'set-setpoint', setpointKey: 'flow' });
    const plan = arbitrate([
      requestOf({ actuator: 'setpoint:flow', protocolExecutionId: 'protocol-execution-000001', value: 4 }),
      requestOf({ actuator: 'setpoint:flow', protocolExecutionId: 'protocol-execution-000002', value: 9 }),
    ], { resolveActuator: setpointResolver });

    expect(plan.commands).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]?.setpointKey).toBe('flow');
    expect(plan.conflicts[0]?.requestedValues).toEqual([4, 9]);
  });
});

describe('protocol arbitration - safety interlock precedence (spec §13.10 step 1)', () => {
  it('blocks a command the safety interlock refuses and reports the mapped reason code', () => {
    const plan = arbitrate(
      [requestOf({ priority: 'critical', value: 'boost' })],
      { state: stateOf({ condition: 10, conditionBand: 'critical' }) },
    );

    expect(plan.commands).toEqual([]);
    expect(plan.rejections).toHaveLength(1);
    expect(plan.rejections[0]).toMatchObject({
      facilityReasonCode: 'facility.condition-blocks-boost',
      reasonCode: 'SAFETY_CONDITION_LIMIT',
      status: 'blocked',
    });
  });

  it('removes the safety-blocked command from the priority contest so a safe lower priority one still applies', () => {
    // §13.10(1) sıra 1'dedir: engellenen KRİTİK komut, güvenli DÜŞÜK komutu bloklamaz.
    const plan = arbitrate([
      requestOf({ priority: 'critical', protocolExecutionId: 'protocol-execution-000001', protocolId: 'alpha', value: 'boost' }),
      requestOf({ priority: 'low', protocolExecutionId: 'protocol-execution-000002', protocolId: 'beta', value: 'eco' }),
    ], { state: stateOf({ condition: 10, conditionBand: 'critical' }) });

    expect(plan.conflicts).toEqual([]);
    expect(plan.commands).toHaveLength(1);
    expect(plan.commands[0]?.command.value).toBe('eco');
    expect(plan.rejections.map((outcome) => outcome.reasonCode)).toEqual(['SAFETY_CONDITION_LIMIT']);
  });

  it('keeps the raw facility reason code when it has no protocol vocabulary entry', () => {
    const strange: SafetyInterlock = { evaluate: () => ({ allowed: false, reasonCode: 'facility.unmapped-future-rule' }) };
    const plan = arbitrate([requestOf()], { interlock: strange });

    expect(plan.rejections[0]?.facilityReasonCode).toBe('facility.unmapped-future-rule');
    expect(plan.rejections[0]?.reasonCode).toBeUndefined();
    expect(plan.rejections[0]?.status).toBe('blocked');
  });
});

describe('protocol arbitration - ramp required is BLOCKED, not delayed (spec §53.7)', () => {
  /**
   * §53.7 `delayed` = "command KABUL EDİLDİ ancak hedef state hemen oluşmadı".
   * Ramp isteyen tesiste mod değişimi bu tanıma girer mi? Cevap ÖLÇÜLDÜ: girmiyor —
   * komut kabul edilmiyor, tesis rampa da girmiyor, state hiç değişmiyor. Bu §53.7'nin
   * `blocked` tanımıdır ("Safety Interlock ... nedeniyle uygulamadı"). Ramp süresi/hedef
   * state alanı gelene kadar `delayed` üretilirse İZ YALAN SÖYLER.
   */
  const REACTOR: FacilityDefinition = Object.freeze({
    id: 'reactor-01',
    initialCondition: 100,
    initialMode: 'normal',
    initialState: 'online',
    modes: { boost: {}, eco: {}, normal: {} },
    safety: { boostConditionMinimum: 30, requiresRampedModeChange: true },
    typeId: 'fusion-reactor',
  });

  it('MEASUREMENT: the facility layer refuses the command and changes NOTHING', () => {
    const state = createFacilityState(REACTOR);
    const before = JSON.stringify(state);
    const result = applyFacilityCommand(
      { actuator: 'set-mode', facilityId: 'reactor-01', id: 'command-1', priority: 'normal', simTime: 10, value: 'eco' },
      state,
      REACTOR,
      defaultSafetyInterlock,
    );

    expect(result).toEqual({ reasonCode: 'facility.ramp-config-required', requestId: 'command-1', status: 'blocked' });
    // Kabul edilseydi mod (ya da bir ramp/hedef alanı) değişirdi; hiçbiri olmadı.
    expect(state.mode).toBe('normal');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('reaches the protocol layer as blocked + SAFETY_RAMP_REQUIRED', () => {
    const plan = arbitrateProtocolCommands({
      definitions: new Map([['reactor-01', REACTOR]]),
      facilities: new Map([['reactor-01', toReadonlyFacilityState(createFacilityState(REACTOR))]]),
      interlock: defaultSafetyInterlock,
      requests: [requestOf({ facilityId: 'reactor-01', value: 'eco' })],
      resolveActuator: identityActuatorResolver,
    });

    expect(plan.commands).toEqual([]);
    expect(plan.rejections).toHaveLength(1);
    expect(plan.rejections[0]).toMatchObject({
      facilityReasonCode: 'facility.ramp-config-required',
      reasonCode: 'SAFETY_RAMP_REQUIRED',
      status: 'blocked',
    });
    // §53.7 dörtlüsünde `delayed` yalnız KABUL EDİLEN komut içindir; bu komut reddedildi.
    expect(plan.rejections[0]?.status).not.toBe('delayed');
    expect(plan.rejections[0]?.appliedValue).toBeUndefined();
  });

  it('applies the same command to a facility WITHOUT the ramp rule (control measurement)', () => {
    // Kontrol ölçümü: engel ramp kuralının kendisidir, mod değeri ya da fixture değil.
    const withoutRamp: FacilityDefinition = { ...REACTOR, safety: { boostConditionMinimum: 30 } };
    const state = createFacilityState(withoutRamp);
    const result = applyFacilityCommand(
      { actuator: 'set-mode', facilityId: 'reactor-01', id: 'command-2', priority: 'normal', simTime: 10, value: 'eco' },
      state,
      withoutRamp,
      defaultSafetyInterlock,
    );

    expect(result).toEqual({ appliedValue: 'eco', requestId: 'command-2', status: 'applied' });
    expect(state.mode).toBe('eco');
  });
});

describe('protocol arbitration - capability resolution and targets', () => {
  it('fails a request whose action capability cannot be resolved to an actuator', () => {
    const plan = arbitrate([requestOf({ actuator: 'launch-the-ship' })]);

    expect(plan.commands).toEqual([]);
    expect(plan.rejections).toHaveLength(1);
    expect(plan.rejections[0]).toMatchObject({ actuator: 'launch-the-ship', reasonCode: 'CAPABILITY_NOT_AVAILABLE', status: 'failed' });
  });

  it('fails a set-setpoint binding that carries no setpoint key', () => {
    const plan = arbitrate([requestOf({ actuator: 'set-setpoint', value: 4 })]);
    expect(plan.rejections.map((outcome) => outcome.reasonCode)).toEqual(['CAPABILITY_NOT_AVAILABLE']);
  });

  it('fails a request that names no facility or an unknown facility', () => {
    const targetless: ProtocolActionRequest = Object.freeze({
      actuator: 'set-mode',
      priority: 'normal',
      protocolExecutionId: 'protocol-execution-000001',
      protocolId: 'alpha',
      simTime: 10,
      value: 'eco',
    });
    const plan = arbitrate([
      targetless,
      requestOf({ facilityId: 'ghost-99', protocolExecutionId: 'protocol-execution-000002' }),
    ]);

    expect(plan.commands).toEqual([]);
    expect(plan.rejections.map((outcome) => outcome.reasonCode)).toEqual(['CAPABILITY_NOT_AVAILABLE', 'TARGET_NOT_FOUND']);
    expect(plan.rejections.every((outcome) => outcome.status === 'failed')).toBe(true);
  });

  it('maps every reason code the current facility layer can produce', () => {
    // Facility katmanının ürettiği ham kodların TAMAMI protokol sözlüğüne çevrilebilmeli;
    // yenisi eklenirse bu test kırmızıya düşer ve tablo güncellenmeye zorlar.
    const produced = [
      'facility.condition-blocks-boost', 'facility.condition-invalid', 'facility.failed',
      'facility.maintenance-active', 'facility.mode-unsupported', 'facility.not-found',
      'facility.priority-invalid', 'facility.ramp-config-required', 'facility.safety-interlocked',
      'facility.setpoint-invalid', 'facility.state-target-unsupported', 'facility.workforce-blocks-boost',
    ];
    for (const code of produced) expect(toProtocolReasonCode(code), code).toBeDefined();

    const mapped = new Set(produced.map((code) => toProtocolReasonCode(code)));
    const arbitrationOwned = ['CAPABILITY_NOT_AVAILABLE', 'COMMAND_CONFLICT_EQUAL_PRIORITY', 'COMMAND_SUPERSEDED_BY_PRIORITY'];
    // Tanımlı her reason code ya tablodan ya arbitration'ın kendisinden gelir; ölü kod yok.
    for (const code of PROTOCOL_COMMAND_REASON_CODES) {
      expect(mapped.has(code) || arbitrationOwned.includes(code), code).toBe(true);
    }
  });
});

describe('protocol arbitration - reason code localization (spec §13.11)', () => {
  it('resolves every command reason code to natural Turkish text outside the engine', () => {
    // §53.8 kodları metin değil KOD taşır; doğal dil localization'da üretilir.
    for (const code of PROTOCOL_COMMAND_REASON_CODES) {
      const key = `protocol.commandReason.${code}`;
      expect(i18n.exists(key, { lng: 'tr' }), key).toBe(true);
      expect(i18n.t(key).length, key).toBeGreaterThan(0);
    }
  });
});

describe('protocol arbitration - request timing (spec §53.6)', () => {
  it('produces the same decision whatever order the requests arrive in', () => {
    const requests = [
      requestOf({ priority: 'high', protocolExecutionId: 'protocol-execution-000001', protocolId: 'alpha', value: 'eco' }),
      requestOf({ priority: 'high', protocolExecutionId: 'protocol-execution-000002', protocolId: 'beta', value: 'boost' }),
      requestOf({ actuator: 'set-energy-priority', priority: 'low', protocolExecutionId: 'protocol-execution-000003', protocolId: 'gamma', value: 'high' }),
      requestOf({ actuator: 'set-energy-priority', priority: 'critical', protocolExecutionId: 'protocol-execution-000004', protocolId: 'delta', value: 'low' }),
    ];

    const forward = summarize(arbitrate(requests));
    const reversed = summarize(arbitrate([...requests].reverse()));
    const shuffled = summarize(arbitrate([requests[2], requests[0], requests[3], requests[1]].filter((request): request is ProtocolActionRequest => request !== undefined)));

    expect(reversed).toEqual(forward);
    expect(shuffled).toEqual(forward);
    // "İlk çalışan kazanır" olsaydı set-mode grubunda sıraya göre farklı kazanan çıkardı.
    expect(forward).toMatchObject({ conflicts: [{ actuator: 'set-mode', values: ['boost', 'eco'] }] });
  });
});

describe('protocol arbitration - SimulationEngine integration', () => {
  function capabilities(): ProtocolCapabilities {
    return {
      actions: [{ allowedValues: ['eco', 'normal', 'boost'], id: 'set-mode', requiresTarget: true, requiresValue: true, valueType: 'enum:facility-mode' }],
      facilities: [{ actionIds: ['set-mode'], id: 'mine-01', sensorIds: ['facility-condition'] }],
      limits: PHASE_FIVE_PROTOCOL_LIMITS,
      sensors: [{ id: 'facility-condition', valueType: 'number' }],
    };
  }

  /**
   * Tetikleme eşikleri kondisyon aşınmasına (maden: saatte 0.25) bağlıdır.
   * Baseline kolonide maden ekibi habitat'tan yürür ve 34. dakikada sahaya varır;
   * o ana kadar `effectiveWorkforce` 0'dır ve §13.10(1) safety interlock her
   * `boost` komutunu priority yarışına GİRMEDEN `facility.workforce-blocks-boost`
   * ile eler. `boost` içeren senaryolar bu yüzden ekip sahadayken tetiklenmeli:
   * 99.75 eşiği 61. dakikada geçilir (ekip 34–75 arası sahada).
   *
   * Adım sayısı tam tetikleme tick'idir: `getProtocolActionRequests()` /
   * `getProtocolCommandOutcomes()` yalnız SON fixed step'in verisini döner.
   */
  const EARLY_TRIGGER_CONDITION = 99.9;
  const CREW_ON_SITE_TRIGGER_CONDITION = 99.75;
  const CREW_ON_SITE_STEPS = 61;

  /** Maden aşınmasıyla kondisyon düştüğünde tek bir mod komutu üreten protokol. */
  function modeProtocol(id: string, priority: Priority, value: string, threshold = EARLY_TRIGGER_CONDITION): ExecutableProtocol {
    const nodes: readonly ProtocolNode[] = [
      { facilityId: 'mine-01', id: 't1', kind: 'trigger', operator: '<', sensorId: 'facility-condition', threshold },
      { actionId: 'set-mode', facilityId: 'mine-01', id: 'a1', kind: 'action', value },
    ];
    const edges: readonly ProtocolEdge[] = [{ from: { nodeId: 't1', port: 'out' }, id: 'e1', to: { nodeId: 'a1', port: 'in' } }];
    const definition: ProtocolDefinition = { edges, id, lifecycle: 'active', name: id, nodes, priority, version: 1 };
    const result = compileProtocol(definition, capabilities());
    if (result.status !== 'compiled') throw new Error(`fixture must compile: ${JSON.stringify(result.report.findings)}`);
    return result.protocol;
  }

  function engineWith(
    protocols: readonly ExecutableProtocol[],
    serialized?: string,
    resolveActuator?: ProtocolActuatorResolver,
  ): SimulationEngine {
    const readSensor = (sensorId: string, facilityId: string | undefined): number | undefined => {
      if (sensorId !== 'facility-condition' || facilityId === undefined) return undefined;
      return engine.getSnapshot().facilities.find((facility) => facility.id === facilityId)?.condition;
    };
    const options = {
      config: PHASE_THREE_BASELINE_CONFIG,
      protocols: { protocols, readSensor, ...(resolveActuator === undefined ? {} : { resolveActuator }) },
    };
    const engine = serialized === undefined ? new SimulationEngine(options) : SimulationEngine.fromSerializedState(serialized, options);
    return engine;
  }

  function modeOf(engine: SimulationEngine): string | null {
    return engine.getSnapshot().facilities.find((facility) => facility.id === 'mine-01')?.mode ?? null;
  }

  it('persists the applied mode and never reverts it on its own (spec §13.4)', () => {
    const engine = engineWith([modeProtocol('watch', 'normal', 'eco')]);
    engine.advanceFixedSteps(25);

    const outcomes = engine.getProtocolCommandOutcomes();
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({ actuator: 'set-mode', appliedValue: 'eco', facilityId: 'mine-01', requestedValue: 'eco', status: 'applied' });
    expect(modeOf(engine)).toBe('eco');

    // Sonraki 100 tick'te başka komut yok: değer kalıcıdır, eski değere DÖNMEZ.
    engine.advanceFixedSteps(100);
    expect(modeOf(engine)).toBe('eco');
    expect(engine.getProtocolCommandOutcomes()).toEqual([]);
  });

  it('applies nothing and records a CONFLICT event when two equal priority protocols disagree', () => {
    const engine = engineWith([
      modeProtocol('alpha', 'high', 'eco', CREW_ON_SITE_TRIGGER_CONDITION),
      modeProtocol('beta', 'high', 'boost', CREW_ON_SITE_TRIGGER_CONDITION),
    ]);
    engine.advanceFixedSteps(CREW_ON_SITE_STEPS);

    expect(engine.getProtocolActionRequests()).toHaveLength(2);
    // §13.10(3): mevcut state DEĞİŞMEZ.
    expect(modeOf(engine)).toBe('normal');
    expect(engine.getProtocolCommandOutcomes().map((outcome) => outcome.reasonCode))
      .toEqual(['COMMAND_CONFLICT_EQUAL_PRIORITY', 'COMMAND_CONFLICT_EQUAL_PRIORITY']);

    const conflicts = engine.getEvents().filter((event) => event.eventType === 'protocol.command-conflict');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ category: 'protocol', facilityId: 'mine-01', reasonCode: 'COMMAND_CONFLICT_EQUAL_PRIORITY', severity: 'warning' });
    expect(conflicts[0]?.payload).toMatchObject({ actuator: 'set-mode', priority: 'high', protocolIds: ['alpha', 'beta'], requestedValues: ['boost', 'eco'] });
  });

  it('lets the higher priority protocol win over a lower one in the same tick', () => {
    const engine = engineWith([
      modeProtocol('alpha', 'low', 'boost', CREW_ON_SITE_TRIGGER_CONDITION),
      modeProtocol('beta', 'critical', 'eco', CREW_ON_SITE_TRIGGER_CONDITION),
    ]);
    engine.advanceFixedSteps(CREW_ON_SITE_STEPS);

    expect(modeOf(engine)).toBe('eco');
    const outcomes = engine.getProtocolCommandOutcomes();
    expect(outcomes.map((outcome) => [outcome.protocolId, outcome.status, outcome.reasonCode]))
      .toEqual([['alpha', 'blocked', 'COMMAND_SUPERSEDED_BY_PRIORITY'], ['beta', 'applied', undefined]]);
    expect(engine.getEvents().filter((event) => event.eventType === 'protocol.command-conflict')).toEqual([]);
  });

  it('emits exactly one command-result event per action request (spec §13.11)', () => {
    const engine = engineWith([
      modeProtocol('alpha', 'high', 'eco', CREW_ON_SITE_TRIGGER_CONDITION),
      modeProtocol('beta', 'high', 'boost', CREW_ON_SITE_TRIGGER_CONDITION),
    ]);
    engine.advanceFixedSteps(CREW_ON_SITE_STEPS);

    const results = engine.getEvents().filter((event) => event.eventType === 'protocol.command-result');
    expect(results).toHaveLength(2);
    expect(results.map((event) => event.sourceEntityId)).toEqual(['protocol-execution-000001', 'protocol-execution-000002']);
    expect(results.every((event) => event.category === 'protocol')).toBe(true);
  });

  it('stays deterministic and identical across serialize/restore', () => {
    const contest = (): readonly ExecutableProtocol[] => [
      modeProtocol('alpha', 'low', 'boost', CREW_ON_SITE_TRIGGER_CONDITION),
      modeProtocol('beta', 'critical', 'eco', CREW_ON_SITE_TRIGGER_CONDITION),
    ];
    const straight = engineWith(contest());
    straight.advanceFixedSteps(CREW_ON_SITE_STEPS);

    // Kesinti tetiklemeden ÖNCE olur: arbitration restore edilmiş engine'de çalışır.
    const interrupted = engineWith(contest());
    interrupted.advanceFixedSteps(55);
    const restored = engineWith(contest(), interrupted.serializeAuthoritativeState());
    restored.advanceFixedSteps(CREW_ON_SITE_STEPS - 55);

    expect(modeOf(restored)).toBe('eco');
    expect(restored.serializeAuthoritativeState()).toBe(straight.serializeAuthoritativeState());
  });

  it('fails the request when the action capability resolves to no facility actuator', () => {
    // Kimlik eşlemesi yalnız gerçek actuator'leri çözer; kanonik action kataloğu yoktur.
    const engine = engineWith([modeProtocol('watch', 'normal', 'eco')], undefined, () => undefined);
    engine.advanceFixedSteps(25);

    expect(engine.getProtocolActionRequests()).toHaveLength(1);
    expect(engine.getProtocolCommandOutcomes()).toHaveLength(1);
    expect(engine.getProtocolCommandOutcomes()[0]).toMatchObject({ reasonCode: 'CAPABILITY_NOT_AVAILABLE', status: 'failed' });
    expect(modeOf(engine)).toBe('normal');
  });
});
