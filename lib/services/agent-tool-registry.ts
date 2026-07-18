import type { Tool } from '@mistralai/mistralai/models/components';
import { z } from 'zod';

import { getCanonicalDemoScenario } from '@/lib/fixtures/canonical-demo-scenario';
import { getSelectedParcelContext } from '@/lib/services/parcel-context-service';
import { generateInspectionReport } from '@/lib/services/inspection-report-service';
import { getWeatherForecast } from '@/lib/services/weather-forecast-service';
import {
  GENERATE_INSPECTION_REPORT_TOOL,
  GET_WEATHER_FORECAST_TOOL,
  GET_SELECTED_PARCEL_CONTEXT_TOOL,
  SAVE_INSPECTION_NOTE_TOOL,
  type AgentActionEvent,
  type AgentToolContext,
} from '@/types/agent-tools';
import type { ParcelCluster } from '@/types/agricultural-operations';

const noArgumentsSchema = z.object({}).strict();
const weatherForecastArgumentsSchema = z
  .object({
    scope: z.enum(['parcel', 'cluster']),
    parcelId: z.string().trim().min(1).max(100).optional(),
    cluster: z
      .enum(['herault', 'aude', 'gard', 'pyrenees-orientales'])
      .optional(),
  })
  .strict()
  .refine(
    ({ scope, parcelId, cluster }) =>
      scope === 'parcel' ? !cluster : Boolean(cluster) && !parcelId,
    'Use a parcel or a cluster, not both.',
  );
const inspectionNoteArgumentsSchema = z
  .object({
    scope: z.enum(['parcel', 'cluster']),
    cluster: z
      .enum(['herault', 'aude', 'gard', 'pyrenees-orientales'])
      .optional(),
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
  .strict()
  .refine(
    ({ scope, cluster }) => scope === 'cluster' || cluster === undefined,
    'A cluster can only be supplied for cluster notes.',
  );

export const AGENT_TOOL_DEFINITIONS: Array<Tool & { type: 'function' }> = [
  {
    type: 'function',
    function: {
      name: GET_WEATHER_FORECAST_TOOL,
      description:
        'Retrieve verified recent weather and the next 7-day forecast for the selected parcel or one portfolio cluster. Use this for forecast, rainfall outlook, temperature, evapotranspiration, or regional irrigation-planning questions. This tool reports evidence and never changes irrigation.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['scope'],
        properties: {
          scope: { type: 'string', enum: ['parcel', 'cluster'] },
          parcelId: { type: 'string' },
          cluster: {
            type: 'string',
            enum: ['herault', 'aude', 'gard', 'pyrenees-orientales'],
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: SAVE_INSPECTION_NOTE_TOOL,
      description:
        "Prepare a structured operational note only when the technician explicitly asks to record, save, or note information. Use parcel scope for the selected parcel. Use cluster scope when the technician says all reviewed parcels, all these parcels, or names a regional cluster. Preserve the technician's meaning. Put only actions they say are already completed in completedAction; put planned or recommended work in nextStep. Never turn uncertainty about disease into a diagnosis. This tool prepares the note for browser persistence and must not be used in the same turn as report generation.",
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: [
          'scope',
          'observation',
          'assessment',
          'uncertainty',
          'nextStep',
        ],
        properties: {
          scope: { type: 'string', enum: ['parcel', 'cluster'] },
          cluster: {
            type: 'string',
            enum: ['herault', 'aude', 'gard', 'pyrenees-orientales'],
          },
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

function parseInspectionNoteArguments(value: unknown) {
  const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;

  return inspectionNoteArgumentsSchema.parse(parsedValue);
}

export async function executeAgentTool(
  name: string,
  rawArguments: unknown,
  context: AgentToolContext,
): Promise<{ content: string; action?: AgentActionEvent }> {
  if (
    name !== GET_SELECTED_PARCEL_CONTEXT_TOOL &&
    name !== GET_WEATHER_FORECAST_TOOL &&
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
    if (name === GET_WEATHER_FORECAST_TOOL) {
      const parsedValue =
        typeof rawArguments === 'string'
          ? JSON.parse(rawArguments || '{}')
          : rawArguments;
      const arguments_ = weatherForecastArgumentsSchema.parse(parsedValue);
      const forecast = await getWeatherForecast(
        arguments_.scope === 'cluster'
          ? {
              scope: 'cluster',
              cluster: arguments_.cluster as ParcelCluster,
            }
          : {
              scope: 'parcel',
              parcelId: arguments_.parcelId ?? context.selectedParcelId,
            },
      );

      return {
        content: JSON.stringify({ success: true, data: forecast }),
        action: {
          name: GET_WEATHER_FORECAST_TOOL,
          label: `Forecast retrieved · ${forecast.locationLabel}`,
          status: 'completed',
        },
      };
    }

    if (name === SAVE_INSPECTION_NOTE_TOOL) {
      const { scope, cluster, ...draft } =
        parseInspectionNoteArguments(rawArguments);
      const scenario = getCanonicalDemoScenario();
      const selectedParcel = scenario.parcels.features.find(
        ({ properties }) => properties.id === context.selectedParcelId,
      );
      const targetCluster = cluster ?? selectedParcel?.properties.cluster;
      const targetParcelIds =
        scope === 'cluster' && targetCluster
          ? scenario.parcels.features
              .filter(({ properties }) => properties.cluster === targetCluster)
              .map(({ properties }) => properties.id)
          : scope === 'parcel'
            ? [context.selectedParcelId]
            : [];

      if (targetParcelIds.length === 0) {
        throw new Error('The note target does not contain any parcels.');
      }

      return {
        content: JSON.stringify({
          success: true,
          data: {
            status: 'ready-for-browser-persistence',
            observation: draft.observation,
            nextStep: draft.nextStep,
            targetParcelIds,
          },
        }),
        action: {
          draft,
          label:
            targetParcelIds.length === 1
              ? 'Parcel note ready'
              : `Parcel note ready · ${targetParcelIds.length} parcels`,
          name: SAVE_INSPECTION_NOTE_TOOL,
          status: 'completed',
          targetParcelIds,
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

    const parcelContext = await getSelectedParcelContext(
      context.selectedParcelId,
      context.inspectionHistory,
      context.selectedParcelNotes,
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
            : name === GET_WEATHER_FORECAST_TOOL
              ? 'The weather forecast could not be retrieved.'
              : name === SAVE_INSPECTION_NOTE_TOOL
                ? 'The inspection note could not be prepared.'
                : 'The selected parcel context could not be retrieved.',
      }),
    };
  }
}
