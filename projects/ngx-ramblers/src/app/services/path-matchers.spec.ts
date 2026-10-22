import { UrlSegment } from "@angular/router";
import { describe, expect, it } from "vitest";
import { WALKS_ADD_WALK_SEGMENT, WALKS_LEADER_SEGMENT, WalksAdminSegment } from "../models/walks-route-paths.model";
import { hasWalksAreaSubPath } from "./path-matchers";

function segments(...paths: string[]): UrlSegment[] {
  return paths.map(path => new UrlSegment(path, {}));
}

describe("hasWalksAreaSubPath", () => {
  it("matches calendar under a renamed walks area", () => {
    expect(hasWalksAreaSubPath(segments("go-walking", WalksAdminSegment.CALENDAR))?.consumed.map(segment => segment.path))
      .toEqual(["go-walking"]);
  });

  it("matches my-walks and add-walk under a renamed walks area", () => {
    expect(hasWalksAreaSubPath(segments("go-walking", WALKS_LEADER_SEGMENT))).toBeTruthy();
    expect(hasWalksAreaSubPath(segments("go-walking", WALKS_ADD_WALK_SEGMENT))).toBeTruthy();
  });

  it("does not treat a walk slug as a walks feature path", () => {
    expect(hasWalksAreaSubPath(segments("go-walking", "hillside-loop"))).toBeNull();
  });
});
