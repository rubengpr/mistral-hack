'use client';

import { useRef, useState } from 'react';
import type { ChatStatus } from 'ai';
import { AudioLines, Database, Mic, Square, Volume2, X } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useVoiceConversation } from '@/hooks/use-voice-conversation';
import { ASSISTANT_IDENTITY } from '@/lib/assistant-identity';
import { createBrowserDemoStateRepository } from '@/lib/db/local-storage-demo-state-repository';
import type {
  MistralChatMessage,
  MistralChatResponse,
} from '@/types/mistral-chat';
import type { VoiceConversationState } from '@/types/voice-conversation';

const VOICE_STATE_LABELS: Record<VoiceConversationState, string> = {
  idle: 'Start voice',
  connecting: 'Connecting',
  listening: 'Listening',
  transcribing: 'Transcribing',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Try voice again',
};

type VoiceControlProps = {
  active: boolean;
  onToggle: () => Promise<void>;
  state: VoiceConversationState;
};

function VoiceControl({ active, onToggle, state }: VoiceControlProps) {
  const isPending =
    state === 'connecting' || state === 'transcribing' || state === 'thinking';
  const Icon =
    state === 'listening'
      ? AudioLines
      : state === 'speaking'
        ? Volume2
        : active
          ? Square
          : Mic;

  return (
    <Button
      aria-label={
        active ? 'Stop voice conversation' : 'Start voice conversation'
      }
      aria-pressed={active}
      onClick={() => void onToggle()}
      size="sm"
      type="button"
      variant={active ? 'secondary' : 'outline'}
    >
      {isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <Icon data-icon="inline-start" />
      )}
      {VOICE_STATE_LABELS[state]}
    </Button>
  );
}

type ChatContentProps = {
  error: string | null;
  messages: MistralChatMessage[];
  onSend: (text: string) => Promise<string>;
  onStop: () => void;
  status: ChatStatus;
  voice: {
    error: string | null;
    isActive: boolean;
    partialTranscript: string;
    state: VoiceConversationState;
    toggleConversation: () => Promise<void>;
  };
};

function isChatResponse(value: unknown): value is MistralChatResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Partial<MistralChatResponse>;

  return (
    response.success === true &&
    typeof response.data?.message === 'string' &&
    response.data.message.length > 0 &&
    Array.isArray(response.data.actions) &&
    response.data.actions.every(
      (action) =>
        action.name === 'get_selected_parcel_context' &&
        typeof action.label === 'string' &&
        action.status === 'completed',
    )
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
  voice,
}: ChatContentProps) {
  const isSending = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Start voice mode once and speak naturally. Vinea will listen again after every response."
              icon={
                <Avatar className="size-14">
                  <AvatarImage
                    alt={`${ASSISTANT_IDENTITY.name} avatar`}
                    src={ASSISTANT_IDENTITY.avatarSrc}
                  />
                  <AvatarFallback>V</AvatarFallback>
                </Avatar>
              }
              title={`Start a conversation with ${ASSISTANT_IDENTITY.name}`}
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.actions?.map((action) => (
                    <Badge
                      className="mb-2 w-fit"
                      key={`${message.id}-${action.name}`}
                      variant="outline"
                    >
                      <Database data-icon="inline-start" aria-hidden="true" />
                      {action.label}
                    </Badge>
                  ))}
                  <MessageResponse>{message.content}</MessageResponse>
                </MessageContent>
              </Message>
            ))
          )}

          {isSending ? (
            <Message from="assistant">
              <MessageContent className="flex-row items-center text-muted-foreground">
                <Spinner />
                <span>{ASSISTANT_IDENTITY.name} is thinking…</span>
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

      {voice.error ? (
        <Alert variant="destructive">
          <AlertTitle>Voice mode unavailable</AlertTitle>
          <AlertDescription>{voice.error}</AlertDescription>
        </Alert>
      ) : null}

      {voice.partialTranscript ? (
        <Badge className="max-w-full self-start truncate" variant="secondary">
          {voice.state === 'listening' ? 'Hearing' : 'Heard'}:{' '}
          {voice.partialTranscript}
        </Badge>
      ) : null}

      <PromptInput
        onSubmit={async ({ text }) => {
          try {
            await onSend(text);
          } catch {
            // The visible alert contains the request error.
          }
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea
            aria-label={`Message ${ASSISTANT_IDENTITY.name}`}
            disabled={isSending || voice.isActive}
            placeholder={`Message ${ASSISTANT_IDENTITY.name}…`}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <VoiceControl
            active={voice.isActive}
            onToggle={voice.toggleConversation}
            state={voice.state}
          />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Say “basta” to finish
            </span>
            <PromptInputSubmit
              disabled={isSending || voice.isActive}
              onStop={onStop}
              status={status}
            />
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

type AssistantPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedParcelId: string;
};

export function AssistantPanel({
  open,
  onOpenChange,
  selectedParcelId,
}: AssistantPanelProps) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<MistralChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(rawText: string) {
    const content = rawText.trim();

    if (!content) {
      setError('Enter a message before sending.');
      setStatus('error');
      throw new Error('Enter a message before sending.');
    }

    if (status === 'submitted' || status === 'streaming') {
      throw new Error('Wait for the current response to finish.');
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
      const demoState = createBrowserDemoStateRepository().load();
      const activeInspection = demoState.activeInspection;
      const inspectionHistory =
        activeInspection.parcelId === selectedParcelId
          ? activeInspection
          : undefined;
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
          selectedParcelId,
          inspectionHistory,
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
          actions: payload.data.actions,
        },
      ]);
      setStatus('ready');
      return payload.data.message;
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === 'AbortError'
      ) {
        setStatus('ready');
        throw requestError;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Mistral could not answer right now. Please try again.',
      );
      setStatus('error');
      throw requestError;
    } finally {
      abortControllerRef.current = null;
    }
  }

  const voice = useVoiceConversation({ onTurn: sendMessage });

  function stopRequest() {
    abortControllerRef.current?.abort();
  }

  function closeAssistant() {
    void voice.stopConversation();
    onOpenChange(false);
  }

  if (!open) {
    return null;
  }

  return (
    <Card className="order-first flex h-full min-h-0 min-w-0 flex-col overflow-hidden lg:order-none">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage
              alt={`${ASSISTANT_IDENTITY.name} avatar`}
              src={ASSISTANT_IDENTITY.avatarSrc}
            />
            <AvatarFallback>V</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{ASSISTANT_IDENTITY.name}</CardTitle>
            <CardDescription>{ASSISTANT_IDENTITY.description}</CardDescription>
          </div>
        </div>
        <Button
          aria-label="Close assistant"
          onClick={closeAssistant}
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
          voice={voice}
        />
      </CardContent>
    </Card>
  );
}
