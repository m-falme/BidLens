import { connection } from "next/server";
import { Suspense, type CSSProperties } from "react";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { SiteHeader } from "@/components/app-shell/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { APP_FOOTER } from "@/lib/app-config";
import { getWorkspaceName } from "@/lib/db/queries/company";
import { countUploadedTenders } from "@/lib/db/queries/tenders";

async function LoadedSidebar() {
  await connection();
  const [companyName, tenderCount] = await Promise.all([getWorkspaceName(), countUploadedTenders()]);
  return <AppSidebar companyName={companyName} tenderCount={tenderCount} />;
}

async function LoadedHeader() {
  await connection();
  return <SiteHeader companyName={await getWorkspaceName()} />;
}

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "15.5rem" } as CSSProperties}>
      <Suspense fallback={<AppSidebar companyName={null} tenderCount={null} />}>
        <LoadedSidebar />
      </Suspense>
      <SidebarInset>
        <Suspense fallback={<SiteHeader companyName={null} />}>
          <LoadedHeader />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6 md:px-8 md:py-7">
          {children}
          <footer className="mt-auto border-t border-border pt-6 text-center text-sm text-muted-foreground italic">
            {APP_FOOTER}
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
