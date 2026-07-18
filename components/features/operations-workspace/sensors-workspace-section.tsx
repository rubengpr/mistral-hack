import { AlertTriangle } from 'lucide-react';

import { ParcelSensorCard } from '@/components/features/operations-workspace/parcel-sensor-card';
import { Badge } from '@/components/ui/badge';
import type { ParcelSensors, SensorsDashboardData } from '@/types/sensors';

type SensorsWorkspaceSectionProps = {
  data: SensorsDashboardData;
};

const MOISTURE_STATUS_PRIORITY: Record<ParcelSensors['moistureStatus'], number> = {
  critical: 0,
  watch: 1,
  stable: 2,
};

function countAlerts(parcel: ParcelSensors) {
  return parcel.sensors.filter(
    (sensor) => sensor.alertStatus.status !== 'normal',
  ).length;
}

export function SensorsWorkspaceSection({ data }: SensorsWorkspaceSectionProps) {
  const sortedParcels = data.parcels.toSorted((firstParcel, secondParcel) => {
    const alertDifference = countAlerts(secondParcel) - countAlerts(firstParcel);

    if (alertDifference !== 0) {
      return alertDifference;
    }

    return (
      MOISTURE_STATUS_PRIORITY[firstParcel.moistureStatus] -
      MOISTURE_STATUS_PRIORITY[secondParcel.moistureStatus]
    );
  });

  return (
    <section
      aria-labelledby="sensor-overview-title"
      className="flex w-full flex-col gap-4 pb-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id="sensor-overview-title"
            className="text-pretty text-xl font-semibold"
          >
            Sensor Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Latest essential readings for all {data.parcels.length} parcels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Sensor summary">
          <Badge variant="secondary">{data.summary.totalSensors} sensors</Badge>
          <Badge variant={data.summary.alertCount > 0 ? 'destructive' : 'outline'}>
            {data.summary.alertCount > 0 ? (
              <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
            ) : null}
            {data.summary.alertCount} active alerts
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {sortedParcels.map((parcel) => (
          <ParcelSensorCard key={parcel.parcelId} parcel={parcel} />
        ))}
      </div>
    </section>
  );
}
