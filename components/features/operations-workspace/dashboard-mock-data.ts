import {
  getCanonicalDemoScenario,
  getCanonicalDemoState,
} from '@/lib/fixtures/canonical-demo-scenario';
import { getSensorData } from '@/lib/fixtures/sensor-data';
import type {
  DashboardViewModel,
  MoisturePoint,
  MonthlyRainfallPoint,
} from '@/types/operations-dashboard';
import type { SensorsDashboardData } from '@/types/sensors';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

function stableSeries(currentMoisture: number): MoisturePoint[] {
  return [14, 15, 16, 17, 18].map((day, index) => ({
    timestamp: `2026-07-${day}T08:00:00Z`,
    label: `Jul ${day}`,
    moisture: Number((currentMoisture + (2 - index) * 0.35).toFixed(1)),
  }));
}

const scenario = getCanonicalDemoScenario();
const state = getCanonicalDemoState();
const finding = scenario.findings.find(
  ({ id }) => id === state.activeFindingId,
);
const affectedSector = scenario.sectors.find(
  ({ properties }) => properties.id === state.activeInspection.sectorId,
);
const lastIrrigation = scenario.irrigationEvents.at(-1);

if (!finding || !affectedSector || !lastIrrigation) {
  throw new Error('The canonical dashboard fixture is incomplete');
}

const affectedMoisture = scenario.observations
  .filter(
    (observation) =>
      observation.source === 'soil-moisture-sensor' &&
      observation.parcelId === finding.parcelId,
  )
  .map(({ observedAt, value }) => ({
    timestamp: observedAt,
    label: new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(observedAt)),
    moisture: value,
  }));

const monthlyRainfall = scenario.observations
  .filter(
    (observation) =>
      observation.source === 'weather-station' &&
      observation.parcelId === finding.parcelId,
  )
  .reduce<MonthlyRainfallPoint[]>((months, observation) => {
    const monthIndex = Number(observation.observedAt.slice(5, 7)) - 1;
    const month = MONTH_LABELS[monthIndex];

    if (!month) {
      return months;
    }

    const existingMonth = months.find((point) => point.month === month);

    if (existingMonth) {
      existingMonth.rainfallMillimeters += observation.value;
      return months;
    }

    months.push({
      month,
      rainfallMillimeters: observation.value,
    });
    return months;
  }, []);

const sensorData = getSensorData();

const sensorsDashboardData: SensorsDashboardData = {
  summary: {
    totalSensors: sensorData.reduce((total, p) => total + p.sensors.length, 0),
    activeSensors: sensorData.reduce(
      (total, p) => total + p.sensors.filter((s) => s.metadata.status === 'active').length,
      0,
    ),
    sensorsByType: sensorData.reduce((acc, p) => {
      p.sensors.forEach((s) => {
        acc[s.metadata.type] = (acc[s.metadata.type] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>),
    sensorsByStatus: sensorData.reduce((acc, p) => {
      p.sensors.forEach((s) => {
        acc[s.metadata.status] = (acc[s.metadata.status] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>),
    alertCount: sensorData.reduce(
      (total, p) => total + p.sensors.filter((s) => s.alertStatus.status !== 'normal').length,
      0,
    ),
    criticalCount: sensorData.reduce(
      (total, p) => total + p.sensors.filter((s) => s.alertStatus.status === 'critical').length,
      0,
    ),
    warningCount: sensorData.reduce(
      (total, p) => total + p.sensors.filter((s) => s.alertStatus.status === 'warning').length,
      0,
    ),
  },
  parcels: sensorData.map((p) => ({
    parcelId: p.parcelId,
    parcelName: p.parcelName,
    moistureStatus: p.moistureStatus,
    sensors: p.sensors,
  })),
  allSensorReadings: sensorData.flatMap((p) => p.sensors.flatMap((s) => s.readings)),
};

export const dashboardMockData: DashboardViewModel = {
  portfolioName: scenario.portfolioName,
  reviewTimeLabel: 'Morning review · 08:00',
  initialParcelId: state.selectedParcelId,
  parcels: scenario.parcels,
  affectedSector,
  finding: {
    id: finding.id,
    title: finding.title,
    summary: finding.summary,
    severity: finding.severity,
    parcelId: finding.parcelId,
    sectorId: finding.sectorId,
    detectedAt: finding.detectedAt,
    confidence: finding.confidence,
    recommendedVerification: finding.recommendedVerification,
  },
  moistureByParcelId: Object.fromEntries(
    scenario.parcels.features.map((parcel) => [
      parcel.properties.id,
      parcel.properties.id === finding.parcelId
        ? affectedMoisture
        : stableSeries(parcel.properties.currentSoilMoisturePercent),
    ]),
  ),
  irrigationEvent: {
    timestamp: lastIrrigation.startedAt,
    label: new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(lastIrrigation.startedAt)),
    parcelId: lastIrrigation.parcelId,
    sectorId: lastIrrigation.sectorId,
  },
  weather: {
    rainfallMillimeters: 0,
    periodLabel: 'Last 5 days',
    summary: 'No meaningful rainfall recorded during the current decline.',
    monthlyRainfall,
    sourceLabel: 'Demo weather station · Simulated data',
  },
  inspection: {
    id: state.activeInspection.id,
    parcelId: state.activeInspection.parcelId,
    sectorId: state.activeInspection.sectorId,
    status: 'not-started',
    nextStep: state.activeInspection.nextStep,
  },
};

export { sensorsDashboardData };
