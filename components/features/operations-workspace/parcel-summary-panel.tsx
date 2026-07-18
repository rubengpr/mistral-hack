import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Droplets,
  LandPlot,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ActiveFinding } from '@/types/operations-dashboard';
import type {
  ParcelProperties,
  SectorFeature,
} from '@/types/agricultural-operations';

const DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'Europe/Paris',
});

type SummaryItemProps = {
  icon: typeof MapPin;
  label: string;
  value: ReactNode;
};

function SummaryItem({ icon: Icon, label, value }: SummaryItemProps) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium break-words">{value}</dd>
      </div>
    </div>
  );
}

type ParcelSummaryPanelProps = {
  affectedSector: SectorFeature;
  finding?: ActiveFinding;
  parcel: ParcelProperties;
};

export function ParcelSummaryPanel({
  affectedSector,
  finding,
  parcel,
}: ParcelSummaryPanelProps) {
  const activeFinding = finding?.parcelId === parcel.id ? finding : undefined;
  const sectorName = activeFinding ? affectedSector.properties.name : 'None';

  return (
    <section className="flex flex-col gap-4" aria-labelledby="parcel-summary">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 id="parcel-summary" className="truncate font-semibold">
              {parcel.name}
            </h2>
            <Badge
              variant={
                parcel.moistureStatus === 'critical'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {parcel.moistureStatus}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {parcel.municipality}, {parcel.department}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/parcels/${parcel.id}`}>
            Open full details
            <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <Separator />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3">
        <SummaryItem
          icon={MapPin}
          label="Location"
          value={`${parcel.municipality}, ${parcel.department}`}
        />
        <SummaryItem
          icon={LandPlot}
          label="Surface area"
          value={`${parcel.areaHectares} ha`}
        />
        <SummaryItem
          icon={Droplets}
          label="Soil moisture"
          value={`${parcel.currentSoilMoisturePercent}%`}
        />
        <SummaryItem
          icon={CalendarClock}
          label="Last reviewed"
          value={DATE_FORMATTER.format(new Date(parcel.lastReviewedAt))}
        />
        <SummaryItem
          icon={AlertTriangle}
          label="Active alert"
          value={activeFinding?.title ?? 'None'}
        />
        <SummaryItem
          icon={LandPlot}
          label="Affected sector"
          value={sectorName}
        />
      </dl>
    </section>
  );
}
