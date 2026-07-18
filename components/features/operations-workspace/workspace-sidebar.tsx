'use client';

import { CloudSun, Map, RotateCcw, type LucideIcon } from 'lucide-react';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { createBrowserDemoStateRepository } from '@/lib/db/local-storage-demo-state-repository';
import type { DashboardSection } from '@/types/operations-dashboard';

type NavigationItem = {
  id: DashboardSection;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'parcels', label: 'Map', icon: Map },
  { id: 'weather', label: 'Weather', icon: CloudSun },
];

type WorkspaceSidebarProps = {
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  parcelCount: number;
  portfolioName: string;
};

export function WorkspaceSidebar({
  activeSection,
  onNavigate,
  parcelCount,
  portfolioName,
}: WorkspaceSidebarProps) {
  const { setOpenMobile } = useSidebar();

  function handleNavigate(section: DashboardSection) {
    onNavigate(section);
    setOpenMobile(false);
  }

  function resetDemo() {
    createBrowserDemoStateRepository().reset();
    window.location.reload();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={portfolioName}>
              <Image
                alt=""
                aria-hidden="true"
                className="size-8 shrink-0 object-contain"
                height={300}
                src="/moet-chandon-logo.png"
                width={300}
              />
              <span className="truncate font-semibold">{portfolioName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAVIGATION_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activeSection === item.id}
                    onClick={() => handleNavigate(item.id)}
                    tooltip={item.label}
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.badge || item.id === 'parcels' ? (
                      <Badge className="ml-auto" variant="secondary">
                        {item.id === 'parcels' ? parcelCount : item.badge}
                      </Badge>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={resetDemo} tooltip="Reset demo">
              <RotateCcw aria-hidden="true" />
              <span>Reset demo</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="Pierre Laurent · Technical agronomist"
              variant="outline"
            >
              <div aria-label="Pierre Laurent, Technical agronomist">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs font-semibold">
                    PL
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                  <span className="truncate font-medium">Pierre Laurent</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Technical agronomist
                  </span>
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
