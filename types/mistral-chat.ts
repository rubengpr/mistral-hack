import type {
  AgentActionEvent,
  InspectionHistoryContext,
} from '@/types/agent-tools';

export type MistralChatRole = 'user' | 'assistant';

export type MistralChatMessage = {
  id: string;
  role: MistralChatRole;
  content: string;
  actions?: AgentActionEvent[];
};

export type MistralChatRequestMessage = Pick<
  MistralChatMessage,
  'role' | 'content'
>;

export type MistralChatResponse = {
  success: true;
  data: {
    message: string;
    actions: AgentActionEvent[];
  };
};

export type MistralChatToolContext = {
  selectedParcelId: string;
  inspectionHistory?: InspectionHistoryContext;
};
