import type { Tool } from '@mistralai/mistralai/models/components';
import { z } from 'zod';

import { getSelectedParcelContext } from '@/lib/services/parcel-context-service';
import { generateInspectionReport } from '@/lib/services/inspection-report-service';
import {
  GENERATE_INSPECTION_REPORT_TOOL,
  GET_SELECTED_PARCEL_CONTEXT_TOOL,
  SAVE_INSPECTION_NOTE_TOOL,
  type AgentActionEvent,
  type AgentToolContext,
  type InspectionNoteDraft,
} from '@/types/agent-tools';

const noArgumentsSchema = z.object({}).strict();
const inspectionNoteDraftSchema = z
  .object({
    observation: z.string().trim().min(1).max(1_000),
    assessment: z.string().trim().min(1).max(1_000),
    uncertainty: z.string().trim().min(1).max(1_000),
    completedAction: z.preprocess(
      (value) =>
        typeof value === 'string' && value.trim().length === 0
          ? undefined
          : value,
      z.string().trim().min(1).max(1_000).optional(),
    ),
    nextStep: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const AGENT_TOOL_DEFINITIONS: Array<Tool & { type: 'function' }> = [
  {
    type: 'function',
    function: {
      name: SAVE_INSPECTION_NOTE_TOOL,
      description:
        'Prepare a structured field inspection note only when the technician explicitly asks to record, save, or note their field findings. Preserve the technician\'s observation and assessment. Put only actions the technician says are already completed in completedAction; put planned or recommended work in nextStep. Never turn uncertainty about disease into a diagnosis. This tool prepares the note for browser persistence and must not be used in the same turn as report generation.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['observation', 'assessment', 'uncertainty', 'nextStep'],
        properties: {
          observation: { type: 'string' },
          assessment: { type: 'string' },
          uncertainty: { type: 'string' },
          completedAction: { type: 'string' },
          nextStep: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: GET_SELECTED_PARCEL_CONTEXT_TOOL,
      description:
        'Retrieve verified context for the parcel currently selected in the workspace: parcel metadata, active alerts, latest sensor readings and trends, recent weather, irrigation events, and saved inspection history. Use this whenever the technician asks about the current parcel or its recent conditions.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: GENERATE_INSPECTION_REPORT_TOOL,
      description:
        'Generate a technician-reviewed inspection report and PDF preview for the active inspection. Use this only when the technician explicitly asks to generate, prepare, create, or draft an inspection report. This tool prepares a preview and never sends email.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
    },
  },
];

function parseToolArguments(value: unknown) {
  if (typeof value === 'string') {
    return noArgumentsSchema.parse(JSON.parse(value || '{}'));
  }

  return noArgumentsSchema.parse(value ?? {});
}

function parseInspectionNoteDraft(value: unknown): InspectionNoteDraft {
  const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;

  return inspectionNoteDraftSchema.parse(parsedValue);
}

export async function executeAgentTool(
  name: string,
  rawArguments: unknown,
  context: AgentToolContext,
): Promise<{ content: string; action?: AgentActionEvent }> {
  if (
    name !== GET_SELECTED_PARCEL_CONTEXT_TOOL &&
    name !== SAVE_INSPECTION_NOTE_TOOL &&
    name !== GENERATE_INSPECTION_REPORT_TOOL
  ) {
    return {
      content: JSON.stringify({
        success: false,
        error: 'The requested tool is not available.',
      }),
    };
  }

  try {
    if (name === SAVE_INSPECTION_NOTE_TOOL) {
      if (
        !context.inspectionHistory ||
        context.inspectionHistory.parcelId !== context.selectedParcelId
      ) {
        throw new Error(
          'A matching active inspection is required to prepare a field note.',
        );
      }

      const draft = parseInspectionNoteDraft(rawArguments);

      return {
        content: JSON.stringify({
          success: true,
          data: {
            status: 'ready-for-browser-persistence',
            observation: draft.observation,
            nextStep: draft.nextStep,
          },
        }),
        action: {
          draft,
          label: 'Inspection note ready',
          name: SAVE_INSPECTION_NOTE_TOOL,
          status: 'completed',
        },
      };
    }

    parseToolArguments(rawArguments);

    if (name === GENERATE_INSPECTION_REPORT_TOOL) {
      const artifact = await generateInspectionReport(context);

      return {
        content: JSON.stringify({
          success: true,
          data: {
            reportId: artifact.report.id,
            parcel: artifact.report.parcelName,
            recipient: artifact.recipient,
            status: artifact.status,
          },
        }),
        action: {
          artifact,
          label: `Report ready · ${artifact.report.parcelName}`,
          name: GENERATE_INSPECTION_REPORT_TOOL,
          status: 'completed',
        },
      };
    }

    const parcelContext = getSelectedParcelContext(
      context.selectedParcelId,
      context.inspectionHistory,
    );

    return {
      content: JSON.stringify({ success: true, data: parcelContext }),
      action: {
        name: GET_SELECTED_PARCEL_CONTEXT_TOOL,
        label: `Context retrieved · ${parcelContext.parcel.name}`,
        status: 'completed',
      },
    };
  } catch (error) {
    console.error('Agent tool execution failed.', error);

    return {
      content: JSON.stringify({
        success: false,
        error:
          name === GENERATE_INSPECTION_REPORT_TOOL
            ? 'The inspection report could not be generated.'
            : name === SAVE_INSPECTION_NOTE_TOOL
              ? 'The inspection note could not be prepared.'
            : 'The selected parcel context could not be retrieved.',
      }),
    };
  }
}
