import type {
  ProtocolCapabilities,
  ProtocolNode,
  ProtocolValidationFinding,
} from '../../../domain/protocol/Protocol';
import type { ProtocolTranslate } from '../protocolSummary';
import { applyProtocolNodeField, protocolNodeFields, type ProtocolFieldId } from './protocolNodeFields';
import { nodeDescriptionKey, nodeLabelKey } from './protocolNodePresentation';

/**
 * Düğüm Ayarları paneli (tasarım §12).
 *
 * Alan listesi ve seçenekleri `protocolNodeFields` içinde üretilir; bu bileşen yalnız
 * onu çizer ve değişikliği yukarı bildirir. Panel hiçbir metni kendisi yazmaz, hiçbir
 * ölçüm/eylem adı uydurmaz ve düzenlenecek gerçek alanı olmayan düğümde (VE) sahte
 * alan göstermez.
 */

export function ProtocolNodeSettings({
  capabilities,
  findings,
  node,
  onChange,
  onDelete,
  summaryLines,
  t,
}: {
  readonly capabilities: ProtocolCapabilities;
  readonly findings: readonly ProtocolValidationFinding[];
  readonly node: ProtocolNode;
  readonly onChange: (node: ProtocolNode) => void;
  readonly onDelete: () => void;
  readonly summaryLines: readonly string[];
  readonly t: ProtocolTranslate;
}) {
  const fields = protocolNodeFields(node, capabilities, t);
  const change = (fieldId: ProtocolFieldId, raw: string): void => {
    onChange(applyProtocolNodeField(node, fieldId, raw, capabilities));
  };

  return (
    <div data-testid="protocol-detail">
      <p className="protocol-editor-detail-type" data-testid="protocol-detail-type">{t(nodeLabelKey(node.kind))}</p>
      <p className="protocol-editor-detail-description">{t(nodeDescriptionKey(node.kind))}</p>
      {summaryLines.map((line) => <p className="protocol-editor-detail-line" key={line}>{line}</p>)}

      {fields.map((field) => (
        <label className="protocol-field" data-required={field.required ? 'true' : 'false'} key={field.id}>
          <span className="protocol-field-label">{field.label}</span>
          <span className="protocol-field-control">
            {field.options === undefined
              ? (
                <input
                  data-testid={`protocol-field-${field.id}`}
                  onChange={(event) => change(field.id, event.target.value)}
                  type={field.control === 'number' ? 'number' : 'text'}
                  value={field.value}
                />
              )
              : (
                <select
                  data-testid={`protocol-field-${field.id}`}
                  onChange={(event) => change(field.id, event.target.value)}
                  value={field.value}
                >
                  {field.options.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
              )}
            {field.suffix === undefined ? null : <span className="protocol-field-suffix">{field.suffix}</span>}
          </span>
          {field.help === undefined ? null : <span className="protocol-field-help">{field.help}</span>}
        </label>
      ))}

      {findings.length === 0 ? null : (
        <ul className="protocol-field-findings" data-testid="protocol-detail-findings">
          {findings.map((finding) => (
            <li data-severity={finding.severity} key={finding.code}>
              <span className="protocol-finding-tag">{t(`protocolEditor.finding.${finding.severity}`)}</span>
              {t(finding.code)}
            </li>
          ))}
        </ul>
      )}

      <button
        className="protocol-editor-delete"
        data-testid="protocol-detail-delete"
        onClick={onDelete}
        type="button"
      >
        {t('protocolEditor.detail.delete')}
      </button>
    </div>
  );
}
