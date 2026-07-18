import { describe, expect, it } from 'vitest';

import { getParcelCenter } from '@/lib/geo/parcel-center';

describe('getParcelCenter', () => {
  it('returns the center of polygon bounds', () => {
    expect(
      getParcelCenter({
        type: 'Polygon',
        coordinates: [
          [
            [2, 40],
            [4, 40],
            [4, 44],
            [2, 44],
            [2, 40],
          ],
        ],
      }),
    ).toEqual([3, 42]);
  });
});
