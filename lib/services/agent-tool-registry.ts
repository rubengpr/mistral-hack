import type { Tool } from '@mistralai/mistralai/models/components';
import { z } from 'zod';

import { getSelectedParcelContext } from '@/lib/services/parcel-context-service';
import { generateInspectionReport } from '@/lib/services/inspection-report-service';
import {
  GENERATE_INSPECTION_REPORT_TOOL,
  GET_SELECTED_PARCEL_CONTEXT_TOOL,
  type AgentActionEvent,
  type AgentToolContext,
} from '@/types/agent-tools';

const noArgumentsSchema = z.object({}).strict();

export const AGENT_TOOL_DEFINITIONS: Array<Tool & { type: 'function' }> = [
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

export async function executeAgentTool(
  name: string,
  rawArguments: unknown,
  context: AgentToolContext,
): Promise<{ content: string; action?: AgentActionEvent }> {
  if (
    name !== GET_SELECTED_PARCEL_CONTEXT_TOOL &&
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
            : 'The selected parcel context could not be retrieved.',
      }),
    };
  }
}
