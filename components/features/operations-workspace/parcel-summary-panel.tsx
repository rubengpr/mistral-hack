import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Droplets,
  LandPlot,
  MapPin,
  NotebookPen,
  RadioTower,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ASSISTANT_IDENTITY } from '@/lib/assistant-identity';
import { cn } from '@/lib/utils';
import type { ActiveFinding } from '@/types/operations-dashboard';
import type {
  InspectionNote,
  ParcelProperties,
  ParcelReviewSummary,
  SectorFeature,
} from '@/types/agricultural-operations';

const DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'Europe/Paris',
});
const REVIEW_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});
const NOTE_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});
const STATUS_LABELS = {
  normal: 'Normal',
  review: 'Review',
  critical: 'Critical',
} as const;
const REVIEW_ALERT_STYLES: Record<
  ParcelProperties['operationalStatus'],
  string
> = {
  normal:
    'border-status-normal/20 bg-status-normal/10 [&>svg]:text-status-normal',
  review:
    'border-status-review/25 bg-status-review/10 [&>svg]:text-status-review',
  critical:
    'border-status-critical/25 bg-status-critical/10 [&>svg]:text-status-critical',
};
const REVIEW_ALERT_DOT_STYLES: Record<
  ParcelProperties['operationalStatus'],
  string
> = {
  normal: 'bg-status-normal',
  review: 'bg-status-review',
  critical: 'bg-status-critical',
};

type SummaryItemProps = {
  hideLabel?: boolean;
  icon: typeof MapPin;
  label: string;
  value: ReactNode;
};

function SummaryItem({
  hideLabel = false,
  icon: Icon,
  label,
  value,
}: SummaryItemProps) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt
          className={cn(
            'text-xs text-muted-foreground',
            hideLabel && 'sr-only',
          )}
        >
          {label}
        </dt>
        <dd className="text-sm font-medium break-words">{value}</dd>
      </div>
    </div>
  );
}

type ParcelSummaryPanelProps = {
  affectedSector: SectorFeature;
  finding?: ActiveFinding;
  notes: InspectionNote[];
  onAskVinea: (parcelId: string) => void;
  onClose?: () => void;
  parcel: ParcelProperties;
  reviewSummary?: ParcelReviewSummary;
  sensorCount: number;
};

