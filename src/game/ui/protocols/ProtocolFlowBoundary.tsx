import { Background, ReactFlow } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const noNodes: Node[] = [];
const noEdges: Edge[] = [];

/** Editing integration boundary only; protocol execution does not occur here. */
export function ProtocolFlowBoundary() {
  return (
    <div aria-hidden="true" className="protocol-flow-shell">
      <ReactFlow edges={noEdges} nodes={noNodes} nodesDraggable={false}>
        <Background />
      </ReactFlow>
    </div>
  );
}
