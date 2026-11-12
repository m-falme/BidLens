import type { Metadata } from "next";

import { NAV } from "@/components/app-shell/nav";
import { PagePlaceholder } from "@/components/app-shell/page-placeholder";

export const metadata: Metadata = { title: NAV.overview.title };

export default function OverviewPage() {
  return <PagePlaceholder item={NAV.overview} />;
}
