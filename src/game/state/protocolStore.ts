import { create } from 'zustand';

import { STARTER_PROTOCOLS } from '../content/protocols/starterProtocols';
import type { ProtocolCommandOutcome, ProtocolDefinition, ProtocolExecutionTrace } from '../domain/protocol/Protocol';
import { EMPTY_PROTOCOL_EXECUTION_LOG, reduceProtocolExecutionLog, type ProtocolExecutionLog } from './protocolExecutionLog';

/**
 * Protokol listesi ve son çalışma kayıtları — UI state katmanı.
 *
 * Burada yürütme YOKTUR: derleme/çalıştırma `src/game/simulation/protocol` altındaki
 * Faz 5 çekirdeğine aittir ve yeniden yazılmaz. Bu store yalnız düzenlenebilir
 * tanımları tutar ve Manager/Editor ekranlarına verir.
 */
interface ProtocolStoreState {
  readonly executions: ProtocolExecutionLog;
  readonly protocols: readonly ProtocolDefinition[];
  readonly recordExecutions: (
    traces: readonly ProtocolExecutionTrace[],
    outcomes: readonly ProtocolCommandOutcome[],
  ) => void;
  readonly replaceProtocols: (protocols: readonly ProtocolDefinition[]) => void;
  readonly upsertProtocol: (protocol: ProtocolDefinition) => void;
}

export const useProtocolStore = create<ProtocolStoreState>((set) => ({
  executions: EMPTY_PROTOCOL_EXECUTION_LOG,
  protocols: STARTER_PROTOCOLS,
  recordExecutions: (traces, outcomes) => {
    if (traces.length === 0 && outcomes.length === 0) return;
    set((state) => {
      const executions = reduceProtocolExecutionLog(state.executions, traces, outcomes);
      return executions === state.executions ? state : { executions };
    });
  },
  replaceProtocols: (protocols) => {
    set({ protocols: Object.freeze([...protocols]) });
  },
  upsertProtocol: (protocol) => {
    set((state) => {
      const index = state.protocols.findIndex(({ id }) => id === protocol.id);
      if (index < 0) return { protocols: Object.freeze([...state.protocols, protocol]) };
      const protocols = [...state.protocols];
      protocols[index] = protocol;
      return { protocols: Object.freeze(protocols) };
    });
  },
}));
