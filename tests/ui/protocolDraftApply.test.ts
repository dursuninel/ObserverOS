import { describe, expect, it } from 'vitest';

import { STARTER_PROTOCOLS } from '../../src/game/content/protocols/starterProtocols';
import type {
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolNode,
  ProtocolValidationReport,
} from '../../src/game/domain/protocol/Protocol';
import { PHASE_FIVE_PROTOCOL_LIMITS, PHASE_THREE_BASELINE_CONFIG } from '../../src/game/simulation/SimulationConfig';
import { buildProtocolCapabilities } from '../../src/game/simulation/protocol/protocolCapabilityBridge';
import { validateProtocol } from '../../src/game/simulation/protocol/protocolValidator';
import {
  appliedProtocol,
  checkProtocolDraft,
  compileActiveProtocols,
  createProtocolDraft,
  edgeFindingSeverity,
  editProtocolDraft,
  nodeFindingSeverity,
  orderedFindings,
  protocolApplyBlock,
  protocolFindingCounts,
  savedDraftProtocol,
} from '../../src/game/ui/protocols/protocolDraftModel';
import {
  addProtocolNode,
  connectProtocolNodes,
  createEditorNode,
  updateProtocolNode,
} from '../../src/game/ui/protocols/graph/protocolEditorModel';
import {
  createProtocolDraftDefinition,
  nextProtocolId,
} from '../../src/game/ui/protocols/protocolManagerModel';
import {
  applyProtocolNodeField,
  protocolNodeFields,
} from '../../src/game/ui/protocols/graph/protocolNodeFields';
import { i18n } from '../../src/localization/i18n';

/**
 * Faz 6/3 — taslak/uygulama akışı ve düğüm ayarları, başsız (§14.2 satır 1058-1060).
 *
 * Buradaki iddia şudur: oyuncunun arayüzden yaptığı her adımın saf bir model karşılığı
 * vardır; bileşen yalnız bu modeli çizer. Ekrandaki akış (Kontrol Et → hatayı gör →
 * düzelt → Uygula) bu testte birebir aynı fonksiyonlarla sürülür.
 */

const t = (key: string, params?: Readonly<Record<string, string | number>>): string => i18n.t(key, params ?? {});

const CAPABILITIES: ProtocolCapabilities = buildProtocolCapabilities({
  definitions: PHASE_THREE_BASELINE_CONFIG.facilities,
  limits: PHASE_FIVE_PROTOCOL_LIMITS,
  protocols: STARTER_PROTOCOLS,
});

function nodeOf(definition: ProtocolDefinition, nodeId: string): ProtocolNode {
  const node = definition.nodes.find((entry) => entry.id === nodeId);
  if (node === undefined) throw new Error(`Test fixture is missing node ${nodeId}.`);
  return node;
}

function emptyDefinition(): ProtocolDefinition {
  return { edges: [], id: 'yeni-protokol', lifecycle: 'draft', name: 'Yeni Protokol', nodes: [], priority: 'normal', version: 1 };
}

function reportOf(findings: ProtocolValidationReport['findings']): ProtocolValidationReport {
  return { findings, valid: findings.every((finding) => finding.severity !== 'error') };
}

