'use client';

import { useState } from 'react';

import { ParcelMapShell } from '@/components/features/operations-workspace/parcel-map-shell';
import { ParcelSummaryPanel } from '@/components/features/operations-workspace/parcel-summary-panel';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ActiveFinding } from '@/types/operations-dashboard';
import type {
  ParcelCollection,
  InspectionNote,
  ParcelProperties,
  ParcelReviewSummary,
  SectorFeature,
} from '@/types/agricultural-operations';

const STATUS_LEGEND = [
  { color: '#4f7f5e', label: 'Stable' },
  { color: '#d39a3c', label: 'Review' },
  { color: '#b55448', label: 'Critical' },
] as const;

type ParcelMapCardProps = {
  affectedSector: SectorFeature;
  expanded?: boolean;
  finding?: ActiveFinding;
  isDetailsOpen?: boolean;
  onAskVinea: (parcelId: string) => void;
  onCloseDetails?: () => void;
  onSelectParcel: (parcelId: string) => void;
  parcels: ParcelCollection;
  parcelNotes: InspectionNote[];
  reviewSummary?: ParcelReviewSummary;
  selectedParcel: ParcelProperties;
  sensorCount: number;
};

export function ParcelMapCard({
  affectedSector,
  expanded = false,
  finding,
  isDetailsOpen = false,
  onAskVinea,
  onCloseDetails,
  onSelectParcel,
  parcels,
  parcelNotes,
  reviewSummary,
  selectedParcel,
  sensorCount,
}: ParcelMapCardProps) {
  const [showParcelStatus, setShowParcelStatus] = useState(false);

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
          showParcelStatus={showParcelStatus}
        />
      </div>

      <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm">
          <Label
            className="cursor-pointer text-xs font-medium"
            htmlFor="parcel-status-mode"
          >
            Parcel status
          </Label>
          <Switch
            aria-label="Show parcel status colors"
            checked={showParcelStatus}
            id="parcel-status-mode"
            onCheckedChange={setShowParcelStatus}
          />
        </div>

        {showParcelStatus ? (
          <div
            aria-label="Parcel status legend"
            className="flex flex-wrap justify-end gap-x-3 gap-y-1 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm"
          >
            {STATUS_LEGEND.map(({ color, label }) => (
              <span className="flex items-center gap-1.5" key={label}>
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {isDetailsOpen ? (
        <ParcelSummaryPanel
          affectedSector={affectedSector}
          finding={finding}
          onAskVinea={onAskVinea}
          onClose={onCloseDetails}
          parcel={selectedParcel}
          notes={parcelNotes}
          reviewSummary={reviewSummary}
          sensorCount={sensorCount}
        />
      ) : null}
    </div>
  );
}
