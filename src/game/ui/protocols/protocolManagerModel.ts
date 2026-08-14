import type { Priority } from '../../domain/facilities/Facility';
import type { ProtocolDefinition, ProtocolLifecycle } from '../../domain/protocol/Protocol';
import type { ProtocolExecutionLog, ProtocolExecutionRecord } from '../../state/protocolExecutionLog';
import { affectedFacilityIds, describeProtocol, facilityLabel, type ProtocolTranslate } from './protocolSummary';

/**
 * Protocol Manager kart modeli (spec §14.1).
 *
 * Kartın altı alanı: ad · durum · öncelik · otomatik kısa özet · etkilenen
 * sistemler · son çalışma durumu/zamanı. Hepsi protokol tanımından ve çalışma
 * kayıtlarından TÜRETİLİR; hiçbiri elle girilen bir metin değildir.
 *
 * MVP'de klasör/Protokol Grupları yoktur ve protokol/node sayısına yapay bir üst
 * sınır konmaz (§14.1); liste tamamı gösterilir.
 */

const PRIORITY_RANK: Readonly<Record<Priority, number>> = Object.freeze({
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
});

const LIFECYCLE_RANK: Readonly<Record<ProtocolLifecycle, number>> = Object.freeze({
  active: 0,
  validated: 1,
  draft: 2,
  disabled: 3,
  archived: 4,
});

export interface ProtocolCardModel {
  readonly affectedFacilityIds: readonly string[];
  readonly affectedFacilityLabels: readonly string[];
  readonly id: string;
  readonly lastExecution: ProtocolExecutionRecord | null;
  readonly lifecycle: ProtocolLifecycle;
  readonly name: string;
  readonly nodeCount: number;
  readonly priority: Priority;
  /** Arama için normalize edilmiş, görünen bütün metin. */
  readonly searchText: string;
  readonly summary: string;
  readonly version: number;
}

export interface ProtocolManagerFilter {
  /** Boş dizi = tesis filtresi yok. */
  readonly facilityIds: readonly string[];
  /** Boş dizi = durum filtresi yok. */
  readonly lifecycles: readonly ProtocolLifecycle[];
  /** Boş dizi = öncelik filtresi yok. */
  readonly priorities: readonly Priority[];
  readonly search: string;
}

export const EMPTY_PROTOCOL_FILTER: ProtocolManagerFilter = Object.freeze({
  facilityIds: Object.freeze([]),
  lifecycles: Object.freeze([]),
  priorities: Object.freeze([]),
  search: '',
});

/** Türkçe'de `I`/`İ` ayrımı doğru düşsün diye arama karşılaştırması `tr` locale'iyle yapılır. */
export function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase('tr').trim();
}

export function createProtocolCard(definition: ProtocolDefinition, log: ProtocolExecutionLog, t: ProtocolTranslate): ProtocolCardModel {
  const facilities = affectedFacilityIds(definition);
  const labels = facilities.map((facilityId) => facilityLabel(t, facilityId));
  const summary = describeProtocol(definition, t);
  return Object.freeze({
    affectedFacilityIds: facilities,
    affectedFacilityLabels: Object.freeze(labels),
    id: definition.id,
    lastExecution: log[definition.id] ?? null,
    lifecycle: definition.lifecycle,
    name: definition.name,
    nodeCount: definition.nodes.length,
    priority: definition.priority,
    searchText: normalizeSearchText([definition.name, definition.id, summary, ...labels].join(' ')),
    summary,
    version: definition.version,
  });
}

/** Durum, sonra öncelik, sonra ada göre stable sıralama. */
export function createProtocolCards(
  definitions: readonly ProtocolDefinition[],
  log: ProtocolExecutionLog,
  t: ProtocolTranslate,
): readonly ProtocolCardModel[] {
  const cards = definitions.map((definition) => createProtocolCard(definition, log, t));
  cards.sort((left, right) => {
    const lifecycle = LIFECYCLE_RANK[left.lifecycle] - LIFECYCLE_RANK[right.lifecycle];
    if (lifecycle !== 0) return lifecycle;
    const priority = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (priority !== 0) return priority;
    return left.name.localeCompare(right.name, 'tr');
  });
  return Object.freeze(cards);
}

export function filterProtocolCards(
  cards: readonly ProtocolCardModel[],
  filter: ProtocolManagerFilter,
): readonly ProtocolCardModel[] {
  const search = normalizeSearchText(filter.search);
  return Object.freeze(cards.filter((card) => {
    if (filter.lifecycles.length > 0 && !filter.lifecycles.includes(card.lifecycle)) return false;
    if (filter.priorities.length > 0 && !filter.priorities.includes(card.priority)) return false;
    if (filter.facilityIds.length > 0 && !card.affectedFacilityIds.some((id) => filter.facilityIds.includes(id))) return false;
    return search === '' || card.searchText.includes(search);
  }));
}

/** Filtre açılırlarının seçenekleri; listede gerçekten geçen tesislerden türer. */
export function protocolFacilityOptions(
  cards: readonly ProtocolCardModel[],
  t: ProtocolTranslate,
): readonly { readonly id: string; readonly label: string }[] {
  const ids = new Set<string>();
  for (const card of cards) for (const id of card.affectedFacilityIds) ids.add(id);
  return Object.freeze([...ids]
    .map((id) => Object.freeze({ id, label: facilityLabel(t, id) }))
    .sort((left, right) => left.label.localeCompare(right.label, 'tr')));
}

export function isProtocolFilterActive(filter: ProtocolManagerFilter): boolean {
  return filter.search.trim() !== ''
    || filter.lifecycles.length > 0
    || filter.priorities.length > 0
    || filter.facilityIds.length > 0;
}

/**
 * Simülasyon dakikasını yerel gün/saat metnine çevirir. Gerçek saat OKUNMAZ:
 * girdi yalnız yetkili simülasyon zamanıdır.
 */
export function formatSimulationTime(simTime: number, localDayMinutes: number, t: ProtocolTranslate): string {
  const dayIndex = Math.floor(simTime / localDayMinutes);
  const minuteOfDay = simTime - dayIndex * localDayMinutes;
  const hours = Math.floor(minuteOfDay / 60).toString().padStart(2, '0');
  const minutes = Math.floor(minuteOfDay % 60).toString().padStart(2, '0');
  return t('protocolManager.lastRun.at', { day: dayIndex + 1, time: `${hours}:${minutes}` });
}

/** Kartın "son çalışma" satırının tam metni; hiç çalışmamış protokol de bir cevap alır. */
export function formatLastExecution(
  record: ProtocolExecutionRecord | null,
  localDayMinutes: number,
  t: ProtocolTranslate,
): string {
  if (record === null) return t('protocolManager.lastRun.never');
  return t('protocolManager.lastRun.entry', {
    status: t(`protocolManager.lastRun.status.${record.status}`),
    time: formatSimulationTime(record.simTime, localDayMinutes, t),
  });
}
