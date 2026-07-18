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

export type WeatherForecastScope =
  | { parcelId: string; scope: 'parcel' }
  | {
      cluster: import('@/types/agricultural-operations').ParcelCluster;
      scope: 'cluster';
    };

export type WeatherForecastQuery = WeatherForecastScope & {
  referenceDate?: string;
};

export type WeatherEvidenceQuality = 'modelled' | 'simulated';

export type WeatherForecast = {
  source: 'open-meteo' | 'fixture';
  sourceLabel: string;
  attributionUrl?: string;
  quality: WeatherEvidenceQuality;
  retrievedAt: string;
  latitude: number;
  longitude: number;
  timezone: string;
  locationLabel: string;
  scope: WeatherForecastScope;
  recent: {
    startsOn: string;
    endsOn: string;
    totalPrecipitationMillimeters: number;
    totalEvapotranspirationMillimeters: number;
    daily: DailyWeatherPoint[];
  };
  forecast: {
    startsOn: string;
    endsOn: string;
    totalPrecipitationMillimeters: number;
    maximumTemperatureCelsius: number;
    totalEvapotranspirationMillimeters: number;
    daily: DailyWeatherPoint[];
  };
};

export type IrrigationPlan = {
  parcelId: string;
  scheduledDepthMillimeters: number;
  periodDays: 7;
  quality: 'simulated';
};

export type ClusterWaterAssessment = {
  cluster: import('@/types/agricultural-operations').ParcelCluster;
  status: 'normal' | 'review';
  recentPrecipitationMillimeters: number;
  forecastPrecipitationMillimeters: number;
  forecastEvapotranspirationMillimeters: number;
  scheduledIrrigationMillimeters: number;
  forecastGapMillimeters: number;
  maximumTemperatureCelsius: number;
  forecastStartsOn: string;
  forecastEndsOn: string;
  source: WeatherForecast['source'];
  quality: WeatherEvidenceQuality;
  rationale: string;
};

export type PortfolioWaterReview = {
  selectedCluster?: import('@/types/agricultural-operations').ParcelCluster;
  assessments: ClusterWaterAssessment[];
  generatedAt: string;
  usedFallback: boolean;
};
