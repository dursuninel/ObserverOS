import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { COMPARE_OPERATORS, PROTOCOL_NODE_KINDS } from '../../src/game/domain/protocol/Protocol';
import { PROTOCOL_CONNECTION_REJECTIONS } from '../../src/game/ui/protocols/graph/protocolConnectionRules';
import { i18n } from '../../src/localization/i18n';
import { tr } from '../../src/localization/tr';

const OPERATOR_KEYS = ['above', 'atLeast', 'atMost', 'below', 'equal', 'notEqual'] as const;

/** §10.1 sözlüğünün kapsaması gereken bütün bağlantı noktaları. */
const PORTS = ['in', 'out', 'value', 'left', 'right', 'a', 'b', 'whenTrue', 'whenFalse', 'result'] as const;

function editorStrings(value: unknown, path: string, into: { key: string; text: string }[]): void {
  if (typeof value === 'string') {
    into.push({ key: path, text: value });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [name, child] of Object.entries(value)) editorStrings(child, `${path}.${name}`, into);
}

describe('protocol editor localization', () => {
  it('names every node the palette can add', () => {
    for (const kind of PROTOCOL_NODE_KINDS) {
      expect(i18n.exists(`protocolEditor.node.${kind}`, { lng: 'tr' }), kind).toBe(true);
      expect(i18n.exists(`protocolEditor.nodeDescription.${kind}`, { lng: 'tr' }), kind).toBe(true);
    }
  });

  it('has a screen wording for every connection point', () => {
    for (const port of PORTS) {
      expect(i18n.exists(`protocolEditor.port.${port}`, { lng: 'tr' }), port).toBe(true);
    }
  });

  it('explains every reason a connection can be refused', () => {
    for (const rejection of PROTOCOL_CONNECTION_REJECTIONS) {
      const text = i18n.t(`protocolEditor.connection.${rejection}`);
      expect(text.length, rejection).toBeGreaterThan(0);
      expect(text.includes('protocolEditor.'), rejection).toBe(false);
    }
  });

  it('has a card wording for every compare operator', () => {
    expect(OPERATOR_KEYS).toHaveLength(COMPARE_OPERATORS.length);
    for (const key of OPERATOR_KEYS) {
      expect(i18n.exists(`protocolEditor.card.condition.${key}`, { lng: 'tr' }), key).toBe(true);
    }
  });

  it('keeps every editor chrome label the screen needs', () => {
    for (const key of [
      'protocolEditor.back', 'protocolEditor.canvasLabel', 'protocolEditor.zoomIn', 'protocolEditor.zoomOut',
      'protocolEditor.zoomLevel', 'protocolEditor.fitView', 'protocolEditor.palette.title',
      'protocolEditor.detail.title', 'protocolEditor.detail.empty', 'protocolEditor.detail.delete',
      'protocolEditor.edge.yes', 'protocolEditor.edge.no', 'protocolManager.card.edit',
    ]) {
      expect(i18n.exists(key, { lng: 'tr' }), key).toBe(true);
    }
  });

  it('shows no engineering jargon on the editor surface (§72.6 satır 5455)', () => {
    const strings: { key: string; text: string }[] = [];
    editorStrings(tr.protocolEditor, 'protocolEditor', strings);
    expect(strings.length).toBeGreaterThan(30);
    const forbidden = /\b(boolean|pulse|execution|node|edge|port|tick|threshold|operator|flow)\b/i;
    for (const entry of strings) {
      expect(forbidden.test(entry.text), `${entry.key}: ${entry.text}`).toBe(false);
    }
  });

  it('does not hard-code Turkish editor copy in the components or model', () => {
    const files = [
      'src/game/ui/protocols/graph/ProtocolGraphEditor.tsx',
      'src/game/ui/protocols/graph/ProtocolNodeCard.tsx',
      'src/game/ui/protocols/graph/protocolConnectionRules.ts',
      'src/game/ui/protocols/graph/protocolFlowView.ts',
      'src/game/ui/protocols/graph/protocolNodePresentation.ts',
      'src/game/ui/protocols/ProtocolEditorRoute.tsx',
    ];
    // Türkçe'ye özgü harfler yalnız açıklama satırlarında geçebilir; JSX/dize içinde geçemez.
    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      const code = source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('/*'))
        .join('\n');
      expect(/'[^']*[çğıöşüÇĞİÖŞÜ][^']*'/.test(code), file).toBe(false);
    }
  });
});
