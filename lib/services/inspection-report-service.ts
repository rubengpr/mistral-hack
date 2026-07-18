import { createHash } from 'node:crypto';

import { z } from 'zod';

import { createMistralClient } from '@/lib/integrations/mistral/client';
import { getCanonicalDemoScenario } from '@/lib/fixtures/canonical-demo-scenario';
import { getParcelReportRecipient } from '@/lib/fixtures/report-recipient';
import { renderInspectionReportPdf } from '@/lib/services/inspection-report-pdf';
import { createReportApprovalToken } from '@/lib/services/report-approval-service';
import type { AgentToolContext } from '@/types/agent-tools';
import type {
  InspectionReport,
  ReportArtifact,
  ReportEvidenceItem,
} from '@/types/inspection-report';

const synthesisSchema = z.object({
  summary: z.string().trim().min(1).max(320),
  interpretation: z.string().trim().min(1).max(260),
  uncertainty: z.string().trim().min(1).max(180),
});

export class InspectionReportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InspectionReportInputError';
  }
}

function formatReading(value: number, unit: string) {
  if (unit === 'percent') {
    return `${value}%`;
  }

  if (unit === 'millimeters') {
    return `${value} mm`;
  }

  return `${value} ${unit}`;
}

async function synthesizeReportText(input: {
  anomaly: string;
  deterministicEvidence: ReportEvidenceItem[];
  notes: string[];
  actions: string[];
  nextStep: string;
}) {
  const client = createMistralClient();
  const response = await client.chat.parse({
    model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
    messages: [
      {
        role: 'system',
        content:
          'Draft three scan-friendly fields for a technician-reviewed vineyard inspection report. Summary: at most 35 words. Interpretation: at most 30 words. Uncertainty: at most 20 words. Use plain language and only supplied evidence. Avoid repetition. Never claim a definitive diagnosis or that the situation is under control.',
      },
      {
        role: 'user',
        content: JSON.stringify(input),
      },
    ],
    responseFormat: synthesisSchema,
  });
  const parsed = response?.choices?.[0]?.message?.parsed;

  if (!parsed) {
    throw new InspectionReportInputError(
      'Mistral did not return a valid report synthesis.',
    );
  }

  return synthesisSchema.parse(parsed);
}

export async function generateInspectionReport(
  context: AgentToolContext,
): Promise<ReportArtifact> {
  const inspection = context.inspectionHistory;

  if (!inspection || inspection.parcelId !== context.selectedParcelId) {
    throw new InspectionReportInputError(
      'The selected parcel does not have an active inspection to report.',
    );
  }

  if (inspection.status !== 'ready-for-review') {
    throw new InspectionReportInputError(
      'Save and review the field inspection note before generating its report.',
    );
  }

  const scenario = getCanonicalDemoScenario();
  const parcel = scenario.parcels.features.find(
    ({ properties }) => properties.id === inspection.parcelId,
  );
  const finding = scenario.findings.find(
    ({ id }) => id === inspection.findingId,
  );
  const sector = scenario.sectors.find(
    ({ properties }) => properties.id === inspection.sectorId,
  );
  const recipient = getParcelReportRecipient(inspection.parcelId);

  if (!parcel || !finding || !sector || !recipient) {
    throw new InspectionReportInputError(
      'The canonical inspection data is incomplete.',
    );
  }

  const moistureObservations = scenario.observations.filter(
    (observation) =>
      observation.source === 'soil-moisture-sensor' &&
      observation.parcelId === inspection.parcelId,
  );
  const rainfallObservations = scenario.observations.filter(
    (observation) =>
      observation.source === 'weather-station' &&
      observation.parcelId === inspection.parcelId,
  );
  const latestMoisture = moistureObservations.at(-1);
  const rainfallTotal = rainfallObservations.reduce(
    (total, observation) => total + observation.value,
    0,
  );
  const evidence: ReportEvidenceItem[] = [];

  if (latestMoisture) {
    evidence.push({
      source: 'sensor',
      statement: `Soil moisture reached ${formatReading(latestMoisture.value, latestMoisture.unit)} after a sustained decline in ${sector.properties.name}.`,
      observedAt: latestMoisture.observedAt,
      quality: 'simulated',
    });
  }

  evidence.push({
    source: 'weather',
    statement: `${formatReading(rainfallTotal, 'millimeters')} of rainfall was recorded during the finding window.`,
    observedAt: finding.timeWindow.endsAt,
    quality: 'simulated',
  });

  const latestNote = inspection.notes.at(-1);

  if (latestNote) {
    evidence.push({
      source: 'field-note',
      statement: latestNote.content,
      observedAt: latestNote.createdAt,
      quality: 'technician-provided',
    });
  }

  const photo = inspection.photos.at(-1);

  if (photo?.analysis) {
    evidence.push({
      source: 'field-photo',
      statement: photo.analysis.observation,
      observedAt: photo.capturedAt,
      quality: 'technician-provided',
    });
  } else if (photo) {
    evidence.push({
      source: 'field-photo',
      statement: 'A technician-provided field photograph is attached for review.',
      observedAt: photo.capturedAt,
      quality: 'technician-provided',
    });
  }

  const synthesis = await synthesizeReportText({
    anomaly: finding.summary,
    deterministicEvidence: evidence,
    notes: inspection.notes.map(({ content }) => content),
    actions: inspection.actions.map(({ description }) => description),
    nextStep: inspection.nextStep,
  });
  const generatedAt = new Date().toISOString();
  const reportFingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        inspection,
        synthesis,
        latestMoisture,
        rainfallTotal,
      }),
    )
    .digest('hex')
    .slice(0, 12);
  const report: InspectionReport = {
    id: `report-${inspection.id}-${reportFingerprint}`,
    inspectionId: inspection.id,
    parcelId: inspection.parcelId,
    parcelName: parcel.properties.name,
    sectorId: inspection.sectorId,
    sectorName: sector.properties.name,
    inspectionDate: scenario.reviewStartedAt.slice(0, 10),
    technicianName: inspection.technicianName ?? 'Pierre Laurent',
    anomaly: finding.title,
    summary: synthesis.summary,
    evidence,
    interpretation: synthesis.interpretation,
    uncertainty: synthesis.uncertainty,
    action:
      inspection.actions.at(-1)?.description ??
      inspection.nextStep,
    nextFollowUp: inspection.nextStep,
    moistureTrend: moistureObservations.slice(-5).map((observation) => ({
      label: new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).format(new Date(observation.observedAt)),
      value: observation.value,
    })),
    photoDataUrl: photo?.dataUrl,
    generatedAt,
  };
  const pdf = await renderInspectionReportPdf(report);
  const pdfBase64 = pdf.toString('base64');
  const sender =
    process.env.RESEND_FROM_EMAIL ?? 'Vinea <onboarding@resend.dev>';
  const subject = `Vinea inspection report · ${report.parcelName}`;

  return {
    report,
    filename: `vinea-inspection-${report.parcelId}.pdf`,
    subject,
    sender,
    recipient: recipient.email,
    pdfBase64,
    approvalToken: createReportApprovalToken(
      report,
      recipient.email,
      pdfBase64,
    ),
    status: 'preview-ready',
  };
}
