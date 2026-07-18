'use client';

import { useState } from 'react';
import { Download, FileCheck2, Send } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type {
  ReportArtifact,
  ReportDeliveryResult,
  ReportStatus,
} from '@/types/inspection-report';

type ReportPreviewDialogProps = {
  artifact: ReportArtifact | null;
  onDeliveryStateChange: (
    status: ReportStatus,
    result?: ReportDeliveryResult,
    error?: string,
  ) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function getErrorMessage(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'error' in value &&
    typeof value.error === 'string'
  ) {
    return value.error;
  }

  return 'The report could not be sent. You can retry or download it.';
}

export function ReportPreviewDialog({
  artifact,
  onDeliveryStateChange,
  onOpenChange,
  open,
}: ReportPreviewDialogProps) {
  const [status, setStatus] = useState<ReportStatus>('preview-ready');
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<ReportDeliveryResult | null>(null);
  const pdfUrl = artifact
    ? `data:application/pdf;base64,${artifact.pdfBase64}`
    : null;

  async function confirmAndSend() {
    if (!artifact || status === 'sending' || status === 'sent') {
      return;
    }

    setStatus('sending');
    setError(null);
    onDeliveryStateChange('sending');

    try {
      const response = await fetch('/api/report-deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalToken: artifact.approvalToken,
          confirmed: true,
          filename: artifact.filename,
          parcelId: artifact.report.parcelId,
          pdfBase64: artifact.pdfBase64,
          recipient: artifact.recipient,
          reportId: artifact.report.id,
          subject: artifact.subject,
        }),
      });
      const payload: unknown = await response.json();

      if (
        !response.ok ||
        !payload ||
        typeof payload !== 'object' ||
        !('success' in payload) ||
        payload.success !== true ||
        !('data' in payload)
      ) {
        throw new Error(getErrorMessage(payload));
      }

      const result = payload.data as ReportDeliveryResult;
      setDelivery(result);
      setStatus('sent');
      onDeliveryStateChange('sent', result);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'The report could not be sent. You can retry or download it.';

      setError(message);
      setStatus('failed');
      onDeliveryStateChange('failed', undefined, message);
    }
  }

  function changeOpen(nextOpen: boolean) {
    if (status !== 'sending') {
      onOpenChange(nextOpen);
    }
  }

  function downloadPdf() {
    if (!artifact || !pdfUrl) {
      return;
    }

    const link = document.createElement('a');
    link.download = artifact.filename;
    link.href = pdfUrl;
    link.click();
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogContent className="flex h-[92svh] max-w-5xl flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Review inspection report</DialogTitle>
            <Badge variant="secondary">Human confirmation required</Badge>
          </div>
          <DialogDescription>
            Review the exact PDF and recipient before Vinea sends the email.
          </DialogDescription>
        </DialogHeader>

        {artifact ? (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">To</p>
              <p className="truncate font-medium">{artifact.recipient}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">From</p>
              <p className="truncate font-medium">{artifact.sender}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="truncate font-medium">{artifact.subject}</p>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/30">
          {pdfUrl ? (
            <iframe
              className="size-full bg-background"
              src={`${pdfUrl}#toolbar=0`}
              title="Inspection report PDF preview"
            />
          ) : (
            <div className="flex size-full items-center justify-center gap-2 text-muted-foreground">
              <Spinner />
              <span>Preparing PDF preview…</span>
            </div>
          )}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Email not sent</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {delivery ? (
          <Alert>
            <FileCheck2 aria-hidden="true" />
            <AlertTitle>Report accepted by Resend</AlertTitle>
            <AlertDescription>
              Provider message ID: {delivery.providerMessageId}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            disabled={status === 'sending'}
            onClick={() => changeOpen(false)}
            type="button"
            variant="outline"
          >
            {status === 'sent' ? 'Close' : 'Cancel'}
          </Button>
          <Button
            disabled={!pdfUrl}
            onClick={downloadPdf}
            type="button"
            variant="secondary"
          >
            <Download data-icon="inline-start" aria-hidden="true" />
            Download PDF
          </Button>
          {status !== 'sent' ? (
            <Button
              disabled={!pdfUrl || status === 'sending'}
              onClick={() => void confirmAndSend()}
              type="button"
            >
              {status === 'sending' ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" aria-hidden="true" />
              )}
              {status === 'sending' ? 'Sending…' : 'Confirm and send'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
