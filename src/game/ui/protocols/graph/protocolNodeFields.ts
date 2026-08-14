import {
  COMPARE_OPERATORS,
  type CompareOperator,
  type ProtocolActionCapability,
  type ProtocolCapabilities,
  type ProtocolLiteral,
  type ProtocolNode,
} from '../../../domain/protocol/Protocol';
import {
  actionValueLabel,
  facilityLabel,
  measurementLabel,
  operatorChoiceKey,
  type ProtocolTranslate,
} from '../protocolSummary';

/**
 * Düğüm ayarları panelinin veri modeli — tasarım §12.4 alan tabloları.
 *
 * Alanlar `Protocol.ts`'teki GERÇEK alanlardan türetilir (spec satır 5452); seçenek
 * listeleri `ProtocolCapabilities`'ten gelir, hiçbir ölçüm/eylem/tesis adı burada
 * uydurulmaz (satır 5448). Teknik kimlik ekrana çıkmaz: her seçenek sözlükten geçmiş
 * doğal Türkçe etiket taşır (satır 5455).
 *
 * Modül saftır: React yoktur, üretim `t` dışında hiçbir dış duruma bakmaz.
 */

export const PROTOCOL_FIELD_IDS = [
  'facilityId', 'sensorId', 'operator', 'threshold', 'compareMode', 'comparand', 'durationMinutes', 'actionId', 'value',
] as const;
export type ProtocolFieldId = (typeof PROTOCOL_FIELD_IDS)[number];

export type ProtocolFieldControl = 'number' | 'select' | 'text';

export interface ProtocolFieldOption {
  readonly label: string;
  readonly value: string;
}

export interface ProtocolNodeField {
  readonly control: ProtocolFieldControl;
  readonly help?: string;
  readonly id: ProtocolFieldId;
  readonly label: string;
  readonly options?: readonly ProtocolFieldOption[];
  readonly required: boolean;
  readonly suffix?: string;
  /** Denetimli alanın metin değeri; sayısal alanlarda da dize taşınır. */
  readonly value: string;
}

/** Değeri henüz seçilmemiş alan; boş dize kimliği veri modelindeki karşılığıdır. */
const UNSET = '';

function option(value: string, label: string): ProtocolFieldOption {
  return Object.freeze({ label, value });
}

function facilityOptions(
  capabilities: ProtocolCapabilities,
  t: ProtocolTranslate,
  accepts: (facility: ProtocolCapabilities['facilities'][number]) => boolean,
): readonly ProtocolFieldOption[] {
  return capabilities.facilities
    .filter(accepts)
    .map((facility) => option(facility.id, facilityLabel(t, facility.id)));
}

function operatorOptions(t: ProtocolTranslate): readonly ProtocolFieldOption[] {
  return COMPARE_OPERATORS.map((operator) => option(operator, t(operatorChoiceKey(operator))));
}

function sensorOptions(
  capabilities: ProtocolCapabilities,
  facilityId: string | undefined,
  t: ProtocolTranslate,
): readonly ProtocolFieldOption[] {
  const facility = facilityId === undefined ? undefined : capabilities.facilities.find((entry) => entry.id === facilityId);
  const allowed = capabilities.sensors.filter((sensor) => facility === undefined || facility.sensorIds.includes(sensor.id));
  return [
    option(UNSET, t('protocolEditor.field.unset')),
    ...allowed.map((sensor) => option(sensor.id, measurementLabel(t, sensor.id, facilityId))),
  ];
}

function actionOptions(
  capabilities: ProtocolCapabilities,
  facilityId: string | undefined,
  t: ProtocolTranslate,
): readonly ProtocolFieldOption[] {
  const facility = facilityId === undefined ? undefined : capabilities.facilities.find((entry) => entry.id === facilityId);
  const allowed = capabilities.actions.filter((action) => facility === undefined || facility.actionIds.includes(action.id));
  return [
    option(UNSET, t('protocolEditor.field.unset')),
    ...allowed.map((action) => option(action.id, t(`protocolEditor.setting.${action.id}`, { defaultValue: action.id }))),
  ];
}

export function protocolActionCapability(
  capabilities: ProtocolCapabilities,
  actionId: string,
): ProtocolActionCapability | undefined {
  return capabilities.actions.find((action) => action.id === actionId);
}

/** Ölçümün taşıdığı tür sayısalsa eşik/sabit değer alanı sayı denetimidir. */
function literalControl(valueType: string | undefined): ProtocolFieldControl {
  return valueType === 'number' ? 'number' : 'text';
}

