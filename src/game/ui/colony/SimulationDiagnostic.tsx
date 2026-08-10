import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSimulationEngine, useSimulationSnapshot } from '../../../app/providers/simulationContext';
import type { FacilityCommandResult } from '../../domain/facilities/Facility';
import { SIMULATION_SPEEDS } from '../../simulation/SimulationClock';
import { createSimulationDiagnosticView, submitMineDiagnosticCommand, type MineDiagnosticCommand } from './simulationDiagnosticModel';

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

  return (
    <section aria-label={t('simulationDiagnostic.title')} className="simulation-diagnostic" data-testid="simulation-diagnostic">
      <div className="simulation-diagnostic-heading"><span>{t('simulationDiagnostic.title')}</span><span>DEV · PHASE 2</span></div>
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
      </div>
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
      <div aria-label={t('simulationDiagnostic.mineCommands')} className="simulation-diagnostic-actions">
        {(Object.keys(commandLabels) as MineDiagnosticCommand[]).map((command) => <button key={command} onClick={() => submit(command)} type="button">Mine {commandLabels[command]}</button>)}
      </div>
      <output className="simulation-command-result">
        {lastResult === null ? 'COMMAND: none' : `COMMAND: ${lastResult.status}${lastResult.reasonCode === undefined ? '' : ` · ${lastResult.reasonCode}`}`}
      </output>
    </section>
  );
}
