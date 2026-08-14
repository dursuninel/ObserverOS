import type {
  CompareOperator,
  ProtocolActionRequest,
  ProtocolLiteral,
} from '../../domain/protocol/Protocol';
import type { ExecutableProtocol, ExecutableProtocolNode } from './protocolCompiler';

/**
 * Protocol runtime yürütme çekirdeği (spec §13.1-§13.5, §53.5, §53.6).
 *
 * Headless ve deterministic'tir: saat/rastgelelik kaynağı okumaz, yalnız simulation
 * time ile ilerler ve execution kimliklerini monoton bir sayaçtan türetir. Action
 * node bu katmanda tesisi DEĞİŞTİRMEZ; yalnız request üretir — arbitration bütün
 * request'ler toplandıktan sonra ayrı bir katmanda çalışır (§53.6).
 */

/** Dünya okuma yüzeyi. Sensor kataloğu data-driven'dır, runtime içine gömülmez. */
export type ProtocolSensorReader = (sensorId: string, facilityId: string | undefined) => ProtocolLiteral | undefined;

export interface ProtocolRuntimeTickInput {
  readonly protocols: readonly ExecutableProtocol[];
  readonly readSensor: ProtocolSensorReader;
  /** Tick sonundaki simulation dakikası. */
  readonly simTime: number;
  /** SimulationClock fixedStep'i; delay yalnız bu adımla ilerler (§13.5). */
  readonly stepMinutes: number;
}

/** Delay'de bekleyen execution; KALAN süre serialize edilir (§13.5). */
export interface ProtocolScheduledExecutionState {
  readonly delayNodeId: string;
  readonly protocolExecutionId: string;
  readonly protocolId: string;
  readonly remainingMinutes: number;
}

/** Trigger crossing durumu: armed olmayan trigger yeniden pulse üretmez (§13.1). */
export interface ProtocolTriggerArmState {
  readonly armed: boolean;
  readonly nodeId: string;
  readonly protocolId: string;
}

export interface ProtocolRuntimeState {
  readonly executionSequence: number;
  readonly scheduled: readonly ProtocolScheduledExecutionState[];
  readonly triggers: readonly ProtocolTriggerArmState[];
}

interface ProtocolIndex {
  /** `toNodeId::toPort` → kaynak port; derleyicinin sıralı kenar listesinden türer. */
  readonly incoming: ReadonlyMap<string, { readonly nodeId: string; readonly port: string }>;
  readonly nodes: ReadonlyMap<string, ExecutableProtocolNode>;
}

interface ExecutionContext {
  readonly booleans: Map<string, boolean | undefined>;
  readonly index: ProtocolIndex;
  readonly protocolExecutionId: string;
  readonly readSensor: ProtocolSensorReader;
  /** §13.2: bir değerlendirmedeki tüm sensor okumaları tek tutarlı snapshot'tan gelir. */
  readonly sensors: Map<string, ProtocolLiteral | undefined>;
}

