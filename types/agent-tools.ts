import type { Inspection } from '@/types/agricultural-operations';
import type { ReportArtifact } from '@/types/inspection-report';

export const GET_SELECTED_PARCEL_CONTEXT_TOOL =
  'get_selected_parcel_context' as const;
export const GENERATE_INSPECTION_REPORT_TOOL =
  'generate_inspection_report' as const;
export const SAVE_INSPECTION_NOTE_TOOL = 'save_inspection_note' as const;
export const SEND_REVIEWED_REPORT_TOOL = 'send_reviewed_report' as const;

export type InspectionNoteDraft = {
  observation: string;
  assessment: string;
  uncertainty: string;
  completedAction?: string;
  nextStep: string;
};

export type InspectionHistoryContext = Inspection;

export type AgentToolContext = {
  selectedParcelId: string;
  inspectionHistory?: InspectionHistoryContext;
};

export type AgentActionEvent =
  | {
      name: typeof GET_SELECTED_PARCEL_CONTEXT_TOOL;
      label: string;
      status: 'completed';
    }
  | {
      artifact: ReportArtifact;
      label: string;
      name: typeof GENERATE_INSPECTION_REPORT_TOOL;
      status: 'completed';
    }
  | {
      draft: InspectionNoteDraft;
      label: string;
      name: typeof SAVE_INSPECTION_NOTE_TOOL;
      status: 'completed';
    }
  | {
      label: string;
      name: typeof SEND_REVIEWED_REPORT_TOOL;
      status: 'completed';
    };
