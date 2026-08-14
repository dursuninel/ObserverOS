import {
  ORDERING_COMPARE_OPERATORS,
  type ProtocolCapabilities,
  type ProtocolDefinition,
  type ProtocolEdge,
  type ProtocolFindingCode,
  type ProtocolLiteral,
  type ProtocolNode,
  type ProtocolPortType,
  type ProtocolValidationFinding,
  type ProtocolValidationReport,
  type ProtocolValueType,
} from '../../domain/protocol/Protocol';

/**
 * Protocol structural validation (spec §53.2 error'ları, §53.3 warning'leri).
 *
 * Headless'tır: React/renderer/browser bağımlılığı yoktur, saat veya rastgelelik
 * kaynağı okumaz ve bulgu sırası Map/Set iteration'ına değil id sıralamasına dayanır.
 * Player-facing metin burada değil `src/localization/tr.ts` içinde, bulgu kodu
 * üzerinden çözülür.
 */

/**
 * `value`: tipi capability'den çözülemeyen serbest değer portu.
 *
 * Port şeması ve tip uyum kuralı düzenleyici tarafından da kullanılır (§14.2:
 * geçersiz bağlantı kurulmadan engellenir). Bu yüzden tek kaynak buradadır ve
 * `protocolInputPorts` / `protocolOutputPorts` / `arePortTypesCompatible` olarak
 * dışa açılır — editör kendi kopyasını tutmaz.
 */
export type ProtocolResolvedPortType = ProtocolPortType | 'value';
type PortType = ProtocolResolvedPortType;

interface MutableFinding {
  readonly code: ProtocolFindingCode;
  readonly edgeId?: string;
  readonly nodeId?: string;
  readonly severity: 'error' | 'warning';
}

function portKey(nodeId: string, port: string): string {
  return `${nodeId}::${port}`;
}

