import type {
  ParcelCollection,
  SectorFeature,
} from '@/types/agricultural-operations';

export type {
  ParcelCollection,
  ParcelFeature,
  ParcelProperties,
  SectorFeature,
} from '@/types/agricultural-operations';

export type MoisturePoint = {
  timestamp: string;
  label: string;
  moisture: number;
};

export type IrrigationEvent = {
  timestamp: string;
  label: string;
  parcelId: string;
  sectorId: string;
};

export type ActiveFinding = {
  id: string;
  title: string;
  summary: string;
  severity: 'medium' | 'high';
  parcelId: string;
  sectorId: string;
  detectedAt: string;
  confidence: number;
  recommendedVerification: string;
};

export type WeatherContext = {
  rainfallMillimeters: number;
  periodLabel: string;
  summary: string;
  monthlyRainfall: MonthlyRainfallPoint[];
  sourceLabel: string;
};

export type MonthlyRainfallPoint = {
  month: string;
  rainfallMillimeters: number;
};

export type InspectionSummary = {
  id: string;
  parcelId: string;
  sectorId: string;
  status: 'not-started';
  nextStep: string;
};

export type DashboardViewModel = {
  portfolioName: string;
  reviewTimeLabel: string;
  initialParcelId: string;
  parcels: ParcelCollection;
  affectedSector: SectorFeature;
  finding: ActiveFinding;
  moistureByParcelId: Record<string, MoisturePoint[]>;
  irrigationEvent: IrrigationEvent;
  weather: WeatherContext;
  inspection: InspectionSummary;
};

export type WorkspaceRoute = 'map' | 'weather' | 'sensors';
