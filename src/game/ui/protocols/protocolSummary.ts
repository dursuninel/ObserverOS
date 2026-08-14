import type {
  CompareOperator,
  ProtocolDefinition,
  ProtocolLiteral,
  ProtocolNode,
} from '../../domain/protocol/Protocol';

/**
 * Kart üzerindeki "otomatik kısa özet" (spec §14.1).
 *
 * Özet metin olarak saklanmaz: her seferinde protokol GRAPH'ından türetilir, böylece
 * düzenleyicide yapılan her değişiklik özete birebir yansır. Türkçe cümle parçaları
 * koda gömülmez; yalnız localization anahtarı + parametre üretilir (AGENTS.md).
 *
 * Oyuncuya Boolean/execution pulse jargonu gösterilmez (§72.6): koşullar "…ise",
 * tetikleyici "…olduğunda", eylem "…yapar" biçiminde doğal Türkçe cümleye çevrilir.
 */

/** i18next `t` ile uyumlu, sadeleştirilmiş çeviri erişimi. */
export type ProtocolTranslate = (key: string, params?: Readonly<Record<string, string | number>>) => string;

const OPERATOR_KEYS: Readonly<Record<CompareOperator, string>> = Object.freeze({
  '<': 'below',
  '<=': 'atMost',
  '=': 'equal',
  '>': 'above',
  '>=': 'atLeast',
  '!=': 'notEqual',
});

/** Eylem değerinin hangi görünen değer sözlüğünden okunacağı. */
const ACTION_VALUE_GROUPS: Readonly<Record<string, string>> = Object.freeze({
  'set-energy-priority': 'priority',
  'set-maintenance-priority': 'priority',
  'set-mode': 'mode',
  'set-operating-state': 'operatingState',
  'set-work-priority': 'priority',
});

/** Kendi cümle kalıbı olan eylemler; kalanlar genel kalıba düşer. */
const ACTION_SENTENCE_IDS: readonly string[] = Object.freeze([
  'set-condition',
  'set-energy-priority',
  'set-maintenance-priority',
  'set-mode',
  'set-operating-state',
  'set-work-priority',
]);

const MINUTES_PER_HOUR = 60;

export function facilityLabel(t: ProtocolTranslate, facilityId: string): string {
  return t(`protocolManager.facility.${facilityId}`, { defaultValue: facilityId });
}

function measurementLabel(t: ProtocolTranslate, sensorId: string, facilityId: string | undefined): string {
  if (facilityId === undefined) return t(`protocolManager.measurementGlobal.${sensorId}`, { defaultValue: sensorId });
  return t(`protocolManager.measurement.${sensorId}`, {
    defaultValue: sensorId,
    facility: facilityLabel(t, facilityId),
  });
}

function literalLabel(t: ProtocolTranslate, value: ProtocolLiteral, group: string | undefined): string {
  if (typeof value === 'boolean') return t(`protocolManager.value.boolean.${value ? 'on' : 'off'}`);
  if (typeof value === 'number') return value.toString();
  if (group === undefined) return value;
  return t(`protocolManager.value.${group}.${value}`, { defaultValue: value });
}

/** `left` portunu besleyen sensor node; bulunamazsa koşul ölçümü bilinmiyordur. */
function comparedMeasurement(definition: ProtocolDefinition, compareNodeId: string, t: ProtocolTranslate): string | undefined {
  const incoming = definition.edges.find((edge) => edge.to.nodeId === compareNodeId && edge.to.port === 'left');
  if (incoming === undefined) return undefined;
  const source = definition.nodes.find((node) => node.id === incoming.from.nodeId);
  if (source === undefined || source.kind !== 'sensor') return undefined;
  return measurementLabel(t, source.sensorId, source.facilityId);
}

function byId(left: ProtocolNode, right: ProtocolNode): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function delayClause(t: ProtocolTranslate, totalMinutes: number): string | undefined {
  if (totalMinutes <= 0) return undefined;
  if (totalMinutes % MINUTES_PER_HOUR === 0) {
    return t('protocolManager.summary.delayHours', { hours: totalMinutes / MINUTES_PER_HOUR });
  }
  return t('protocolManager.summary.delayMinutes', { minutes: totalMinutes });
}

function actionClause(t: ProtocolTranslate, actionId: string, facilityId: string | undefined, value: ProtocolLiteral | undefined): string {
  const facility = facilityId === undefined
    ? t('protocolManager.summary.unassignedFacility')
    : facilityLabel(t, facilityId);
  const valueLabel = value === undefined
    ? t('protocolManager.summary.unsetValue')
    : literalLabel(t, value, ACTION_VALUE_GROUPS[actionId]);
  if (ACTION_SENTENCE_IDS.includes(actionId)) {
    return t(`protocolManager.action.${actionId}`, { facility, value: valueLabel });
  }
  return t('protocolManager.action.generic', { action: actionId, facility, value: valueLabel });
}

/**
 * Protokolü tek cümlelik doğal Türkçe özete çevirir.
 *
 * Sıralama node id'sine göre stable'dır; aynı graph her zaman aynı cümleyi üretir.
 */
