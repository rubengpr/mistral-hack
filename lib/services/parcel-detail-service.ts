import { getCanonicalDemoScenario } from '@/lib/fixtures/canonical-demo-scenario';
import type {
  Finding,
  ParcelFeature,
  SectorFeature,
} from '@/types/agricultural-operations';

export type ParcelDetail = {
  parcel: ParcelFeature;
  activeFinding?: Finding;
  affectedSector?: SectorFeature;
};

export function listParcelIds(): string[] {
  return getCanonicalDemoScenario().parcels.features.map(
    ({ properties }) => properties.id,
  );
}

export function getParcelDetail(parcelId: string): ParcelDetail | undefined {
  const scenario = getCanonicalDemoScenario();
  const parcel = scenario.parcels.features.find(
    ({ properties }) => properties.id === parcelId,
  );

  if (!parcel) {
    return undefined;
  }

  const activeFinding = scenario.findings.find(
    (finding) => finding.parcelId === parcelId && finding.status !== 'reviewed',
  );
  const affectedSector = activeFinding
    ? scenario.sectors.find(
        ({ properties }) => properties.id === activeFinding.sectorId,
      )
    : undefined;

  return { parcel, activeFinding, affectedSector };
}
