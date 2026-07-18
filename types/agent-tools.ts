import type { Inspection } from '@/types/agricultural-operations';

export const GET_SELECTED_PARCEL_CONTEXT_TOOL =
  'get_selected_parcel_context' as const;

export type InspectionHistoryContext = Inspection;

export type AgentToolContext = {
  selectedParcelId: string;
  inspectionHistory?: InspectionHistoryContext;
};

export type AgentActionEvent = {
  name: typeof GET_SELECTED_PARCEL_CONTEXT_TOOL;
  label: string;
  status: 'completed';
};
