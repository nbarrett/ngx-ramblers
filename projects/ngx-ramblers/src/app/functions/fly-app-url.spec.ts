import { describe, expect, it } from "vitest";
import { flyAppMetricsUrl, flyAppUrl } from "./fly-app-url";
import { flyTargetApp, FlyTargetApp } from "../models/health.model";

describe("flyAppUrl", () => {

  it("builds the Fly dashboard URL for an app", () => {
    expect(flyAppUrl("ngx-ramblers-jitsi")).toEqual("https://fly.io/apps/ngx-ramblers-jitsi");
  });

  it("is empty when there is no app name", () => {
    expect(flyAppUrl("")).toEqual("");
    expect(flyAppUrl("  ")).toEqual("");
  });

});

describe("flyAppMetricsUrl", () => {

  it("opens Fly's Grafana metrics page for the app", () => {
    expect(flyAppMetricsUrl("ngx-ramblers-integration-worker"))
      .toEqual("https://fly.io/apps/ngx-ramblers-integration-worker/metrics");
  });

});

describe("flyTargetApp", () => {

  it("recognises the integration worker and video meetings apps", () => {
    expect(flyTargetApp("worker")).toEqual(FlyTargetApp.WORKER);
    expect(flyTargetApp("jitsi")).toEqual(FlyTargetApp.JITSI);
  });

  it("defaults to the current website app", () => {
    expect(flyTargetApp("")).toEqual(FlyTargetApp.ENVIRONMENT);
    expect(flyTargetApp("environment")).toEqual(FlyTargetApp.ENVIRONMENT);
  });

});
