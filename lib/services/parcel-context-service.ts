import { createWeatherSeriesFallback } from '@/lib/fixtures/weather-series-fallback';
import { getCanonicalDemoScenario } from '@/lib/fixtures/canonical-demo-scenario';
import { getSensorDataForParcel } from '@/lib/fixtures/sensor-data';
import { getParcelCenter } from '@/lib/geo/parcel-center';
import type { InspectionHistoryContext } from '@/types/agent-tools';

const DEFAULT_CONTEXT_DAYS = 7;

export class ParcelContextNotFoundError extends Error {
  constructor(parcelId: string) {
    super(`Parcel ${parcelId} was not found.`);
    this.name = 'ParcelContextNotFoundError';
  }
}

function subtractDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function getSelectedParcelContext(
  parcelId: string,
  inspectionHistory?: InspectionHistoryContext,
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
  const selectedAlert = activeAlerts[0];
  const reviewDate = scenario.reviewStartedAt.slice(0, 10);
  const startsOn =
    selectedAlert?.timeWindow.startsAt.slice(0, 10) ??
    subtractDays(reviewDate, DEFAULT_CONTEXT_DAYS - 1);
  const [longitude, latitude] = getParcelCenter(parcel.geometry);
  const weather = createWeatherSeriesFallback({
    latitude,
    longitude,
    startDate: startsOn,
    endDate: reviewDate,
  });
  const sensors = getSensorDataForParcel(parcelId);
  const matchingInspection =
    inspectionHistory?.parcelId === parcelId ? inspectionHistory : undefined;

  return {
    parcel: {
      id: parcel.properties.id,
      name: parcel.properties.name,
      crop: parcel.properties.crop,
      municipality: parcel.properties.municipality,
      department: parcel.properties.department,
      areaHectares: parcel.properties.areaHectares,
      moistureStatus: parcel.properties.moistureStatus,
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
    })),
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
      quality: 'simulated' as const,
      startsOn: weather.startsOn,
      endsOn: weather.endsOn,
      totalPrecipitationMillimeters: Number(
        weather.points
          .reduce((total, point) => total + point.precipitationMillimeters, 0)
          .toFixed(2),
      ),
      maximumTemperatureCelsius: Math.max(
        ...weather.points.map((point) => point.maximumTemperatureCelsius),
      ),
      totalEvapotranspirationMillimeters: Number(
        weather.points
          .reduce(
            (total, point) => total + point.evapotranspirationMillimeters,
            0,
          )
          .toFixed(2),
      ),
      daily: weather.points,
    },
    history: {
      lastReviewedAt: parcel.properties.lastReviewedAt,
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

export type SelectedParcelContext = ReturnType<typeof getSelectedParcelContext>;