export function ParcelSummaryPanel({
  affectedSector,
  finding,
  notes,
  onAskVinea,
  onClose,
  parcel,
  reviewSummary,
  sensorCount,
}: ParcelSummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const activeFinding = finding?.parcelId === parcel.id ? finding : undefined;
  const sectorName = activeFinding ? affectedSector.properties.name : 'None';

  return (
    <Card
      className={cn(
        'absolute inset-x-3 bottom-3 overflow-hidden shadow-lg transition-[max-height] duration-200',
        isExpanded
          ? 'max-h-[calc(100%-1.5rem)] overflow-y-auto'
          : 'max-h-20',
      )}
      role="region"
      aria-labelledby="parcel-summary"
    >
      <CardHeader
        className={cn(
          'flex-row items-center justify-between gap-3 p-4',
          isExpanded && 'items-start border-b pb-3',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle id="parcel-summary" className="truncate">
              {parcel.name}
            </CardTitle>
            <Badge
              className="shrink-0"
              variant={
                parcel.operationalStatus === 'critical'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {STATUS_LABELS[parcel.operationalStatus]}
            </Badge>
          </div>
          <CardDescription className="truncate">
            {parcel.municipality}, {parcel.department}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            aria-controls="parcel-summary-content"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? 'Collapse parcel details' : 'Expand parcel details'
            }
            onClick={() => setIsExpanded((expanded) => !expanded)}
            size="icon"
            type="button"
            variant="ghost"
          >
            {isExpanded ? (
              <ChevronDown aria-hidden="true" />
            ) : (
              <ChevronUp aria-hidden="true" />
            )}
          </Button>
          <Button
            aria-label="Close parcel details"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent
        className="px-4 pb-4 pt-4"
        hidden={!isExpanded}
        id="parcel-summary-content"
      >
        {reviewSummary ? (
          <Alert
            className={cn(
              'mb-4 px-3 py-2.5 [&>svg]:left-3 [&>svg]:top-3 [&>svg]:size-4 [&>svg~*]:pl-6',
              REVIEW_ALERT_STYLES[parcel.operationalStatus],
            )}
          >
            <Sparkles aria-hidden="true" />
            <AlertTitle className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  REVIEW_ALERT_DOT_STYLES[parcel.operationalStatus],
                )}
              />
              <span className="sr-only">
                {STATUS_LABELS[parcel.operationalStatus]}.{' '}
              </span>
              AI review summary
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-1.5">
              <p className="leading-snug">
                <span className="font-medium text-foreground">
                  {reviewSummary.title}.
                </span>{' '}
                {reviewSummary.summary}
              </p>
              <p className="text-xs leading-snug text-muted-foreground">
                Mistral morning review ·{' '}
                {reviewSummary.quality === 'modelled'
                  ? 'Modelled weather evidence'
                  : 'Simulated fallback evidence'}{' '}
                ·{' '}
                {REVIEW_DATE_FORMATTER.format(
                  new Date(reviewSummary.generatedAt),
                )}
              </p>
            </AlertDescription>
          </Alert>
        ) : null}
        {reviewSummary?.evidence ? (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
            <span>
              Recent rain:{' '}
              {reviewSummary.evidence.recentPrecipitationMillimeters.toFixed(1)}{' '}
              mm
            </span>
            <span>
              Forecast rain:{' '}
              {reviewSummary.evidence.forecastPrecipitationMillimeters.toFixed(
                1,
              )}{' '}
              mm
            </span>
            <span>
              Forecast ET₀:{' '}
              {reviewSummary.evidence.forecastEvapotranspirationMillimeters.toFixed(
                1,
              )}{' '}
              mm
            </span>
            <span>
              Planning gap:{' '}
              {reviewSummary.evidence.forecastGapMillimeters.toFixed(1)} mm
            </span>
          </div>
        ) : null}
        {notes.length > 0 ? (
          <section aria-labelledby="parcel-notes" className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 id="parcel-notes" className="text-sm font-medium">
                Parcel notes
              </h3>
              <Badge variant="secondary">{notes.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {notes
                .slice(-3)
                .reverse()
                .map((note) => (
                  <Alert key={note.id}>
                    <NotebookPen aria-hidden="true" />
                    <AlertTitle>
                      {NOTE_DATE_FORMATTER.format(new Date(note.createdAt))}
                    </AlertTitle>
                    <AlertDescription className="flex flex-col gap-1">
                      <p>{note.observation ?? note.content}</p>
                      {note.nextStep ? (
                        <p>
                          <span className="font-medium text-foreground">
                            Planned action:
                          </span>{' '}
                          {note.nextStep}
                        </p>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ))}
            </div>
          </section>
        ) : null}
        <Separator />
        <dl className="mt-4 grid grid-cols-2 gap-4">
          <SummaryItem
            hideLabel
            icon={MapPin}
            label="Location"
            value={`${parcel.municipality}, ${parcel.department}`}
          />
          <SummaryItem
            hideLabel
            icon={LandPlot}
            label="Surface area"
            value={`${parcel.areaHectares} ha`}
          />
          <SummaryItem
            hideLabel
            icon={Droplets}
            label="Soil moisture"
            value={`${parcel.currentSoilMoisturePercent}%`}
          />
          <SummaryItem
            hideLabel
            icon={CalendarClock}
            label="Last reviewed"
            value={DATE_FORMATTER.format(new Date(parcel.lastReviewedAt))}
          />
          <SummaryItem
            icon={AlertTriangle}
            label="Active alert"
            value={activeFinding?.title ?? reviewSummary?.title ?? 'None'}
          />
          <SummaryItem
            icon={LandPlot}
            label="Affected sector"
            value={sectorName}
          />
          <SummaryItem
            hideLabel
            icon={RadioTower}
            label="Associated sensors"
            value={`${sensorCount} sensor${sensorCount === 1 ? '' : 's'}`}
          />
        </dl>
      </CardContent>

      {isExpanded ? (
        <CardFooter className="flex-wrap justify-end gap-2 px-4 pb-4">
          <Button
            onClick={() => onAskVinea(parcel.id)}
            size="sm"
            type="button"
          >
            <Avatar className="size-5">
              <AvatarImage alt="" src={ASSISTANT_IDENTITY.avatarSrc} />
              <AvatarFallback>V</AvatarFallback>
            </Avatar>
            Ask Vinea
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/sensors#parcel-sensors-${parcel.id}`}>
              View sensor data
              <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/parcels/${parcel.id}`}>
              Open full details
              <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
