import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWeatherForecast = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/weather-forecast-service', () => ({
  getWeatherForecast,
}));

import { getCanonicalDemoScenario } from '@/lib/fixtures/canonical-demo-scenario';
import {
  applyWaterReviewToParcels,
  getPortfolioWaterReview,
} from '@/lib/services/portfolio-water-review-service';
import type { ParcelCluster } from '@/types/agricultural-operations';
import type { WeatherForecast } from '@/types/weather';

const PROFILES: Record<
  ParcelCluster,
  { recentRain: number; forecastRain: number; forecastEt0: number }
> = {
  herault: { recentRain: 0.1, forecastRain: 0.6, forecastEt0: 50.8 },
  aude: { recentRain: 0, forecastRain: 0, forecastEt0: 56 },
  gard: { recentRain: 0, forecastRain: 0, forecastEt0: 61.7 },
  'pyrenees-orientales': {
    recentRain: 0.6,
    forecastRain: 0,
    forecastEt0: 52.4,
  },
};

function forecast(cluster: ParcelCluster): WeatherForecast {
  const profile = PROFILES[cluster];
  return {
    source: 'open-meteo',
    sourceLabel: 'Open-Meteo modelled weather',
    quality: 'modelled',
    retrievedAt: '2026-07-18T08:00:00.000Z',
    latitude: 43,
    longitude: 4,
    timezone: 'Europe/Paris',
    locationLabel: cluster,
    scope: { scope: 'cluster', cluster },
    recent: {
      startsOn: '2026-07-11',
      endsOn: '2026-07-17',
      totalPrecipitationMillimeters: profile.recentRain,
      totalEvapotranspirationMillimeters: 40,
      daily: [],
    },
    forecast: {
      startsOn: '2026-07-18',
      endsOn: '2026-07-24',
      totalPrecipitationMillimeters: profile.forecastRain,
      maximumTemperatureCelsius: 38,
      totalEvapotranspirationMillimeters: profile.forecastEt0,
      daily: [],
    },
  };
}

beforeEach(() => {
  getWeatherForecast.mockImplementation(
    ({ cluster }: { cluster: ParcelCluster }) =>
      Promise.resolve(forecast(cluster)),
  );
});

describe('portfolio water review service', () => {
  it('selects only Gard and keeps its sensor moisture normal', async () => {
    const review = await getPortfolioWaterReview('2026-07-18');
    const parcels = applyWaterReviewToParcels(
      getCanonicalDemoScenario().parcels,
      review,
    );
    const gardParcels = parcels.features.filter(
      ({ properties }) => properties.cluster === 'gard',
    );

    expect(review.selectedCluster).toBe('gard');
    expect(
      review.assessments.filter(({ status }) => status === 'review'),
    ).toHaveLength(1);
    expect(gardParcels).toHaveLength(6);
    expect(
      gardParcels.every(
        ({ properties }) =>
          properties.operationalStatus === 'review' &&
          properties.moistureStatus === 'stable',
      ),
    ).toBe(true);
  });

  it('does not manufacture a regional review below the threshold', async () => {
    getWeatherForecast.mockImplementation(
      ({ cluster }: { cluster: ParcelCluster }) => {
        const value = forecast(cluster);
        value.forecast.totalEvapotranspirationMillimeters = 48;
        value.forecast.totalPrecipitationMillimeters = 4;
        return Promise.resolve(value);
      },
    );

    const review = await getPortfolioWaterReview('2026-07-18');

    expect(review.selectedCluster).toBeUndefined();
    expect(review.assessments.every(({ status }) => status === 'normal')).toBe(
      true,
    );
  });

  it('keeps a critical parcel above a regional review', async () => {
    const review = await getPortfolioWaterReview('2026-07-18');
    review.selectedCluster = 'herault';
    const parcels = applyWaterReviewToParcels(
      getCanonicalDemoScenario().parcels,
      review,
    );
    const critical = parcels.features.find(
      ({ properties }) => properties.id === 'parcel-herault-06',
    );

    expect(critical?.properties.operationalStatus).toBe('critical');
  });
});
