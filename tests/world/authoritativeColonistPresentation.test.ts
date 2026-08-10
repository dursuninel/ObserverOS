import { describe, expect, it } from 'vitest';

import type { ColonistState } from '../../src/game/domain/workforce/Workforce';
import { getAuthoritativeColonistPose } from '../../src/game/world/prototype/authoritativeColonistPresentation';

const base: ColonistState = { assignment: null, id: 'colonist-002', locationId: 'habitat', restDue: false, restGroup: 1, state: 'available', travel: null };

describe('authoritative colonist world adapter', () => {
  it('keeps Available and Resting colonists inside Habitat instead of rendering static outdoor models', () => {
    const available = getAuthoritativeColonistPose(base);
    const resting = getAuthoritativeColonistPose({ ...base, state: 'resting' });
    expect(available).toEqual(resting);
    expect(available).toMatchObject({ activity: false, animation: 'Idle', visible: false });
  });

  it('maps authoritative travel progress onto the target facility route', () => {
    const traveling = (elapsedMinutes: number): ColonistState => ({
      ...base,
      assignment: {
        facilityId: 'mine-01', id: 'work-operate-mine-01', phase: 'traveling', taskType: 'operate',
      },
      state: 'working',
      travel: { durationMinutes: 12, elapsedMinutes, id: 'travel-1', purpose: 'to-assignment', routeNodeIds: ['habitat-entrance', 'spine-habitat', 'spine-oxygen', 'spine-mine', 'mine-approach', 'mine-entrance'], sourceLocationId: 'habitat', startedAt: 0, targetLocationId: 'mine-01', taskType: 'operate' },
    });
    const start = getAuthoritativeColonistPose(traveling(0));
    const middle = getAuthoritativeColonistPose(traveling(6));
    const end = getAuthoritativeColonistPose(traveling(12));
    expect(start.animation).toBe('Walk');
    expect(middle.position).not.toEqual(start.position);
    expect(end.position).not.toEqual(middle.position);
    expect(start.visible).toBe(true);
  });

  it('keeps a maintenance worker visible while traveling to the work point', () => {
    const traveling: ColonistState = {
      ...base,
      assignment: { facilityId: 'mine-01', id: 'work-maintenance-mine-01', phase: 'traveling', taskType: 'maintenance' },
      state: 'working',
      travel: { durationMinutes: 12, elapsedMinutes: 6, id: 'maintenance-travel-1', purpose: 'to-assignment', routeNodeIds: ['habitat-entrance', 'spine-habitat', 'spine-oxygen', 'spine-mine', 'mine-approach', 'mine-entrance'], sourceLocationId: 'habitat', startedAt: 0, targetLocationId: 'mine-01', taskType: 'maintenance' },
    };
    expect(getAuthoritativeColonistPose(traveling)).toMatchObject({ activity: false, animation: 'Walk', visible: true });
  });

  it('hides indoor operation and uses an effect-only maintenance fallback at the work point', () => {
    const operation = getAuthoritativeColonistPose({
      ...base, state: 'working', assignment: { facilityId: 'mine-01', id: 'work-operate-mine-01', phase: 'on-site', taskType: 'operate' },
    });
    const maintenance = getAuthoritativeColonistPose({
      ...base, state: 'working', assignment: { facilityId: 'mine-01', id: 'work-maintenance-mine', phase: 'on-site', taskType: 'maintenance' },
    });
    expect(operation.visible).toBe(false);
    expect(maintenance).toMatchObject({ activity: true, animation: 'Idle', visible: false });
  });
});
