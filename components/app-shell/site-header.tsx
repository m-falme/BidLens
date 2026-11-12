import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="data-vertical:h-5 data-vertical:self-center" />
      <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
      <span className="hidden truncate text-sm text-muted-foreground md:inline">{APP_TAGLINE}</span>
    </header>
  );
}
