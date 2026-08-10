import { useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { useSimulationEngine, useSimulationSnapshot } from '../../../app/providers/simulationContext';
import type { FacilityCommandResult, Priority } from '../../domain/facilities/Facility';
import { SIMULATION_SPEEDS } from '../../simulation/SimulationClock';
import { createSimulationDiagnosticView, submitMineConditionCommand, submitMineDiagnosticCommand, submitMineMaintenancePriorityCommand, type MineDiagnosticCommand } from './simulationDiagnosticModel';

function display(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function translatedValue(t: TFunction, group: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return t('simulationDiagnostic.values.none');
  return t(`simulationDiagnostic.values.${group}.${value}`, { defaultValue: value });
}

export function SimulationDiagnostic() {
  const { t } = useTranslation();
  const engine = useSimulationEngine();
  const snapshot = useSimulationSnapshot();
  const view = createSimulationDiagnosticView(snapshot);
  const commandSequence = useRef(0);
  const [lastResult, setLastResult] = useState<FacilityCommandResult | null>(null);

  const submit = (command: MineDiagnosticCommand) => {
    commandSequence.current += 1;
    setLastResult(submitMineDiagnosticCommand(engine, command, `dev-mine-command-${commandSequence.current.toString().padStart(4, '0')}`));
  };

  const submitCondition = (condition: number) => {
    commandSequence.current += 1;
    setLastResult(submitMineConditionCommand(engine, condition, `dev-mine-condition-${condition}-${commandSequence.current.toString().padStart(4, '0')}`));
  };

  const submitMaintenancePriority = (priority: Priority) => {
    commandSequence.current += 1;
    setLastResult(submitMineMaintenancePriorityCommand(engine, priority, `dev-mine-maintenance-${priority}-${commandSequence.current.toString().padStart(4, '0')}`));
  };

  return (
    <section aria-label={t('simulationDiagnostic.title')} className="simulation-diagnostic" data-testid="simulation-diagnostic">
      <div className="simulation-diagnostic-heading"><span>{t('simulationDiagnostic.title')}</span><span>{t('simulationDiagnostic.phaseBadge')}</span></div>
      <dl className="simulation-diagnostic-time">
        <div><dt>{t('simulationDiagnostic.labels.day')}</dt><dd>{view.time.dayIndex}</dd></div>
        <div><dt>{t('simulationDiagnostic.labels.localTime')}</dt><dd>{view.localTime}</dd></div>
        <div><dt>{t('simulationDiagnostic.labels.dayPhase')}</dt><dd>{translatedValue(t, 'dayPhase', view.time.dayPhase)}</dd></div>
        <div><dt>{t('simulationDiagnostic.labels.elapsed')}</dt><dd>{view.elapsedMinutes}</dd></div>
        <div><dt>{t('simulationDiagnostic.labels.speed')}</dt><dd>{view.speed === 0 ? t('simulationDiagnostic.values.paused') : `×${view.speed}`}</dd></div>
        <div><dt>{t('simulationDiagnostic.labels.simStep')}</dt><dd>{t('simulationDiagnostic.minutes', { count: view.simStepMinutes })}</dd></div>
        <div><dt>{t('simulationDiagnostic.labels.x1Rate')}</dt><dd>{t('simulationDiagnostic.x1Rate', { value: view.x1RealSecondsPerSimulationMinute.toFixed(3) })}</dd></div>
        <div><dt>{t('simulationDiagnostic.labels.worldPresentation')}</dt><dd>{view.speed === 0 ? t('simulationDiagnostic.values.paused') : t('simulationDiagnostic.values.running')}</dd></div>
      </dl>
      <div aria-label={t('simulationDiagnostic.speedControls')} className="simulation-diagnostic-actions">
        {SIMULATION_SPEEDS.map((speed) => <button aria-pressed={view.speed === speed} key={speed} onClick={() => engine.setSpeed(speed)} type="button">{speed === 0 ? t('simulationDiagnostic.actions.pause') : `×${speed}`}</button>)}
        <button onClick={() => engine.advanceFixedSteps(60)} type="button">{t('simulationDiagnostic.actions.advance60')}</button>
      </div>
      <dl className="simulation-diagnostic-time simulation-workforce-summary">
        <div><dt>{t('simulationDiagnostic.labels.population')}</dt><dd>{view.workforce.population}</dd></div>
        <div><dt title={t('simulationDiagnostic.help.active')}>{t('simulationDiagnostic.labels.active')}</dt><dd>{view.workforce.active}</dd></div>
        <div><dt title={t('simulationDiagnostic.help.assigned')}>{t('simulationDiagnostic.labels.assigned')}</dt><dd>{view.workforce.assigned}</dd></div>
        <div><dt title={t('simulationDiagnostic.help.available')}>{t('simulationDiagnostic.labels.available')}</dt><dd>{view.workforce.available}</dd></div>
        <div><dt title={t('simulationDiagnostic.help.resting')}>{t('simulationDiagnostic.labels.resting')}</dt><dd>{view.workforce.resting}</dd></div>
        <div><dt title={t('simulationDiagnostic.help.traveling')}>{t('simulationDiagnostic.labels.traveling')}</dt><dd>{view.workforce.traveling}</dd></div>
      </dl>
      <div className="simulation-travel-list">
        {view.travels.length === 0 ? <small>{t('simulationDiagnostic.empty.travel')}</small> : view.travels.map((travel) => <div key={travel.colonistId}>
          <strong>{travel.colonistId}</strong>
          <span>{t('simulationDiagnostic.travel.route', { from: translatedValue(t, 'location', travel.from), to: translatedValue(t, 'location', travel.to) })}</span>
          <small>{t('simulationDiagnostic.travel.detail', { progress: (travel.progress * 100).toFixed(0), purpose: translatedValue(t, 'travelPurpose', travel.purpose), remaining: display(travel.remainingMinutes) })}</small>
        </div>)}
      </div>
      <div className="simulation-resource-list">
        {view.resources.map((resource) => <div data-resource={resource.id} key={resource.id}>
          <strong>{translatedValue(t, 'resource', resource.id)}</strong>
          <span>{display(resource.stored)} / {display(resource.capacity)}</span>
          <small>{t('simulationDiagnostic.resourceRate', { consumption: display(resource.consumptionRate), net: display(resource.netRate), production: display(resource.productionRate) })}</small>
        </div>)}
      </div>
      <dl className="simulation-mine-state">
        <div><dt>{t('simulationDiagnostic.labels.mineState')}</dt><dd>{translatedValue(t, 'facilityState', view.mine?.state)}</dd></div>
        <div><dt>{t('simulationDiagnostic.labels.mode')}</dt><dd>{translatedValue(t, 'mode', view.mine?.mode)}</dd></div>
        <div><dt>{t('simulationDiagnostic.labels.energyPriority')}</dt><dd>{translatedValue(t, 'priority', view.mine?.energyPriority)}</dd></div>
      </dl>
      <div className="simulation-facility-workforce">
        {view.facilities.map((facility) => <div key={facility.id}>
          <strong>{translatedValue(t, 'location', facility.id)}</strong>
          <span>{t('simulationDiagnostic.facility.workforce', { assigned: facility.assignedWorkforce, nominal: facility.requiredNominalWorkforce, onSite: facility.effectiveWorkforce })}</span>
          <small title={t('simulationDiagnostic.help.condition')}>{t('simulationDiagnostic.facility.condition', { band: translatedValue(t, 'condition', facility.conditionBand), condition: display(facility.condition), wear: display(facility.wearRatePerHour) })}</small>
        </div>)}
      </div>
      <div className="simulation-maintenance-list">
        {view.maintenanceTasks.length === 0 ? <small>{t('simulationDiagnostic.empty.maintenance')}</small> : view.maintenanceTasks.map((task) => <div data-maintenance-facility={task.facilityId} key={task.id}>
          <strong>{translatedValue(t, 'location', task.facilityId)} · {translatedValue(t, 'maintenanceStatus', task.status)}</strong>
          <span>{t('simulationDiagnostic.maintenance.workforce', { assigned: task.workerIds.length, priority: translatedValue(t, 'priority', task.priority), required: task.workforceRequired })}</span>
          <small>{t('simulationDiagnostic.maintenance.detail', { consumed: task.materialConsumed ? t('simulationDiagnostic.values.consumed') : '', material: task.materialRequired, reason: task.reasonCode === null ? '' : ` · ${task.reasonCode}`, remaining: display(task.remainingMinutes) })}</small>
        </div>)}
      </div>
      <div aria-label={t('simulationDiagnostic.mineCommands')} className="simulation-diagnostic-actions">
        {(['boost', 'eco', 'normal', 'offline', 'online'] as const).map((command: MineDiagnosticCommand) => <button key={command} onClick={() => submit(command)} type="button">{t(`simulationDiagnostic.actions.mine.${command}`)}</button>)}
      </div>
      <div aria-label={t('simulationDiagnostic.conditionFixtures')} className="simulation-diagnostic-actions">
        {[59, 29, 0].map((condition) => <button key={condition} onClick={() => submitCondition(condition)} type="button">{t('simulationDiagnostic.actions.mineCondition', { condition })}</button>)}
      </div>
      <div aria-label={t('simulationDiagnostic.maintenancePriority')} className="simulation-diagnostic-actions">
        {(['low', 'normal', 'high', 'critical'] as const).map((priority) => <button key={priority} onClick={() => submitMaintenancePriority(priority)} type="button">{t('simulationDiagnostic.actions.maintenancePriority', { priority: translatedValue(t, 'priority', priority) })}</button>)}
      </div>
      <output className="simulation-command-result">
        {lastResult === null ? t('simulationDiagnostic.command.none') : t('simulationDiagnostic.command.result', { reason: lastResult.reasonCode === undefined ? '' : ` · ${lastResult.reasonCode}`, status: translatedValue(t, 'commandStatus', lastResult.status) })}
      </output>
    </section>
  );
}
