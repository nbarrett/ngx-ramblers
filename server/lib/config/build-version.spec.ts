import expect from "expect";
import { describe, it } from "mocha";
import { environmentNameFrom, imageTagFrom } from "./build-version";

describe("environmentNameFrom", () => {
  it("strips the ngx-ramblers prefix from a Fly app name", () => {
    expect(environmentNameFrom("ngx-ramblers-ekwg", "production")).toEqual("ekwg");
  });

  it("keeps an app name that does not follow the convention", () => {
    expect(environmentNameFrom("kent-ramblers-web", "production")).toEqual("kent-ramblers-web");
  });

  it("describes a local run when there is no Fly app name", () => {
    expect(environmentNameFrom(null, "development")).toEqual("local (development)");
  });
});

describe("imageTagFrom", () => {
  it("prefers the image Fly is actually running and drops the registry host", () => {
    expect(imageTagFrom("registry-1.docker.io/nbarrett/ngx-ramblers:877", "nbarrett/ngx-ramblers:876")).toEqual("nbarrett/ngx-ramblers:877");
  });

  it("falls back to the tag baked in at build time", () => {
    expect(imageTagFrom(null, "nbarrett/ngx-ramblers:877")).toEqual("nbarrett/ngx-ramblers:877");
  });

  it("returns null when neither is known", () => {
    expect(imageTagFrom(null, null)).toBeNull();
  });
});
