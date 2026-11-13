import { tenderReturnFromParam } from "@/lib/tenders/evidence-return";
import { hashForTab, previousTab, tabFromStage, type WorkspaceTabId } from "@/lib/tenders/workspace-stages";

const TENDER_PAGE = /^\/tenders\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const PLAN_PAGE = /^\/tenders\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/plan$/i;

export type BackDestination = { kind: "href"; href: string } | { kind: "history" } | { kind: "none" };

/** Path plus query, without a hash. The hash only scrolls. */
export function locationString(pathname: string, search: string): string {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return query ? `${pathname}?${query}` : pathname;
}

export function isInAppLocation(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 500) return false;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return false;
  if (/[\u0000-\u001f]/.test(value)) return false;
  return true;
}

/**
 * On a tender stage, back is the previous stage.
 * Interpretation goes to the tender list. A missing stage is treated as Interpretation.
 */
export function stageBackHref(pathname: string, stageParam: string | null): string | null {
  const match = TENDER_PAGE.exec(pathname);
  if (!match) return null;
  const id = match[1];
  const stage: WorkspaceTabId = tabFromStage(stageParam) ?? "interpretation";
  const previous = previousTab(stage);
  if (!previous) return "/tenders";
  return `/tenders/${id}?stage=${previous}#${hashForTab(previous)}`;
}

/** Parent used when this page was opened directly. */
export function parentBackHref(pathname: string, fromParam: string | null): string | null {
  if (pathname === "/") return null;
  const plan = PLAN_PAGE.exec(pathname);
  if (plan) return `/tenders/${plan[1]}?stage=preparation#${hashForTab("preparation")}`;
  if (pathname === "/tenders/new" || pathname === "/leads" || pathname === "/proposals") return "/tenders";
  if (pathname === "/tenders") return "/";
  if (pathname.startsWith("/tenders/")) return "/tenders";
  if (pathname.startsWith("/evidence")) return tenderReturnFromParam(fromParam)?.href ?? "/";
  return "/";
}

export function backDestination(input: {
  pathname: string;
  stage: string | null;
  from: string | null;
  previous: string | null;
  here: string;
}): BackDestination {
  const stageHref = stageBackHref(input.pathname, input.stage);
  if (stageHref) return { kind: "href", href: stageHref };
  if (isInAppLocation(input.previous) && input.previous !== input.here) return { kind: "history" };
  const parent = parentBackHref(input.pathname, input.from);
  if (parent && parent !== input.here) return { kind: "href", href: parent };
  return { kind: "none" };
}

/** Keep an in-app trail so back can follow the visit, and the browser Back button stays in step. */
export function rememberLocation(stack: readonly string[], here: string, popped: boolean): string[] {
  if (!isInAppLocation(here)) return [...stack];
  if (popped) {
    const index = stack.lastIndexOf(here);
    if (index >= 0) return stack.slice(0, index + 1);
    return [here];
  }
  if (stack[stack.length - 1] === here) return [...stack];
  const next = [...stack, here];
  return next.length > 40 ? next.slice(next.length - 40) : next;
}

export function previousLocation(stack: readonly string[], here: string): string | null {
  if (!isInAppLocation(here)) return null;
  const index = stack.lastIndexOf(here);
  if (index > 0) {
    const earlier = stack[index - 1];
    return isInAppLocation(earlier) ? earlier : null;
  }
  if (index === -1) {
    const last = stack[stack.length - 1];
    if (isInAppLocation(last) && last !== here) return last;
  }
  return null;
}
