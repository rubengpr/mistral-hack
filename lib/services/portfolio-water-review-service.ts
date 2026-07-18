import { getCanonicalDemoScenario } from '@/lib/fixtures/canonical-demo-scenario';
import { getWeatherForecast } from '@/lib/services/weather-forecast-service';
import type {
  OperationalStatus,
  ParcelCluster,
  ParcelCollection,
  ParcelReviewSummary,
} from '@/types/agricultural-operations';
import type {
  ClusterWaterAssessment,
  PortfolioWaterReview,
} from '@/types/weather';

const CLUSTERS: ParcelCluster[] = [
  'herault',
  'aude',
  'gard',
  'pyrenees-orientales',
];
const MAX_RECENT_RAINFALL_MILLIMETERS = 5;
const MIN_FORECAST_GAP_MILLIMETERS = 10;

export async function getPortfolioWaterReview(
  referenceDate?: string,
): Promise<PortfolioWaterReview> {
  const scenario = getCanonicalDemoScenario();
  const forecasts = await Promise.all(
    CLUSTERS.map((cluster) =>
      getWeatherForecast({ scope: 'cluster', cluster, referenceDate }),
    ),
  );
  const assessments = forecasts.map<ClusterWaterAssessment>((forecast) => {
    const forecastScope = forecast.scope;
    const cluster =
      forecastScope.scope === 'cluster'
        ? forecastScope.cluster
        : scenario.parcels.features.find(
            ({ properties }) => properties.id === forecastScope.parcelId,
          )?.properties.cluster;

    if (!cluster) {
      throw new Error('The weather forecast is missing its cluster.');
    }

    const clusterParcelIds = new Set(
      scenario.parcels.features
        .filter(({ properties }) => properties.cluster === cluster)
        .map(({ properties }) => properties.id),
    );
    const irrigationPlans = scenario.irrigationPlans.filter(({ parcelId }) =>
      clusterParcelIds.has(parcelId),
    );
    const scheduledIrrigationMillimeters =
      irrigationPlans.reduce(
        (sum, plan) => sum + plan.scheduledDepthMillimeters,
        0,
      ) / irrigationPlans.length;
    const forecastGapMillimeters = Number(
      Math.max(
        0,
        forecast.forecast.totalEvapotranspirationMillimeters -
          forecast.forecast.totalPrecipitationMillimeters -
          scheduledIrrigationMillimeters,
      ).toFixed(2),
    );
    const qualifies =
      forecast.recent.totalPrecipitationMillimeters <
        MAX_RECENT_RAINFALL_MILLIMETERS &&
      forecastGapMillimeters > MIN_FORECAST_GAP_MILLIMETERS;

    return {
      cluster,
      status: qualifies ? 'review' : 'normal',
      recentPrecipitationMillimeters:
        forecast.recent.totalPrecipitationMillimeters,
      forecastPrecipitationMillimeters:
        forecast.forecast.totalPrecipitationMillimeters,
      forecastEvapotranspirationMillimeters:
        forecast.forecast.totalEvapotranspirationMillimeters,
      scheduledIrrigationMillimeters,
      forecastGapMillimeters,
      maximumTemperatureCelsius: forecast.forecast.maximumTemperatureCelsius,
      forecastStartsOn: forecast.forecast.startsOn,
      forecastEndsOn: forecast.forecast.endsOn,
      source: forecast.source,
      quality: forecast.quality,
      rationale: qualifies
        ? 'Recent rainfall is limited and the seven-day atmospheric water demand exceeds forecast rainfall plus scheduled irrigation.'
        : 'The seven-day weather outlook does not exceed the regional review threshold.',
    };
  });
  const selected = assessments
    .filter(({ status }) => status === 'review')
    .toSorted(
      (left, right) =>
        right.forecastGapMillimeters - left.forecastGapMillimeters,
    )[0];

  return {
    selectedCluster: selected?.cluster,
    assessments: assessments.map((assessment) => ({
      ...assessment,
      status: assessment.cluster === selected?.cluster ? 'review' : 'normal',
    })),
    generatedAt: new Date().toISOString(),
    usedFallback: forecasts.some(({ source }) => source === 'fixture'),
  };
}

export function applyWaterReviewToParcels(
  parcels: ParcelCollection,
  review: PortfolioWaterReview,
): ParcelCollection {
  return {
    ...parcels,
    features: parcels.features.map((parcel) => {
      let operationalStatus: OperationalStatus = 'normal';

      if (parcel.properties.moistureStatus === 'critical') {
        operationalStatus = 'critical';
      } else if (parcel.properties.cluster === review.selectedCluster) {
        operationalStatus = 'review';
      }

      return {
        ...parcel,
        properties: { ...parcel.properties, operationalStatus },
      };
    }),
  };
}

export function createWaterReviewSummaries(
  review: PortfolioWaterReview,
): ParcelReviewSummary[] {
  const scenario = getCanonicalDemoScenario();
  const selected = review.assessments.find(
    ({ cluster }) => cluster === review.selectedCluster,
  );

  if (!selected) {
    return [];
  }

  return scenario.parcels.features
    .filter(({ properties }) => properties.cluster === selected.cluster)
    .map(({ properties }) => ({
      parcelId: properties.id,
      status: 'review',
      title: 'Irrigation plan review recommended',
      summary:
        'The seven-day outlook indicates that forecast rainfall and scheduled irrigation may not cover atmospheric water demand. Recalculate irrigation depth, volume, or duration for this parcel.',
      generatedAt: review.generatedAt,
      source: 'mistral-morning-review',
      quality: selected.quality,
      evidence: {
        recentPrecipitationMillimeters: selected.recentPrecipitationMillimeters,
        forecastPrecipitationMillimeters:
          selected.forecastPrecipitationMillimeters,
        forecastEvapotranspirationMillimeters:
          selected.forecastEvapotranspirationMillimeters,
        scheduledIrrigationMillimeters: selected.scheduledIrrigationMillimeters,
        forecastGapMillimeters: selected.forecastGapMillimeters,
        forecastStartsOn: selected.forecastStartsOn,
        forecastEndsOn: selected.forecastEndsOn,
      },
    }));
}
