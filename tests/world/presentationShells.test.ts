import { describe, expect, it } from 'vitest';

import { ProtocolFlowBoundary } from '../../src/game/ui/protocols/ProtocolFlowBoundary';
import { WorldScene } from '../../src/game/world/renderer/WorldScene';

describe('Phase 0 presentation integration shells', () => {
  it('loads the R3F world renderer shell as a presentation component', () => {
    expect(WorldScene).toBeTypeOf('function');
  });

  it('loads the React Flow boundary without a protocol runtime', () => {
    expect(ProtocolFlowBoundary).toBeTypeOf('function');
  });
});