describe('protocol draft/apply flow', () => {
  it('blocks apply until the draft has been checked', () => {
    const draft = createProtocolDraft(STARTER_PROTOCOLS[0] as ProtocolDefinition);
    expect(protocolApplyBlock(draft)).toBe('unchecked');
    expect(protocolApplyBlock(checkProtocolDraft(draft, CAPABILITIES))).toBeUndefined();
  });

  it('runs exactly the Phase 5 validator and nothing more', () => {
    const definition = STARTER_PROTOCOLS[2] as ProtocolDefinition;
    const checked = checkProtocolDraft(createProtocolDraft(definition), CAPABILITIES);
    expect(checked.report).toEqual(validateProtocol(definition, CAPABILITIES));
    // Statik doğrulama tanımı değiştirmez ve gelecek sonucu çözmez.
    expect(checked.definition).toBe(definition);
  });

  it('stales the result as soon as the graph changes again', () => {
    const checked = checkProtocolDraft(createProtocolDraft(emptyDefinition()), CAPABILITIES);
    expect(checked.report).toBeDefined();
    const edited = editProtocolDraft(checked, addProtocolNode(checked.definition, createEditorNode('and', 'and-1', PHASE_FIVE_PROTOCOL_LIMITS)));
    expect(edited.report).toBeUndefined();
    expect(edited.dirty).toBe(true);
    expect(protocolApplyBlock(edited)).toBe('unchecked');
  });

  it('keeps apply closed while an error stands and open when only warnings remain', () => {
    const broken = checkProtocolDraft(createProtocolDraft(emptyDefinition()), CAPABILITIES);
    expect(protocolApplyBlock(broken)).toBe('invalid');
    expect(protocolFindingCounts(broken.report).errors).toBeGreaterThan(0);

    const longDelay: ProtocolDefinition = {
      edges: [
        { from: { nodeId: 't1', port: 'out' }, id: 'e1', to: { nodeId: 'd1', port: 'in' } },
        { from: { nodeId: 'd1', port: 'out' }, id: 'e2', to: { nodeId: 'a1', port: 'in' } },
      ],
      id: 'uzun-bekleme',
      lifecycle: 'draft',
      name: 'Uzun Bekleme',
      nodes: [
        { facilityId: 'mine-01', id: 't1', kind: 'trigger', operator: '<', sensorId: 'facility-condition', threshold: 40 },
        { durationMinutes: PHASE_FIVE_PROTOCOL_LIMITS.longDelayMinutes + 60, id: 'd1', kind: 'delay' },
        { actionId: 'set-mode', facilityId: 'mine-01', id: 'a1', kind: 'action', value: 'eco' },
      ],
      priority: 'normal',
      version: 1,
    };
    const warned = checkProtocolDraft(createProtocolDraft(longDelay), CAPABILITIES);
    expect(protocolFindingCounts(warned.report)).toEqual({ errors: 0, warnings: 1 });
    // §53.3: uyarı uygulamayı ENGELLEMEZ.
    expect(protocolApplyBlock(warned)).toBeUndefined();
  });

  it('separates error and warning anchors, error winning on a shared node', () => {
    const report = reportOf([
      { code: 'protocol.warning.long-delay', nodeId: 'd1', severity: 'warning' },
      { code: 'protocol.error.delay-duration-out-of-range', nodeId: 'd1', severity: 'error' },
      { code: 'protocol.error.edge-port-incompatible', edgeId: 'e9', severity: 'error' },
    ]);
    expect(nodeFindingSeverity(report, 'd1')).toBe('error');
    expect(nodeFindingSeverity(report, 'baska')).toBeUndefined();
    expect(edgeFindingSeverity(report, 'e9')).toBe('error');
    expect(nodeFindingSeverity(undefined, 'd1')).toBeUndefined();
  });

  it('lists protocol-wide errors before anchored findings and warnings', () => {
    const ordered = orderedFindings(reportOf([
      { code: 'protocol.warning.long-delay', nodeId: 'd1', severity: 'warning' },
      { code: 'protocol.error.and-input-missing', nodeId: 'and-1', severity: 'error' },
      { code: 'protocol.error.trigger-missing', severity: 'error' },
    ]));
    expect(ordered.map((finding) => finding.code)).toEqual([
      'protocol.error.trigger-missing',
      'protocol.error.and-input-missing',
      'protocol.warning.long-delay',
    ]);
  });

  it('promotes an applied protocol and bumps its version, a saved draft neither', () => {
    const definition = emptyDefinition();
    expect(appliedProtocol(definition)).toEqual({ ...definition, lifecycle: 'active', version: 2 });
    expect(savedDraftProtocol(definition)).toEqual(definition);
    // Yayındaki bir protokolün taslak kaydı onu yayından DÜŞÜRMEZ.
    expect(savedDraftProtocol({ ...definition, lifecycle: 'active' }).lifecycle).toBe('active');
  });

  it('compiles only active protocols into the running set', () => {
    const library = compileActiveProtocols(STARTER_PROTOCOLS, CAPABILITIES);
    const activeIds = STARTER_PROTOCOLS.filter((protocol) => protocol.lifecycle === 'active').map((protocol) => protocol.id);
    expect(library.programs.map((program) => program.id).sort()).toEqual([...activeIds].sort());
    expect(library.rejectedIds).toEqual([]);
  });

  it('refuses to run a protocol that cannot compile', () => {
    const broken: ProtocolDefinition = { ...emptyDefinition(), id: 'bos-aktif', lifecycle: 'active' };
    const library = compileActiveProtocols([broken], CAPABILITIES);
    expect(library.programs).toEqual([]);
    expect(library.rejectedIds).toEqual(['bos-aktif']);
  });
});

