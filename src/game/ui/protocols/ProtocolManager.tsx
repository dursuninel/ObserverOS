import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useSimulationEngine, useSimulationSnapshot } from '../../../app/providers/simulationContext';
import { PRIORITIES, type Priority } from '../../domain/facilities/Facility';
import { PROTOCOL_LIFECYCLES, type ProtocolLifecycle } from '../../domain/protocol/Protocol';
import { useProtocolStore } from '../../state/protocolStore';
import { PHASE_THREE_BASELINE_CONFIG } from '../../simulation/SimulationConfig';
import {
  createProtocolCards,
  filterProtocolCards,
  formatLastExecution,
  isProtocolFilterActive,
  protocolFacilityOptions,
  type ProtocolCardModel,
  type ProtocolManagerFilter,
} from './protocolManagerModel';
import type { ProtocolTranslate } from './protocolSummary';

/**
 * PROTOKOLLER ana ekranı (spec §14.1): doğrudan graph DEĞİL, manager'dır.
 *
 * Kartlar protokol tanımından türetilir; arama ve filtreler yalnız görüntülemeyi
 * daraltır, hiçbir protokolü değiştirmez. MVP'de klasör yoktur ve listeye yapay
 * bir üst sınır konmaz — filtre sonucunun tamamı gösterilir.
 */

const LOCAL_DAY_MINUTES = PHASE_THREE_BASELINE_CONFIG.clock.localDayMinutes;

function toggle<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function ProtocolCard({ card, t }: { readonly card: ProtocolCardModel; readonly t: ProtocolTranslate }) {
  return (
    <article aria-labelledby={`protocol-card-${card.id}`} className="protocol-card" data-lifecycle={card.lifecycle} data-testid="protocol-card">
      <header className="protocol-card-header">
        <h2 id={`protocol-card-${card.id}`}>{card.name}</h2>
        <span className="protocol-badge" data-lifecycle={card.lifecycle}>{t(`protocolManager.lifecycle.${card.lifecycle}`)}</span>
      </header>
      <p className="protocol-card-meta">
        <span className="protocol-priority" data-priority={card.priority}>
          {t('protocolManager.card.priority')} · {t(`protocolManager.priority.${card.priority}`)}
        </span>
        <span>{t('protocolManager.card.scale', { nodes: card.nodeCount, version: card.version })}</span>
      </p>
      <dl className="protocol-card-fields">
        <div>
          <dt>{t('protocolManager.card.summary')}</dt>
          <dd className="protocol-card-summary">{card.summary}</dd>
        </div>
        <div>
          <dt>{t('protocolManager.card.affected')}</dt>
          <dd>
            {card.affectedFacilityLabels.length === 0
              ? t('protocolManager.card.noFacility')
              : card.affectedFacilityLabels.map((label) => <span className="protocol-chip" key={label}>{label}</span>)}
          </dd>
        </div>
        <div>
          <dt>{t('protocolManager.card.lastRun')}</dt>
          <dd data-testid="protocol-card-last-run">{formatLastExecution(card.lastExecution, LOCAL_DAY_MINUTES, t)}</dd>
        </div>
      </dl>
      <Link className="protocol-card-edit" data-testid={`protocol-card-edit-${card.id}`} to={`/protocols/${card.id}`}>
        {t('protocolManager.card.edit')}
      </Link>
    </article>
  );
}

