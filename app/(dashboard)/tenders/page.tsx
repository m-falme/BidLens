import type { Metadata } from "next";

import { NAV } from "@/components/app-shell/nav";
import { PagePlaceholder } from "@/components/app-shell/page-placeholder";

export const metadata: Metadata = { title: NAV.tenders.title };

export default function TendersPage() {
  return <PagePlaceholder item={NAV.tenders} />;
}
