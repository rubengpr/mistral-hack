export type MistralChatRole = 'user' | 'assistant';

export type MistralChatMessage = {
  id: string;
  role: MistralChatRole;
  content: string;
};

export type MistralChatRequestMessage = Pick<
  MistralChatMessage,
  'role' | 'content'
>;

export type MistralChatResponse = {
  success: true;
  data: {
    message: string;
  };
};
