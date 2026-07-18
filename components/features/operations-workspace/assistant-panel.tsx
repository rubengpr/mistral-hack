'use client';

import { useRef, useState } from 'react';
import type { ChatStatus } from 'ai';
import { Bot, X } from 'lucide-react';
import { nanoid } from 'nanoid';

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type {
  MistralChatMessage,
  MistralChatResponse,
} from '@/types/mistral-chat';

type ChatContentProps = {
  error: string | null;
  messages: MistralChatMessage[];
  onSend: (text: string) => Promise<void>;
  onStop: () => void;
  status: ChatStatus;
};

function isChatResponse(value: unknown): value is MistralChatResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Partial<MistralChatResponse>;

  return (
    response.success === true &&
    typeof response.data?.message === 'string' &&
    response.data.message.length > 0
  );
}

function getErrorMessage(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'error' in value &&
    typeof value.error === 'string'
  ) {
    return value.error;
  }

  return 'Mistral could not answer right now. Please try again.';
}

function ChatContent({
  error,
  messages,
  onSend,
  onStop,
  status,
}: ChatContentProps) {
  const isSending = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="This first version talks directly to the model without tools or agricultural context."
              icon={<Bot className="size-6" aria-hidden="true" />}
              title="Start a conversation with Mistral"
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <MessageResponse>{message.content}</MessageResponse>
                </MessageContent>
              </Message>
            ))
          )}

          {isSending ? (
            <Message from="assistant">
              <MessageContent className="flex-row items-center text-muted-foreground">
                <Spinner />
                <span>Mistral is thinking…</span>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Message not sent</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <PromptInput
        onSubmit={async ({ text }) => {
          await onSend(text);
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea
            aria-label="Message Mistral"
            disabled={isSending}
            placeholder="Message Mistral…"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <span className="text-xs text-muted-foreground">
            Direct model chat · no tools
          </span>
          <PromptInputSubmit
            disabled={isSending}
            onStop={onStop}
            status={status}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

type AssistantPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssistantPanel({ open, onOpenChange }: AssistantPanelProps) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<MistralChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(rawText: string) {
    const content = rawText.trim();

    if (!content) {
      setError('Enter a message before sending.');
      setStatus('error');
      return;
    }

    if (status === 'submitted' || status === 'streaming') {
      return;
    }

    const userMessage: MistralChatMessage = {
      id: nanoid(),
      role: 'user',
      content,
    };
    const nextMessages = [...messages, userMessage];
    const abortController = new AbortController();

    abortControllerRef.current = abortController;
    setMessages(nextMessages);
    setError(null);
    setStatus('submitted');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
        }),
        signal: abortController.signal,
      });
      const payload: unknown = await response.json();

      if (!response.ok || !isChatResponse(payload)) {
        throw new Error(getErrorMessage(payload));
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: nanoid(),
          role: 'assistant',
          content: payload.data.message,
        },
      ]);
      setStatus('ready');
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === 'AbortError'
      ) {
        setStatus('ready');
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Mistral could not answer right now. Please try again.',
      );
      setStatus('error');
    } finally {
      abortControllerRef.current = null;
    }
  }

  function stopRequest() {
    abortControllerRef.current?.abort();
  }

  if (!open) {
    return null;
  }

  return (
    <Card className="order-first flex h-full min-h-0 min-w-0 flex-col overflow-hidden lg:order-none">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b p-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle>Mistral chat</CardTitle>
          <CardDescription>
            A direct conversation with the language model.
          </CardDescription>
        </div>
        <Button
          aria-label="Close assistant"
          onClick={() => onOpenChange(false)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 p-4">
        <ChatContent
          error={error}
          messages={messages}
          onSend={sendMessage}
          onStop={stopRequest}
          status={status}
        />
      </CardContent>
    </Card>
  );
}
