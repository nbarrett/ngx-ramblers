import expect from "expect";
import { describe, it } from "mocha";
import { isTrackingQueryParam, pathWithTrackingQueryStripped } from "./tracking-query";

describe("tracking-query", () => {
  it("recognises common tracking parameter names", () => {
    expect(isTrackingQueryParam("ref")).toBe(true);
    expect(isTrackingQueryParam("utm_source")).toBe(true);
    expect(isTrackingQueryParam("gclid")).toBe(true);
    expect(isTrackingQueryParam("format")).toBe(false);
    expect(isTrackingQueryParam("q")).toBe(false);
  });

  it("returns null when there are no tracking parameters", () => {
    expect(pathWithTrackingQueryStripped("/", {})).toBe(null);
    expect(pathWithTrackingQueryStripped("/walks", {format: "markdown", q: "deal"})).toBe(null);
  });

  it("strips only tracking parameters and keeps the rest", () => {
    expect(pathWithTrackingQueryStripped("/", {ref: "ed_direct"})).toBe("/");
    expect(pathWithTrackingQueryStripped("/walks/coastal", {
      ref: "ed_direct",
      utm_source: "newsletter",
      format: "markdown"
    })).toBe("/walks/coastal?format=markdown");
  });

  it("preserves repeated non-tracking values", () => {
    expect(pathWithTrackingQueryStripped("/search", {
      q: ["deal", "sandwich"],
      utm_campaign: "spring"
    })).toBe("/search?q=deal&q=sandwich");
  });
});
