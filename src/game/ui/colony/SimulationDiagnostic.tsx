import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSimulationEngine, useSimulationSnapshot } from '../../../app/providers/simulationContext';
import type { FacilityCommandResult } from '../../domain/facilities/Facility';
import type { Priority } from '../../domain/facilities/Facility';
import { SIMULATION_SPEEDS } from '../../simulation/SimulationClock';
import { createSimulationDiagnosticView, submitMineConditionCommand, submitMineDiagnosticCommand, submitMineMaintenancePriorityCommand, type MineDiagnosticCommand } from './simulationDiagnosticModel';

const commandLabels: Readonly<Record<MineDiagnosticCommand, string>> = {
  boost: 'Boost', eco: 'Eco', normal: 'Normal', offline: 'Offline', online: 'Online',
};

function display(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
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
      <div className="simulation-diagnostic-heading"><span>{t('simulationDiagnostic.title')}</span><span>DEV · PHASE 3</span></div>
      <dl className="simulation-diagnostic-time">
        <div><dt>DAY</dt><dd>{view.time.dayIndex}</dd></div>
        <div><dt>LOCAL (SIM)</dt><dd>{view.localTime}</dd></div>
        <div><dt>PHASE</dt><dd>{view.time.dayPhase}</dd></div>
        <div><dt>ELAPSED</dt><dd>{view.elapsedMinutes}</dd></div>
        <div><dt>SPEED</dt><dd>{view.speed === 0 ? 'Pause' : `×${view.speed}`}</dd></div>
        <div><dt>SIM STEP</dt><dd>{view.simStepMinutes} dk</dd></div>
        <div><dt>×1 RATE</dt><dd>1 sim dk ≈ {view.x1RealSecondsPerSimulationMinute.toFixed(3)} gerçek sn</dd></div>
        <div><dt>WORLD PRESENTATION</dt><dd>{view.worldPresentation}</dd></div>
      </dl>
      <div aria-label={t('simulationDiagnostic.speedControls')} className="simulation-diagnostic-actions">
        {SIMULATION_SPEEDS.map((speed) => <button aria-pressed={view.speed === speed} key={speed} onClick={() => engine.setSpeed(speed)} type="button">{speed === 0 ? 'Pause' : `×${speed}`}</button>)}
        <button onClick={() => engine.advanceFixedSteps(60)} type="button">Advance +60m</button>
      </div>
      <dl className="simulation-diagnostic-time simulation-workforce-summary">
        <div><dt>POPULATION</dt><dd>{view.workforce.population}</dd></div>
        <div><dt>ACTIVE</dt><dd>{view.workforce.active}</dd></div>
        <div><dt>ASSIGNED</dt><dd>{view.workforce.assigned}</dd></div>
        <div><dt>AVAILABLE</dt><dd>{view.workforce.available}</dd></div>
        <div><dt>RESTING</dt><dd>{view.workforce.resting}</dd></div>
      </dl>
      <div className="simulation-resource-list">
        {view.resources.map((resource) => <div data-resource={resource.id} key={resource.id}>
          <strong>{resource.id.toUpperCase()}</strong>
          <span>{display(resource.stored)} / {display(resource.capacity)}</span>
          <small>+{display(resource.productionRate)} −{display(resource.consumptionRate)} = {display(resource.netRate)}/h</small>
        </div>)}
      </div>
      <dl className="simulation-mine-state">
        <div><dt>MINE STATE</dt><dd>{view.mine?.state ?? 'missing'}</dd></div>
        <div><dt>MODE</dt><dd>{view.mine?.mode ?? 'none'}</dd></div>
        <div><dt>ENERGY PRIORITY</dt><dd>{view.mine?.energyPriority ?? 'none'}</dd></div>
      </dl>
      <div className="simulation-facility-workforce">
        {view.facilities.map((facility) => <div key={facility.id}>
          <strong>{facility.id.toUpperCase()}</strong>
          <span>WORK {facility.assignedWorkforce}/{facility.requiredNominalWorkforce} · ON SITE {facility.effectiveWorkforce}</span>
          <small>CONDITION {display(facility.condition)} · {facility.conditionBand.toUpperCase()} · WEAR {display(facility.wearRatePerHour)}/h</small>
        </div>)}
      </div>
      <div className="simulation-maintenance-list">
        {view.maintenanceTasks.length === 0 ? <small>MAINTENANCE: none</small> : view.maintenanceTasks.map((task) => <div data-maintenance-facility={task.facilityId} key={task.id}>
          <strong>{task.facilityId.toUpperCase()} · {task.status.toUpperCase()}</strong>
          <span>PRIORITY {task.priority.toUpperCase()} · WORKERS {task.workerIds.length}/{task.workforceRequired}</span>
          <small>MATERIAL {task.materialRequired}{task.materialConsumed ? ' · CONSUMED' : ''} · REMAINING {display(task.remainingMinutes)} sim dk{task.reasonCode === null ? '' : ` · ${task.reasonCode}`}</small>
        </div>)}
      </div>
      <div aria-label={t('simulationDiagnostic.mineCommands')} className="simulation-diagnostic-actions">
        {(Object.keys(commandLabels) as MineDiagnosticCommand[]).map((command) => <button key={command} onClick={() => submit(command)} type="button">Mine {commandLabels[command]}</button>)}
      </div>
      <div aria-label="Mine condition fixtures" className="simulation-diagnostic-actions">
        {[59, 29, 0].map((condition) => <button key={condition} onClick={() => submitCondition(condition)} type="button">Mine Condition {condition}</button>)}
      </div>
      <div aria-label="Mine maintenance priority" className="simulation-diagnostic-actions">
        {(['low', 'normal', 'high', 'critical'] as const).map((priority) => <button key={priority} onClick={() => submitMaintenancePriority(priority)} type="button">Maint {priority}</button>)}
      </div>
      <output className="simulation-command-result">
        {lastResult === null ? 'COMMAND: none' : `COMMAND: ${lastResult.status}${lastResult.reasonCode === undefined ? '' : ` · ${lastResult.reasonCode}`}`}
      </output>
    </section>
  );
}
