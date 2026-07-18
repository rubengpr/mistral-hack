import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ParcelDetailPage } from '@/components/features/parcel-detail/parcel-detail-page';
import {
  getParcelDetail,
  listParcelIds,
} from '@/lib/services/parcel-detail-service';

type ParcelPageProps = {
  params: Promise<{ parcelId: string }>;
};

export function generateStaticParams() {
  return listParcelIds().map((parcelId) => ({ parcelId }));
}

export async function generateMetadata({
  params,
}: ParcelPageProps): Promise<Metadata> {
  const { parcelId } = await params;
  const detail = getParcelDetail(parcelId);

  if (!detail) {
    return { title: 'Parcel not found' };
  }

  return {
    title: `${detail.parcel.properties.name} · Parcel details`,
    description: `Current status and critical information for ${detail.parcel.properties.name}.`,
  };
}

export default async function ParcelPage({ params }: ParcelPageProps) {
  const { parcelId } = await params;
  const detail = getParcelDetail(parcelId);

  if (!detail) {
    notFound();
  }

  return <ParcelDetailPage {...detail} />;
}
