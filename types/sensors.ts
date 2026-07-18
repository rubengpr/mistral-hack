import type { ParcelMoistureStatus } from '@/types/agricultural-operations';

export type SensorType =
  'soil-moisture' | 'temperature' | 'humidity' | 'soil-temperature';

export type SensorStatus =
  'active' | 'maintenance-needed' | 'offline' | 'calibrating';

export type SensorQuality = 'simulated' | 'verified' | 'estimated';

/**
 * Metadata about a physical sensor device
 */
export type SensorMetadata = {
  id: string;
  parcelId: string;
  sectorId?: string;
  type: SensorType;
  name: string;
  installedAt: string;
  location: string; // e.g., "North sector", "Center", "Near irrigation line"
  depthCentimeters?: number; // For soil sensors
  status: SensorStatus;
  lastCalibrationDate?: string;
  batteryPercent?: number;
};

/**
 * A single reading from a sensor
 */
export type SensorReading = {
  id: string;
  sensorId: string;
  observedAt: string;
  value: number;
  unit: string;
  quality: SensorQuality;
  confidence: number;
  rawReference?: string;
};

/**
 * Trend information for a sensor over time
 */
export type SensorTrend = {
  current: number;
  previous: number;
  change: number; // positive = increase, negative = decrease
  period: string; // e.g., "24h", "7d"
  direction: 'increasing' | 'decreasing' | 'stable';
};

/**
 * Alert thresholds for a sensor
 */
export type SensorThresholds = {
  criticalMin?: number;
  criticalMax?: number;
  warningMin?: number;
  warningMax?: number;
  optimalMin: number;
  optimalMax: number;
};

/**
 * Current alert status for a sensor
 */
export type SensorAlertStatus = {
  status: 'normal' | 'warning' | 'critical';
  message?: string;
  triggeredAt?: string;
};

/**
 * Combined sensor information with latest reading and status
 */
export type SensorInfo = {
  metadata: SensorMetadata;
  latestReading: SensorReading;
  trend: SensorTrend;
  thresholds: SensorThresholds;
  alertStatus: SensorAlertStatus;
  readings: SensorReading[];
};

/**
 * All sensors for a single parcel
 */
export type ParcelSensors = {
  parcelId: string;
  parcelName: string;
  moistureStatus: ParcelMoistureStatus;
  sensors: SensorInfo[];
};

/**
 * Summary statistics for all sensors
 */
export type SensorSummary = {
  totalSensors: number;
  activeSensors: number;
  sensorsByType: Record<SensorType, number>;
  sensorsByStatus: Record<SensorStatus, number>;
  alertCount: number;
  criticalCount: number;
  warningCount: number;
};

/**
 * Filter options for sensor data
 */
export type SensorFilter = {
  parcelId?: string;
  sensorType?: SensorType;
  status?: SensorStatus;
  alertStatus?: SensorAlertStatus['status'];
};

/**
 * Complete sensor data model for the dashboard
 */
export type SensorsDashboardData = {
  summary: SensorSummary;
  parcels: ParcelSensors[];
  allSensorReadings: SensorReading[];
};
