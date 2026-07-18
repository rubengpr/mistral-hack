'use client';

import { useRef, useState } from 'react';
import type { ChatStatus, FileUIPart } from 'ai';
import {
  AudioLines,
  Camera,
  CircleCheck,
  FileText,
  Mic,
  Send,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import Image from 'next/image';
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
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
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
import { ReportPreviewDialog } from '@/components/features/operations-workspace/report-preview-dialog';
import { useVoiceConversation } from '@/hooks/use-voice-conversation';
import { ASSISTANT_IDENTITY } from '@/lib/assistant-identity';
import { createBrowserDemoStateRepository } from '@/lib/db/local-storage-demo-state-repository';
import {
  FIELD_PHOTO_INPUT_MAX_BYTES,
  prepareFieldPhoto,
} from '@/lib/images/prepare-field-photo';
import type {
  MistralChatMessage,
  MistralChatPhoto,
  MistralChatResponse,
} from '@/types/mistral-chat';
import type { AgentActionEvent } from '@/types/agent-tools';
import type {
  ReportArtifact,
  ReportDeliveryResult,
  ReportStatus,
} from '@/types/inspection-report';
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
  isAnalyzingPhoto: boolean;
  messages: MistralChatMessage[];
  onInputError: (message: string) => void;
  onSend: (text: string, file?: FileUIPart) => Promise<string>;
  onOpenReport: (artifact: ReportArtifact) => void;
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

function FieldPhotoPreview() {
  const attachments = usePromptInputAttachments();
  const photo = attachments.files[0];

  if (!photo?.url) {
    return null;
  }

  return (
    <PromptInputHeader>
      <div className="flex min-w-0 items-center gap-2">
        <Image
          alt="Selected field photo preview"
          className="size-12 shrink-0 rounded-md object-cover"
          height={48}
          src={photo.url}
          unoptimized
          width={48}
        />
        <span className="min-w-0 flex-1 truncate text-xs">
          {photo.filename ?? 'Field photo'}
        </span>
        <PromptInputButton
          aria-label="Remove field photo"
          onClick={() => attachments.remove(photo.id)}
          tooltip="Remove field photo"
        >
          <X aria-hidden="true" />
        </PromptInputButton>
      </div>
    </PromptInputHeader>
  );
}

function FieldPhotoButton({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments();

  return (
    <PromptInputButton
      aria-label="Add field photo"
      disabled={disabled || attachments.files.length > 0}
      onClick={attachments.openFileDialog}
      tooltip="Add field photo"
    >
      <Camera aria-hidden="true" />
    </PromptInputButton>
  );
}

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
    response.data.actions.every(isAgentAction) &&
    (response.data.photoAnalysis === undefined ||
      (typeof response.data.photoAnalysis.photoId === 'string' &&
        isFieldPhotoAnalysis(response.data.photoAnalysis.analysis)))
  );
}

function isFieldPhotoAnalysis(value: unknown) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const analysis = value as Record<string, unknown>;

  return (
    typeof analysis.observation === 'string' &&
    typeof analysis.inference === 'string' &&
    typeof analysis.uncertainty === 'string' &&
    typeof analysis.recommendedVerification === 'string'
  );
}

