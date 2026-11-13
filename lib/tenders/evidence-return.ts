import { tabFromStage, type WorkspaceTabId } from "./workspace-stages";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenderReturn {
  /** Path and stage query only. Safe to use as a link href. */
  href: string;
  tenderId: string;
  stage: WorkspaceTabId | null;
}

/**
 * Link to the evidence library that can return to this tender and stage.
 * `from` is encoded so `?stage=` stays inside it. The hash scrolls to a document.
 */
export function evidenceLibraryHref(tenderId: string, stage: WorkspaceTabId, docId?: string): string {
  const from = `/tenders/${tenderId}?stage=${stage}`;
  const hash = docId ? `#doc-${docId}` : "";
  return `/evidence?from=${encodeURIComponent(from)}${hash}`;
}

/**
 * A return path is kept only when it is a same-app tender URL.
 * Anything else (other sites, protocol-relative URLs, path traversal) is ignored.
 */
export function tenderReturnFromParam(from: string | null | undefined): TenderReturn | null {
  if (typeof from !== "string") return null;
  if (from.length > 300 || from.includes("\\") || /[\u0000-\u001f]/.test(from)) return null;
  const raw = from.trim();
  if (!raw.startsWith("/tenders/")) return null;

  let url: URL;
  try {
    url = new URL(raw, "http://bidlens.local");
  } catch {
    return null;
  }
  if (url.origin !== "http://bidlens.local") return null;
  if (url.username || url.password) return null;
  if (!url.pathname.startsWith("/tenders/")) return null;

  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 2 || segments.includes("..") || segments.includes(".")) return null;
  const tenderId = segments[1]?.toLowerCase() ?? "";
  if (!UUID_RE.test(tenderId)) return null;

  const stage = tabFromStage(url.searchParams.get("stage"));
  const pathname = `/${segments.join("/")}`;
  const href = stage ? `${pathname}?stage=${stage}` : pathname;
  return { href, tenderId, stage };
}
