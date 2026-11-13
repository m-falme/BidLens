import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">{eyebrow}</p>
        <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const CARD_CLASS = "rounded-xl border border-border bg-card shadow-[0_8px_28px_rgba(23,32,42,0.05)]";
