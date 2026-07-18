'use client';

import { useEffect, useState } from 'react';
import { CloudRain, Droplets, ThermometerSun } from 'lucide-react';

import { WeatherSeriesChartCard } from '@/components/features/operations-workspace/weather-series-chart-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWeatherSeries } from '@/lib/api/weather-api';
import { getParcelCenter } from '@/lib/geo/parcel-center';
import type { ParcelFeature } from '@/types/agricultural-operations';
import type { WeatherSeries } from '@/types/weather';

const DEMO_START_DATE = '2026-01-01';
const DEMO_END_DATE = '2026-07-18';

type WeatherWorkspaceSectionProps = {
  parcel: ParcelFeature;
};

export function WeatherWorkspaceSection({
  parcel,
}: WeatherWorkspaceSectionProps) {
  const [series, setSeries] = useState<WeatherSeries>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const [longitude, latitude] = getParcelCenter(parcel.geometry);

    void fetchWeatherSeries(
      {
        latitude,
        longitude,
        startDate: DEMO_START_DATE,
        endDate: DEMO_END_DATE,
      },
      controller.signal,
    )
      .then(setSeries)
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === 'AbortError'
        ) {
          return;
        }

        setError('Weather data could not be loaded. Try again in a moment.');
      });

    return () => controller.abort();
  }, [parcel.geometry]);

  if (error) {
    return (
      <Alert variant="destructive">
        <CloudRain aria-hidden="true" />
        <AlertTitle>Weather unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!series) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const latestPoint = series.points.at(-1);
  const rainfallTotal = series.points.reduce(
    (total, point) => total + point.precipitationMillimeters,
    0,
  );

  return (
    <section id="weather" className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Weather</h2>
          <p className="text-sm text-muted-foreground">
            Weather evidence for {parcel.properties.name} in{' '}
            {parcel.properties.municipality}.
          </p>
        </div>
        <Badge
          variant={series.source === 'open-meteo' ? 'secondary' : 'outline'}
        >
          {series.sourceLabel}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CloudRain className="size-4" aria-hidden="true" />
              Total precipitation
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {rainfallTotal.toFixed(1)} mm
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Jan 1–Jul 18
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ThermometerSun className="size-4" aria-hidden="true" />
              Latest daily maximum
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {latestPoint?.maximumTemperatureCelsius.toFixed(1) ?? '—'} °C
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {series.endsOn}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Droplets className="size-4" aria-hidden="true" />
              Latest reference ET₀
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {latestPoint?.evapotranspirationMillimeters.toFixed(2) ?? '—'} mm
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Atmospheric water demand
          </CardContent>
        </Card>
      </div>

      <WeatherSeriesChartCard
        parcelName={parcel.properties.name}
        series={series}
      />

      <p className="text-xs text-muted-foreground">
        {series.attributionUrl ? (
          <>
            Weather data by{' '}
            <a
              className="underline underline-offset-4"
              href={series.attributionUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open-Meteo
            </a>
            . Historical forecasts are modelled evidence and may differ from a
            local station.
          </>
        ) : (
          'Live weather is unavailable. Deterministic simulated data is shown for demo continuity.'
        )}
      </p>
    </section>
  );
}
