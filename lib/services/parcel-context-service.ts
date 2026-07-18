import { getCanonicalDemoScenario } from '@/lib/fixtures/canonical-demo-scenario';
import { getSensorDataForParcel } from '@/lib/fixtures/sensor-data';
import { getPortfolioWaterReview } from '@/lib/services/portfolio-water-review-service';
import { getWeatherForecast } from '@/lib/services/weather-forecast-service';
import type { InspectionHistoryContext } from '@/types/agent-tools';
import type { InspectionNote } from '@/types/agricultural-operations';

export class ParcelContextNotFoundError extends Error {
  constructor(parcelId: string) {
    super(`Parcel ${parcelId} was not found.`);
    this.name = 'ParcelContextNotFoundError';
  }
}

export async function getSelectedParcelContext(
  parcelId: string,
  inspectionHistory?: InspectionHistoryContext,
  selectedParcelNotes: InspectionNote[] = [],
) {
  const scenario = getCanonicalDemoScenario();
  const parcel = scenario.parcels.features.find(
    (feature) => feature.properties.id === parcelId,
  );

  if (!parcel) {
    throw new ParcelContextNotFoundError(parcelId);
  }

  const activeAlerts = scenario.findings.filter(
    (finding) => finding.parcelId === parcelId && finding.status !== 'reviewed',
  );
  const reviewDate = scenario.reviewStartedAt.slice(0, 10);
  const [weather, portfolioReview] = await Promise.all([
    getWeatherForecast({
      scope: 'parcel',
      parcelId,
      referenceDate: reviewDate,
    }),
    getPortfolioWaterReview(reviewDate),
  ]);
  const sensors = getSensorDataForParcel(parcelId);
  const matchingInspection =
    inspectionHistory?.parcelId === parcelId ? inspectionHistory : undefined;

  const regionalAssessment = portfolioReview.assessments.find(
    ({ cluster }) => cluster === parcel.properties.cluster,
  );
  const hasRegionalReview =
    portfolioReview.selectedCluster === parcel.properties.cluster &&
    regionalAssessment?.status === 'review';
  const latestAffectedMoisture = scenario.observations
    .filter(
      (observation) =>
        observation.metric === 'soil-moisture' &&
        observation.parcelId === parcelId &&
        observation.sectorId === 'sector-b',
    )
    .at(-1);
  const latestReferenceMoisture = scenario.observations
    .filter(
      (observation) =>
        observation.metric === 'soil-moisture' &&
        observation.parcelId === parcelId &&
        observation.sectorId === 'sector-reference',
    )
    .at(-1);

  return {
    parcel: {
      id: parcel.properties.id,
      name: parcel.properties.name,
      crop: parcel.properties.crop,
      municipality: parcel.properties.municipality,
      department: parcel.properties.department,
      areaHectares: parcel.properties.areaHectares,
      moistureStatus: parcel.properties.moistureStatus,
      operationalStatus:
        parcel.properties.moistureStatus === 'critical'
          ? ('critical' as const)
          : portfolioReview.selectedCluster === parcel.properties.cluster
            ? ('review' as const)
            : ('normal' as const),
      currentSoilMoisturePercent: parcel.properties.currentSoilMoisturePercent,
      lastReviewedAt: parcel.properties.lastReviewedAt,
    },
    alerts: activeAlerts.map((finding) => ({
      id: finding.id,
      title: finding.title,
      summary: finding.summary,
      severity: finding.severity,
      status: finding.status,
      sectorId: finding.sectorId,
      detectedAt: finding.detectedAt,
      timeWindow: finding.timeWindow,
      confidence: finding.confidence,
      recommendedVerification: finding.recommendedVerification,
      evidenceQuality: 'simulated' as const,
      comparison:
        latestAffectedMoisture && latestReferenceMoisture
          ? {
              affectedSectorMoisturePercent: latestAffectedMoisture.value,
              referenceSectorMoisturePercent: latestReferenceMoisture.value,
              observation:
                'After the 90-minute irrigation cycle on July 12, the reference area rose from 30% to 34% moisture while Sector B fell from 34% to 16%.',
              inference:
                'The pattern is compatible with a localized irrigation delivery problem, but the cause requires field verification.',
            }
          : undefined,
    })),
    reviews:
      hasRegionalReview && regionalAssessment
        ? [
            {
              title: 'Irrigation plan review recommended',
              summary:
                'The seven-day outlook indicates that forecast rainfall and scheduled irrigation may not cover atmospheric water demand.',
              status: 'review' as const,
              cluster: regionalAssessment.cluster,
              recentPrecipitationMillimeters:
                regionalAssessment.recentPrecipitationMillimeters,
              forecastPrecipitationMillimeters:
                regionalAssessment.forecastPrecipitationMillimeters,
              forecastEvapotranspirationMillimeters:
                regionalAssessment.forecastEvapotranspirationMillimeters,
              scheduledIrrigationMillimeters:
                regionalAssessment.scheduledIrrigationMillimeters,
              forecastGapMillimeters: regionalAssessment.forecastGapMillimeters,
              recommendedAction:
                'Recalculate irrigation depth, volume, or duration for this parcel. Do not change irrigation automatically.',
            },
          ]
        : [],
    sensors: {
      sourceLabel: 'Simulated demo sensors',
      items:
        sensors?.sensors.map((sensor) => ({
          id: sensor.metadata.id,
          name: sensor.metadata.name,
          type: sensor.metadata.type,
          sectorId: sensor.metadata.sectorId,
          location: sensor.metadata.location,
          deviceStatus: sensor.metadata.status,
          observedAt: sensor.latestReading.observedAt,
          value: sensor.latestReading.value,
          unit: sensor.latestReading.unit,
          quality: sensor.latestReading.quality,
          confidence: sensor.latestReading.confidence,
          trend: sensor.trend,
          alert: sensor.alertStatus,
        })) ?? [],
    },
    weather: {
      sourceLabel: weather.sourceLabel,
      quality: weather.quality,
      retrievedAt: weather.retrievedAt,
      recent: weather.recent,
      forecast: weather.forecast,
      startsOn: weather.forecast.startsOn,
      endsOn: weather.forecast.endsOn,
      totalPrecipitationMillimeters:
        weather.forecast.totalPrecipitationMillimeters,
      maximumTemperatureCelsius: weather.forecast.maximumTemperatureCelsius,
      totalEvapotranspirationMillimeters:
        weather.forecast.totalEvapotranspirationMillimeters,
      daily: weather.forecast.daily,
    },
    history: {
      lastReviewedAt: parcel.properties.lastReviewedAt,
      notes: matchingInspection?.notes ?? selectedParcelNotes,
      irrigationEvents: scenario.irrigationEvents
        .filter((event) => event.parcelId === parcelId)
        .map((event) => ({ ...event, evidenceQuality: event.quality })),
      inspection: matchingInspection
        ? {
            status: matchingInspection.status,
            notes: matchingInspection.notes,
            photos: matchingInspection.photos.map(
              ({ id, capturedAt, analysis }) => ({
                id,
                capturedAt,
                analysis,
              }),
            ),
            actions: matchingInspection.actions,
            nextStep: matchingInspection.nextStep,
          }
        : null,
    },
  };
}

export type SelectedParcelContext = Awaited<
  ReturnType<typeof getSelectedParcelContext>
>;
