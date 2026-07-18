import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/weather-forecast/route';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('weather forecast route', () => {
  it('requires exactly one parcel or cluster', async () => {
    const neither = await GET(
      new Request('http://localhost/api/weather-forecast'),
    );
    const both = await GET(
      new Request(
        'http://localhost/api/weather-forecast?parcelId=parcel-gard-01&cluster=gard',
      ),
    );

    expect(neither.status).toBe(400);
    expect(both.status).toBe(400);
  });

  it('returns a seven-day forecast for a valid parcel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));

    const response = await GET(
      new Request(
        'http://localhost/api/weather-forecast?parcelId=parcel-gard-01&referenceDate=2026-07-18',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: { source: 'fixture', locationLabel: expect.any(String) },
    });
    expect(body.data.forecast.daily).toHaveLength(7);
  });
});
