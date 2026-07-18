'use client';

import { ParcelMapShell } from '@/components/features/operations-workspace/parcel-map-shell';
import { ParcelSummaryPanel } from '@/components/features/operations-workspace/parcel-summary-panel';
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
  isDetailsOpen?: boolean;
  onCloseDetails?: () => void;
  onSelectParcel: (parcelId: string) => void;
  parcels: ParcelCollection;
  selectedParcel: ParcelProperties;
};

export function ParcelMapCard({
  affectedSector,
  expanded = false,
  finding,
  isDetailsOpen = false,
  onCloseDetails,
  onSelectParcel,
  parcels,
  selectedParcel,
}: ParcelMapCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card shadow',
        expanded && 'h-full min-h-[30rem]',
      )}
    >
      <div
        className={cn(
          'min-h-80',
          expanded
            ? 'h-full'
            : 'h-[48svh] min-h-80 xl:h-[calc(100svh-15rem)] xl:min-h-[34rem]',
        )}
      >
        <ParcelMapShell
          affectedSector={affectedSector}
          onSelectParcel={onSelectParcel}
          parcels={parcels}
          selectedParcelId={isDetailsOpen ? selectedParcel.id : undefined}
        />
      </div>

      {isDetailsOpen ? (
        <ParcelSummaryPanel
          affectedSector={affectedSector}
          finding={finding}
          onClose={onCloseDetails}
          parcel={selectedParcel}
        />
      ) : null}
    </div>
  );
}
