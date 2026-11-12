import type { Metadata } from "next";

import { NAV } from "@/components/app-shell/nav";
import { PagePlaceholder } from "@/components/app-shell/page-placeholder";

export const metadata: Metadata = { title: NAV.counties.title };

export default function CountiesPage() {
  return <PagePlaceholder item={NAV.counties} />;
}
