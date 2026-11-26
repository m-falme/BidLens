import type { Metadata } from "next";

import { NAV } from "@/components/app-shell/nav";
import { PageHeading } from "@/components/app-shell/page-heading";

import { FindClient } from "./find-client";

export const metadata: Metadata = { title: NAV.find.title };

export default function FindPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeading eyebrow="Workspace" title={NAV.find.title} description={NAV.find.description} />
      <FindClient />
    </div>
  );
}