export function protocolNodeFields(
  node: ProtocolNode,
  capabilities: ProtocolCapabilities,
  t: ProtocolTranslate,
): readonly ProtocolNodeField[] {
  const fields: ProtocolNodeField[] = [];

  if (node.kind === 'trigger' || node.kind === 'sensor') {
    fields.push(Object.freeze({
      control: 'select',
      help: t('protocolEditor.field.facilityHelp'),
      id: 'facilityId',
      label: t('protocolEditor.field.facility'),
      options: Object.freeze([
        option(UNSET, t('protocolEditor.field.allFacilities')),
        ...facilityOptions(capabilities, t, (facility) => node.sensorId === UNSET || facility.sensorIds.includes(node.sensorId)),
      ]),
      required: false,
      value: node.facilityId ?? UNSET,
    }));
    fields.push(Object.freeze({
      control: 'select',
      id: 'sensorId',
      label: t('protocolEditor.field.measurement'),
      options: sensorOptions(capabilities, node.facilityId, t),
      required: true,
      value: node.sensorId,
    }));
  }

  if (node.kind === 'trigger') {
    const sensorType = capabilities.sensors.find((sensor) => sensor.id === node.sensorId)?.valueType;
    fields.push(Object.freeze({
      control: 'select',
      id: 'operator',
      label: t('protocolEditor.field.condition'),
      options: operatorOptions(t),
      required: true,
      value: node.operator,
    }));
    fields.push(Object.freeze({
      control: literalControl(sensorType),
      id: 'threshold',
      label: t('protocolEditor.field.threshold'),
      required: true,
      value: String(node.threshold),
    }));
  }

  if (node.kind === 'compare') {
    fields.push(Object.freeze({
      control: 'select',
      id: 'operator',
      label: t('protocolEditor.field.condition'),
      options: operatorOptions(t),
      required: true,
      value: node.operator,
    }));
    fields.push(Object.freeze({
      control: 'select',
      id: 'compareMode',
      label: t('protocolEditor.field.compareMode'),
      options: Object.freeze([
        option('constant', t('protocolEditor.field.compareConstant')),
        option('measurement', t('protocolEditor.field.compareMeasurement')),
      ]),
      required: true,
      value: node.comparand === undefined ? 'measurement' : 'constant',
    }));
    if (node.comparand !== undefined) {
      fields.push(Object.freeze({
        control: typeof node.comparand === 'number' ? 'number' : 'text',
        id: 'comparand',
        label: t('protocolEditor.field.comparand'),
        required: true,
        value: String(node.comparand),
      }));
    }
  }

  if (node.kind === 'delay') {
    fields.push(Object.freeze({
      control: 'number',
      help: t('protocolEditor.field.delayHelp', {
        maximum: capabilities.limits.delayMaximumMinutes,
        minimum: capabilities.limits.delayMinimumMinutes,
      }),
      id: 'durationMinutes',
      label: t('protocolEditor.field.delayDuration'),
      required: true,
      suffix: t('protocolEditor.field.delaySuffix'),
      value: String(node.durationMinutes),
    }));
  }

  if (node.kind === 'action') {
    const capability = protocolActionCapability(capabilities, node.actionId);
    fields.push(Object.freeze({
      control: 'select',
      id: 'facilityId',
      label: t('protocolEditor.field.targetFacility'),
      options: Object.freeze([
        option(UNSET, t('protocolEditor.field.unset')),
        ...facilityOptions(capabilities, t, (facility) => node.actionId === UNSET || facility.actionIds.includes(node.actionId)),
      ]),
      required: capability?.requiresTarget ?? true,
      value: node.facilityId ?? UNSET,
    }));
    fields.push(Object.freeze({
      control: 'select',
      id: 'actionId',
      label: t('protocolEditor.field.setting'),
      options: actionOptions(capabilities, node.facilityId, t),
      required: true,
      value: node.actionId,
    }));
    // §12.4: değer gerektirmeyen eylemde alan hiç çizilmez — devre dışı gösterilmez.
    if (capability !== undefined && capability.requiresValue) {
      const allowed = capability.allowedValues;
      fields.push(Object.freeze({
        control: allowed === undefined ? literalControl(capability.valueType) : 'select',
        id: 'value',
        label: t('protocolEditor.field.value'),
        ...(allowed === undefined ? {} : {
          options: Object.freeze([
            option(UNSET, t('protocolEditor.field.unset')),
            ...allowed.map((value) => option(String(value), actionValueLabel(t, node.actionId, value))),
          ]),
        }),
        required: true,
        value: node.value === undefined ? UNSET : String(node.value),
      }));
    }
  }

  return Object.freeze(fields);
}