function byId(left: { readonly id: string }, right: { readonly id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function protocolInputPorts(node: ProtocolNode): ReadonlyMap<string, PortType> {
  switch (node.kind) {
    case 'trigger':
    case 'sensor':
      return new Map();
    case 'compare':
      return node.comparand === undefined
        ? new Map<string, PortType>([['in', 'flow'], ['left', 'value'], ['right', 'value']])
        : new Map<string, PortType>([['in', 'flow'], ['left', 'value']]);
    case 'and':
      return new Map<string, PortType>([['in', 'flow'], ['a', 'boolean'], ['b', 'boolean']]);
    case 'delay':
      return new Map<string, PortType>([['in', 'flow']]);
    case 'action':
      return new Map<string, PortType>([['in', 'flow']]);
  }
}

export function protocolOutputPorts(node: ProtocolNode, capabilities?: ProtocolCapabilities): ReadonlyMap<string, PortType> {
  switch (node.kind) {
    case 'trigger':
      return new Map<string, PortType>([['out', 'flow']]);
    case 'sensor': {
      const declared = capabilities?.sensors.find((sensor) => sensor.id === node.sensorId)?.valueType;
      return new Map<string, PortType>([['value', declared ?? 'value']]);
    }
    case 'compare':
    case 'and':
      return new Map<string, PortType>([['whenTrue', 'flow'], ['whenFalse', 'flow'], ['result', 'boolean']]);
    case 'delay':
      return new Map<string, PortType>([['out', 'flow']]);
    case 'action':
      return new Map();
  }
}

/**
 * §53.1 port tip uyumu: implicit dönüşüm yoktur. Tipi çözülememiş serbest değer
 * portu (`value`) yalnız akış portuna bağlanamaz; iki değer portu birbirini kabul eder.
 */
export function arePortTypesCompatible(sourceType: PortType, targetType: PortType): boolean {
  if (targetType === 'value') return sourceType !== 'flow';
  if (sourceType === 'value') return targetType !== 'flow';
  return sourceType === targetType;
}

function literalMatchesType(literal: ProtocolLiteral, type: ProtocolValueType): boolean {
  if (type === 'number') return typeof literal === 'number';
  if (type === 'boolean') return typeof literal === 'boolean';
  return typeof literal === 'string';
}

function isOrdering(operator: string): boolean {
  return ORDERING_COMPARE_OPERATORS.some((candidate) => candidate === operator);
}

function concreteType(type: PortType | undefined): ProtocolValueType | undefined {
  if (type === undefined || type === 'value' || type === 'flow') return undefined;
  return type;
}

function findCycleMembers(
  nodeIds: readonly string[],
  adjacency: ReadonlyMap<string, readonly string[]>,
): readonly string[] | undefined {
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];

  function visit(nodeId: string): readonly string[] | undefined {
    if (active.has(nodeId)) return stack.slice(stack.indexOf(nodeId));
    if (visited.has(nodeId)) return undefined;
    visited.add(nodeId);
    active.add(nodeId);
    stack.push(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      const cycle = visit(next);
      if (cycle !== undefined) return cycle;
    }
    stack.pop();
    active.delete(nodeId);
    return undefined;
  }

  for (const nodeId of nodeIds) {
    const cycle = visit(nodeId);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
}

export function buildAdjacency(
  edges: readonly ProtocolEdge[],
  knownNodeIds: ReadonlySet<string>,
): ReadonlyMap<string, readonly string[]> {
  const adjacency = new Map<string, string[]>();
  for (const nodeId of knownNodeIds) adjacency.set(nodeId, []);
  for (const edge of edges) {
    if (!knownNodeIds.has(edge.from.nodeId) || !knownNodeIds.has(edge.to.nodeId)) continue;
    adjacency.get(edge.from.nodeId)?.push(edge.to.nodeId);
  }
  for (const [nodeId, targets] of adjacency) adjacency.set(nodeId, [...targets].sort());
  return adjacency;
}

export function validateProtocol(
  definition: ProtocolDefinition,
  capabilities?: ProtocolCapabilities,
): ProtocolValidationReport {
  const findings: MutableFinding[] = [];
  const add = (code: ProtocolFindingCode, severity: 'error' | 'warning', anchor: { readonly edgeId?: string; readonly nodeId?: string } = {}): void => {
    findings.push({
      code,
      ...(anchor.edgeId === undefined ? {} : { edgeId: anchor.edgeId }),
      ...(anchor.nodeId === undefined ? {} : { nodeId: anchor.nodeId }),
      severity,
    });
  };

  const nodes = [...definition.nodes].sort(byId);
  const edges = [...definition.edges].sort(byId);
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const inputSchemas = new Map(nodes.map((node) => [node.id, protocolInputPorts(node)] as const));
  const outputSchemas = new Map(nodes.map((node) => [node.id, protocolOutputPorts(node, capabilities)] as const));

  const incomingSourceType = new Map<string, PortType>();
  const incomingSourceNodeId = new Map<string, string>();

  // Trigger kuralları (§53.2: Trigger yok / birden fazla bağımsız root Trigger).
  const triggers = nodes.filter((node) => node.kind === 'trigger');
  if (triggers.length === 0) add('protocol.error.trigger-missing', 'error');
  for (const extra of triggers.slice(1)) add('protocol.error.multiple-root-triggers', 'error', { nodeId: extra.id });

  // Kenar/port uyumu (§53.1, §53.2: edge incompatible port'a bağlı).
  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.from.nodeId);
    const targetNode = nodeById.get(edge.to.nodeId);
    const sourceType = sourceNode === undefined ? undefined : outputSchemas.get(sourceNode.id)?.get(edge.from.port);
    const targetType = targetNode === undefined ? undefined : inputSchemas.get(targetNode.id)?.get(edge.to.port);

    if (sourceType === undefined || targetType === undefined) {
      add('protocol.error.edge-port-incompatible', 'error', { edgeId: edge.id });
      continue;
    }

    if (!arePortTypesCompatible(sourceType, targetType)) {
      add('protocol.error.edge-port-incompatible', 'error', { edgeId: edge.id });
    }

    const key = portKey(edge.to.nodeId, edge.to.port);
    if (!incomingSourceType.has(key)) {
      incomingSourceType.set(key, sourceType);
      if (sourceNode !== undefined) incomingSourceNodeId.set(key, sourceNode.id);
    }
  }

  const numericThresholds: { readonly nodeId: string; readonly sensorId: string; readonly value: number }[] = [];

  for (const node of nodes) {
    const facilityId = node.kind === 'and' || node.kind === 'compare' || node.kind === 'delay' ? undefined : node.facilityId;
    const facility = capabilities === undefined || facilityId === undefined
      ? undefined
      : capabilities.facilities.find((candidate) => candidate.id === facilityId);
    const facilityMissing = capabilities !== undefined && facilityId !== undefined && facility === undefined;
    // §53.2: silinmiş facility instance'a hard instance ref.
    if (facilityMissing) add('protocol.error.deleted-facility-reference', 'error', { nodeId: node.id });

    if (node.kind === 'trigger' || node.kind === 'sensor') {
      const sensor = capabilities?.sensors.find((candidate) => candidate.id === node.sensorId);
      // §53.2: referans verilen sensor current capability'de yok.
      if (capabilities !== undefined && (sensor === undefined || (facility !== undefined && !facility.sensorIds.includes(node.sensorId)))) {
        add('protocol.error.capability-unavailable', 'error', { nodeId: node.id });
      }

      if (node.kind === 'trigger') {
        const sensorType = sensor?.valueType;
        if (sensorType !== undefined && !literalMatchesType(node.threshold, sensorType)) {
          add('protocol.error.compare-operand-type', 'error', { nodeId: node.id });
        } else if (isOrdering(node.operator) && typeof node.threshold !== 'number') {
          add('protocol.error.compare-operand-type', 'error', { nodeId: node.id });
        }
        if (typeof node.threshold === 'number') {
          numericThresholds.push({ nodeId: node.id, sensorId: node.sensorId, value: node.threshold });
        }
      }
    }

    if (node.kind === 'compare') {
      const leftType = concreteType(incomingSourceType.get(portKey(node.id, 'left')));
      const rightType = concreteType(incomingSourceType.get(portKey(node.id, 'right')));
      const comparand = node.comparand;
      let incompatible = false;

      if (comparand === undefined) {
        if (leftType !== undefined && rightType !== undefined && leftType !== rightType) incompatible = true;
        if (isOrdering(node.operator) && ((leftType !== undefined && leftType !== 'number') || (rightType !== undefined && rightType !== 'number'))) {
          incompatible = true;
        }
      } else {
        if (leftType !== undefined && !literalMatchesType(comparand, leftType)) incompatible = true;
        if (isOrdering(node.operator) && (typeof comparand !== 'number' || (leftType !== undefined && leftType !== 'number'))) incompatible = true;
      }

      // §53.2: Compare operand type incompatible.
      if (incompatible) add('protocol.error.compare-operand-type', 'error', { nodeId: node.id });

      // §53.2 (engelleyen bulgu): runtime bağlanmamış operandı değerlendiremez —
      // sabit comparand yoksa iki operand da bir kenardan beslenmelidir.
      const leftConnected = incomingSourceType.has(portKey(node.id, 'left'));
      const rightConnected = incomingSourceType.has(portKey(node.id, 'right'));
      if (!leftConnected || (comparand === undefined && !rightConnected)) {
        add('protocol.error.compare-operand-missing', 'error', { nodeId: node.id });
      }

      const leftSourceId = incomingSourceNodeId.get(portKey(node.id, 'left'));
      const leftSource = leftSourceId === undefined ? undefined : nodeById.get(leftSourceId);
      if (typeof comparand === 'number' && leftSource !== undefined && leftSource.kind === 'sensor') {
        numericThresholds.push({ nodeId: node.id, sensorId: leftSource.sensorId, value: comparand });
      }
    }

    // §53.2: AND input eksik.
    if (node.kind === 'and') {
      const missing = !incomingSourceType.has(portKey(node.id, 'a')) || !incomingSourceType.has(portKey(node.id, 'b'));
      if (missing) add('protocol.error.and-input-missing', 'error', { nodeId: node.id });
    }

    // §53.2: Delay duration ≤0 veya schema range dışı.
    if (node.kind === 'delay') {
      const limits = capabilities?.limits;
      const outOfRange = !Number.isFinite(node.durationMinutes)
        || node.durationMinutes <= 0
        || (limits !== undefined && (node.durationMinutes < limits.delayMinimumMinutes || node.durationMinutes > limits.delayMaximumMinutes));
      if (outOfRange) add('protocol.error.delay-duration-out-of-range', 'error', { nodeId: node.id });
      // §53.3: uzun Delay mission cycle'dan uzun olabilir.
      else if (limits !== undefined && node.durationMinutes > limits.longDelayMinutes) {
        add('protocol.warning.long-delay', 'warning', { nodeId: node.id });
      }
    }

    if (node.kind === 'action' && capabilities !== undefined) {
      const action = capabilities.actions.find((candidate) => candidate.id === node.actionId);
      // §53.2: referans verilen action current capability'de yok.
      if (action === undefined || (facility !== undefined && !facility.actionIds.includes(node.actionId))) {
        add('protocol.error.capability-unavailable', 'error', { nodeId: node.id });
      }

      if (action !== undefined) {
        // §53.2: Action required target/value eksik.
        if (action.requiresTarget && node.facilityId === undefined) add('protocol.error.action-required-field-missing', 'error', { nodeId: node.id });
        if (action.requiresValue && node.value === undefined) add('protocol.error.action-required-field-missing', 'error', { nodeId: node.id });

        // §53.1: implicit dönüşüm yok — değer türü aksiyonun türüyle birebir eşleşir.
        if (node.value !== undefined) {
          const typeMismatch = action.valueType !== undefined && !literalMatchesType(node.value, action.valueType);
          const outsideDomain = action.allowedValues !== undefined && !action.allowedValues.includes(node.value);
          if (typeMismatch || outsideDomain) add('protocol.error.action-value-type', 'error', { nodeId: node.id });
        }

        // §53.3: action muhtemelen zaten mevcut değere set ediyor.
        if (node.value !== undefined && facility?.currentActionValues?.[node.actionId] === node.value) {
          add('protocol.warning.action-value-unchanged', 'warning', { nodeId: node.id });
        }

        // §53.3: protocol hiçbir current facility'yi etkileyemiyor.
        if (node.facilityId === undefined && !capabilities.facilities.some((candidate) => candidate.actionIds.includes(node.actionId))) {
          add('protocol.warning.no-affected-facility', 'warning', { nodeId: node.id });
        }

        // §53.3: aynı actuator'u etkileyen başka aktif protocol — yalnız potential conflict.
        const conflicting = (capabilities.activeActionClaims ?? []).some((claim) =>
          claim.protocolId !== definition.id && claim.actionId === node.actionId && claim.facilityId === node.facilityId);
        if (conflicting) add('protocol.warning.potential-conflict', 'warning', { nodeId: node.id });
      }
    }
  }

  // §13.9 / §53.2: graph cycle reddedilir.
  const adjacency = buildAdjacency(edges, new Set(nodeById.keys()));
  const cycle = findCycleMembers(nodes.map((node) => node.id), adjacency);
  if (cycle !== undefined && cycle.length > 0) {
    const anchor = [...cycle].sort()[0];
    add('protocol.error.graph-cycle', 'error', anchor === undefined ? {} : { nodeId: anchor });
  }

  // §53.3: birbirine çok yakın eşikler oscillation riski taşıyabilir (çözüm önerilmez).
  const margin = capabilities?.limits.thresholdOscillationMargin;
  if (margin !== undefined) {
    const sorted = [...numericThresholds].sort((left, right) =>
      left.sensorId < right.sensorId ? -1
        : left.sensorId > right.sensorId ? 1
          : left.value !== right.value ? left.value - right.value
            : byId({ id: left.nodeId }, { id: right.nodeId }));
    for (let index = 0; index < sorted.length; index += 1) {
      for (let other = index + 1; other < sorted.length; other += 1) {
        const first = sorted[index];
        const second = sorted[other];
        if (first === undefined || second === undefined) continue;
        if (first.sensorId !== second.sensorId || first.nodeId === second.nodeId) continue;
        if (Math.abs(first.value - second.value) <= margin) {
          const anchor = first.nodeId < second.nodeId ? second.nodeId : first.nodeId;
          add('protocol.warning.threshold-oscillation-risk', 'warning', { nodeId: anchor });
        }
      }
    }
  }

  const unique = new Map<string, ProtocolValidationFinding>();
  for (const finding of findings) unique.set(`${finding.code}|${finding.nodeId ?? ''}|${finding.edgeId ?? ''}`, Object.freeze(finding));
  const ordered = [...unique.entries()].sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0)).map(([, finding]) => finding);

  return Object.freeze({
    findings: Object.freeze(ordered),
    valid: !ordered.some((finding) => finding.severity === 'error'),
  });
}
