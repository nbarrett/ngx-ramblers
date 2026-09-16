import expect from "expect";
import { describe, it } from "mocha";
import {
  EstateRebuildConfigured,
  EstateRebuildInfraSnapshot,
  EstateRebuildSiteProbe
} from "./estate-rebuild-capture.model";
import { configuredFor, safeValueFor } from "./generate-estate-rebuild-capture";

describe("generate-estate-rebuild-capture field values", () => {

  const infra = {
    environment: "example-group",
    flyAppName: "ngx-ramblers-example-group",
    customDomains: [],
    ngxLite: false,
    mongoCluster: "example-cluster",
    mongoDb: "ngx-ramblers-example-group",
    mongoUsername: "example_db_user",
    mongoPassword: "mongo-password",
    secretEntries: {},
    consoleAccess: {mongodbAtlas: {login: "example-group@example.org", password: "console-password"}}
  } as unknown as EstateRebuildInfraSnapshot;

  const failedProbe = {environment: "example-group", error: "could not connect to site database", googleMapsApiKey: ""} as unknown as EstateRebuildSiteProbe;
  const healthyProbe = {environment: "example-group", googleMapsApiKey: "maps-key"} as unknown as EstateRebuildSiteProbe;

  it("keeps values held in the stored environment record when the site probe fails", () => {
    expect(safeValueFor("mongoCluster", infra, failedProbe, false)).toEqual("example-cluster");
    expect(safeValueFor("mongoDb", infra, failedProbe, false)).toEqual("ngx-ramblers-example-group");
    expect(configuredFor("mongoUsername", infra, failedProbe, false)).toEqual(EstateRebuildConfigured.PRESENT);
  });

  it("keeps console logins when the site probe fails", () => {
    expect(safeValueFor("consoleAccess.mongodbAtlas.login", infra, failedProbe, false)).toEqual("example-group@example.org");
    expect(configuredFor("consoleAccess.mongodbAtlas.login", infra, failedProbe, false)).toEqual(EstateRebuildConfigured.PRESENT);
  });

  it("reports an error only for values that come from the site's own database", () => {
    expect(safeValueFor("googleMapsApiKey", infra, failedProbe, false)).toEqual("ERROR: could not connect to site database");
    expect(configuredFor("googleMapsApiKey", infra, failedProbe, false)).toEqual(EstateRebuildConfigured.ERROR);
  });

  it("reads values from the site's own database when the probe succeeds", () => {
    expect(configuredFor("googleMapsApiKey", infra, healthyProbe, false)).toEqual(EstateRebuildConfigured.PRESENT);
  });
});
