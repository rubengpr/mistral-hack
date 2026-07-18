'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Filter, Search, Thermometer, X } from 'lucide-react';

import { ParcelSensorCard } from '@/components/features/operations-workspace/parcel-sensor-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SensorFilter, SensorType, SensorsDashboardData } from '@/types/sensors';
import type { ParcelMoistureStatus } from '@/types/agricultural-operations';

const SENSOR_TYPES: SensorType[] = ['soil-moisture', 'temperature', 'humidity', 'soil-temperature'];
const SENSOR_STATUSES = ['active', 'maintenance-needed', 'offline', 'calibrating'] as const;
const ALERT_STATUSES = ['normal', 'warning', 'critical'] as const;

type SensorsWorkspaceSectionProps = {
  data: SensorsDashboardData;
};

export function SensorsWorkspaceSection({ data }: SensorsWorkspaceSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParcels, setExpandedParcels] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<SensorFilter>({});
  
  // Toggle parcel expansion
  const toggleParcel = (parcelId: string) => {
    setExpandedParcels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(parcelId)) {
        newSet.delete(parcelId);
      } else {
        newSet.add(parcelId);
      }
      return newSet;
    });
  };

  // Toggle expand/collapse all
  const toggleAllParcels = (expand: boolean) => {
    if (expand) {
      setExpandedParcels(new Set(data.parcels.map((p) => p.parcelId)));
    } else {
      setExpandedParcels(new Set());
    }
  };

  // Apply filters to parcels
  const filteredParcels = data.parcels.filter((parcel) => {
    // Search filter
    const matchesSearch = 
      searchQuery === '' ||
      parcel.parcelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      parcel.parcelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      parcel.sensors.some(
        (s) =>
          s.metadata.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.metadata.id.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    if (!matchesSearch) return false;

    // Moisture status filter
    if (filters.parcelId && parcel.parcelId !== filters.parcelId) return false;
    
    // Sensor type filter
    if (filters.sensorType) {
      const hasMatchingSensor = parcel.sensors.some(
        (s) => s.metadata.type === filters.sensorType,
      );
      if (!hasMatchingSensor) return false;
    }

    // Sensor status filter
    if (filters.status) {
      const hasMatchingStatus = parcel.sensors.some(
        (s) => s.metadata.status === filters.status,
      );
      if (!hasMatchingStatus) return false;
    }

    // Alert status filter
    if (filters.alertStatus) {
      const hasMatchingAlert = parcel.sensors.some(
        (s) => s.alertStatus.status === filters.alertStatus,
      );
      if (!hasMatchingAlert) return false;
    }

    return true;
  });

  // Group parcels by moisture status
  const parcelsByStatus: Record<ParcelMoistureStatus, typeof filteredParcels> = {
    critical: [],
    watch: [],
    stable: [],
  };

  filteredParcels.forEach((parcel) => {
    parcelsByStatus[parcel.moistureStatus].push(parcel);
  });

  // Count active alerts
  const activeAlerts = filteredParcels.reduce(
    (count, parcel) =>
      count + parcel.sensors.filter((s) => s.alertStatus.status !== 'normal').length,
    0,
  );

  const allParcelsExpanded = data.parcels.every((p) => expandedParcels.has(p.parcelId));

  return (
    <section id="sensors" className="flex w-full flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Sensors Overview</h2>
          <p className="text-sm text-muted-foreground">
            Real-time sensor data across all parcels in your portfolio.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sensors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data.summary.totalSensors}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.activeSensors} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{activeAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.criticalCount} critical · {data.summary.warningCount} warning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.summary.sensorsByType).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type.replace('-', ' ')}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.summary.sensorsByStatus).map(([status, count]) => (
                <Badge key={status} variant="secondary" className="text-xs">
                  {status.replace('-', ' ')}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search parcels or sensors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Filter className="size-3.5" aria-hidden="true" />
                    Type
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sensor Type</DropdownMenuLabel>
                  {SENSOR_TYPES.map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={filters.sensorType === type}
                      onCheckedChange={(checked) =>
                        setFilters((prev) => ({
                          ...prev,
                          sensorType: checked ? type : undefined,
                        }))
                      }
                    >
                      {type.replace('-', ' ')}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Filter className="size-3.5" aria-hidden="true" />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sensor Status</DropdownMenuLabel>
                  {SENSOR_STATUSES.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={filters.status === status}
                      onCheckedChange={(checked) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: checked ? status : undefined,
                        }))
                      }
                    >
                      {status.replace('-', ' ')}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    Alerts
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Alert Status</DropdownMenuLabel>
                  {ALERT_STATUSES.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={filters.alertStatus === status}
                      onCheckedChange={(checked) =>
                        setFilters((prev) => ({
                          ...prev,
                          alertStatus: checked ? status : undefined,
                        }))
                      }
                    >
                      <StatusBadge status={status} />
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {(filters.sensorType || filters.status || filters.alertStatus) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({})}
                  className="flex items-center gap-2"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expand/Collapse All */}
      {filteredParcels.length > 0 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAllParcels(!allParcelsExpanded)}
            className="flex items-center gap-2"
          >
            {allParcelsExpanded ? (
              <>
                <ChevronDown className="size-4" aria-hidden="true" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronUp className="size-4" aria-hidden="true" />
                Expand All
              </>
            )}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="self-center text-sm text-muted-foreground">
                {filteredParcels.length} parcels
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{filteredParcels.length} parcels match your filters</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Parcel Sections by Status */}
      <div className="flex flex-col gap-6">
        {Object.entries(parcelsByStatus).map(([status, parcels]) => {
          if (parcels.length === 0) return null;
          
          return (
            <div key={status} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <StatusIcon status={status as ParcelMoistureStatus} />
                {status.charAt(0).toUpperCase() + status.slice(1)} Parcels
                <Badge variant="secondary" className="ml-2">
                  {parcels.length}
                </Badge>
              </h3>
              <div className="flex flex-col gap-2">
                {parcels.map((parcel) => (
                  <ParcelSensorCard
                    key={parcel.parcelId}
                    parcel={parcel}
                    isExpanded={expandedParcels.has(parcel.parcelId)}
                    onToggle={() => toggleParcel(parcel.parcelId)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredParcels.length === 0 && (
        <Card className="text-center py-8">
          <CardContent>
            <Thermometer className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">
              No parcels match your filters
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setFilters({});
              }}
              className="mt-2"
            >
              Clear all filters
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

// Helper components
function StatusIcon({ status }: { status: ParcelMoistureStatus }) {
  const iconClass = 'size-4';
  
  switch (status) {
    case 'critical':
      return <AlertTriangle className={`${iconClass} text-destructive`} aria-hidden="true" />;
    case 'watch':
      return <AlertTriangle className={`${iconClass} text-amber-500`} aria-hidden="true" />;
    default:
      return <CheckCircle2 className={`${iconClass} text-green-500`} aria-hidden="true" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'critical' ? 'destructive' : status === 'warning' ? 'default' : 'secondary';
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}
