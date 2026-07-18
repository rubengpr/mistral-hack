import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Droplets,
  Grape,
  LandPlot,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { ParcelDetail } from '@/lib/services/parcel-detail-service';
import type { OperationalStatus } from '@/types/agricultural-operations';

const DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

const STATUS_LABELS: Record<OperationalStatus, string> = {
  normal: 'Normal',
  review: 'Review',
  critical: 'Critical',
};

type ParcelDetailPageProps = ParcelDetail;

function StatusBadge({ status }: { status: OperationalStatus }) {
  return (
    <Badge variant={status === 'critical' ? 'destructive' : 'secondary'}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

type DetailItemProps = {
  icon: typeof MapPin;
  label: string;
  value: React.ReactNode;
};

function DetailItem({ icon: Icon, label, value }: DetailItemProps) {
  return (
    <div className="flex min-w-0 gap-3 py-4">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}

export function ParcelDetailPage({
  parcel,
  activeFinding,
  affectedSector,
}: ParcelDetailPageProps) {
  const { properties } = parcel;

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4 md:px-6">
          <Button asChild size="sm" variant="ghost">
            <Link href="/map">
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Back to map
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12">
        <section className="flex flex-col gap-4" aria-labelledby="parcel-title">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Grape className="size-4" aria-hidden="true" />
            <span>Parcel</span>
          </div>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:gap-6">
            <div className="flex min-w-0 flex-col gap-2">
              <h1
                id="parcel-title"
                className="text-3xl font-semibold tracking-tight md:text-4xl"
              >
                {properties.name}
              </h1>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                {properties.municipality}, {properties.department}
              </p>
            </div>
            <StatusBadge status={properties.operationalStatus} />
          </div>
        </section>

        {activeFinding ? (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>{activeFinding.title}</AlertTitle>
            <AlertDescription>
              <p>{activeFinding.summary}</p>
              {affectedSector ? (
                <p className="mt-2 font-medium">
                  Affected area: {affectedSector.properties.name}
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Parcel overview</CardTitle>
            <CardDescription>
              The critical information from the latest portfolio review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2">
              <DetailItem
                icon={MapPin}
                label="Location"
                value={`${properties.municipality}, ${properties.department}`}
              />
              <DetailItem
                icon={LandPlot}
                label="Surface area"
                value={`${properties.areaHectares} ha`}
              />
              <Separator className="sm:col-span-2" />
              <DetailItem
                icon={Droplets}
                label="Current soil moisture"
                value={`${properties.currentSoilMoisturePercent}%`}
              />
              <DetailItem
                icon={CalendarClock}
                label="Last reviewed"
                value={DATE_FORMATTER.format(
                  new Date(properties.lastReviewedAt),
                )}
              />
              <Separator className="sm:col-span-2" />
              <DetailItem
                icon={AlertTriangle}
                label="Active alert"
                value={activeFinding?.title ?? 'None'}
              />
              <DetailItem
                icon={LandPlot}
                label="Affected sector"
                value={affectedSector?.properties.name ?? 'None'}
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
