import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getWeatherSeries } from '@/lib/services/weather-service';

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use dates in YYYY-MM-DD format');
const latitudeSchema = z
  .string()
  .min(1)
  .transform(Number)
  .pipe(z.number().min(-90).max(90));
const longitudeSchema = z
  .string()
  .min(1)
  .transform(Number)
  .pipe(z.number().min(-180).max(180));

const weatherQuerySchema = z
  .object({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine(({ startDate, endDate }) => startDate <= endDate, {
    message: 'The start date must be before the end date',
  });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = weatherQuerySchema.safeParse({
    latitude: url.searchParams.get('latitude'),
    longitude: url.searchParams.get('longitude'),
    startDate: url.searchParams.get('startDate'),
    endDate: url.searchParams.get('endDate'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Enter a valid location and date range.' },
      { status: 400 },
    );
  }

  try {
    const data = await getWeatherSeries(parsed.data);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { error: 'Weather data is temporarily unavailable.' },
      { status: 502 },
    );
  }
}
