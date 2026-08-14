import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

import type { ProtocolNodeKind } from '../../../domain/protocol/Protocol';
import { PROTOCOL_NODE_CARD_WIDTH, portOffsetY } from './protocolNodePresentation';

/**
 * Graph editor node kartı (tasarım §9).
 *
 * Kart iskeleti bütün türlerde AYNIDIR; tür ayrımı yalnız üç kanalda taşınır:
 * kimlik şeridi (CSS `data-kind`), ikon ve tür adı. Renk tek başına bilgi taşımaz
 * (§3.4c — sensör ile mantık renklerinin parlaklık farkı 1.00:1 ölçüldü).
 */

export interface ProtocolNodePortView {
  readonly label: string;
  readonly port: string;
}

export interface ProtocolNodeCardData extends Record<string, unknown> {
  /** Son doğrulamanın bu karta çapaladığı en ağır bulgu (tasarım §17.1/§17.2). */
  readonly finding?: 'error' | 'warning';
  readonly height: number;
  readonly inputs: readonly ProtocolNodePortView[];
  readonly kind: ProtocolNodeKind;
  readonly lines: readonly string[];
  readonly outputs: readonly ProtocolNodePortView[];
  readonly typeLabel: string;
}

export type ProtocolFlowNode = Node<ProtocolNodeCardData, 'protocolNode'>;

/** Tür ikonları (§9.3 "ikon yönü" sütunu). Dekoratif: bilgi ad ile de verilir. */
function NodeIcon({ kind }: { readonly kind: ProtocolNodeKind }) {
  const common = { 'aria-hidden': true, className: 'protocol-node-icon', height: 16, viewBox: '0 0 16 16', width: 16 } as const;
  switch (kind) {
    case 'trigger':
      return <svg {...common}><circle cx="4" cy="8" fill="currentColor" r="3" /><path d="M8 8h6m-2.5-2.5L14 8l-2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
    case 'sensor':
      return <svg {...common}><circle cx="8" cy="8" fill="none" r="6" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" fill="currentColor" r="2" /></svg>;
    case 'compare':
      return <svg {...common}><path d="M3 6h10M3 10h10M11 3l3 5-3 5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
    case 'and':
      return <svg {...common}><path d="M2 4h4l4 4m-8 4h4l4-4m0 0h4" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
    case 'delay':
      return <svg {...common}><circle cx="8" cy="8" fill="none" r="6" stroke="currentColor" strokeWidth="1.4" /><path d="M8 4.5V8l2.5 2" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
    case 'action':
      return <svg {...common}><path d="M2 5h12M2 11h12" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="6" cy="5" fill="currentColor" r="2.2" /><circle cx="10" cy="11" fill="currentColor" r="2.2" /></svg>;
  }
}

export function ProtocolNodeCard({ data, selected }: NodeProps<ProtocolFlowNode>) {
  return (
    <div
      className="protocol-node"
      data-finding={data.finding ?? 'none'}
      data-kind={data.kind}
      data-selected={selected === true ? 'true' : 'false'}
      data-testid={`protocol-node-${data.kind}`}
      style={{ height: data.height, width: PROTOCOL_NODE_CARD_WIDTH }}
    >
      <span aria-hidden="true" className="protocol-node-identity" />
      <header className="protocol-node-head">
        <NodeIcon kind={data.kind} />
        <span className="protocol-node-type">{data.typeLabel}</span>
      </header>
      <div className="protocol-node-body">
        {data.lines.map((line) => <p className="protocol-node-line" key={line}>{line}</p>)}
      </div>

      {data.inputs.map((input, index) => (
        <span className="protocol-port protocol-port-in" key={input.port} style={{ top: portOffsetY(index, data.kind) }}>
          <Handle
            className="protocol-port-dot"
            id={input.port}
            position={Position.Left}
            type="target"
          />
          <span className="protocol-port-label">{input.label}</span>
        </span>
      ))}

      {data.outputs.map((output, index) => (
        <span className="protocol-port protocol-port-out" key={output.port} style={{ top: portOffsetY(index, data.kind) }}>
          <span className="protocol-port-label">{output.label}</span>
          <Handle
            className="protocol-port-dot"
            id={output.port}
            position={Position.Right}
            type="source"
          />
        </span>
      ))}
    </div>
  );
}
