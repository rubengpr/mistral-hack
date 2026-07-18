'use client';

import { ParcelMapShell } from '@/components/features/operations-workspace/parcel-map-shell';
import { ParcelSummaryPanel } from '@/components/features/operations-workspace/parcel-summary-panel';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ActiveFinding } from '@/types/operations-dashboard';
import type {
  ParcelCollection,
  ParcelProperties,
  SectorFeature,
} from '@/types/agricultural-operations';

type ParcelMapCardProps = {
  affectedSector: SectorFeature;
  expanded?: boolean;
  finding?: ActiveFinding;
  onSelectParcel: (parcelId: string) => void;
  parcels: ParcelCollection;
  selectedParcel: ParcelProperties;
};

export function ParcelMapCard({
  affectedSector,
  expanded = false,
  finding,
  onSelectParcel,
  parcels,
  selectedParcel,
}: ParcelMapCardProps) {
  return (
    <Card
      className={cn('overflow-hidden', expanded && 'flex min-h-full flex-col')}
    >
      <CardContent
        className={cn(
          'p-0',
          expanded
            ? 'h-[44svh] min-h-80 shrink-0'
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
        <ParcelSummaryPanel
          affectedSector={affectedSector}
          finding={finding}
          parcel={selectedParcel}
        />
      </CardFooter>
    </Card>
  );
}
