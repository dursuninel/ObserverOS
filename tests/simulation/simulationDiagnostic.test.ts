import { describe, expect, it } from 'vitest';

import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import { createSimulationDiagnosticView, submitMineDiagnosticCommand } from '../../src/game/ui/colony/simulationDiagnosticModel';

describe('Phase 2 simulation diagnostic model', () => {
  it('derives time, resources and Mine state only from SimulationSnapshot', () => {
    const engine = new SimulationEngine();
    engine.advanceFixedSteps(60);
    const view = createSimulationDiagnosticView(engine.getSnapshot());
    expect(view).toMatchObject({ elapsedMinutes: 60, localTime: '01:00', speed: 1 });
    expect(view.mine).toMatchObject({ energyPriority: 'normal', id: 'mine-01', mode: 'normal', state: 'online' });
    expect(view.resources.find(({ id }) => id === 'material')?.productionRate).toBe(12);
    expect(view.resources.find(({ id }) => id === 'material')?.stored).toBeCloseTo(12);
  });

  it('uses real command results and changes Mine Normal to Eco resource rates', () => {
    const engine = new SimulationEngine();
    expect(submitMineDiagnosticCommand(engine, 'eco', 'diagnostic-eco')).toEqual({ appliedValue: 'eco', requestId: 'diagnostic-eco', status: 'applied' });
    engine.advanceFixedSteps(60);
    const view = createSimulationDiagnosticView(engine.getSnapshot());
    expect(view.mine?.mode).toBe('eco');
    expect(view.resources.find(({ id }) => id === 'energy')?.consumptionRate).toBe(18);
    expect(view.resources.find(({ id }) => id === 'material')?.productionRate).toBe(6);
  });

  it('returns Mine from Eco to canonical Normal rates', () => {
    const engine = new SimulationEngine();
    submitMineDiagnosticCommand(engine, 'eco', 'diagnostic-eco');
    expect(submitMineDiagnosticCommand(engine, 'normal', 'diagnostic-normal').status).toBe('applied');
    engine.advanceFixedSteps(60);
    const view = createSimulationDiagnosticView(engine.getSnapshot());
    expect(view.mine?.mode).toBe('normal');
    expect(view.resources.find(({ id }) => id === 'energy')?.consumptionRate).toBe(28);
    expect(view.resources.find(({ id }) => id === 'material')?.productionRate).toBe(12);
  });

  it('cuts Mine output and consumption while Offline and restores it while Online', () => {
    const engine = new SimulationEngine();
    expect(submitMineDiagnosticCommand(engine, 'offline', 'diagnostic-offline').status).toBe('applied');
    engine.advanceFixedSteps(1);
    let view = createSimulationDiagnosticView(engine.getSnapshot());
    expect(view.mine?.state).toBe('offline');
    expect(view.resources.find(({ id }) => id === 'energy')?.consumptionRate).toBe(10);
    expect(view.resources.find(({ id }) => id === 'material')?.productionRate).toBe(0);
    expect(submitMineDiagnosticCommand(engine, 'online', 'diagnostic-online').status).toBe('applied');
    engine.advanceFixedSteps(1);
    view = createSimulationDiagnosticView(engine.getSnapshot());
    expect(view.mine?.state).toBe('online');
    expect(view.resources.find(({ id }) => id === 'energy')?.consumptionRate).toBe(28);
    expect(view.resources.find(({ id }) => id === 'material')?.productionRate).toBe(12);
  });
});
