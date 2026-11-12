import {
  Building2,
  FileSearch,
  History,
  Landmark,
  LayoutDashboard,
  Library,
  Settings,
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
    description: "Uploaded tenders, open decisions, and the latest reviews.",
    icon: LayoutDashboard,
    planned: [],
  },
  tenders: {
    href: "/tenders",
    title: "Tenders",
    description: "Upload a tender and get evidence-backed fields, readiness and payment risk.",
    icon: FileSearch,
    planned: [],
  },
  company: {
    href: "/company",
    title: "Company profile",
    description: "Papers used in tender checks, and the status set for each one.",
    icon: Building2,
    planned: [],
  },
  evidence: {
    href: "/evidence",
    title: "Evidence library",
    description: "Company documents and the tenders that use them.",
    icon: Library,
    planned: [],
  },
  trail: {
    href: "/trail",
    title: "Decision trail",
    description: "Reviews and bid decisions, newest first.",
    icon: History,
    planned: [],
  },
  settings: {
    href: "/settings",
    title: "Settings",
    description: "Review gates for this workspace. Nothing here is saved.",
    icon: Settings,
    planned: [],
  },
  leads: {
    href: "/leads",
    title: "Leads",
    description: "Field leads from visits, notebooks, emails and voice notes.",
    icon: Users,
    planned: [],
  },
  counties: {
    href: "/counties",
    title: "Counties",
    description: "Pending bills and payment-risk bands for all 47 counties.",
    icon: Landmark,
    planned: [],
  },
  proposals: {
    href: "/proposals",
    title: "Proposals",
    description: "Proposal drafts built only from approved inputs.",
    icon: FileSearch,
    planned: [],
  },
} as const satisfies Record<string, NavItem>;

/** Counties stays a working page. It is linked from a tender, not listed in the sidebar. */
export const WORKSPACE_NAV: readonly NavItem[] = [NAV.overview, NAV.tenders, NAV.company, NAV.evidence];

export const MANAGE_NAV: readonly NavItem[] = [NAV.trail, NAV.settings];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function shellCrumb(pathname: string): { group: "Workspace" | "Manage"; page: string } {
  const manage = MANAGE_NAV.find((item) => isNavItemActive(pathname, item.href));
  if (manage) return { group: "Manage", page: manage.title };
  if (pathname.startsWith("/tenders")) return { group: "Workspace", page: NAV.tenders.title };
  if (pathname.startsWith("/company")) return { group: "Workspace", page: NAV.company.title };
  if (pathname.startsWith("/evidence")) return { group: "Workspace", page: NAV.evidence.title };
  if (pathname.startsWith("/leads")) return { group: "Workspace", page: NAV.leads.title };
  if (pathname.startsWith("/counties")) return { group: "Workspace", page: NAV.counties.title };
  if (pathname.startsWith("/proposals")) return { group: "Workspace", page: NAV.proposals.title };
  return { group: "Workspace", page: NAV.overview.title };
}