describe('protocol node settings fields', () => {
  it('shows no invented field on a node that has none', () => {
    expect(protocolNodeFields(createEditorNode('and', 'and-1', PHASE_FIVE_PROTOCOL_LIMITS), CAPABILITIES, t)).toEqual([]);
  });

  it('derives trigger fields from the data model and capability lists', () => {
    const fields = protocolNodeFields(createEditorNode('trigger', 'trigger-1', PHASE_FIVE_PROTOCOL_LIMITS), CAPABILITIES, t);
    expect(fields.map((field) => field.id)).toEqual(['facilityId', 'sensorId', 'operator', 'threshold']);
    const measurement = fields.find((field) => field.id === 'sensorId');
    expect(measurement?.required).toBe(true);
    expect(measurement?.options?.map((choice) => choice.value)).toEqual(['', 'energy-level', 'facility-condition']);
    // Teknik kimlik ekrana çıkmaz: her seçenek sözlükten geçmiş metin taşır.
    expect(measurement?.options?.map((choice) => choice.label)).not.toContain('facility-condition');
  });

  it('narrows the facility list to the ones that carry the chosen measurement', () => {
    const node = applyProtocolNodeField(createEditorNode('trigger', 'trigger-1', PHASE_FIVE_PROTOCOL_LIMITS), 'sensorId', 'facility-condition', CAPABILITIES);
    const facilities = protocolNodeFields(node, CAPABILITIES, t).find((field) => field.id === 'facilityId');
    expect(facilities?.required).toBe(false);
    expect(facilities?.options?.[0]?.value).toBe('');
    expect(facilities?.options?.some((choice) => choice.value === 'reactor-01')).toBe(true);
  });

  it('offers the operating mode setting only for a facility that has modes', () => {
    const action = createEditorNode('action', 'action-1', PHASE_FIVE_PROTOCOL_LIMITS);
    const onBattery = applyProtocolNodeField(action, 'facilityId', 'battery-01', CAPABILITIES);
    const settings = protocolNodeFields(onBattery, CAPABILITIES, t).find((field) => field.id === 'actionId');
    expect(settings?.options?.some((choice) => choice.value === 'set-mode')).toBe(false);
    const onMine = applyProtocolNodeField(action, 'facilityId', 'mine-01', CAPABILITIES);
    expect(protocolNodeFields(onMine, CAPABILITIES, t).find((field) => field.id === 'actionId')?.options?.some((choice) => choice.value === 'set-mode')).toBe(true);
  });

  it('draws the value field only once the setting declares it, then from allowedValues', () => {
    const action = createEditorNode('action', 'action-1', PHASE_FIVE_PROTOCOL_LIMITS);
    expect(protocolNodeFields(action, CAPABILITIES, t).map((field) => field.id)).toEqual(['facilityId', 'actionId']);
    const withSetting = applyProtocolNodeField(action, 'actionId', 'set-mode', CAPABILITIES);
    const value = protocolNodeFields(withSetting, CAPABILITIES, t).find((field) => field.id === 'value');
    expect(value?.control).toBe('select');
    expect(value?.options?.map((choice) => choice.value)).toEqual(['', 'eco', 'normal', 'boost']);
  });

  it('clears a value that the newly chosen setting would not accept', () => {
    const node = applyProtocolNodeField(
      applyProtocolNodeField(createEditorNode('action', 'action-1', PHASE_FIVE_PROTOCOL_LIMITS), 'actionId', 'set-mode', CAPABILITIES),
      'value',
      'eco',
      CAPABILITIES,
    );
    expect(node).toMatchObject({ actionId: 'set-mode', value: 'eco' });
    const switched = applyProtocolNodeField(node, 'actionId', 'set-work-priority', CAPABILITIES);
    expect('value' in switched).toBe(false);
  });

  it('removes an optional facility instead of writing an empty id', () => {
    const chosen = applyProtocolNodeField(createEditorNode('sensor', 'sensor-1', PHASE_FIVE_PROTOCOL_LIMITS), 'facilityId', 'mine-01', CAPABILITIES);
    expect(chosen).toMatchObject({ facilityId: 'mine-01' });
    expect('facilityId' in applyProtocolNodeField(chosen, 'facilityId', '', CAPABILITIES)).toBe(false);
  });

  it('parses numbers and refuses to store an unreadable one', () => {
    const delay = createEditorNode('delay', 'delay-1', PHASE_FIVE_PROTOCOL_LIMITS);
    expect(applyProtocolNodeField(delay, 'durationMinutes', '45', CAPABILITIES)).toMatchObject({ durationMinutes: 45 });
    expect(applyProtocolNodeField(delay, 'durationMinutes', 'abc', CAPABILITIES)).toMatchObject({ durationMinutes: PHASE_FIVE_PROTOCOL_LIMITS.delayMinimumMinutes });
  });

  it('drops the second value connection when the comparison switches to a constant', () => {
    const withCompare = addProtocolNode(
      addProtocolNode(emptyDefinition(), createEditorNode('sensor', 'sensor-1', PHASE_FIVE_PROTOCOL_LIMITS)),
      applyProtocolNodeField(createEditorNode('compare', 'compare-1', PHASE_FIVE_PROTOCOL_LIMITS), 'compareMode', 'measurement', CAPABILITIES),
    );
    const connected = connectProtocolNodes(withCompare, { from: { nodeId: 'sensor-1', port: 'value' }, to: { nodeId: 'compare-1', port: 'right' } }, CAPABILITIES);
    expect(connected.verdict.allowed).toBe(true);
    expect(connected.definition.edges).toHaveLength(1);

    const constant = applyProtocolNodeField(nodeOf(connected.definition, 'compare-1'), 'compareMode', 'constant', CAPABILITIES);
    const updated = updateProtocolNode(connected.definition, constant);
    // "İkinci değer" girişi artık yok; ona bağlı kenar da düşer, yetim kenar kalmaz.
    expect(updated.edges).toEqual([]);
  });
});

