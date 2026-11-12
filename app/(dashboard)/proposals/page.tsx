import type { Metadata } from "next";

import { NAV } from "@/components/app-shell/nav";
import { PagePlaceholder } from "@/components/app-shell/page-placeholder";

export const metadata: Metadata = { title: NAV.proposals.title };

export default function ProposalsPage() {
  return <PagePlaceholder item={NAV.proposals} />;
}
