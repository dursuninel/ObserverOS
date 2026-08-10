import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { FACILITY_MODES, FACILITY_OPERATING_STATES, PRIORITIES } from '../../src/game/domain/facilities/Facility';
import { i18n } from '../../src/localization/i18n';

const requiredKeys = [
  'simulationDiagnostic.title', 'simulationDiagnostic.labels.population', 'simulationDiagnostic.labels.active',
  'simulationDiagnostic.labels.assigned', 'simulationDiagnostic.labels.available', 'simulationDiagnostic.labels.resting',
  'simulationDiagnostic.labels.traveling', 'simulationDiagnostic.labels.mineState', 'simulationDiagnostic.labels.mode',
  'simulationDiagnostic.labels.energyPriority', 'simulationDiagnostic.actions.pause', 'simulationDiagnostic.actions.advance60',
  'simulationDiagnostic.values.condition.healthy', 'simulationDiagnostic.values.condition.worn',
  'simulationDiagnostic.values.condition.critical', 'simulationDiagnostic.values.condition.failed',
  'simulationDiagnostic.values.maintenanceStatus.requested', 'simulationDiagnostic.values.maintenanceStatus.waiting-resources',
  'simulationDiagnostic.values.maintenanceStatus.waiting-workforce', 'simulationDiagnostic.values.maintenanceStatus.traveling',
  'simulationDiagnostic.values.maintenanceStatus.in-progress', 'simulationDiagnostic.values.maintenanceStatus.completed',
] as const;

describe('Turkish colony diagnostic localization', () => {
  it('contains every required Turkish diagnostic key', () => {
    for (const key of requiredKeys) expect(i18n.exists(key, { lng: 'tr' }), key).toBe(true);
  });

  it('does not leak raw English diagnostic labels from the component', () => {
    const source = readFileSync(resolve('src/game/ui/colony/SimulationDiagnostic.tsx'), 'utf8');
    for (const label of ['POPULATION', 'ACTIVE', 'ASSIGNED', 'AVAILABLE', 'RESTING', 'TRAVELING', 'CONDITION', 'WEAR', 'MAINTENANCE', 'HEALTHY', 'ONLINE', 'COMMAND']) {
      expect(source.includes(`>${label}<`), label).toBe(false);
    }
  });

  it('keeps canonical domain enum values unchanged while translating display values', () => {
    expect(FACILITY_MODES).toEqual(['eco', 'normal', 'boost']);
    expect(PRIORITIES).toEqual(['low', 'normal', 'high', 'critical']);
    expect(FACILITY_OPERATING_STATES).toEqual(['offline', 'starting', 'online', 'standby', 'maintenance', 'interlocked', 'failed']);
    expect(i18n.t('simulationDiagnostic.values.facilityState.online')).toBe('Aktif');
    expect(i18n.t('simulationDiagnostic.values.condition.healthy')).toBe('Sağlıklı');
  });
});
