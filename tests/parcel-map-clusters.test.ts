import { describe, expect, it } from 'vitest';

import {
  createClusterPoints,
  getMapLabelColor,
} from '@/components/features/operations-workspace/parcel-map';
import { getCanonicalDemoScenario } from '@/lib/fixtures/canonical-demo-scenario';

describe('parcel map cluster summaries', () => {
  it('aggregates flagged parcel counts and the highest-priority status', () => {
    const clusters = createClusterPoints(
      getCanonicalDemoScenario().parcels,
    ).features;
    const summaries = Object.fromEntries(
      clusters.map(({ properties }) => [properties.cluster, properties]),
    );

    expect(summaries.herault).toMatchObject({
      totalCount: 6,
      flaggedCount: 1,
      moistureStatus: 'critical',
    });
    expect(summaries.aude).toMatchObject({
      totalCount: 6,
      flaggedCount: 1,
      moistureStatus: 'watch',
    });
    expect(summaries.gard).toMatchObject({
      totalCount: 6,
      flaggedCount: 0,
      moistureStatus: 'stable',
    });
    expect(summaries['pyrenees-orientales']).toMatchObject({
      totalCount: 6,
      flaggedCount: 0,
      moistureStatus: 'stable',
    });
  });

  it('uses neutral labels by default and status colors when enabled', () => {
    expect(getMapLabelColor('stable', false)).toBe('#2f3632');
    expect(getMapLabelColor('critical', false)).toBe('#2f3632');
    expect(getMapLabelColor('stable', true)).toBe('#4f7f5e');
    expect(getMapLabelColor('watch', true)).toBe('#d39a3c');
    expect(getMapLabelColor('critical', true)).toBe('#b55448');
  });
});
