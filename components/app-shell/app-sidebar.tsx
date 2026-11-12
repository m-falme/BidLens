"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { APP_BYLINE, APP_NAME } from "@/lib/app-config";
import { profileInitials } from "@/lib/overview/build";

import { MANAGE_NAV, WORKSPACE_NAV, isNavItemActive, type NavItem } from "./nav";

function NavMenu({
  items,
  pathname,
  tenderCount,
}: {
  items: readonly NavItem[];
  pathname: string | null;
  tenderCount: number | null;
}) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = pathname !== null && isNavItemActive(pathname, item.href);
        const count = item.href === "/tenders" ? tenderCount : null;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={active}
              tooltip={item.title}
              aria-current={active ? "page" : undefined}
              className="h-9"
              render={<Link href={item.href} />}
            >
              <item.icon aria-hidden />
              <span className="truncate">{item.title}</span>
              {count !== null && (
                <span className="ml-auto text-sm tabular-nums text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {count}
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function ActiveNav({ tenderCount }: { tenderCount: number | null }) {
  const pathname = usePathname();
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="h-7 text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Workspace
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <NavMenu items={WORKSPACE_NAV} pathname={pathname} tenderCount={tenderCount} />
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel className="h-7 text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Manage
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <NavMenu items={MANAGE_NAV} pathname={pathname} tenderCount={null} />
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

export function AppSidebar({
  companyName,
  tenderCount,
}: {
  companyName: string | null;
  tenderCount: number | null;
}) {
  const name = companyName ?? "Workspace";
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            BT
          </div>
          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-heading text-base font-semibold tracking-tight">{APP_NAME}</span>
            <span className="text-sm tracking-[0.12em] text-muted-foreground uppercase">{APP_BYLINE}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Suspense
          fallback={
            <>
              <SidebarGroup>
                <SidebarGroupLabel className="h-7 text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Workspace
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavMenu items={WORKSPACE_NAV} pathname={null} tenderCount={tenderCount} />
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel className="h-7 text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Manage
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavMenu items={MANAGE_NAV} pathname={null} tenderCount={null} />
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          }
        >
          <ActiveNav tenderCount={tenderCount} />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2.5 border-t border-sidebar-border px-1 pt-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand"
            aria-hidden
          >
            {profileInitials(companyName ?? "")}
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">Bid manager · {name}</p>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
