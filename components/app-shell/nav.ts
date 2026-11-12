import {
  FileSearch,
  FileText,
  Landmark,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Shown on the placeholder page until the feature ships. */
  planned: readonly string[];
};

export const NAV = {
  overview: {
    href: "/",
    title: "Overview",
    description: "Where every opportunity stands and what was decided.",
    icon: LayoutDashboard,
    planned: ["Pipeline counts by status", "Recent bid decisions with their snapshots"],
  },
  leads: {
    href: "/leads",
    title: "Leads",
    description: "Field leads from visits, notebooks, emails and voice notes.",
    icon: Users,
    planned: [
      "Pipeline board and table with owner, status and next action",
      "Form 1 lead capture",
      "Lead detail with duplicate warnings and missing fields",
    ],
  },
  tenders: {
    href: "/tenders",
    title: "Tenders",
    description: "Upload a tender and get evidence-backed fields, readiness and payment risk.",
    icon: FileSearch,
    planned: [
      "Tender PDF upload",
      "Extracted fields, each with page, quote, confidence and status",
      "Readiness, payment risk, decision and proposal tabs",
    ],
  },
  counties: {
    href: "/counties",
    title: "Counties",
    description: "Pending bills and payment-risk bands for all 47 counties.",
    icon: Landmark,
    planned: [
      "Table and chart of pending bills and the share older than 3 years",
      "Risk band per county with the Controller of Budget source and date",
    ],
  },
  proposals: {
    href: "/proposals",
    title: "Proposals",
    description: "Proposal drafts built only from approved inputs.",
    icon: FileText,
    planned: [
      "Proposal list with version and status",
      "Editor with placeholders for prices and claims that need approval",
    ],
  },
} as const satisfies Record<string, NavItem>;

export const NAV_ITEMS: readonly NavItem[] = Object.values(NAV);

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
