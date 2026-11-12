import { connection } from "next/server";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { SiteHeader } from "@/components/app-shell/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { APP_FOOTER } from "@/lib/app-config";
import { getWorkspaceName } from "@/lib/db/queries/company";

function WorkspaceLine({ name }: { name: string | null }) {
  return (
    <p className="px-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
      {name ? `Workspace: ${name}` : "Workspace"}
    </p>
  );
}

async function WorkspaceName() {
  await connection();
  return <WorkspaceLine name={await getWorkspaceName()} />;
}

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarProvider>
      <AppSidebar
        workspace={
          <Suspense fallback={<WorkspaceLine name={null} />}>
            <WorkspaceName />
          </Suspense>
        }
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6 md:p-8">
          {children}
          <footer className="mt-auto border-t border-border/80 pt-6 text-center text-sm text-muted-foreground italic">
            {APP_FOOTER}
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
