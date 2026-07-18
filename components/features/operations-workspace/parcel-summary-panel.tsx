import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Droplets,
  LandPlot,
  MapPin,
  X,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  onClose?: () => void;
  parcel: ParcelProperties;
};

export function ParcelSummaryPanel({
  affectedSector,
  finding,
  onClose,
  parcel,
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
            {parcel.moistureStatus}
          </Badge>
        </div>
        <CardDescription className="truncate">
          {parcel.municipality}, {parcel.department}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        <Separator />
        <dl className="mt-4 grid grid-cols-2 gap-4">
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
      </CardContent>

      <CardFooter className="justify-end px-4 pb-4">
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
