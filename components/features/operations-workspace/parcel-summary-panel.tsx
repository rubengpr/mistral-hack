import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Droplets,
  LandPlot,
  MapPin,
  RadioTower,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

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
const STATUS_LABELS = {
  stable: 'Stable',
  watch: 'Review',
  critical: 'Critical',
} as const;

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
  onAskVinea: (parcelId: string) => void;
  onClose?: () => void;
  parcel: ParcelProperties;
  reviewSummary?: ParcelReviewSummary;
  sensorCount: number;
};

export function ParcelSummaryPanel({
  affectedSector,
  finding,
  onAskVinea,
  onClose,
  parcel,
  reviewSummary,
  sensorCount,
}: ParcelSummaryPanelProps) {
  const activeFinding = finding?.parcelId === parcel.id ? finding : undefined;
  const sectorName = activeFinding ? affectedSector.properties.name : 'None';

  return (
    <Card
      className="absolute inset-x-3 bottom-3 max-h-[calc(100%-1.5rem)] overflow-y-auto shadow-lg"
      role="region"
      aria-labelledby="parcel-summary"
    >
      <Button
        aria-label="Close parcel details"
        className="absolute right-3 top-3"
        onClick={onClose}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" />
      </Button>

      <CardHeader className="p-4 pb-3 pr-14">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle id="parcel-summary" className="truncate">
            {parcel.name}
          </CardTitle>
          <Badge
            variant={
              parcel.moistureStatus === 'critical' ? 'destructive' : 'secondary'
            }
          >
            {STATUS_LABELS[parcel.moistureStatus]}
          </Badge>
        </div>
        <CardDescription className="truncate">
          {parcel.municipality}, {parcel.department}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {reviewSummary ? (
          <Alert className="mb-4">
            <Sparkles aria-hidden="true" />
            <AlertTitle>AI review summary</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <p>
                <span className="font-medium text-foreground">
                  {reviewSummary.title}.
                </span>{' '}
                {reviewSummary.summary}
              </p>
              <p className="text-xs text-muted-foreground">
                Mistral morning review · Simulated sensor data ·{' '}
                {REVIEW_DATE_FORMATTER.format(
                  new Date(reviewSummary.generatedAt),
                )}
              </p>
            </AlertDescription>
          </Alert>
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
    </Card>
  );
}