function toNumber(raw: string, previous: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : previous;
}

function toOperator(raw: string, previous: CompareOperator): CompareOperator {
  return COMPARE_OPERATORS.find((operator) => operator === raw) ?? previous;
}

/** Eylem değerini capability'nin ilan ettiği türe çevirir; boş seçim değeri kaldırır. */
function toActionValue(raw: string, capability: ProtocolActionCapability | undefined): ProtocolLiteral | undefined {
  if (raw === UNSET) return undefined;
  if (capability?.valueType === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (capability?.valueType === 'boolean') return raw === 'true';
  return raw;
}

/**
 * Tek bir alanın düzenlenmesi. Saf: yeni düğüm döner, girdi düğümü değişmez.
 *
 * Bilinen tek yan etki eylem kimliğinin değişmesidir: yeni ayarın kabul ettiği değer
 * kümesi farklı olduğu için eski değer TAŞINMAZ, temizlenir — böylece "eski değer yeni
 * ayarda geçersiz" durumu ekrana sessizce sızmaz, doğrulama zorunlu alan der.
 */
export function applyProtocolNodeField(
  node: ProtocolNode,
  fieldId: ProtocolFieldId,
  raw: string,
  capabilities: ProtocolCapabilities,
): ProtocolNode {
  /** Alan boşsa isteğe bağlı özellik hiç yazılmaz (`exactOptionalPropertyTypes`). */
  const facilityPart = raw === UNSET ? {} : { facilityId: raw };

  switch (node.kind) {
    case 'trigger':
      if (fieldId === 'facilityId') return Object.freeze({ id: node.id, kind: node.kind, operator: node.operator, sensorId: node.sensorId, threshold: node.threshold, ...facilityPart });
      if (fieldId === 'sensorId') return Object.freeze({ ...node, sensorId: raw });
      if (fieldId === 'operator') return Object.freeze({ ...node, operator: toOperator(raw, node.operator) });
      if (fieldId === 'threshold') {
        return Object.freeze({ ...node, threshold: typeof node.threshold === 'number' ? toNumber(raw, node.threshold) : raw });
      }
      return node;
    case 'sensor':
      if (fieldId === 'facilityId') return Object.freeze({ id: node.id, kind: node.kind, sensorId: node.sensorId, ...facilityPart });
      if (fieldId === 'sensorId') return Object.freeze({ ...node, sensorId: raw });
      return node;
    case 'compare':
      if (fieldId === 'operator') return Object.freeze({ ...node, operator: toOperator(raw, node.operator) });
      if (fieldId === 'compareMode') {
        return raw === 'measurement'
          ? Object.freeze({ id: node.id, kind: node.kind, operator: node.operator })
          : Object.freeze({ ...node, comparand: node.comparand ?? 0 });
      }
      if (fieldId === 'comparand') {
        return Object.freeze({ ...node, comparand: typeof node.comparand === 'number' ? toNumber(raw, node.comparand) : raw });
      }
      return node;
    case 'and':
      return node;
    case 'delay':
      return fieldId === 'durationMinutes'
        ? Object.freeze({ ...node, durationMinutes: toNumber(raw, node.durationMinutes) })
        : node;
    case 'action': {
      const valuePart = node.value === undefined ? {} : { value: node.value };
      if (fieldId === 'facilityId') {
        return Object.freeze({ actionId: node.actionId, id: node.id, kind: node.kind, ...facilityPart, ...valuePart });
      }
      if (fieldId === 'actionId') {
        return Object.freeze({ actionId: raw, id: node.id, kind: node.kind, ...(node.facilityId === undefined ? {} : { facilityId: node.facilityId }) });
      }
      if (fieldId === 'value') {
        const parsed = toActionValue(raw, protocolActionCapability(capabilities, node.actionId));
        return Object.freeze({
          actionId: node.actionId,
          id: node.id,
          kind: node.kind,
          ...(node.facilityId === undefined ? {} : { facilityId: node.facilityId }),
          ...(parsed === undefined ? {} : { value: parsed }),
        });
      }
      return node;
    }
  }
}
