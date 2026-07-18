import { AFFECTED_PARCEL_ID } from '@/lib/fixtures/canonical-demo-scenario';
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

// Parcel IDs from the canonical scenario (20 parcels)
const ALL_PARCEL_IDS = [
  'parcel-herault-01',
  'parcel-herault-02',
  'parcel-herault-03',
  'parcel-herault-04',
  'parcel-herault-05',
  'parcel-herault-06',
  'parcel-herault-07',
  'parcel-aude-01',
  'parcel-aude-02',
  'parcel-aude-03',
  'parcel-aude-04',
  'parcel-aude-05',
  'parcel-gard-01',
  'parcel-gard-02',
  'parcel-gard-03',
  'parcel-gard-04',
  'parcel-pyrenees-orientales-01',
  'parcel-pyrenees-orientales-02',
  'parcel-pyrenees-orientales-03',
  'parcel-pyrenees-orientales-04',
] as const;

// Parcel names corresponding to the IDs
const PARCEL_NAMES = [
  'Les Terrasses du Soleil',
  'Le Clos des Oliviers',
  'La Combe Rouge',
  'Les Pierres Blanches',
  'Le Plateau des Moulins',
  'Le Clos de la Rivière',
  'Les Vents des Corbières',
  'La Garrigue Haute',
  'Le Chemin des Cyprès',
  "Les Collines d'Ambre",
  'La Porte du Midi',
  'Les Vignes du Canal',
  'Les Galets du Rhône',
  'La Costière Dorée',
  'Le Bois des Pins',
  'Le Mas du Levant',
  'Les Hautes Pierres',
  'La Plaine des Genêts',
  'Les Terrasses Catalanes',
  'Le Clos de la Tramontane',
] as const;

// Watch parcel IDs (from canonical scenario)
const WATCH_PARCEL_IDS = new Set([
  'parcel-herault-04',
  'parcel-aude-05',
  'parcel-gard-03',
  'parcel-pyrenees-orientales-04',
]);

// Moisture status for each parcel
function getMoistureStatus(parcelId: string): ParcelMoistureStatus {
  if (parcelId === AFFECTED_PARCEL_ID) {
    return 'critical';
  }
  return WATCH_PARCEL_IDS.has(parcelId as typeof ALL_PARCEL_IDS[number]) ? 'watch' : 'stable';
}

// Generate realistic sensor readings based on parcel moisture status
function generateSensorReadings(
  sensorId: string,
  sensorType: SensorType,
  parcelId: string,
  days: number = 14,
): SensorReading[] {
  const readings: SensorReading[] = [];
  const now = new Date('2026-07-18T08:00:00Z');
  const moistureStatus = getMoistureStatus(parcelId);
  
  let currentValue = getBaseValue(sensorType, moistureStatus);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - days + i + 1);
    const timestamp = date.toISOString().slice(0, 10) + 'T08:00:00Z';
    
    // Add some variability based on moisture status
    const variability = getVariability(sensorType, moistureStatus);
    const dailyChange = (Math.random() * 2 - 1) * variability;
    
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
    if (Math.random() < 0.05) {
      continue; // Skip this reading
    }
    
    const reading: SensorReading = {
      id: `${sensorId}-${timestamp.slice(0, 10)}`,
      sensorId,
      observedAt: timestamp,
      value: Number(currentValue.toFixed(1)),
      unit: getUnit(sensorType),
      quality: 'simulated',
      confidence: 0.95 + Math.random() * 0.05,
      rawReference: `fixture://sensor/${sensorId}/${timestamp.slice(0, 10)}`,
    };
    
    readings.push(reading);
  }
  
  return readings;
}

function getBaseValue(sensorType: SensorType, moistureStatus: ParcelMoistureStatus): number {
  switch (sensorType) {
    case 'soil-moisture':
      if (moistureStatus === 'critical') return 16.0;
      if (moistureStatus === 'watch') return 24.0;
      return 32.0 + Math.random() * 8;
    case 'temperature':
      return 18.0 + Math.random() * 10;
    case 'humidity':
      return 45.0 + Math.random() * 30;
    case 'soil-temperature':
      return 16.0 + Math.random() * 8;
    default:
      return 0;
  }
}

function getVariability(sensorType: SensorType, moistureStatus: ParcelMoistureStatus): number {
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
  const sectorId = `${parcelId}-sector-${String.fromCharCode(97 + (index % 2))}`;
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
    const depth = (type === 'soil-moisture' || type === 'soil-temperature') ? [30, 60, 90][typeIndex % 3] : undefined;
    
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
      lastCalibrationDate: status === 'calibrating' ? '2026-07-18' : '2026-01-15',
      batteryPercent: status === 'offline' ? 0 : Math.floor(20 + Math.random() * 80),
    };
  });
}

function formatSensorType(type: SensorType): string {
  return type
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace('-', ' ');
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
  const random = Math.random();
  if (random < 0.05) return 'offline';
  if (random < 0.15) return 'calibrating';
  if (moistureStatus === 'critical' && random < 0.25) return 'maintenance-needed';
  
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
  const locations = ['North sector', 'South sector', 'East sector', 'West sector', 'Center'];
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
    (a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime(),
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
  const direction = change > 0.5 ? 'increasing' : change < -0.5 ? 'decreasing' : 'stable';
  
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
function getThresholds(type: SensorType): { criticalMin?: number; criticalMax?: number; warningMin?: number; warningMax?: number; optimalMin: number; optimalMax: number } {
  switch (type) {
    case 'soil-moisture':
      return { criticalMin: 15, warningMin: 20, optimalMin: 25, optimalMax: 45 };
    case 'temperature':
      return { criticalMax: 38, warningMax: 32, warningMin: 8, optimalMin: 15, optimalMax: 30 };
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
  const readings = generateSensorReadings(metadata.id, metadata.type, metadata.parcelId);
  const latestReading = [...readings].sort(
    (a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime(),
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
  
  ALL_PARCEL_IDS.forEach((parcelId, index) => {
    const moistureStatus = getMoistureStatus(parcelId);
    const parcelName = PARCEL_NAMES[index] ?? `Parcel ${index + 1}`;
    const sensorMetadata = generateSensorMetadata(parcelId, index, moistureStatus);
    
    const sensors = sensorMetadata.map((metadata) =>
      createSensorInfo(metadata, moistureStatus),
    );
    
    parcelsData.push({
      parcelId,
      parcelName,
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
