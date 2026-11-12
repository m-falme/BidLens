"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
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
} from "@/components/ui/sidebar";
import { APP_BYLINE, APP_NAME, APP_TAGLINE } from "@/lib/app-config";

import { NAV_ITEMS, isNavItemActive } from "./nav";

function NavMenu({ pathname }: { pathname: string | null }) {
  return (
    <SidebarMenu>
      {NAV_ITEMS.map((item) => {
        const active = pathname !== null && isNavItemActive(pathname, item.href);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={active}
              tooltip={item.title}
              aria-current={active ? "page" : undefined}
              render={<Link href={item.href} />}
            >
              <item.icon aria-hidden />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

/** On dynamic routes the pathname is request-time data, so the highlight streams in after the shell. */
function ActiveNavMenu() {
  return <NavMenu pathname={usePathname()} />;
}

export function AppSidebar({ workspace }: { workspace: ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-start gap-2.5 p-1">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            BT
          </div>
          <div className="grid gap-0.5 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold">{APP_NAME}</span>
            <span className="text-sm text-muted-foreground">{APP_TAGLINE}</span>
            <span className="text-sm text-muted-foreground">{APP_BYLINE}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <Suspense fallback={<NavMenu pathname={null} />}>
              <ActiveNavMenu />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>{workspace}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
