export type WeatherMetric =
  'precipitation' | 'maximum-temperature' | 'evapotranspiration';

export type DailyWeatherPoint = {
  date: string;
  label: string;
  precipitationMillimeters: number;
  maximumTemperatureCelsius: number;
  evapotranspirationMillimeters: number;
};

export type WeatherSeries = {
  source: 'open-meteo' | 'fixture';
  sourceLabel: string;
  attributionUrl?: string;
  latitude: number;
  longitude: number;
  timezone: string;
  startsOn: string;
  endsOn: string;
  points: DailyWeatherPoint[];
};

export type WeatherSeriesQuery = {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
};
