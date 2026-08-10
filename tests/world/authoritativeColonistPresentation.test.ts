import { describe, expect, it } from 'vitest';

import type { ColonistState } from '../../src/game/domain/workforce/Workforce';
import { getAuthoritativeColonistPose } from '../../src/game/world/prototype/authoritativeColonistPresentation';

const base: ColonistState = { assignment: null, id: 'colonist-002', locationId: 'habitat', restGroup: 1, state: 'available' };

describe('authoritative colonist world adapter', () => {
  it('renders Available and Resting colonists at stable habitat positions', () => {
    const available = getAuthoritativeColonistPose(base);
    const resting = getAuthoritativeColonistPose({ ...base, state: 'resting' });
    expect(available).toEqual(resting);
    expect(available).toMatchObject({ activity: false, animation: 'Idle', visible: true });
  });

  it('maps authoritative travel progress onto the target facility route', () => {
    const traveling = (elapsedMinutes: number): ColonistState => ({
      ...base,
      assignment: {
        facilityId: 'mine-01', id: 'work-operate-mine-01', phase: 'traveling', taskType: 'operate',
        travel: { durationMinutes: 12, elapsedMinutes, id: 'travel-1', sourceLocationId: 'habitat', startedAt: 0, targetFacilityId: 'mine-01', taskType: 'operate' },
      },
      state: 'working',
    });
    const start = getAuthoritativeColonistPose(traveling(0));
    const middle = getAuthoritativeColonistPose(traveling(6));
    const end = getAuthoritativeColonistPose(traveling(12));
    expect(start.animation).toBe('Walk');
    expect(middle.position).not.toEqual(start.position);
    expect(end.position).not.toEqual(middle.position);
  });

  it('hides indoor operation and shows outside maintenance at the work point', () => {
    const operation = getAuthoritativeColonistPose({
      ...base, state: 'working', assignment: { facilityId: 'mine-01', id: 'work-operate-mine-01', phase: 'on-site', taskType: 'operate', travel: null },
    });
    const maintenance = getAuthoritativeColonistPose({
      ...base, state: 'working', assignment: { facilityId: 'mine-01', id: 'work-maintenance-mine', phase: 'on-site', taskType: 'maintenance', travel: null },
    });
    expect(operation.visible).toBe(false);
    expect(maintenance).toMatchObject({ activity: true, animation: 'Idle', visible: true });
  });
});
