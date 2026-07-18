import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';
import type { PersistedReportState } from '@/types/inspection-report';

export type ParcelMoistureStatus = 'stable' | 'watch' | 'critical';
export type ParcelCluster = 'herault' | 'aude' | 'gard' | 'pyrenees-orientales';
export type ParcelGeometry = Polygon | MultiPolygon;

export type ParcelProperties = {
  id: string;
  sourceParcelId: string;
  sourceDataset: 'IGN RPG 2024';
  sourceCropCode: 'VRC';
  name: string;
  cluster: ParcelCluster;
  municipality: string;
  municipalityInseeCode: string;
  department: string;
  departmentCode: string;
  crop: string;
  areaHectares: number;
  currentSoilMoisturePercent: number;
  moistureStatus: ParcelMoistureStatus;
  lastReviewedAt: string;
  sectorCount: number;
};

export type SectorProperties = {
  id: string;
  name: string;
  parcelId: string;
};

export type ParcelFeature = Feature<ParcelGeometry, ParcelProperties>;
export type ParcelCollection = FeatureCollection<
  ParcelGeometry,
  ParcelProperties
>;
export type SectorFeature = Feature<Polygon, SectorProperties>;

export type EvidenceQuality = 'simulated';

type ObservationBase = {
  id: string;
  observedAt: string;
  parcelId: string;
  sectorId?: string;
  quality: EvidenceQuality;
  confidence: number;
  rawReference?: string;
};

export type SoilMoistureObservation = ObservationBase & {
  source: 'soil-moisture-sensor';
  metric: 'soil-moisture';
  value: number;
  unit: 'percent';
};

export type WeatherObservation = ObservationBase & {
  source: 'weather-station';
  metric: 'rainfall';
  value: number;
  unit: 'millimeters';
};

export type EvidenceObservation = SoilMoistureObservation | WeatherObservation;

export type IrrigationEvent = {
  id: string;
  parcelId: string;
  sectorId: string;
  startedAt: string;
  durationMinutes: number;
  status: 'completed';
  quality: EvidenceQuality;
};

export type FindingSeverity = 'medium' | 'high';
export type FindingStatus = 'open' | 'investigating' | 'reviewed';

export type Finding = {
  id: string;
  type: 'soil-moisture-drop';
  title: string;
  summary: string;
  severity: FindingSeverity;
  status: FindingStatus;
  parcelId: string;
  sectorId: string;
  detectedAt: string;
  timeWindow: {
    startsAt: string;
    endsAt: string;
  };
  supportingObservationIds: string[];
  confidence: number;
  recommendedVerification: string;
};

export type ParcelReviewSummary = {
  parcelId: string;
  status: Exclude<ParcelMoistureStatus, 'stable'>;
  title: string;
  summary: string;
  generatedAt: string;
  source: 'mistral-morning-review';
  quality: EvidenceQuality;
};

export type ConversationTurn = {
  id: string;
  role: 'technician' | 'assistant';
  content: string;
  createdAt: string;
};

export type InspectionNote = {
  id: string;
  content: string;
  createdAt: string;
  observation?: string;
  assessment?: string;
  uncertainty?: string;
};

export type FieldPhotoAnalysis = {
  observation: string;
  inference: string;
  uncertainty: string;
  recommendedVerification: string;
};

export type FieldPhoto = {
  id: string;
  dataUrl: string;
  capturedAt: string;
  analysis?: FieldPhotoAnalysis;
};

export type TechnicianAction = {
  id: string;
  description: string;
  completedAt: string;
};

export type Inspection = {
  id: string;
  findingId: string;
  parcelId: string;
  sectorId: string;
  status: 'not-started' | 'in-progress' | 'ready-for-review';
  technicianName?: string;
  conversation: ConversationTurn[];
  notes: InspectionNote[];
  photos: FieldPhoto[];
  actions: TechnicianAction[];
  nextStep: string;
};

export type DemoScenario = {
  portfolioName: string;
  reviewStartedAt: string;
  parcels: ParcelCollection;
  sectors: SectorFeature[];
  observations: EvidenceObservation[];
  irrigationEvents: IrrigationEvent[];
  findings: Finding[];
  reviewSummaries: ParcelReviewSummary[];
};

export type DemoState = {
  schemaVersion: 2;
  selectedParcelId: string;
  activeFindingId: string;
  activeInspection: Inspection;
  report?: PersistedReportState;
};
