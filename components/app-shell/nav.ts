import {
  Building2,
  FileSearch,
  History,
  Landmark,
  LayoutDashboard,
  Library,
  Search,
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
    description: "Uploaded tenders and the leads the team has captured.",
    icon: FileSearch,
    planned: [],
  },
  find: {
    href: "/find",
    title: "Find tenders",
    description:
      "Reads tenders from a source, checks them against your company profile and evidence, and ranks the best matches.",
    icon: Search,
    planned: [],
  },
  company: {
    href: "/company",
    title: "Company profile",
    description: "Your company profile: who you are and what you deliver. Tenders are checked against it.",
    icon: Building2,
    planned: [],
  },
  evidence: {
    href: "/evidence",
    title: "Evidence library",
    description:
      "Company documents a tender requirement can link to. Upload a file for each one. A requirement is met only when it links to a document marked Have.",
    icon: Library,
    planned: [],
  },
  trail: {
    href: "/trail",
    title: "Decision trail",
    description: "Every stage review and bid decision across tenders, newest first. Rows are never edited or removed.",
    icon: History,
    planned: [],
  },
  settings: {
    href: "/settings",
    title: "Settings",
    description: "Loan rate, review gates, automation and alerts for this workspace. Changes save as you make them.",
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
} as const satisfies Record<string, NavItem>;

/** Counties stays a working page. It is linked from a tender, not listed in the sidebar. */
export const WORKSPACE_NAV: readonly NavItem[] = [NAV.overview, NAV.tenders, NAV.find, NAV.company, NAV.evidence];

export const MANAGE_NAV: readonly NavItem[] = [NAV.trail, NAV.settings];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function shellCrumb(pathname: string): { group: "Workspace" | "Manage"; page: string } {
  const manage = MANAGE_NAV.find((item) => isNavItemActive(pathname, item.href));
  if (manage) return { group: "Manage", page: manage.title };
  if (pathname.startsWith("/tenders")) return { group: "Workspace", page: NAV.tenders.title };
  if (pathname.startsWith("/find")) return { group: "Workspace", page: NAV.find.title };
  if (pathname.startsWith("/company")) return { group: "Workspace", page: NAV.company.title };
  if (pathname.startsWith("/evidence")) return { group: "Workspace", page: NAV.evidence.title };
  if (pathname.startsWith("/leads")) return { group: "Workspace", page: NAV.leads.title };
  if (pathname.startsWith("/counties")) return { group: "Workspace", page: NAV.counties.title };
  return { group: "Workspace", page: NAV.overview.title };
}
