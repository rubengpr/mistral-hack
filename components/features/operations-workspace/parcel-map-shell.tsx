'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';
import type {
  ParcelCollection,
  SectorFeature,
} from '@/types/operations-dashboard';

const ParcelMap = dynamic(
  () => import('./parcel-map').then((module) => module.ParcelMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full flex-col gap-3 p-4"
        aria-label="Loading parcel map"
      >
        <Skeleton className="h-full min-h-72 w-full" />
      </div>
    ),
  },
);

type ParcelMapShellProps = {
  parcels: ParcelCollection;
  affectedSector: SectorFeature;
  selectedParcelId?: string;
  onSelectParcel: (parcelId: string) => void;
};

export function ParcelMapShell(props: ParcelMapShellProps) {
  return <ParcelMap {...props} />;
}