function portKey(nodeId: string, port: string): string {
  return `${nodeId}::${port}`;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** §53.1: implicit dönüşüm yoktur; tipler eşleşmezse sonuç belirsizdir. */
function compareLiterals(
  left: ProtocolLiteral | undefined,
  operator: CompareOperator,
  right: ProtocolLiteral | undefined,
): boolean | undefined {
  if (left === undefined || right === undefined) return undefined;
  if (typeof left !== typeof right) return undefined;
  if (operator === '=') return left === right;
  if (operator === '!=') return left !== right;
  if (typeof left !== 'number' || typeof right !== 'number') return undefined;
  switch (operator) {
    case '<': return left < right;
    case '>': return left > right;
    case '<=': return left <= right;
    case '>=': return left >= right;
  }
}

function buildIndex(protocol: ExecutableProtocol): ProtocolIndex {
  const incoming = new Map<string, { readonly nodeId: string; readonly port: string }>();
  for (const executable of protocol.nodes) {
    for (const edge of executable.outgoing) {
      const key = portKey(edge.toNodeId, edge.toPort);
      if (incoming.has(key)) continue;
      incoming.set(key, { nodeId: executable.id, port: edge.fromPort });
    }
  }
  return { incoming, nodes: new Map(protocol.nodes.map((executable) => [executable.id, executable] as const)) };
}

export class ProtocolRuntime {
  private readonly armed = new Map<string, boolean>();
  private executionSequence = 0;
  private scheduled: ProtocolScheduledExecutionState[] = [];

  exportState(): ProtocolRuntimeState {
    return Object.freeze({
      executionSequence: this.executionSequence,
      scheduled: Object.freeze(this.scheduled.map((entry) => Object.freeze({ ...entry }))),
      triggers: Object.freeze([...this.armed.entries()]
        .sort((left, right) => compareStrings(left[0], right[0]))
        .map(([key, armed]) => {
          const separator = key.indexOf('::');
          return Object.freeze({ armed, nodeId: key.slice(separator + 2), protocolId: key.slice(0, separator) });
        })),
    });
  }

  restoreState(state: ProtocolRuntimeState): void {
    this.executionSequence = state.executionSequence;
    this.scheduled = [...state.scheduled]
      .map((entry) => Object.freeze({ ...entry }))
      .sort((left, right) => compareStrings(left.protocolExecutionId, right.protocolExecutionId));
    this.armed.clear();
    for (const trigger of state.triggers) this.armed.set(portKey(trigger.protocolId, trigger.nodeId), trigger.armed);
  }

  /** Tek fixed step yürütür ve o tick'te doğan action request'leri döndürür (§53.6). */
  tick(input: ProtocolRuntimeTickInput): readonly ProtocolActionRequest[] {
    const requests: ProtocolActionRequest[] = [];
    const byId = new Map(input.protocols.map((protocol) => [protocol.id, protocol] as const));

    for (const entry of this.advanceScheduled(input.stepMinutes)) {
      const protocol = byId.get(entry.protocolId);
      const delayNode = protocol?.nodes.find((candidate) => candidate.id === entry.delayNodeId);
      if (protocol === undefined || delayNode === undefined) continue;
      // §13.2: delay sonrası değerlendirme O ANKİ state'i okur; eski snapshot taşınmaz.
      const context = this.createContext(protocol, entry.protocolExecutionId, input.readSensor);
      this.propagate(protocol, delayNode, 'out', context, input, requests);
    }

    for (const protocol of [...input.protocols].sort((left, right) => compareStrings(left.id, right.id))) {
      const index = buildIndex(protocol);
      const trigger = index.nodes.get(protocol.rootTriggerId);
      if (trigger === undefined || trigger.node.kind !== 'trigger') continue;

      // §13.2: trigger okuması, başlayacak execution'ın snapshot'ının ilk parçasıdır.
      const snapshot = new Map<string, ProtocolLiteral | undefined>();
      const booleans = new Map<string, boolean | undefined>();
      const probe: ExecutionContext = { booleans, index, protocolExecutionId: '', readSensor: input.readSensor, sensors: snapshot };
      const observed = readSensorValue(probe, trigger.node.sensorId, trigger.node.facilityId);
      const condition = compareLiterals(observed, trigger.node.operator, trigger.node.threshold);
      if (condition === undefined) continue;

      const key = portKey(protocol.id, trigger.id);
      if (!condition) {
        this.armed.set(key, true);
        continue;
      }
      // §13.1: crossing yoksa (armed değilse) her tick yeniden tetiklenmez.
      if (this.armed.get(key) !== true) continue;
      this.armed.set(key, false);

      const execution: ExecutionContext = {
        booleans,
        index,
        protocolExecutionId: this.nextExecutionId(),
        readSensor: input.readSensor,
        sensors: snapshot,
      };
      this.propagate(protocol, trigger, 'out', execution, input, requests);
    }

    return Object.freeze(requests);
  }

  private advanceScheduled(stepMinutes: number): readonly ProtocolScheduledExecutionState[] {
    const pending: ProtocolScheduledExecutionState[] = [];
    const due: ProtocolScheduledExecutionState[] = [];
    for (const entry of this.scheduled) {
      const remainingMinutes = entry.remainingMinutes - stepMinutes;
      if (remainingMinutes > 0) pending.push(Object.freeze({ ...entry, remainingMinutes }));
      else due.push(entry);
    }
    this.scheduled = pending;
    return due.sort((left, right) => compareStrings(left.protocolExecutionId, right.protocolExecutionId));
  }

  private createContext(
    protocol: ExecutableProtocol,
    protocolExecutionId: string,
    readSensor: ProtocolSensorReader,
  ): ExecutionContext {
    return { booleans: new Map(), index: buildIndex(protocol), protocolExecutionId, readSensor, sensors: new Map() };
  }

  private enter(
    protocol: ExecutableProtocol,
    target: ExecutableProtocolNode,
    context: ExecutionContext,
    input: ProtocolRuntimeTickInput,
    requests: ProtocolActionRequest[],
  ): void {
    const node = target.node;
    switch (node.kind) {
      case 'delay':
        // §13.5: simulation time ile bekler; wall clock kullanılmaz.
        this.scheduled = [...this.scheduled, Object.freeze({
          delayNodeId: node.id,
          protocolExecutionId: context.protocolExecutionId,
          protocolId: protocol.id,
          remainingMinutes: node.durationMinutes,
        })].sort((left, right) => compareStrings(left.protocolExecutionId, right.protocolExecutionId));
        return;
      case 'action':
        requests.push(Object.freeze({
          actuator: node.actionId,
          ...(node.facilityId === undefined ? {} : { facilityId: node.facilityId }),
          priority: protocol.priority,
          protocolExecutionId: context.protocolExecutionId,
          protocolId: protocol.id,
          simTime: input.simTime,
          ...(node.value === undefined ? {} : { value: node.value }),
        }));
        return;
      case 'compare':
      case 'and': {
        // §13.3: instantaneous boolean evaluation; gizli memory yok.
        const result = evaluateBoolean(context, target);
        if (result === undefined) return;
        this.propagate(protocol, target, result ? 'whenTrue' : 'whenFalse', context, input, requests);
        return;
      }
      case 'trigger':
      case 'sensor':
        return;
    }
  }

  private nextExecutionId(): string {
    this.executionSequence += 1;
    return `protocol-execution-${this.executionSequence.toString().padStart(6, '0')}`;
  }

  private propagate(
    protocol: ExecutableProtocol,
    source: ExecutableProtocolNode,
    port: string,
    context: ExecutionContext,
    input: ProtocolRuntimeTickInput,
    requests: ProtocolActionRequest[],
  ): void {
    for (const edge of source.outgoing) {
      if (edge.fromPort !== port) continue;
      const target = context.index.nodes.get(edge.toNodeId);
      if (target === undefined) continue;
      this.enter(protocol, target, context, input, requests);
    }
  }
}

function readSensorValue(
  context: ExecutionContext,
  sensorId: string,
  facilityId: string | undefined,
): ProtocolLiteral | undefined {
  const key = portKey(sensorId, facilityId ?? '-');
  const cached = context.sensors.get(key);
  if (cached !== undefined || context.sensors.has(key)) return cached;
  const value = context.readSensor(sensorId, facilityId);
  context.sensors.set(key, value);
  return value;
}

/** Değer portu pull ile çözülür; graph acyclic olduğu için özyineleme sonlanır (§13.9). */
function readValue(context: ExecutionContext, nodeId: string, port: string): ProtocolLiteral | undefined {
  const source = context.index.incoming.get(portKey(nodeId, port));
  if (source === undefined) return undefined;
  const sourceNode = context.index.nodes.get(source.nodeId);
  if (sourceNode === undefined) return undefined;
  if (sourceNode.node.kind === 'sensor') return readSensorValue(context, sourceNode.node.sensorId, sourceNode.node.facilityId);
  if (sourceNode.node.kind === 'compare' || sourceNode.node.kind === 'and') {
    return source.port === 'result' ? evaluateBoolean(context, sourceNode) : undefined;
  }
  return undefined;
}

function evaluateBoolean(context: ExecutionContext, executable: ExecutableProtocolNode): boolean | undefined {
  const cached = context.booleans.get(executable.id);
  if (cached !== undefined || context.booleans.has(executable.id)) return cached;

  const node = executable.node;
  let result: boolean | undefined;
  if (node.kind === 'compare') {
    const left = readValue(context, node.id, 'left');
    const right = node.comparand === undefined ? readValue(context, node.id, 'right') : node.comparand;
    result = compareLiterals(left, node.operator, right);
  } else if (node.kind === 'and') {
    const left = readValue(context, node.id, 'a');
    const right = readValue(context, node.id, 'b');
    result = typeof left === 'boolean' && typeof right === 'boolean' ? left && right : undefined;
  }

  context.booleans.set(executable.id, result);
  return result;
}
