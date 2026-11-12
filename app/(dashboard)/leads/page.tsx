import type { Metadata } from "next";

import { NAV } from "@/components/app-shell/nav";
import { PagePlaceholder } from "@/components/app-shell/page-placeholder";

export const metadata: Metadata = { title: NAV.leads.title };

export default function LeadsPage() {
  return <PagePlaceholder item={NAV.leads} />;
}