export function ProtocolManager() {
  const { t: translate } = useTranslation();
  const t = translate as ProtocolTranslate;
  const engine = useSimulationEngine();
  const snapshot = useSimulationSnapshot();
  const protocols = useProtocolStore((state) => state.protocols);
  const executions = useProtocolStore((state) => state.executions);
  const recordExecutions = useProtocolStore((state) => state.recordExecutions);

  // Son çalışma alanı yetkili simülasyondan beslenir; UI kendi zamanını uydurmaz.
  useEffect(() => {
    recordExecutions(engine.getProtocolExecutionTraces(), engine.getProtocolCommandOutcomes());
  }, [engine, recordExecutions, snapshot.revision]);

  const [search, setSearch] = useState('');
  const [lifecycles, setLifecycles] = useState<readonly ProtocolLifecycle[]>([]);
  const [priorities, setPriorities] = useState<readonly Priority[]>([]);
  const [facilityIds, setFacilityIds] = useState<readonly string[]>([]);

  const cards = useMemo(() => createProtocolCards(protocols, executions, t), [executions, protocols, t]);
  const facilityOptions = useMemo(() => protocolFacilityOptions(cards, t), [cards, t]);
  const filter: ProtocolManagerFilter = { facilityIds, lifecycles, priorities, search };
  const visible = filterProtocolCards(cards, filter);
  const filtered = isProtocolFilterActive(filter);

  const clearFilters = () => {
    setSearch('');
    setLifecycles([]);
    setPriorities([]);
    setFacilityIds([]);
  };

  return (
    <section aria-labelledby="protocol-manager-heading" className="protocol-manager" data-testid="protocol-manager">
      <div className="protocol-manager-intro">
        <h1 id="protocol-manager-heading">{t('protocolManager.title')}</h1>
        <p>{t('protocolManager.intro')}</p>
      </div>

      <div aria-label={t('protocolManager.filters.label')} className="protocol-toolbar" role="search">
        <label className="protocol-search">
          <span>{t('protocolManager.search.label')}</span>
          <input
            data-testid="protocol-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('protocolManager.search.placeholder')}
            type="search"
            value={search}
          />
        </label>

        <div className="protocol-filter-group">
          <span className="protocol-filter-label">{t('protocolManager.filters.lifecycle')}</span>
          <div className="protocol-chip-row">
            {PROTOCOL_LIFECYCLES.map((lifecycle) => (
              <button
                aria-pressed={lifecycles.includes(lifecycle)}
                className="protocol-filter-chip"
                data-testid={`protocol-lifecycle-${lifecycle}`}
                key={lifecycle}
                onClick={() => setLifecycles((current) => toggle(current, lifecycle))}
                type="button"
              >
                {t(`protocolManager.lifecycle.${lifecycle}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="protocol-filter-group">
          <span className="protocol-filter-label">{t('protocolManager.filters.priority')}</span>
          <div className="protocol-chip-row">
            {PRIORITIES.map((priority) => (
              <button
                aria-pressed={priorities.includes(priority)}
                className="protocol-filter-chip"
                data-testid={`protocol-priority-${priority}`}
                key={priority}
                onClick={() => setPriorities((current) => toggle(current, priority))}
                type="button"
              >
                {t(`protocolManager.priority.${priority}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="protocol-filter-group protocol-facility-filter">
          <span className="protocol-filter-label">{t('protocolManager.filters.facility')}</span>
          <select
            data-testid="protocol-facility-filter"
            onChange={(event) => setFacilityIds(event.target.value === '' ? [] : [event.target.value])}
            value={facilityIds[0] ?? ''}
          >
            <option value="">{t('protocolManager.filters.allFacilities')}</option>
            {facilityOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>

        <button
          className="protocol-clear-filters"
          data-testid="protocol-clear-filters"
          disabled={!filtered}
          onClick={clearFilters}
          type="button"
        >
          {t('protocolManager.filters.clear')}
        </button>
      </div>

      <p aria-live="polite" className="protocol-result-count" data-testid="protocol-result-count">
        {t('protocolManager.results.count', { shown: visible.length, total: cards.length })}
      </p>

      {visible.length === 0
        ? <p className="protocol-empty" data-testid="protocol-empty">{t(cards.length === 0 ? 'protocolManager.results.emptyLibrary' : 'protocolManager.results.empty')}</p>
        : <div className="protocol-card-grid">{visible.map((card) => <ProtocolCard card={card} key={card.id} t={t} />)}</div>}
    </section>
  );
}
