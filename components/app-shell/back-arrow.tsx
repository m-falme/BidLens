"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  backDestination,
  isInAppLocation,
  locationString,
  previousLocation,
  rememberLocation,
} from "@/lib/nav/back";

const STORAGE_KEY = "bidlens-nav";

export const backArrowClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-1 py-1 text-base font-semibold text-foreground hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

let popped = false;

function readStack(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => isInAppLocation(item));
  } catch {
    return [];
  }
}

function writeStack(stack: readonly string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack));
  } catch {
    // A private window can refuse storage. The parent fallback still works.
  }
}

export function BackArrowLabel() {
  return (
    <span className={backArrowClass} aria-hidden>
      ← Back
    </span>
  );
}

export function BackArrow() {
  const pathname = usePathname() || "/";
  const params = useSearchParams();
  const router = useRouter();
  const search = params.toString();
  const here = locationString(pathname, search);
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    function onPop() {
      popped = true;
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const prior = readStack();
    const cameFrom = previousLocation(prior, here);
    const wasPop = popped;
    popped = false;
    writeStack(rememberLocation(prior, here, wasPop));
    setPrevious(cameFrom);
  }, [here]);

  const destination = backDestination({
    pathname,
    stage: params.get("stage"),
    from: params.get("from"),
    previous,
    here,
  });

  const label = (
    <>
      <span aria-hidden>←</span> Back
    </>
  );

  if (destination.kind === "href") {
    return (
      <Link href={destination.href} className={backArrowClass} aria-label="Back">
        {label}
      </Link>
    );
  }

  return (
    <button type="button" className={backArrowClass} aria-label="Back" onClick={() => router.back()}>
      {label}
    </button>
  );
}
