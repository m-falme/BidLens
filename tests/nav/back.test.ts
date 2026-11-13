import { describe, expect, it } from "vitest";

import {
  backDestination,
  locationString,
  parentBackHref,
  previousLocation,
  rememberLocation,
  stageBackHref,
} from "@/lib/nav/back";

const TENDER = "72d5c834-f3e2-44ba-814b-588f4c144894";

describe("stage back", () => {
  it("sends Interpretation to the tender list", () => {
    expect(stageBackHref(`/tenders/${TENDER}`, "interpretation")).toBe("/tenders");
    expect(stageBackHref(`/tenders/${TENDER}`, null)).toBe("/tenders");
  });

  it("steps to the previous stage and keeps that stage in the address", () => {
    expect(stageBackHref(`/tenders/${TENDER}`, "compliance")).toBe(
      `/tenders/${TENDER}?stage=interpretation#can_bid`,
    );
    expect(stageBackHref(`/tenders/${TENDER}`, "commercial")).toBe(`/tenders/${TENDER}?stage=compliance#can_comply`);
    expect(stageBackHref(`/tenders/${TENDER}`, "should_bid")).toBe(`/tenders/${TENDER}?stage=compliance#can_comply`);
    expect(stageBackHref(`/tenders/${TENDER}`, "recommendation")).toBe(
      `/tenders/${TENDER}?stage=commercial#should_bid`,
    );
    expect(stageBackHref(`/tenders/${TENDER}`, "Bid preparation")).toBe(
      `/tenders/${TENDER}?stage=recommendation#recommendation`,
    );
  });

  it("uses the stage order even when the visit came from somewhere else", () => {
    expect(
      backDestination({
        pathname: `/tenders/${TENDER}`,
        stage: "commercial",
        from: null,
        previous: "/evidence",
        here: `/tenders/${TENDER}?stage=commercial`,
      }),
    ).toEqual({ kind: "href", href: `/tenders/${TENDER}?stage=compliance#can_comply` });
  });
});

describe("parent back", () => {
  it("falls back to the parent when the page was opened directly", () => {
    expect(parentBackHref("/settings", null)).toBe("/");
    expect(parentBackHref("/company", null)).toBe("/");
    expect(parentBackHref("/trail", null)).toBe("/");
    expect(parentBackHref("/counties", null)).toBe("/");
    expect(parentBackHref("/tenders", null)).toBe("/");
    expect(parentBackHref("/tenders/new", null)).toBe("/tenders");
    expect(parentBackHref(`/tenders/${TENDER}/plan`, null)).toBe(`/tenders/${TENDER}?stage=preparation#proceed`);
    expect(parentBackHref("/tenders/not-a-uuid", null)).toBe("/tenders");
    expect(parentBackHref("/", null)).toBeNull();
  });

  it("sends evidence back to the tender stage it was opened from", () => {
    const from = `/tenders/${TENDER}?stage=compliance`;
    expect(parentBackHref("/evidence", from)).toBe(from);
    expect(parentBackHref("/evidence", "https://evil.test")).toBe("/");
  });

  it("follows the page the user came from before the parent", () => {
    expect(
      backDestination({
        pathname: "/settings",
        stage: null,
        from: null,
        previous: `/tenders/${TENDER}?stage=commercial`,
        here: "/settings",
      }),
    ).toEqual({ kind: "history" });
    expect(
      backDestination({
        pathname: "/settings",
        stage: null,
        from: null,
        previous: null,
        here: "/settings",
      }),
    ).toEqual({ kind: "href", href: "/" });
  });
});

describe("visit trail", () => {
  it("records a visit and trims it when the browser goes back", () => {
    const forward = rememberLocation(["/"], "/tenders", false);
    expect(forward).toEqual(["/", "/tenders"]);
    expect(previousLocation(forward, "/company")).toBe("/tenders");
    expect(rememberLocation(forward, "/tenders", true)).toEqual(["/", "/tenders"]);
    expect(previousLocation(["/", "/tenders", "/settings"], "/tenders")).toBe("/");
    expect(locationString("/evidence", "?from=%2Ftenders")).toBe("/evidence?from=%2Ftenders");
    expect(previousLocation(["javascript:alert(1)"], "/settings")).toBeNull();
  });
});
