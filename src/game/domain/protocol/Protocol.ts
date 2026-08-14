import type { Priority } from '../facilities/Facility';

/**
 * Protocol veri modeli (spec §11, §12, §53.1).
 *
 * Bu dosya editörden bağımsızdır: React Flow node position/selection/color gibi
 * sunum alanları burada YOKTUR (§53.4). Faz 5 kapsamı yalnız altı node'dur;
 * §12'deki OR/NOT/Timer/Cooldown/Counter/Splitter bu fazda tanımlanmaz.
 */

export const PROTOCOL_LIFECYCLES = ['draft', 'validated', 'active', 'disabled', 'archived'] as const;
export type ProtocolLifecycle = (typeof PROTOCOL_LIFECYCLES)[number];

export const PROTOCOL_NODE_KINDS = ['trigger', 'sensor', 'compare', 'and', 'delay', 'action'] as const;
export type ProtocolNodeKind = (typeof PROTOCOL_NODE_KINDS)[number];

/** Spec §12'deki `≤`/`≥`/`≠` sembolleri kodda ASCII karşılıklarıyla taşınır. */
export const COMPARE_OPERATORS = ['<', '>', '<=', '>=', '=', '!='] as const;
export type CompareOperator = (typeof COMPARE_OPERATORS)[number];

export const ORDERING_COMPARE_OPERATORS: readonly CompareOperator[] = ['<', '>', '<=', '>='];

/** §53.1 port tipleri. Implicit dönüşüm yoktur; tipler birebir eşleşmelidir. */
export type ProtocolValueType = 'boolean' | 'number' | `enum:${string}` | `entityRef:${string}`;
export type ProtocolPortType = 'flow' | ProtocolValueType;

export type ProtocolLiteral = boolean | number | string;

export interface ProtocolPortRef {
  readonly nodeId: string;
  readonly port: string;
}

export interface ProtocolEdge {
  readonly from: ProtocolPortRef;
  readonly id: string;
  readonly to: ProtocolPortRef;
}

interface ProtocolNodeBase {
  readonly id: string;
}

/** Threshold trigger (§13.1). Yalnız Trigger execution başlatır (§11). */
export interface ProtocolTriggerNode extends ProtocolNodeBase {
  readonly facilityId?: string;
  readonly kind: 'trigger';
  readonly operator: CompareOperator;
  readonly sensorId: string;
  readonly threshold: ProtocolLiteral;
}

/** Sensor yalnız veri okur, pulse üretmez (§11). */
export interface ProtocolSensorNode extends ProtocolNodeBase {
  readonly facilityId?: string;
  readonly kind: 'sensor';
  readonly sensorId: string;
}

export interface ProtocolCompareNode extends ProtocolNodeBase {
  /** Sabit operand; verilmezse `right` portu bir kenardan beslenir. */
  readonly comparand?: ProtocolLiteral;
  readonly kind: 'compare';
  readonly operator: CompareOperator;
}

export interface ProtocolAndNode extends ProtocolNodeBase {
  readonly kind: 'and';
}

export interface ProtocolDelayNode extends ProtocolNodeBase {
  readonly durationMinutes: number;
  readonly kind: 'delay';
}

export interface ProtocolActionNode extends ProtocolNodeBase {
  readonly actionId: string;
  readonly facilityId?: string;
  readonly kind: 'action';
  readonly value?: ProtocolLiteral;
}

export type ProtocolNode =
  | ProtocolActionNode
  | ProtocolAndNode
  | ProtocolCompareNode
  | ProtocolDelayNode
  | ProtocolSensorNode
  | ProtocolTriggerNode;

export interface ProtocolDefinition {
  readonly edges: readonly ProtocolEdge[];
  readonly id: string;
  readonly lifecycle: ProtocolLifecycle;
  readonly name: string;
  readonly nodes: readonly ProtocolNode[];
  readonly priority: Priority;
  readonly version: number;
}

/**
 * Capability katmanı data-driven'dır: hangi sensor/action'ın var olduğu ve hangi
 * tesiste bulunduğu çağıran tarafından verilir, validator içine hard-code edilmez.
 */
export interface ProtocolSensorCapability {
  readonly id: string;
  readonly valueType: ProtocolValueType;
}

export interface ProtocolActionCapability {
  readonly allowedValues?: readonly ProtocolLiteral[];
  readonly id: string;
  readonly requiresTarget: boolean;
  readonly requiresValue: boolean;
  readonly valueType?: ProtocolValueType;
}

export interface ProtocolFacilityCapability {
  readonly actionIds: readonly string[];
  /** Aksiyonun şu anda tesiste geçerli olan değeri; warning üretimi için. */
  readonly currentActionValues?: Readonly<Record<string, ProtocolLiteral>>;
  readonly id: string;
  readonly sensorIds: readonly string[];
}

export interface ProtocolActionClaim {
  readonly actionId: string;
  readonly facilityId?: string;
  readonly protocolId: string;
}

/** TUNABLE sayısal sınırlar; engine içine gömülmez, data katmanından gelir. */
export interface ProtocolValidationLimits {
  readonly delayMaximumMinutes: number;
  readonly delayMinimumMinutes: number;
  readonly longDelayMinutes: number;
  readonly thresholdOscillationMargin: number;
}

export interface ProtocolCapabilities {
  readonly actions: readonly ProtocolActionCapability[];
  readonly activeActionClaims?: readonly ProtocolActionClaim[];
  readonly facilities: readonly ProtocolFacilityCapability[];
  readonly limits: ProtocolValidationLimits;
  readonly sensors: readonly ProtocolSensorCapability[];
}

/** §53.2 — apply'i engelleyen bulgular. Metin değil kod taşınır. */
export const PROTOCOL_ERROR_CODES = [
  'protocol.error.trigger-missing',
  'protocol.error.multiple-root-triggers',
  'protocol.error.action-required-field-missing',
  'protocol.error.action-value-type',
  'protocol.error.compare-operand-type',
  'protocol.error.and-input-missing',
  'protocol.error.graph-cycle',
  'protocol.error.delay-duration-out-of-range',
  'protocol.error.edge-port-incompatible',
  'protocol.error.capability-unavailable',
  'protocol.error.deleted-facility-reference',
] as const;
export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[number];

/** §53.3 — apply'i engellemeyen bulgular. */
export const PROTOCOL_WARNING_CODES = [
  'protocol.warning.action-value-unchanged',
  'protocol.warning.no-affected-facility',
  'protocol.warning.potential-conflict',
  'protocol.warning.threshold-oscillation-risk',
  'protocol.warning.long-delay',
] as const;
export type ProtocolWarningCode = (typeof PROTOCOL_WARNING_CODES)[number];

export type ProtocolFindingCode = ProtocolErrorCode | ProtocolWarningCode;

export interface ProtocolValidationFinding {
  readonly code: ProtocolFindingCode;
  readonly edgeId?: string;
  readonly nodeId?: string;
  readonly severity: 'error' | 'warning';
}

export interface ProtocolValidationReport {
  readonly findings: readonly ProtocolValidationFinding[];
  readonly valid: boolean;
}
