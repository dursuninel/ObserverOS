import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { STARTER_PROTOCOLS } from '../../src/game/content/protocols/starterProtocols';
import {
  COMPARE_OPERATORS,
  PROTOCOL_ERROR_CODES,
  PROTOCOL_NODE_KINDS,
  PROTOCOL_WARNING_CODES,
} from '../../src/game/domain/protocol/Protocol';
import { PHASE_FIVE_PROTOCOL_LIMITS, PHASE_THREE_BASELINE_CONFIG } from '../../src/game/simulation/SimulationConfig';
import { buildProtocolCapabilities } from '../../src/game/simulation/protocol/protocolCapabilityBridge';
import { PROTOCOL_CONNECTION_REJECTIONS } from '../../src/game/ui/protocols/graph/protocolConnectionRules';
import { createEditorNode } from '../../src/game/ui/protocols/graph/protocolEditorModel';
import { protocolNodeFields } from '../../src/game/ui/protocols/graph/protocolNodeFields';
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
      'protocolEditor.actions.check', 'protocolEditor.actions.apply', 'protocolEditor.actions.saveDraft',
      'protocolEditor.unsaved', 'protocolEditor.check.clean', 'protocolEditor.check.problems',
      'protocolEditor.check.warnings', 'protocolEditor.check.warningsHint', 'protocolEditor.check.more',
      'protocolEditor.check.dismiss', 'protocolEditor.check.focus',
      'protocolEditor.apply.blockedUnchecked', 'protocolEditor.apply.blockedInvalid',
      'protocolEditor.apply.done', 'protocolEditor.apply.savedDraft',
      'protocolEditor.finding.error', 'protocolEditor.finding.warning',
    ]) {
      expect(i18n.exists(key, { lng: 'tr' }), key).toBe(true);
    }
  });

  it('has a selection wording for every compare operator (§12.3)', () => {
    for (const key of OPERATOR_KEYS) {
      expect(i18n.exists(`protocolEditor.operatorChoice.${key}`, { lng: 'tr' }), key).toBe(true);
    }
  });

  it('resolves every settings field label, help and option a node can show', () => {
    const capabilities = buildProtocolCapabilities({
      definitions: PHASE_THREE_BASELINE_CONFIG.facilities,
      limits: PHASE_FIVE_PROTOCOL_LIMITS,
      protocols: STARTER_PROTOCOLS,
    });
    const t = (key: string, params?: Readonly<Record<string, string | number>>): string => i18n.t(key, params ?? {});
    const leaked: string[] = [];
    for (const kind of PROTOCOL_NODE_KINDS) {
      for (const field of protocolNodeFields(createEditorNode(kind, `${kind}-1`, PHASE_FIVE_PROTOCOL_LIMITS), capabilities, t)) {
        const texts = [field.label, field.help ?? '', field.suffix ?? '', ...(field.options ?? []).map((choice) => choice.label)];
        for (const text of texts) {
          if (text.includes('protocolEditor.') || text.includes('protocolManager.')) leaked.push(`${kind}/${field.id}: ${text}`);
        }
      }
    }
    expect(leaked).toEqual([]);
  });

  it('gives every validation finding a Turkish sentence instead of its code', () => {
    for (const code of [...PROTOCOL_ERROR_CODES, ...PROTOCOL_WARNING_CODES]) {
      const text = i18n.t(code);
      expect(text, code).not.toBe(code);
      expect(text.includes('protocol.'), code).toBe(false);
      expect(text.length, code).toBeGreaterThan(10);
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
      'src/game/ui/protocols/graph/protocolNodeFields.ts',
      'src/game/ui/protocols/graph/ProtocolNodeSettings.tsx',
      'src/game/ui/protocols/protocolDraftModel.ts',
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