describe('creating a protocol from the manager', () => {
  it('claims the first free id and never collides with the library', () => {
    expect(nextProtocolId([])).toBe('protokol-1');
    const first = createProtocolDraftDefinition(nextProtocolId(STARTER_PROTOCOLS), 'Adsız');
    expect(first.id).toBe('protokol-1');
    expect(nextProtocolId([...STARTER_PROTOCOLS, first])).toBe('protokol-2');
  });

  it('is born as an empty draft with no invented content', () => {
    const created = createProtocolDraftDefinition('protokol-1', 'Adsız');
    expect(created).toEqual({ edges: [], id: 'protokol-1', lifecycle: 'draft', name: 'Adsız', nodes: [], priority: 'normal', version: 1 });
    // Yeni protokol kendiliğinden uygulanamaz: önce doğrulanır, doğrulama da hata verir.
    const draft = checkProtocolDraft(createProtocolDraft(created), CAPABILITIES);
    expect(protocolApplyBlock(draft)).toBe('invalid');
  });
});

describe('editor flow without writing code (§14.2 exit rehearsal)', () => {
  it('walks empty graph → check → fix → check → apply', () => {
    // 1. Boş protokol: Kontrol Et başlangıç tetikleyicisinin eksik olduğunu söyler.
    let draft = checkProtocolDraft(createProtocolDraft(emptyDefinition()), CAPABILITIES);
    expect(orderedFindings(draft.report).map((finding) => finding.code)).toContain('protocol.error.trigger-missing');
    expect(protocolApplyBlock(draft)).toBe('invalid');

    // 2. Paletten iki düğüm: ölçüm ve eylem henüz seçilmediği için hâlâ geçersiz.
    let definition = addProtocolNode(draft.definition, createEditorNode('trigger', 'trigger-1', PHASE_FIVE_PROTOCOL_LIMITS));
    definition = addProtocolNode(definition, createEditorNode('action', 'action-1', PHASE_FIVE_PROTOCOL_LIMITS));
    const connected = connectProtocolNodes(definition, { from: { nodeId: 'trigger-1', port: 'out' }, to: { nodeId: 'action-1', port: 'in' } }, CAPABILITIES);
    expect(connected.verdict.allowed).toBe(true);
    draft = checkProtocolDraft(editProtocolDraft(draft, connected.definition), CAPABILITIES);
    expect(orderedFindings(draft.report).map((finding) => finding.code)).toContain('protocol.error.capability-unavailable');

    // 3. Sağ panelden alanlar doldurulur — kod yazılmaz, yalnız alan değerleri değişir.
    let trigger: ProtocolNode = nodeOf(draft.definition, 'trigger-1');
    trigger = applyProtocolNodeField(trigger, 'facilityId', 'mine-01', CAPABILITIES);
    trigger = applyProtocolNodeField(trigger, 'sensorId', 'facility-condition', CAPABILITIES);
    trigger = applyProtocolNodeField(trigger, 'threshold', '99.9', CAPABILITIES);
    let action: ProtocolNode = nodeOf(draft.definition, 'action-1');
    action = applyProtocolNodeField(action, 'facilityId', 'mine-01', CAPABILITIES);
    action = applyProtocolNodeField(action, 'actionId', 'set-mode', CAPABILITIES);
    action = applyProtocolNodeField(action, 'value', 'eco', CAPABILITIES);

    draft = editProtocolDraft(draft, updateProtocolNode(updateProtocolNode(draft.definition, trigger), action));
    expect(protocolApplyBlock(draft)).toBe('unchecked');

    // 4. Kontrol Et temiz → Uygula açılır → protokol yayına girer ve derlenir.
    draft = checkProtocolDraft(draft, CAPABILITIES);
    expect(draft.report?.findings).toEqual([]);
    expect(protocolApplyBlock(draft)).toBeUndefined();

    const applied = appliedProtocol(draft.definition);
    expect(applied.lifecycle).toBe('active');
    expect(compileActiveProtocols([applied], CAPABILITIES).programs).toHaveLength(1);
  });
});
