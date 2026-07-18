import { AlertTriangle, Clock3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type {
  ParcelSensors,
  SensorAlertStatus,
  SensorInfo,
  SensorStatus,
} from '@/types/sensors';

type ParcelSensorCardProps = {
  parcel: ParcelSensors;
};

const ALERT_PRIORITY: Record<SensorAlertStatus['status'], number> = {
  critical: 0,
  warning: 1,
  normal: 2,
};

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatReading(sensor: SensorInfo) {
  const value = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(sensor.latestReading.value);

  switch (sensor.latestReading.unit) {
    case 'percent':
      return `${value}%`;
    case 'celsius':
      return `${value} °C`;
    default:
      return `${value} ${sensor.latestReading.unit}`;
  }
}

function formatStatus(status: SensorStatus) {
  return status.replace('-', ' ');
}

function getParcelBadgeVariant(status: ParcelSensors['moistureStatus']) {
  if (status === 'critical') {
    return 'destructive' as const;
  }

  if (status === 'watch') {
    return 'default' as const;
  }

  return 'secondary' as const;
}

function getAlertBadgeVariant(status: SensorAlertStatus['status']) {
  if (status === 'critical') {
    return 'destructive' as const;
  }

  if (status === 'warning') {
    return 'default' as const;
  }

  return 'outline' as const;
}

export function ParcelSensorCard({ parcel }: ParcelSensorCardProps) {
  const sortedSensors = parcel.sensors.toSorted(
    (firstSensor, secondSensor) =>
      ALERT_PRIORITY[firstSensor.alertStatus.status] -
      ALERT_PRIORITY[secondSensor.alertStatus.status],
  );
  const alertCount = sortedSensors.filter(
    (sensor) => sensor.alertStatus.status !== 'normal',
  ).length;

  return (
    <Card
      className="scroll-mt-4 overflow-hidden"
      id={`parcel-sensors-${parcel.parcelId}`}
    >
      <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="truncate text-base">{parcel.parcelName}</CardTitle>
          <CardDescription>
            {parcel.sensors.length} sensor{parcel.sensors.length === 1 ? '' : 's'} ·{' '}
            {alertCount} alert{alertCount === 1 ? '' : 's'}
          </CardDescription>
        </div>
        <Badge variant={getParcelBadgeVariant(parcel.moistureStatus)}>
          {parcel.moistureStatus}
        </Badge>
      </CardHeader>

      <CardContent className="px-4 pb-0">
        <Separator />
        <div className="flex flex-col">
          {sortedSensors.map((sensor, index) => (
            <div key={sensor.metadata.id}>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(5rem,0.6fr)_minmax(7rem,0.8fr)_minmax(9rem,1fr)]">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-sm font-medium">
                    {sensor.metadata.name}
                  </p>
                  {sensor.metadata.status !== 'active' ? (
                    <p className="text-xs capitalize text-muted-foreground">
                      {formatStatus(sensor.metadata.status)}
                    </p>
                  ) : null}
                </div>

                <p className="text-lg font-semibold tabular-nums">
                  {formatReading(sensor)}
                </p>

                <Badge
                  className="justify-self-start"
                  variant={getAlertBadgeVariant(sensor.alertStatus.status)}
                >
                  {sensor.alertStatus.status === 'normal' ? null : (
                    <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
                  )}
                  {sensor.alertStatus.status}
                </Badge>

                <p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  <span className="tabular-nums">
                    {dateTimeFormatter.format(
                      new Date(sensor.latestReading.observedAt),
                    )}
                  </span>
                </p>
              </div>
              {index < sortedSensors.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </div>
      </CardContent>

    </Card>
  );
}
