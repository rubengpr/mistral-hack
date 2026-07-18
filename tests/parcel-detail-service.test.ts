import { describe, expect, it } from 'vitest';

import {
  getParcelDetail,
  listParcelIds,
} from '@/lib/services/parcel-detail-service';

describe('parcel detail service', () => {
  it('lists every canonical parcel for static route generation', () => {
    expect(listParcelIds()).toHaveLength(24);
  });

  it('returns summary data without an alert for a stable parcel', () => {
    const detail = getParcelDetail('parcel-herault-01');

    expect(detail?.parcel.properties.name).toBe('Les Terrasses du Soleil');
    expect(detail?.activeFinding).toBeUndefined();
    expect(detail?.affectedSector).toBeUndefined();
  });

  it('includes the active finding and sector for the affected parcel', () => {
    const detail = getParcelDetail('parcel-herault-06');

    expect(detail?.activeFinding?.id).toBe('finding-soil-moisture-01');
    expect(detail?.affectedSector?.properties.id).toBe('sector-b');
  });

  it('returns undefined for an unknown parcel', () => {
    expect(getParcelDetail('unknown-parcel')).toBeUndefined();
  });
});
