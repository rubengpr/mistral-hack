import {
  AFFECTED_PARCEL_ID,
  AFFECTED_SECTOR_ID,
  getCanonicalDemoScenario,
} from '@/lib/fixtures/canonical-demo-scenario';
import type {
  SensorAlertStatus,
  SensorInfo,
  SensorMetadata,
  SensorReading,
  SensorStatus,
  SensorTrend,
  SensorType,
} from '@/types/sensors';
import type { ParcelMoistureStatus } from '@/types/agricultural-operations';

function deterministicFraction(seed: string): number {
  let hash = 2166136261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

// Generate realistic sensor readings based on parcel moisture status
function generateSensorReadings(
  sensorId: string,
  sensorType: SensorType,
  moistureStatus: ParcelMoistureStatus,
  days: number = 14,
): SensorReading[] {
  const readings: SensorReading[] = [];
  const now = new Date('2026-07-18T08:00:00Z');

  let currentValue = getBaseValue(sensorType, moistureStatus, sensorId);

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - days + i + 1);
    const timestamp = date.toISOString().slice(0, 10) + 'T08:00:00Z';

    // Add some variability based on moisture status
    const variability = getVariability(sensorType, moistureStatus);
    const dailyChange =
      (deterministicFraction(`${sensorId}:${i}:change`) * 2 - 1) * variability;

    // For critical parcels, add more decline
    if (moistureStatus === 'critical' && sensorType === 'soil-moisture') {
      currentValue += dailyChange - 0.5;
    } else if (moistureStatus === 'watch' && sensorType === 'soil-moisture') {
      currentValue += dailyChange - 0.2;
    } else {
      currentValue += dailyChange;
    }

    // Clamp values to reasonable ranges
    currentValue = clampValue(currentValue, sensorType);

    // Occasionally add missing readings (simulating sensor issues)
    if (deterministicFraction(`${sensorId}:${i}:missing`) < 0.05) {
      continue; // Skip this reading
    }

    const reading: SensorReading = {
      id: `${sensorId}-${timestamp.slice(0, 10)}`,
      sensorId,
      observedAt: timestamp,
      value: Number(currentValue.toFixed(1)),
      unit: getUnit(sensorType),
      quality: 'simulated',
      confidence: Number(
        (
          0.95 +
          deterministicFraction(`${sensorId}:${i}:confidence`) * 0.05
        ).toFixed(3),
      ),
      rawReference: `fixture://sensor/${sensorId}/${timestamp.slice(0, 10)}`,
    };

    readings.push(reading);
  }

  return readings;
}

function getBaseValue(
  sensorType: SensorType,
  moistureStatus: ParcelMoistureStatus,
  seed: string,
): number {
  const variation = deterministicFraction(`${seed}:base`);

  switch (sensorType) {
    case 'soil-moisture':
      if (moistureStatus === 'critical') return 16.0;
      if (moistureStatus === 'watch') return 24.0;
      return 32.0 + variation * 8;
    case 'temperature':
      return 18.0 + variation * 10;
    case 'humidity':
      return 45.0 + variation * 30;
    case 'soil-temperature':
      return 16.0 + variation * 8;
    default:
      return 0;
  }
}

function getVariability(
  sensorType: SensorType,
  moistureStatus: ParcelMoistureStatus,
): number {
  switch (sensorType) {
    case 'soil-moisture':
      if (moistureStatus === 'critical') return 1.5;
      if (moistureStatus === 'watch') return 1.0;
      return 0.5;
    case 'temperature':
      return 2.0;
    case 'humidity':
      return 3.0;
    case 'soil-temperature':
      return 1.0;
    default:
      return 1.0;
  }
}

function getUnit(sensorType: SensorType): string {
  switch (sensorType) {
    case 'soil-moisture':
      return 'percent';
    case 'temperature':
    case 'soil-temperature':
      return 'celsius';
    case 'humidity':
      return 'percent';
    default:
      return 'unit';
  }
}

function clampValue(value: number, sensorType: SensorType): number {
  switch (sensorType) {
    case 'soil-moisture':
      return Math.max(5, Math.min(50, value));
    case 'temperature':
      return Math.max(5, Math.min(45, value));
    case 'humidity':
      return Math.max(20, Math.min(100, value));
    case 'soil-temperature':
      return Math.max(5, Math.min(40, value));
    default:
      return value;
  }
}

