'use client';

import { AlertTriangle, Battery, Calendar, ChevronDown, ChevronUp, Clock, MapPin, Thermometer, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ParcelSensors } from '@/types/sensors';
import type { ParcelMoistureStatus } from '@/types/agricultural-operations';

type ParcelSensorCardProps = {
  parcel: ParcelSensors;
  isExpanded: boolean;
  onToggle: () => void;
};

export function ParcelSensorCard({ parcel, isExpanded, onToggle }: ParcelSensorCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-1 items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="-ml-2 h-6 w-6 p-0"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="size-4" aria-hidden="true" />
              ) : (
                <ChevronUp className="size-4" aria-hidden="true" />
              )}
            </Button>
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-base">{parcel.parcelName}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getMoistureStatusVariant(parcel.moistureStatus)}>
                  {parcel.moistureStatus.replace('-', ' ')}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {parcel.parcelId}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {parcel.sensors.length} sensors
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ParcelStatusIndicator parcel={parcel} />
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <>
          <Separator />
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3">
              {parcel.sensors.map((sensor) => (
                <SensorReadingDisplay
                  key={sensor.metadata.id}
                  sensor={sensor}
                />
              ))}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

// Helper components
function ParcelStatusIndicator({ parcel }: { parcel: ParcelSensors }) {
  const alertCount = parcel.sensors.filter((s) => s.alertStatus.status !== 'normal').length;
  const criticalCount = parcel.sensors.filter((s) => s.alertStatus.status === 'critical').length;

  if (alertCount === 0) {
    return (
      <Badge variant="outline" className="text-xs">
        <CheckCircle className="size-3 mr-1" aria-hidden="true" />
        All normal
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={criticalCount > 0 ? 'destructive' : 'default'} className="text-xs">
          {criticalCount > 0 && (
            <AlertTriangle className="size-3 mr-1" aria-hidden="true" />
          )}
          {alertCount} alert{alertCount !== 1 ? 's' : ''}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1">
          <p>
            {criticalCount} critical · {alertCount - criticalCount} warning
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function SensorReadingDisplay({ sensor }: { sensor: ParcelSensors['sensors'][0] }) {
  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'soil-moisture':
        return <Droplet className="size-4" aria-hidden="true" />;
      case 'temperature':
        return <Thermometer className="size-4" aria-hidden="true" />;
      case 'humidity':
        return <Humidity className="size-4" aria-hidden="true" />;
      case 'soil-temperature':
        return <SoilTemperature className="size-4" aria-hidden="true" />;
      default:
        return <Thermometer className="size-4" aria-hidden="true" />;
    }
  };

  const formatValue = (value: number, type: string, unit: string) => {
    if (type === 'soil-moisture' || type === 'humidity') {
      return `${value.toFixed(1)}${unit === 'percent' ? '%' : ''}`;
    }
    if (type === 'temperature' || type === 'soil-temperature') {
      return `${value.toFixed(1)}°${unit === 'celsius' ? 'C' : ''}`;
    }
    return `${value.toFixed(1)} ${unit}`;
  };

  const getTrendIcon = () => {
    switch (sensor.trend.direction) {
      case 'increasing':
        return (
          <TrendingUp className="size-3.5 text-green-500" aria-hidden="true" />
        );
      case 'decreasing':
        return (
          <TrendingDown className="size-3.5 text-destructive" aria-hidden="true" />
        );
      default:
        return (
          <span className="size-3.5 text-muted-foreground">—</span>
        );
    }
  };

  const alertStatus = sensor.alertStatus.status;

  return (
    <div className="flex flex-col gap-2 p-2 rounded-lg border bg-muted/50 hover:bg-muted/70 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-muted">
            {getSensorIcon(sensor.metadata.type)}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">{sensor.metadata.name}</h4>
              <Badge variant={getSensorStatusVariant(sensor.metadata.status)} className="text-xs">
                {sensor.metadata.status.replace('-', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-default">
                    <MapPin className="size-3" aria-hidden="true" />
                    {sensor.metadata.location}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Location: {sensor.metadata.location}</p>
                </TooltipContent>
              </Tooltip>
              {sensor.metadata.depthCentimeters && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 cursor-default">
                      <Depth className="size-3" aria-hidden="true" />
                      {sensor.metadata.depthCentimeters}cm
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Depth: {sensor.metadata.depthCentimeters}cm</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {sensor.metadata.batteryPercent !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 cursor-default">
                      <Battery className="size-3" aria-hidden="true" />
                      {sensor.metadata.batteryPercent}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Battery: {sensor.metadata.batteryPercent}%</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertStatusBadge status={alertStatus} />
        </div>
      </div>

      <Separator className="my-1" />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums">
              {formatValue(
                sensor.latestReading.value,
                sensor.metadata.type,
                sensor.latestReading.unit,
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {sensor.latestReading.unit}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 cursor-default">
                  {getTrendIcon()}
                  <span
                    className={`font-medium ${sensor.trend.direction === 'increasing' ? 'text-green-600' : sensor.trend.direction === 'decreasing' ? 'text-destructive' : 'text-muted-foreground'}`}
                  >
                    {sensor.trend.change > 0 ? '+' : ''}
                    {sensor.trend.change.toFixed(1)}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {sensor.trend.direction.charAt(0).toUpperCase() +
                    sensor.trend.direction.slice(1)}{' '}
                  {Math.abs(sensor.trend.change).toFixed(1)} {sensor.latestReading.unit} in last {sensor.trend.period}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 cursor-default">
                <Clock className="size-3" aria-hidden="true" />
                {new Date(sensor.latestReading.observedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Last reading: {new Date(sensor.latestReading.observedAt).toLocaleString()}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 cursor-default">
                <Calendar className="size-3" aria-hidden="true" />
                {new Date(sensor.metadata.installedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Installed: {sensor.metadata.installedAt}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getMoistureStatusVariant(status: ParcelMoistureStatus) {
  switch (status) {
    case 'critical':
      return 'destructive';
    case 'watch':
      return 'default';
    default:
      return 'secondary';
  }
}

function getSensorStatusVariant(status: string) {
  switch (status) {
    case 'active':
      return 'secondary';
    case 'maintenance-needed':
      return 'default';
    case 'offline':
      return 'destructive';
    case 'calibrating':
      return 'outline';
    default:
      return 'secondary';
  }
}

function AlertStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'critical':
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="size-3 mr-1" aria-hidden="true" />
          Critical
        </Badge>
      );
    case 'warning':
      return (
        <Badge variant="default" className="text-xs">
          <AlertTriangle className="size-3 mr-1" aria-hidden="true" />
          Warning
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          <CheckCircle className="size-3 mr-1" aria-hidden="true" />
          Normal
        </Badge>
      );
  }
}

// Custom icons for sensors
function Droplet({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.93-2.05-2.15-2.5C8.28 9.02 7 8.1 7 6.94c0-1.72 1.48-3.1 3.3-3.1S13 5.22 13 6.94c0 .19-.04.37-.1.55-.23.56-.75 1.52-1.43 2.3-.68.78-1.44 1.4-2.26 1.75-.82.35-1.7.53-2.62.53z"
      />
    </svg>
  );
}

function Humidity({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function SoilTemperature({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 16.5L16.5 20M4 16.5L7.5 20M12 3v1"
      />
    </svg>
  );
}

function Depth({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}
