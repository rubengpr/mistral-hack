import type {
  Inspection,
  InspectionNote,
} from '@/types/agricultural-operations';
import type { ReportArtifact } from '@/types/inspection-report';

export const GET_SELECTED_PARCEL_CONTEXT_TOOL =
  'get_selected_parcel_context' as const;
export const GENERATE_INSPECTION_REPORT_TOOL =
  'generate_inspection_report' as const;
export const SAVE_INSPECTION_NOTE_TOOL = 'save_inspection_note' as const;
export const GET_WEATHER_FORECAST_TOOL = 'get_weather_forecast' as const;
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
  selectedParcelNotes?: InspectionNote[];
};

export type AgentActionEvent =
  | {
      name: typeof GET_SELECTED_PARCEL_CONTEXT_TOOL;
      label: string;
      status: 'completed';
    }
  | {
      label: string;
      name: typeof GET_WEATHER_FORECAST_TOOL;
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
      targetParcelIds: string[];
    }
  | {
      label: string;
      name: typeof SEND_REVIEWED_REPORT_TOOL;
      status: 'completed';
    };
