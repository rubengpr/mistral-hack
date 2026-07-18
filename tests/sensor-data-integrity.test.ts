import { describe, expect, it } from 'vitest';

import {
  AFFECTED_PARCEL_ID,
  AFFECTED_SECTOR_ID,
  getCanonicalDemoScenario,
} from '@/lib/fixtures/canonical-demo-scenario';
import {
  generateSensorData,
  getSensorDataForParcel,
} from '@/lib/fixtures/sensor-data';

describe('sensor data integrity', () => {
  const canonicalParcels = getCanonicalDemoScenario().parcels.features;
  const canonicalParcelIds = canonicalParcels.map(
    ({ properties }) => properties.id,
  );
  const sensorData = generateSensorData();

  it('uses every canonical parcel exactly once', () => {
    expect(sensorData.map(({ parcelId }) => parcelId)).toEqual(
      canonicalParcelIds,
    );
  });

  it('keeps parcel names and sensor references aligned', () => {
    sensorData.forEach((parcelSensors) => {
      const canonicalParcel = canonicalParcels.find(
        ({ properties }) => properties.id === parcelSensors.parcelId,
      );

      expect(parcelSensors.parcelName).toBe(canonicalParcel?.properties.name);
      parcelSensors.sensors.forEach((sensor) => {
        expect(sensor.metadata.parcelId).toBe(parcelSensors.parcelId);
        expect(
          sensor.readings.every(
            ({ sensorId }) => sensorId === sensor.metadata.id,
          ),
        ).toBe(true);
      });
    });
  });

  it('uses the canonical sector only for the affected parcel', () => {
    sensorData.forEach((parcelSensors) => {
      parcelSensors.sensors.forEach((sensor) => {
        expect(sensor.metadata.sectorId).toBe(
          parcelSensors.parcelId === AFFECTED_PARCEL_ID
            ? AFFECTED_SECTOR_ID
            : undefined,
        );
      });
    });
  });

  it('generates deterministic data and supports parcel lookup', () => {
    expect(generateSensorData()).toEqual(sensorData);
    expect(getSensorDataForParcel(AFFECTED_PARCEL_ID)?.parcelId).toBe(
      AFFECTED_PARCEL_ID,
    );
    expect(getSensorDataForParcel('unknown-parcel')).toBeUndefined();
  });
});
