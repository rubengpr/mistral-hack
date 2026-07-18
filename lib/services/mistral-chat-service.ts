import type {
  ChatCompletionRequest,
  ContentChunk,
} from '@mistralai/mistralai/models/components';

import { createMistralClient } from '@/lib/integrations/mistral/client';
import {
  AGENT_TOOL_DEFINITIONS,
  executeAgentTool,
} from '@/lib/services/agent-tool-registry';
import { applyAgentResponsePolicy } from '@/lib/services/agent-response-policy';
import type { AgentActionEvent, AgentToolContext } from '@/types/agent-tools';
import type { MistralChatRequestMessage } from '@/types/mistral-chat';

const CONVERSATION_SYSTEM_PROMPT = `You are Vinea, a calm and practical vineyard operations assistant speaking with an agricultural technician.
Reply in the same language as the technician. Keep answers concise: normally one to three short sentences.
Write for both screen and speech using plain text. Always render numeric values with digits and standard unit symbols, never as number words. For example, write 32%, 33.2%, and 24.5 °C instead of spelling those values out. Do not use Markdown, emoji, headings, or lists.
Use the parcel-context tool whenever the technician asks about the selected parcel, alerts, sensors, recent weather, irrigation, notes, actions, or history.
Use the inspection-note tool only when the technician explicitly asks to record, save, or note field findings. Preserve the technician's meaning. Put only actions they state are already completed in completedAction; put planned work in nextStep. A successful tool result means the note is ready for browser persistence, not yet saved, so do not claim it was saved in your response.
Use the report-generation tool only when the technician explicitly asks to generate, prepare, create, or draft an inspection report. Generating a report creates a preview and does not send email. Never claim that an email was sent from a conversational message.
Never use the inspection-note and report-generation tools in the same turn. Ask the technician to review the saved note and request the report in a subsequent turn.
Treat tool results as evidence. Preserve the factual meaning of alert titles and descriptions; you may translate them, but do not reclassify them as drought, disease, failure, or another diagnosis.
When a turn includes a supporting field photo analysis, use it as technician-provided evidence. Separate its visual observation from its inference, preserve its uncertainty, and do not claim a definitive diagnosis.
Clearly distinguish observations from inference, mention uncertainty when relevant, and never invent missing data.
Never mention or allude to demos, simulations, fixtures, mocks, prototypes, test data, or internal data provenance. Present the supplied evidence directly as the current operational context.`;

export class EmptyMistralResponseError extends Error {
  constructor() {
    super('Mistral returned an empty response.');
    this.name = 'EmptyMistralResponseError';
  }
}

export function extractMistralText(
  content: string | ContentChunk[] | null | undefined,
) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!content) {
    return '';
  }

  return content
    .filter(
      (chunk): chunk is ContentChunk & { type: 'text'; text: string } =>
        chunk.type === 'text' && 'text' in chunk,
    )
    .map(({ text }) => text)
    .join('')
    .trim();
}

export async function completeMistralChat(
  messages: MistralChatRequestMessage[],
  toolContext: AgentToolContext,
) {
  const client = createMistralClient();
  const conversation: ChatCompletionRequest['messages'] = [
    {
      role: 'system',
      content: `${CONVERSATION_SYSTEM_PROMPT}\nThe workspace currently has parcel ID ${toolContext.selectedParcelId} selected.`,
    },
    ...messages,
  ];
  const response = await client.chat.complete({
    model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
    messages: conversation,
    tools: AGENT_TOOL_DEFINITIONS,
    toolChoice: 'auto',
    parallelToolCalls: false,
  });
  const assistantMessage = response.choices[0]?.message;

  if (!assistantMessage) {
    throw new EmptyMistralResponseError();
  }

  const toolCalls = assistantMessage?.toolCalls ?? [];

  if (toolCalls.length === 0) {
    const message = extractMistralText(assistantMessage?.content);

    if (!message) {
      throw new EmptyMistralResponseError();
    }

    return { message: applyAgentResponsePolicy(message), actions: [] };
  }

  conversation.push({ ...assistantMessage, role: 'assistant' });
  const actions: AgentActionEvent[] = [];

  for (const toolCall of toolCalls) {
    const execution = await executeAgentTool(
      toolCall.function.name,
      toolCall.function.arguments,
      toolContext,
    );

    conversation.push({
      role: 'tool',
      name: toolCall.function.name,
      toolCallId: toolCall.id,
      content: execution.content,
    });

    if (execution.action) {
      actions.push(execution.action);
    }
  }

  const finalResponse = await client.chat.complete({
    model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
    messages: conversation,
    tools: AGENT_TOOL_DEFINITIONS,
    toolChoice: 'none',
    parallelToolCalls: false,
  });
  const message = extractMistralText(
    finalResponse.choices[0]?.message?.content,
  );

  if (!message) {
    throw new EmptyMistralResponseError();
  }

  return { message: applyAgentResponsePolicy(message), actions };
}
