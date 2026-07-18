'use client';

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { Clock3 } from 'lucide-react';

import { AssistantPanel } from '@/components/features/operations-workspace/assistant-panel';
import {
  dashboardMockData,
  sensorsDashboardData,
} from '@/components/features/operations-workspace/dashboard-mock-data';
import { ParcelMapCard } from '@/components/features/operations-workspace/parcel-map-card';
import { SensorsWorkspaceSection } from '@/components/features/operations-workspace/sensors-workspace-section';
import { WeatherWorkspaceSection } from '@/components/features/operations-workspace/weather-workspace-section';
import { WorkspaceSidebar } from '@/components/features/operations-workspace/workspace-sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  createBrowserDemoStateRepository,
  DEMO_STATE_CHANGE_EVENT,
  DEMO_STATE_STORAGE_KEY,
} from '@/lib/db/local-storage-demo-state-repository';
import { ASSISTANT_IDENTITY } from '@/lib/assistant-identity';
import { fetchPortfolioWaterReview } from '@/lib/api/weather-api';
import { cn } from '@/lib/utils';
import type { WorkspaceRoute } from '@/types/operations-dashboard';
import type { InspectionNote } from '@/types/agricultural-operations';
import type { PortfolioWaterReview } from '@/types/weather';

const SIDEBAR_STYLE = {
  '--sidebar-width': '14rem',
} as CSSProperties;
function subscribeToSelectedParcel(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === DEMO_STATE_STORAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener('storage', handleStorage);
  window.addEventListener(DEMO_STATE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(DEMO_STATE_CHANGE_EVENT, onStoreChange);
  };
}

function getStoredSelectedParcelId() {
  return createBrowserDemoStateRepository().load().selectedParcelId;
}

function getServerSelectedParcelId() {
  return dashboardMockData.initialParcelId;
}

type ParcelNotesSnapshot = {
  activeInspection: {
    notes: InspectionNote[];
    parcelId: string;
  };
  parcelNotes: Record<string, InspectionNote[]>;
};

function getStoredParcelNotesSnapshot() {
  const state = createBrowserDemoStateRepository().load();

  return JSON.stringify({
    activeInspection: {
      notes: state.activeInspection.notes,
      parcelId: state.activeInspection.parcelId,
    },
    parcelNotes: state.parcelNotes,
  } satisfies ParcelNotesSnapshot);
}

function getServerParcelNotesSnapshot() {
  return JSON.stringify({
    activeInspection: { notes: [], parcelId: '' },
    parcelNotes: {},
  } satisfies ParcelNotesSnapshot);
}

type OperationsWorkspaceProps = {
  route: WorkspaceRoute;
};

