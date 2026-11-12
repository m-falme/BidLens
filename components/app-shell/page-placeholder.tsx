import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { NavItem } from "./nav";

export function PagePlaceholder({ item }: { item: NavItem }) {
  const Icon = item.icon;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{item.title}</h1>
        <p className="text-lg text-muted-foreground">{item.description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-5 text-primary" aria-hidden />
            Not built yet
          </CardTitle>
          <CardDescription>This page is a placeholder. It will show:</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5">
            {item.planned.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
