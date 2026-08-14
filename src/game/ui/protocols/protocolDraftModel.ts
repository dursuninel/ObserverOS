import type {
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolValidationFinding,
  ProtocolValidationReport,
} from '../../domain/protocol/Protocol';
import { compileProtocol, type ExecutableProtocol } from '../../simulation/protocol/protocolCompiler';
import { validateProtocol } from '../../simulation/protocol/protocolValidator';

/**
 * Taslak → uygulama durum makinesi (spec §11 lifecycle, §14.2 satır 1058-1060).
 *
 * Kurallar burada, bileşende değil: `Kontrol Et` YALNIZ statik doğrulama çalıştırır
 * (graph/tip/bağlantı/zorunlu alan) — gelecek sonucu ÇÖZMEZ, simülasyonu ilerletmez.
 * `Uygula` yalnız doğrulaması güncel ve hatasız bir taslakta açılır; uyarı engellemez
 * (§53.3). Doğrulayıcı ve derleyici Faz 5'e aittir, burada yeniden yazılmaz.
 *
 * Modül saftır: React/store/tarayıcı bağımlılığı yoktur.
 */

/** `Uygula` neden kapalı? Metin değil kod taşınır. */
export const PROTOCOL_APPLY_BLOCKS = ['unchecked', 'invalid'] as const;
export type ProtocolApplyBlock = (typeof PROTOCOL_APPLY_BLOCKS)[number];

export interface ProtocolDraftState {
  readonly definition: ProtocolDefinition;
  /** Yayındaki (store'daki) hâlden farklı, kaydedilmemiş değişiklik var mı. */
  readonly dirty: boolean;
  /** `Kontrol Et` sonucu; her düzenlemede düşer — eski rapor taze sayılmaz. */
  readonly report: ProtocolValidationReport | undefined;
}

export function createProtocolDraft(definition: ProtocolDefinition): ProtocolDraftState {
  return Object.freeze({ definition, dirty: false, report: undefined });
}

/** Graph veya alan düzenlemesi: rapor bayatlar, taslak kirlenir. */
export function editProtocolDraft(state: ProtocolDraftState, definition: ProtocolDefinition): ProtocolDraftState {
  if (definition === state.definition) return state;
  return Object.freeze({ definition, dirty: true, report: undefined });
}

export function checkProtocolDraft(state: ProtocolDraftState, capabilities: ProtocolCapabilities): ProtocolDraftState {
  return Object.freeze({ ...state, report: validateProtocol(state.definition, capabilities) });
}

export function protocolApplyBlock(state: ProtocolDraftState): ProtocolApplyBlock | undefined {
  if (state.report === undefined) return 'unchecked';
  return state.report.valid ? undefined : 'invalid';
}

export interface ProtocolFindingCounts {
  readonly errors: number;
  readonly warnings: number;
}

export function protocolFindingCounts(report: ProtocolValidationReport | undefined): ProtocolFindingCounts {
  const findings = report?.findings ?? [];
  return Object.freeze({
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
  });
}

/** Hata her zaman uyarıyı bastırır: bir düğüm ikisini birden taşıyorsa sınır hata rengindedir. */
function severityOf(findings: readonly ProtocolValidationFinding[]): 'error' | 'warning' | undefined {
  if (findings.some((finding) => finding.severity === 'error')) return 'error';
  return findings.length === 0 ? undefined : 'warning';
}

export function nodeFindingSeverity(report: ProtocolValidationReport | undefined, nodeId: string): 'error' | 'warning' | undefined {
  return severityOf((report?.findings ?? []).filter((finding) => finding.nodeId === nodeId));
}

export function edgeFindingSeverity(report: ProtocolValidationReport | undefined, edgeId: string): 'error' | 'warning' | undefined {
  return severityOf((report?.findings ?? []).filter((finding) => finding.edgeId === edgeId));
}

/**
 * Bulgu kodunun kendisi localization anahtarıdır (`protocol.error.*` / `protocol.warning.*`);
 * oyuncuya kod DEĞİL bu anahtarın Türkçe karşılığı gösterilir (§13.11).
 */
export function protocolFindingKey(finding: ProtocolValidationFinding): string {
  return finding.code;
}

/** Protokol düzeyindeki bulgular (bir düğüme/bağlantıya çapalanmamış olanlar) önce listelenir. */
export function orderedFindings(report: ProtocolValidationReport | undefined): readonly ProtocolValidationFinding[] {
  const findings = report?.findings ?? [];
  const rank = (finding: ProtocolValidationFinding): number =>
    (finding.severity === 'error' ? 0 : 2) + (finding.nodeId === undefined && finding.edgeId === undefined ? 0 : 1);
  return Object.freeze([...findings].sort((left, right) => rank(left) - rank(right)));
}

/**
 * §11: Uygula → `active`. Sürüm her uygulamada bir artar; kart üzerindeki sürüm
 * numarası (§14.1) böylece yayına giren hâli sayar, düzenleme sayısını değil.
 */
export function appliedProtocol(definition: ProtocolDefinition): ProtocolDefinition {
  return Object.freeze({ ...definition, lifecycle: 'active', version: definition.version + 1 });
}

/** §11: taslak kaydı yayına almaz; geçersiz taslak da kaydedilebilir. */
export function savedDraftProtocol(definition: ProtocolDefinition): ProtocolDefinition {
  return Object.freeze({ ...definition, lifecycle: definition.lifecycle === 'active' ? 'active' : 'draft' });
}

/**
 * Kitaplıktaki `active` protokollerin çalıştırılabilir karşılığı.
 *
 * Derlemesi reddedilen protokol koşan kümeye ALINMAZ (motorun yarım graph
 * çalıştırması engellenir); kimliği çağırana rapor edilir.
 */
export interface CompiledProtocolLibrary {
  readonly programs: readonly ExecutableProtocol[];
  readonly rejectedIds: readonly string[];
}

export function compileActiveProtocols(
  protocols: readonly ProtocolDefinition[],
  capabilities: ProtocolCapabilities,
): CompiledProtocolLibrary {
  const programs: ExecutableProtocol[] = [];
  const rejectedIds: string[] = [];
  for (const definition of [...protocols].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))) {
    if (definition.lifecycle !== 'active') continue;
    const result = compileProtocol(definition, capabilities);
    if (result.status === 'compiled') programs.push(result.protocol);
    else rejectedIds.push(definition.id);
  }
  return Object.freeze({ programs: Object.freeze(programs), rejectedIds: Object.freeze(rejectedIds) });
}