// Generate sensor metadata for a parcel
function generateSensorMetadata(
  parcelId: string,
  index: number,
  moistureStatus: ParcelMoistureStatus,
): SensorMetadata[] {
  const sectorId =
    parcelId === AFFECTED_PARCEL_ID ? AFFECTED_SECTOR_ID : undefined;
  const sensorTypes: SensorType[] = ['soil-moisture', 'temperature'];

  // Critical parcels get more sensors
  if (moistureStatus === 'critical') {
    sensorTypes.push('humidity', 'soil-temperature');
  } else if (moistureStatus === 'watch') {
    sensorTypes.push('humidity');
  }

  return sensorTypes.map((type) => {
    const typeIndex = sensorTypes.indexOf(type);
    const status = getSensorStatus(parcelId, moistureStatus, typeIndex);
    const depth =
      type === 'soil-moisture' || type === 'soil-temperature'
        ? [30, 60, 90][typeIndex % 3]
        : undefined;

    return {
      id: `${parcelId}-${type}-sensor-${sensorTypes.indexOf(type) + 1}`,
      parcelId,
      sectorId,
      type,
      name: `${formatSensorType(type)} Sensor ${sensorTypes.indexOf(type) + 1}`,
      installedAt: getInstallDate(moistureStatus),
      location: getSensorLocation(index),
      depthCentimeters: depth,
      status,
      lastCalibrationDate:
        status === 'calibrating' ? '2026-07-18' : '2026-01-15',
      batteryPercent:
        status === 'offline'
          ? 0
          : Math.floor(
              20 +
                deterministicFraction(`${parcelId}:${typeIndex}:battery`) * 80,
            ),
    };
  });
}

function formatSensorType(type: SensorType): string {
  return type.replace(/\b\w/g, (l) => l.toUpperCase()).replace('-', ' ');
}

function getSensorStatus(
  parcelId: string,
  moistureStatus: ParcelMoistureStatus,
  sensorIndex: number,
): SensorStatus {
  // Affected parcel has some sensors with issues
  if (parcelId === AFFECTED_PARCEL_ID && sensorIndex === 1) {
    return 'maintenance-needed';
  }

  // Some random variation
  const random = deterministicFraction(`${parcelId}:${sensorIndex}:status`);
  if (random < 0.05) return 'offline';
  if (random < 0.15) return 'calibrating';
  if (moistureStatus === 'critical' && random < 0.25)
    return 'maintenance-needed';

  return 'active';
}

function getInstallDate(moistureStatus: ParcelMoistureStatus): string {
  if (moistureStatus === 'critical') {
    // Recently installed sensors for critical parcels
    return '2026-04-01';
  }
  if (moistureStatus === 'watch') {
    return '2026-02-15';
  }
  return '2025-11-01';
}

function getSensorLocation(parcelIndex: number): string {
  const locations = [
    'North sector',
    'South sector',
    'East sector',
    'West sector',
    'Center',
  ];
  return locations[parcelIndex % locations.length] || 'Center';
}

// Calculate trend from readings
function calculateTrend(readings: SensorReading[]): SensorTrend {
  if (readings.length < 2) {
    return {
      current: readings[0]?.value ?? 0,
      previous: readings[0]?.value ?? 0,
      change: 0,
      period: '24h',
      direction: 'stable',
    };
  }

  const sortedReadings = [...readings].sort(
    (a, b) =>
      new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime(),
  );
  const latest = sortedReadings.at(-1);
  const previous = sortedReadings.at(-2);

  if (!latest || !previous) {
    return {
      current: latest?.value ?? 0,
      previous: previous?.value ?? 0,
      change: 0,
      period: '24h',
      direction: 'stable',
    };
  }

  const change = latest.value - previous.value;
  const direction =
    change > 0.5 ? 'increasing' : change < -0.5 ? 'decreasing' : 'stable';

  return {
    current: latest.value,
    previous: previous.value,
    change,
    period: '24h',
    direction,
  };
}

