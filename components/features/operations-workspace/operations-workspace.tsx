'use client';

import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import { Clock3 } from 'lucide-react';

import { AssistantPanel } from '@/components/features/operations-workspace/assistant-panel';
import { dashboardMockData, sensorsDashboardData } from '@/components/features/operations-workspace/dashboard-mock-data';
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
  DEMO_STATE_STORAGE_KEY,
} from '@/lib/db/local-storage-demo-state-repository';
import { ASSISTANT_IDENTITY } from '@/lib/assistant-identity';
import { cn } from '@/lib/utils';
import type { WorkspaceRoute } from '@/types/operations-dashboard';

const SIDEBAR_STYLE = {
  '--sidebar-width': '14rem',
} as CSSProperties;
const DEMO_SELECTION_EVENT = 'demo-parcel-selection-change';

function subscribeToSelectedParcel(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === DEMO_STATE_STORAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener('storage', handleStorage);
  window.addEventListener(DEMO_SELECTION_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(DEMO_SELECTION_EVENT, onStoreChange);
  };
}

function getStoredSelectedParcelId() {
  return createBrowserDemoStateRepository().load().selectedParcelId;
}

function getServerSelectedParcelId() {
  return dashboardMockData.initialParcelId;
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
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isParcelDetailsOpen, setIsParcelDetailsOpen] = useState(false);

  const selectedParcelId = data.parcels.features.some(
    ({ properties }) => properties.id === storedSelectedParcelId,
  )
    ? storedSelectedParcelId
    : data.initialParcelId;

  const selectedParcelFeature =
    data.parcels.features.find(
      (feature) => feature.properties.id === selectedParcelId,
    ) ?? data.parcels.features[0];
  const selectedParcel = selectedParcelFeature.properties;
  const isAffectedParcel = selectedParcel.id === data.finding.parcelId;

  function selectParcel(parcelId: string) {
    const repository = createBrowserDemoStateRepository();
    const state = repository.load();
    repository.save({ ...state, selectedParcelId: parcelId });
    window.dispatchEvent(new Event(DEMO_SELECTION_EVENT));
    setIsParcelDetailsOpen(true);
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
                onCloseDetails={() => setIsParcelDetailsOpen(false)}
                onSelectParcel={selectParcel}
                parcels={data.parcels}
                selectedParcel={selectedParcel}
              />
            )}
          </div>

          <AssistantPanel
            onOpenChange={setIsAssistantOpen}
            open={isAssistantOpen}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
