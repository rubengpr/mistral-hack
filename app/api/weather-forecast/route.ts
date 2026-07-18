import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getWeatherForecast } from '@/lib/services/weather-forecast-service';

const clusterSchema = z.enum([
  'herault',
  'aude',
  'gard',
  'pyrenees-orientales',
]);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();
const querySchema = z
  .object({
    parcelId: z.string().trim().min(1).max(100).optional(),
    cluster: clusterSchema.optional(),
    referenceDate: dateSchema,
  })
  .refine(({ parcelId, cluster }) => Boolean(parcelId) !== Boolean(cluster), {
    message: 'Provide exactly one parcel or cluster.',
  });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    parcelId: url.searchParams.get('parcelId') ?? undefined,
    cluster: url.searchParams.get('cluster') ?? undefined,
    referenceDate: url.searchParams.get('referenceDate') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Provide one valid parcel or cluster.' },
      { status: 400 },
    );
  }

  try {
    const { referenceDate, parcelId, cluster } = parsed.data;
    const data = await getWeatherForecast(
      parcelId
        ? { scope: 'parcel', parcelId, referenceDate }
        : { scope: 'cluster', cluster: cluster!, referenceDate },
    );
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { error: 'Weather forecast data is temporarily unavailable.' },
      { status: 502 },
    );
  }
}