export function OperationsWorkspace({ route }: OperationsWorkspaceProps) {
  const data = dashboardMockData;
  const storedSelectedParcelId = useSyncExternalStore(
    subscribeToSelectedParcel,
    getStoredSelectedParcelId,
    getServerSelectedParcelId,
  );
  const parcelNotesSnapshot = useSyncExternalStore(
    subscribeToSelectedParcel,
    getStoredParcelNotesSnapshot,
    getServerParcelNotesSnapshot,
  );
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isParcelDetailsOpen, setIsParcelDetailsOpen] = useState(false);
  const [waterReview, setWaterReview] = useState<PortfolioWaterReview>();

  useEffect(() => {
    const controller = new AbortController();

    void fetchPortfolioWaterReview(controller.signal)
      .then(setWaterReview)
      .catch(() => {
        // The canonical Gard review remains visible when live weather fails.
      });

    return () => controller.abort();
  }, []);

  const parcels = useMemo(() => {
    if (!waterReview) {
      return data.parcels;
    }

    return {
      ...data.parcels,
      features: data.parcels.features.map((parcel) => ({
        ...parcel,
        properties: {
          ...parcel.properties,
          operationalStatus:
            parcel.properties.moistureStatus === 'critical'
              ? ('critical' as const)
              : parcel.properties.cluster === waterReview.selectedCluster
                ? ('review' as const)
                : ('normal' as const),
        },
      })),
    };
  }, [data.parcels, waterReview]);

  const reviewSummaries = useMemo(() => {
    if (!waterReview) {
      return data.reviewSummaries;
    }

    const criticalSummaries = data.reviewSummaries.filter(
      ({ status }) => status === 'critical',
    );
    const assessment = waterReview.assessments.find(
      ({ cluster }) => cluster === waterReview.selectedCluster,
    );

    if (!assessment) {
      return criticalSummaries;
    }

    const regionalSummaries = parcels.features
      .filter(({ properties }) => properties.cluster === assessment.cluster)
      .map(({ properties }) => ({
        parcelId: properties.id,
        status: 'review' as const,
        title: 'Irrigation plan review recommended',
        summary:
          'The seven-day outlook indicates that forecast rainfall and scheduled irrigation may not cover atmospheric water demand. Recalculate irrigation depth, volume, or duration for this parcel.',
        generatedAt: waterReview.generatedAt,
        source: 'mistral-morning-review' as const,
        quality: assessment.quality,
        evidence: {
          recentPrecipitationMillimeters:
            assessment.recentPrecipitationMillimeters,
          forecastPrecipitationMillimeters:
            assessment.forecastPrecipitationMillimeters,
          forecastEvapotranspirationMillimeters:
            assessment.forecastEvapotranspirationMillimeters,
          scheduledIrrigationMillimeters:
            assessment.scheduledIrrigationMillimeters,
          forecastGapMillimeters: assessment.forecastGapMillimeters,
          forecastStartsOn: assessment.forecastStartsOn,
          forecastEndsOn: assessment.forecastEndsOn,
        },
      }));

    return [...criticalSummaries, ...regionalSummaries];
  }, [data.reviewSummaries, parcels.features, waterReview]);

  const selectedParcelId = parcels.features.some(
    ({ properties }) => properties.id === storedSelectedParcelId,
  )
    ? storedSelectedParcelId
    : data.initialParcelId;

  const selectedParcelFeature =
    parcels.features.find(
      (feature) => feature.properties.id === selectedParcelId,
    ) ?? parcels.features[0];
  const selectedParcel = selectedParcelFeature.properties;
  const isAffectedParcel = selectedParcel.id === data.finding.parcelId;
  const selectedReviewSummary = reviewSummaries.find(
    ({ parcelId }) => parcelId === selectedParcel.id,
  );
  const selectedParcelSensorCount =
    sensorsDashboardData.parcels.find(
      ({ parcelId }) => parcelId === selectedParcel.id,
    )?.sensors.length ?? 0;
  const noteState = JSON.parse(parcelNotesSnapshot) as ParcelNotesSnapshot;
  const selectedParcelNotes =
    noteState.parcelNotes[selectedParcel.id] ??
    (noteState.activeInspection.parcelId === selectedParcel.id
      ? noteState.activeInspection.notes
      : []);

  function selectParcel(parcelId: string) {
    const repository = createBrowserDemoStateRepository();
    const state = repository.load();
    repository.save({ ...state, selectedParcelId: parcelId });
    setIsParcelDetailsOpen(true);
  }

  function askVineaAboutParcel(parcelId: string) {
    selectParcel(parcelId);
    setIsAssistantOpen(true);
  }

  return (
    <SidebarProvider style={SIDEBAR_STYLE}>
      <WorkspaceSidebar
        activeRoute={route}
        parcelCount={data.parcels.features.length}
        portfolioName={data.portfolioName}
      />

      <SidebarInset className="h-svh min-w-0 overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="truncate text-base font-semibold md:text-lg">
                {data.portfolioName}
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" />
                <span>{data.reviewTimeLabel}</span>
              </div>
            </div>
          </div>
          <Button
            aria-expanded={isAssistantOpen}
            onClick={() => setIsAssistantOpen((isOpen) => !isOpen)}
            size="sm"
            variant={isAssistantOpen ? 'secondary' : 'default'}
          >
            <Avatar className="size-5">
              <AvatarImage alt="" src={ASSISTANT_IDENTITY.avatarSrc} />
              <AvatarFallback>V</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">
              {isAssistantOpen
                ? `Close ${ASSISTANT_IDENTITY.name}`
                : `Open ${ASSISTANT_IDENTITY.name}`}
            </span>
            <span className="sm:hidden">{ASSISTANT_IDENTITY.name}</span>
          </Button>
        </header>

        <div
          id={route}
          className={cn(
            'grid min-h-0 flex-1 gap-2 p-2 md:gap-4 md:p-4',
            isAssistantOpen
              ? 'grid-rows-[minmax(30rem,calc(100svh-6rem))_minmax(24rem,55svh)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] lg:grid-rows-1 lg:overflow-hidden'
              : 'grid-cols-1',
          )}
        >
          <div
            className={cn(
              'min-h-0 min-w-0',
              route === 'map'
                ? 'h-full overflow-hidden'
                : (route === 'weather' || route === 'sensors') &&
                    'overflow-y-auto',
            )}
          >
            {route === 'weather' ? (
              <WeatherWorkspaceSection
                key={selectedParcelFeature.properties.id}
                parcel={selectedParcelFeature}
              />
            ) : route === 'sensors' ? (
              <SensorsWorkspaceSection data={sensorsDashboardData} />
            ) : (
              <ParcelMapCard
                affectedSector={data.affectedSector}
                expanded
                finding={isAffectedParcel ? data.finding : undefined}
                isDetailsOpen={isParcelDetailsOpen}
                onAskVinea={askVineaAboutParcel}
                onCloseDetails={() => setIsParcelDetailsOpen(false)}
                onSelectParcel={selectParcel}
                parcels={parcels}
                parcelNotes={selectedParcelNotes}
                reviewSummary={selectedReviewSummary}
                selectedParcel={selectedParcel}
                sensorCount={selectedParcelSensorCount}
              />
            )}
          </div>

          <AssistantPanel
            key={selectedParcelId}
            onOpenChange={setIsAssistantOpen}
            open={isAssistantOpen}
            selectedParcelId={selectedParcelId}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
