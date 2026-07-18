'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WeatherMetric, WeatherSeries } from '@/types/weather';

const metricOptions: Record<
  WeatherMetric,
  {
    label: string;
    dataKey:
      | 'precipitationMillimeters'
      | 'maximumTemperatureCelsius'
      | 'evapotranspirationMillimeters';
    unit: string;
  }
> = {
  precipitation: {
    label: 'Daily precipitation',
    dataKey: 'precipitationMillimeters',
    unit: 'mm',
  },
  'maximum-temperature': {
    label: 'Maximum temperature',
    dataKey: 'maximumTemperatureCelsius',
    unit: '°C',
  },
  evapotranspiration: {
    label: 'Reference evapotranspiration',
    dataKey: 'evapotranspirationMillimeters',
    unit: 'mm',
  },
};

const chartConfig = {
  value: {
    label: 'Weather value',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

type WeatherSeriesChartCardProps = {
  parcelName: string;
  series: WeatherSeries;
  title?: string;
};

export function WeatherSeriesChartCard({
  parcelName,
  series,
  title = 'Weather history',
}: WeatherSeriesChartCardProps) {
  const [metric, setMetric] = useState<WeatherMetric>('precipitation');
  const selectedMetric = metricOptions[metric];
  const chartData = series.points.map((point) => ({
    ...point,
    value: point[selectedMetric.dataKey],
  }));
  const tooltip = (
    <ChartTooltip
      content={
        <ChartTooltipContent
          formatter={(value) => (
            <div className="flex w-full items-center justify-between gap-4">
              <span className="text-muted-foreground">
                {selectedMetric.label}
              </span>
              <span className="font-mono font-medium tabular-nums">
                {Number(value).toFixed(metric === 'precipitation' ? 1 : 2)}{' '}
                {selectedMetric.unit}
              </span>
            </div>
          )}
        />
      }
    />
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {parcelName} · {series.startsOn}–{series.endsOn}
          </CardDescription>
        </div>
        <Select
          onValueChange={(value) => setMetric(value as WeatherMetric)}
          value={metric}
        >
          <SelectTrigger
            aria-label="Select weather time series"
            className="w-full sm:w-64"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(metricOptions).map(([value, option]) => (
                <SelectItem key={value} value={value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer
          aria-label={`${selectedMetric.label} for ${parcelName}`}
          className="h-72 w-full aspect-auto"
          config={chartConfig}
          role="img"
        >
          {metric === 'precipitation' ? (
            <BarChart
              data={chartData}
              margin={{ bottom: 0, left: -4, right: 8, top: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                minTickGap={44}
                tickLine={false}
              />
              <YAxis axisLine={false} tickLine={false} width={38} />
              {tooltip}
              <Bar dataKey="value" fill="var(--color-value)" radius={2} />
            </BarChart>
          ) : (
            <AreaChart
              data={chartData}
              margin={{ bottom: 0, left: -4, right: 8, top: 8 }}
            >
              <defs>
                <linearGradient
                  id="weather-series-fill"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-value)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-value)"
                    stopOpacity={0.03}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                minTickGap={44}
                tickLine={false}
              />
              <YAxis axisLine={false} tickLine={false} width={38} />
              {tooltip}
              <Area
                dataKey="value"
                fill="url(#weather-series-fill)"
                stroke="var(--color-value)"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