export function describeProtocol(definition: ProtocolDefinition, t: ProtocolTranslate): string {
  const nodes = [...definition.nodes].sort(byId);
  const trigger = nodes.find((node) => node.kind === 'trigger');
  if (trigger === undefined || trigger.kind !== 'trigger') return t('protocolManager.summary.noTrigger');

  const clauses = [
    t(`protocolManager.summary.trigger.${OPERATOR_KEYS[trigger.operator]}`, {
      measurement: measurementLabel(t, trigger.sensorId, trigger.facilityId),
      threshold: literalLabel(t, trigger.threshold, undefined),
    }),
  ];

  for (const node of nodes) {
    if (node.kind !== 'compare') continue;
    const measurement = comparedMeasurement(definition, node.id, t);
    if (measurement === undefined || node.comparand === undefined) {
      clauses.push(t('protocolManager.summary.condition.unknown'));
      continue;
    }
    clauses.push(t(`protocolManager.summary.condition.${OPERATOR_KEYS[node.operator]}`, {
      measurement,
      value: literalLabel(t, node.comparand, undefined),
    }));
  }

  const conjunction = t('protocolManager.summary.and');
  const parts = [clauses.join(conjunction)];

  const totalDelayMinutes = nodes.reduce((total, node) => (node.kind === 'delay' ? total + node.durationMinutes : total), 0);
  const delay = delayClause(t, totalDelayMinutes);
  if (delay !== undefined) parts.push(delay);

  const actions: string[] = [];
  for (const node of nodes) {
    if (node.kind !== 'action') continue;
    actions.push(actionClause(t, node.actionId, node.facilityId, node.value));
  }
  parts.push(actions.length === 0 ? t('protocolManager.summary.noAction') : actions.join(conjunction));

  return t('protocolManager.summary.sentence', { body: parts.join(' ') });
}

/**
 * Graph editor node kartının özet satırları (§9.2, §9.3).
 *
 * Manager özetiyle aynı sözlükten beslenir; tür başına 0–2 satır üretir ve hiçbir
 * satırda teknik kimlik (node id, port adı, `boolean`) geçmez. Değer atanmamışsa
 * satır "seçilmedi" karşılığına düşer, boş bırakılmaz.
 */
export function describeProtocolNode(
  definition: ProtocolDefinition,
  node: ProtocolNode,
  t: ProtocolTranslate,
): readonly string[] {
  /** Yeni eklenen düğümde ölçüm/eylem henüz seçilmemiştir; boş kimlik metne dönüşmez. */
  const measurement = (sensorId: string, facilityId: string | undefined): string =>
    (sensorId === '' ? t('protocolEditor.card.unsetMeasurement') : measurementLabel(t, sensorId, facilityId));

  switch (node.kind) {
    case 'trigger':
      return Object.freeze([
        measurement(node.sensorId, node.facilityId),
        t(`protocolEditor.card.condition.${OPERATOR_KEYS[node.operator]}`, {
          value: literalLabel(t, node.threshold, undefined),
        }),
      ]);
    case 'sensor':
      return Object.freeze([measurement(node.sensorId, node.facilityId)]);
    case 'compare': {
      if (node.comparand === undefined) return Object.freeze([t('protocolEditor.card.compareTwoValues')]);
      const measurement = comparedMeasurement(definition, node.id, t);
      return Object.freeze([
        measurement === undefined
          ? t(`protocolEditor.card.condition.${OPERATOR_KEYS[node.operator]}`, {
            value: literalLabel(t, node.comparand, undefined),
          })
          : t(`protocolManager.summary.condition.${OPERATOR_KEYS[node.operator]}`, {
            measurement,
            value: literalLabel(t, node.comparand, undefined),
          }),
      ]);
    }
    case 'and':
      return Object.freeze([]);
    case 'delay':
      return Object.freeze([t('protocolEditor.card.delay', { minutes: node.durationMinutes })]);
    case 'action':
      return Object.freeze([
        node.facilityId === undefined ? t('protocolManager.summary.unassignedFacility') : facilityLabel(t, node.facilityId),
        t('protocolEditor.card.action', {
          setting: node.actionId === ''
            ? t('protocolEditor.card.unsetSetting')
            : t(`protocolEditor.setting.${node.actionId}`, { defaultValue: node.actionId }),
          value: node.value === undefined
            ? t('protocolManager.summary.unsetValue')
            : literalLabel(t, node.value, ACTION_VALUE_GROUPS[node.actionId]),
        }),
      ]);
  }
}

/** Kartın "etkilenen sistemler" alanı: eylemi olan tesisler, sonra ölçüm alınan tesisler. */
export function affectedFacilityIds(definition: ProtocolDefinition): readonly string[] {
  const acting: string[] = [];
  const observed: string[] = [];
  for (const node of [...definition.nodes].sort(byId)) {
    if (node.kind === 'action') {
      if (node.facilityId !== undefined && !acting.includes(node.facilityId)) acting.push(node.facilityId);
      continue;
    }
    if (node.kind !== 'sensor' && node.kind !== 'trigger') continue;
    if (node.facilityId !== undefined && !observed.includes(node.facilityId)) observed.push(node.facilityId);
  }
  return Object.freeze([...acting, ...observed.filter((id) => !acting.includes(id))]);
}
