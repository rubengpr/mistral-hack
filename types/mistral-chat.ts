import type {
  AgentActionEvent,
  InspectionHistoryContext,
} from '@/types/agent-tools';
import type { FieldPhotoAnalysis } from '@/types/agricultural-operations';

export type MistralChatRole = 'user' | 'assistant';

export type MistralChatPhoto = {
  id: string;
  capturedAt: string;
  dataUrl: string;
  fileName: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  analysis?: FieldPhotoAnalysis;
};

export type MistralChatMessage = {
  id: string;
  role: MistralChatRole;
  content: string;
  photo?: MistralChatPhoto;
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
    photoAnalysis?: {
      photoId: string;
      analysis: FieldPhotoAnalysis;
    };
  };
};

export type MistralChatToolContext = {
  selectedParcelId: string;
  inspectionHistory?: InspectionHistoryContext;
};