function isAgentAction(value: unknown): value is AgentActionEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const action = value as Partial<AgentActionEvent>;

  if (typeof action.label !== 'string' || action.status !== 'completed') {
    return false;
  }

  if (
    action.name === 'get_selected_parcel_context' ||
    action.name === 'send_reviewed_report'
  ) {
    return true;
  }

  if (action.name !== 'generate_inspection_report' || !('artifact' in action)) {
    return false;
  }

  const artifact = action.artifact as Partial<ReportArtifact>;

  return (
    typeof artifact.pdfBase64 === 'string' &&
    typeof artifact.approvalToken === 'string' &&
    typeof artifact.recipient === 'string' &&
    typeof artifact.report?.id === 'string'
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
  isAnalyzingPhoto,
  messages,
  onInputError,
  onOpenReport,
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
                  {message.actions?.map((action) => {
                    if (action.name === 'generate_inspection_report') {
                      return (
                        <div
                          className="mb-2 flex flex-wrap items-center gap-2"
                          key={`${message.id}-${action.name}`}
                        >
                          <Badge variant="outline">
                            <FileText
                              data-icon="inline-start"
                              aria-hidden="true"
                            />
                            {action.label}
                          </Badge>
                          <Button
                            onClick={() => onOpenReport(action.artifact)}
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            Review PDF
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <Badge
                        className="mb-2 w-fit gap-1.5 [&>svg]:size-4"
                        key={`${message.id}-${action.name}`}
                        variant="secondary"
                      >
                        {action.name === 'send_reviewed_report' ? (
                          <Send data-icon="inline-start" aria-hidden="true" />
                        ) : (
                          <CircleCheck
                            data-icon="inline-start"
                            aria-hidden="true"
                          />
                        )}
                        {action.label}
                      </Badge>
                    );
                  })}
                  {message.photo ? (
                    <Image
                      alt={message.photo.fileName}
                      className="max-h-56 w-full rounded-md object-cover"
                      height={900}
                      src={message.photo.dataUrl}
                      unoptimized
                      width={1200}
                    />
                  ) : null}
                  <MessageResponse>{message.content}</MessageResponse>
                </MessageContent>
              </Message>
            ))
          )}

          {isSending ? (
            <Message from="assistant">
              <MessageContent className="flex-row items-center text-muted-foreground">
                <Spinner />
                <span>
                  {isAnalyzingPhoto
                    ? 'Analyzing field photo…'
                    : `${ASSISTANT_IDENTITY.name} is thinking…`}
                </span>
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
        accept="image/jpeg,image/png,image/webp"
        maxFiles={1}
        maxFileSize={FIELD_PHOTO_INPUT_MAX_BYTES}
        onError={({ message }) => onInputError(message)}
        onSubmit={async ({ files, text }) => {
          await onSend(text, files[0]);
        }}
      >
        <FieldPhotoPreview />
        <PromptInputBody>
          <PromptInputTextarea
            aria-label={`Message ${ASSISTANT_IDENTITY.name}`}
            disabled={isSending || voice.isActive}
            placeholder={`Message ${ASSISTANT_IDENTITY.name}…`}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <div className="flex items-center gap-1">
            <FieldPhotoButton disabled={isSending || voice.isActive} />
            <VoiceControl
              active={voice.isActive}
              onToggle={voice.toggleConversation}
              state={voice.state}
            />
          </div>
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
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [reportArtifact, setReportArtifact] = useState<ReportArtifact | null>(
    null,
  );
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  function persistReportStatus(
    reportStatus: ReportStatus,
    result?: ReportDeliveryResult,
    reportError?: string,
  ) {
    if (!reportArtifact) {
      return;
    }

    const repository = createBrowserDemoStateRepository();
    const demoState = repository.load();

    repository.save({
      ...demoState,
      report: {
        reportId: reportArtifact.report.id,
        recipient: reportArtifact.recipient,
        subject: reportArtifact.subject,
        status: reportStatus,
        generatedAt: reportArtifact.report.generatedAt,
        providerMessageId: result?.providerMessageId,
        error: reportError,
      },
    });

    if (reportStatus === 'sent' && result) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: nanoid(),
          role: 'assistant',
          content: `The reviewed report was accepted by Resend for ${result.recipient}.`,
          actions: [
            {
              label: `Email accepted · ${result.providerMessageId}`,
              name: 'send_reviewed_report',
              status: 'completed',
            },
          ],
        },
      ]);
    }
  }

  function openReport(artifact: ReportArtifact) {
    setReportArtifact(artifact);
    setIsReportDialogOpen(true);
  }

  async function sendMessage(rawText: string, file?: FileUIPart) {
    const technicianText = rawText.trim();

    if (!technicianText && !file) {
      const message = 'Enter a message or attach a field photo before sending.';

      setError(message);
      setStatus('error');
      throw new Error(message);
    }

    if (status === 'submitted' || status === 'streaming') {
      throw new Error('Wait for the current response to finish.');
    }

    const abortController = new AbortController();
    let userMessageId: string | undefined;

    abortControllerRef.current = abortController;
    setError(null);
    setStatus('submitted');
    setIsAnalyzingPhoto(Boolean(file));

    try {
      const photo = file ? await prepareFieldPhoto(file) : undefined;
      const content =
        technicianText ||
        'Please analyze this field photo as supporting evidence for the selected parcel.';
      const userMessage: MistralChatMessage = {
        id: nanoid(),
        role: 'user',
        content,
        photo,
      };
      const nextMessages = [...messages, userMessage];

      userMessageId = userMessage.id;
      setMessages(nextMessages);

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
          photo,
        }),
        signal: abortController.signal,
      });
      const payload: unknown = await response.json();

      if (!response.ok || !isChatResponse(payload)) {
        throw new Error(getErrorMessage(payload));
      }

      let persistedPhoto: MistralChatPhoto | undefined;

      if (photo) {
        if (
          !payload.data.photoAnalysis ||
          payload.data.photoAnalysis.photoId !== photo.id
        ) {
          throw new Error(
            'Mistral returned an incomplete field photo analysis. Please try again.',
          );
        }

        const repository = createBrowserDemoStateRepository();
        const currentState = repository.load();

        if (currentState.activeInspection.parcelId !== selectedParcelId) {
          throw new Error(
            'The selected parcel changed before the field photo could be saved.',
          );
        }

        persistedPhoto = {
          ...photo,
          analysis: payload.data.photoAnalysis.analysis,
        };
        try {
          repository.save({
            ...currentState,
            activeInspection: {
              ...currentState.activeInspection,
              status:
                currentState.activeInspection.status === 'not-started'
                  ? 'in-progress'
                  : currentState.activeInspection.status,
              photos: [
                ...currentState.activeInspection.photos.filter(
                  ({ id }) => id !== photo.id,
                ),
                {
                  id: persistedPhoto.id,
                  capturedAt: persistedPhoto.capturedAt,
                  dataUrl: persistedPhoto.dataUrl,
                  analysis: persistedPhoto.analysis,
                },
              ],
            },
          });
        } catch {
          throw new Error(
            'The photo was analyzed but could not be saved in this browser. Remove an older photo or reset the demo, then try again.',
          );
        }
      }

      const generatedReport = payload.data.actions.find(
        (action) => action.name === 'generate_inspection_report',
      );

      if (generatedReport?.name === 'generate_inspection_report') {
        const repository = createBrowserDemoStateRepository();
        const currentState = repository.load();

        setReportArtifact(generatedReport.artifact);
        setIsReportDialogOpen(true);
        repository.save({
          ...currentState,
          report: {
            reportId: generatedReport.artifact.report.id,
            recipient: generatedReport.artifact.recipient,
            subject: generatedReport.artifact.subject,
            status: 'preview-ready',
            generatedAt: generatedReport.artifact.report.generatedAt,
          },
        });
      }

      setMessages((currentMessages) => [
        ...currentMessages.map((message) =>
          message.id === userMessage.id && persistedPhoto
            ? { ...message, photo: persistedPhoto }
            : message,
        ),
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
      if (userMessageId) {
        setMessages((currentMessages) =>
          currentMessages.filter(({ id }) => id !== userMessageId),
        );
      }

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
      setIsAnalyzingPhoto(false);
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
    <>
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
              <CardDescription>
                {ASSISTANT_IDENTITY.description}
              </CardDescription>
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
            isAnalyzingPhoto={isAnalyzingPhoto}
            messages={messages}
            onInputError={setError}
            onOpenReport={openReport}
            onSend={sendMessage}
            onStop={stopRequest}
            status={status}
            voice={voice}
          />
        </CardContent>
      </Card>
      <ReportPreviewDialog
        artifact={reportArtifact}
        key={reportArtifact?.report.id ?? 'no-report'}
        onDeliveryStateChange={persistReportStatus}
        onOpenChange={setIsReportDialogOpen}
        open={isReportDialogOpen}
      />
    </>
  );
}