// Calculate alert status based on thresholds and current value
function calculateAlertStatus(
  value: number,
  type: SensorType,
  moistureStatus: ParcelMoistureStatus,
): SensorAlertStatus {
  switch (type) {
    case 'soil-moisture':
      if (moistureStatus === 'critical' || value < 18) {
        return { status: 'critical', message: 'Soil moisture critically low' };
      }
      if (value < 22) {
        return { status: 'warning', message: 'Soil moisture below optimal' };
      }
      return { status: 'normal' };

    case 'temperature':
      if (value > 35) {
        return { status: 'critical', message: 'High temperature' };
      }
      if (value > 30) {
        return { status: 'warning', message: 'Elevated temperature' };
      }
      if (value < 10) {
        return { status: 'warning', message: 'Low temperature' };
      }
      return { status: 'normal' };

    case 'humidity':
      if (value < 30) {
        return { status: 'warning', message: 'Low humidity' };
      }
      if (value > 80) {
        return { status: 'warning', message: 'High humidity' };
      }
      return { status: 'normal' };

    case 'soil-temperature':
      if (value > 35) {
        return { status: 'warning', message: 'High soil temperature' };
      }
      if (value < 10) {
        return { status: 'warning', message: 'Low soil temperature' };
      }
      return { status: 'normal' };

    default:
      return { status: 'normal' };
  }
}

// Get thresholds for a sensor type
function getThresholds(type: SensorType): {
  criticalMin?: number;
  criticalMax?: number;
  warningMin?: number;
  warningMax?: number;
  optimalMin: number;
  optimalMax: number;
} {
  switch (type) {
    case 'soil-moisture':
      return {
        criticalMin: 15,
        warningMin: 20,
        optimalMin: 25,
        optimalMax: 45,
      };
    case 'temperature':
      return {
        criticalMax: 38,
        warningMax: 32,
        warningMin: 8,
        optimalMin: 15,
        optimalMax: 30,
      };
    case 'humidity':
      return { warningMin: 30, warningMax: 80, optimalMin: 40, optimalMax: 70 };
    case 'soil-temperature':
      return { warningMin: 8, warningMax: 35, optimalMin: 12, optimalMax: 30 };
    default:
      return { optimalMin: 0, optimalMax: 100 };
  }
}

// Create sensor info for a single sensor
export function createSensorInfo(
  metadata: SensorMetadata,
  moistureStatus: ParcelMoistureStatus,
): SensorInfo {
  const readings = generateSensorReadings(
    metadata.id,
    metadata.type,
    moistureStatus,
  );
  const latestReading = [...readings].sort(
    (a, b) =>
      new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime(),
  )[0];

  const trend = calculateTrend(readings);
  const alertStatus = calculateAlertStatus(
    latestReading.value,
    metadata.type,
    moistureStatus,
  );

  return {
    metadata,
    latestReading,
    trend,
    thresholds: getThresholds(metadata.type),
    alertStatus,
    readings,
  };
}

// Generate all sensor data for all parcels
export function generateSensorData() {
  const parcelsData: Array<{
    parcelId: string;
    parcelName: string;
    moistureStatus: ParcelMoistureStatus;
    sensors: SensorInfo[];
  }> = [];

  const canonicalParcels = getCanonicalDemoScenario().parcels.features;

  canonicalParcels.forEach(({ properties }, index) => {
    const parcelId = properties.id;
    const moistureStatus = properties.moistureStatus;
    const sensorMetadata = generateSensorMetadata(
      parcelId,
      index,
      moistureStatus,
    );

    const sensors = sensorMetadata.map((metadata) =>
      createSensorInfo(metadata, moistureStatus),
    );

    parcelsData.push({
      parcelId,
      parcelName: properties.name,
      moistureStatus,
      sensors,
    });
  });

  return parcelsData;
}

// Pre-generated sensor data for the dashboard
const SENSOR_DATA_CACHE = generateSensorData();

export function getSensorData() {
  return SENSOR_DATA_CACHE;
}

// Get sensor data for a specific parcel
export function getSensorDataForParcel(parcelId: string) {
  return SENSOR_DATA_CACHE.find((p) => p.parcelId === parcelId);
}
