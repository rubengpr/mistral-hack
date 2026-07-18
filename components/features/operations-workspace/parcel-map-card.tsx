'use client';

import { Grape } from 'lucide-react';

import { ParcelMapShell } from '@/components/features/operations-workspace/parcel-map-shell';
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
import { cn } from '@/lib/utils';
import type {
  ParcelCollection,
  ParcelProperties,
  SectorFeature,
} from '@/types/agricultural-operations';

type ParcelMapCardProps = {
  affectedSector: SectorFeature;
  expanded?: boolean;
  isAffectedParcel: boolean;
  onSelectParcel: (parcelId: string) => void;
  parcels: ParcelCollection;
  selectedParcel: ParcelProperties;
};

export function ParcelMapCard({
  affectedSector,
  expanded = false,
  isAffectedParcel,
  onSelectParcel,
  parcels,
  selectedParcel,
}: ParcelMapCardProps) {
  return (
    <Card
      className={cn(
        'overflow-hidden',
        expanded && 'flex h-full min-h-0 flex-col',
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle>Parcel map</CardTitle>
          <CardDescription>
            24 real vineyard parcels across Hérault, Aude, Gard and
            Pyrénées-Orientales.
          </CardDescription>
        </div>
        <Badge variant={isAffectedParcel ? 'destructive' : 'secondary'}>
          {selectedParcel.moistureStatus}
        </Badge>
      </CardHeader>

      <CardContent
        className={cn(
          'p-0',
          expanded
            ? 'min-h-0 flex-1'
            : 'h-[48svh] min-h-80 xl:h-[calc(100svh-15rem)] xl:min-h-[34rem]',
        )}
      >
        <ParcelMapShell
          affectedSector={affectedSector}
          onSelectParcel={onSelectParcel}
          parcels={parcels}
          selectedParcelId={selectedParcel.id}
        />
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Grape
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate text-sm font-medium">
              {selectedParcel.name}
            </span>
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {selectedParcel.areaHectares} ha ·{' '}
            {selectedParcel.currentSoilMoisturePercent}%
          </span>
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label="Select a parcel"
        >
          {parcels.features.map((feature) => (
            <Button
              key={feature.properties.id}
              aria-pressed={selectedParcel.id === feature.properties.id}
              className="shrink-0"
              onClick={() => onSelectParcel(feature.properties.id)}
              size="sm"
              variant={
                selectedParcel.id === feature.properties.id
                  ? 'default'
                  : 'outline'
              }
            >
              <Grape data-icon="inline-start" aria-hidden="true" />
              {feature.properties.name}
            </Button>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
}
