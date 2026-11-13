import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageNav({ crumbs }: { crumbs: readonly { href?: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="inline-flex min-w-0 items-center gap-1.5">
              {index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
              {crumb.href && !current ? (
                <Link href={crumb.href} className="hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className="max-w-[14rem] truncate text-foreground sm:max-w-md" title={crumb.label}>
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
