export type SeasonalMoistureSample = {
  timestamp: string;
  label: string;
  value: number;
  rainfallMillimeters: number;
  irrigationApplied: boolean;
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const SERIES_START = Date.UTC(2026, 0, 1, 8);
const SERIES_END = Date.UTC(2026, 6, 18, 8);
const FIRST_IRRIGATION = Date.UTC(2026, 5, 2, 8);
const LAST_COMPLETED_IRRIGATION = Date.UTC(2026, 6, 12, 8);

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'] as const;

const MONTHLY_MOISTURE_CAP = [52, 51, 49, 47, 43, 37, 34];
const MONTHLY_DAILY_DRYING_RATE = [0.18, 0.2, 0.28, 0.4, 0.55, 1.4, 3];

const RAINFALL_BY_DATE: Record<string, number> = {
  '2026-01-04': 12,
  '2026-01-11': 18,
  '2026-01-19': 7,
  '2026-01-28': 14,
  '2026-02-05': 11,
  '2026-02-14': 16,
  '2026-02-23': 9,
  '2026-03-04': 13,
  '2026-03-12': 8,
  '2026-03-21': 17,
  '2026-03-30': 6,
  '2026-04-08': 11,
  '2026-04-19': 8,
  '2026-04-28': 5,
  '2026-05-09': 7,
  '2026-05-22': 10,
  '2026-06-14': 3,
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function formatLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const month = MONTH_LABELS[date.getUTCMonth()];
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${month} ${day}`;
}

function isScheduledIrrigationDay(timestamp: number): boolean {
  return (
    timestamp >= FIRST_IRRIGATION &&
    (timestamp - FIRST_IRRIGATION) % (5 * DAY_IN_MILLISECONDS) === 0
  );
}

export function createSeasonalMoistureSeries(): SeasonalMoistureSample[] {
  const samples: SeasonalMoistureSample[] = [];
  let moisture = 48;

  for (
    let timestamp = SERIES_START;
    timestamp <= SERIES_END;
    timestamp += DAY_IN_MILLISECONDS
  ) {
    const date = formatDate(timestamp);
    const rainfallMillimeters = RAINFALL_BY_DATE[date] ?? 0;
    const irrigationApplied =
      isScheduledIrrigationDay(timestamp) &&
      timestamp <= LAST_COMPLETED_IRRIGATION;
    const month = new Date(timestamp).getUTCMonth();
    const moistureCap = MONTHLY_MOISTURE_CAP[month];

    if (irrigationApplied) {
      moisture = moistureCap;
    } else {
      moisture -= MONTHLY_DAILY_DRYING_RATE[month];
    }

    moisture = Math.min(moistureCap, moisture + rainfallMillimeters * 0.4);
    moisture = Math.max(12, Number(moisture.toFixed(1)));

    samples.push({
      timestamp: `${date}T08:00:00Z`,
      label: formatLabel(timestamp),
      value: moisture,
      rainfallMillimeters,
      irrigationApplied,
    });
  }

  return samples;
}
