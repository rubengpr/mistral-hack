export type ReportStatus =
  | 'drafting'
  | 'preview-ready'
  | 'sending'
  | 'sent'
  | 'failed';

export type ReportEvidenceItem = {
  source: 'sensor' | 'weather' | 'field-note' | 'field-photo';
  statement: string;
  observedAt?: string;
  quality: 'simulated' | 'technician-provided';
};

export type ReportChartPoint = {
  label: string;
  value: number;
};

export type InspectionReport = {
  id: string;
  inspectionId: string;
  parcelId: string;
  parcelName: string;
  sectorId: string;
  sectorName: string;
  inspectionDate: string;
  technicianName: string;
  anomaly: string;
  summary: string;
  evidence: ReportEvidenceItem[];
  interpretation: string;
  uncertainty: string;
  action: string;
  nextFollowUp: string;
  moistureTrend: ReportChartPoint[];
  photoDataUrl?: string;
  generatedAt: string;
};

export type ReportArtifact = {
  report: InspectionReport;
  filename: string;
  subject: string;
  sender: string;
  recipient: string;
  pdfBase64: string;
  approvalToken: string;
  status: 'preview-ready';
};

export type ReportDeliveryResult = {
  reportId: string;
  providerMessageId: string;
  recipient: string;
  sentAt: string;
  status: 'sent';
};

export type PersistedReportState = {
  reportId: string;
  recipient: string;
  subject: string;
  status: ReportStatus;
  generatedAt: string;
  providerMessageId?: string;
  error?: string;
};
