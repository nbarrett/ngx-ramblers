import { describe, expect, it } from "vitest";
import { ConversionNextStep } from "../models/environment-setup.model";
import { conversionNextStep } from "./conversion-next-step";

describe("conversionNextStep", () => {

  it("asks for Site URL when the group domain is not the public address", () => {
    expect(conversionNextStep({
      siteUrl: "https://group.ngx-ramblers.org.uk",
      groupApex: "group.org.uk",
      extraMx: true,
      inboundReady: false,
      incomingRepairable: false
    })).toEqual(ConversionNextStep.SET_SITE_URL);
  });

  it("asks to move inbound when Site URL is the group domain and foreign MX remains", () => {
    expect(conversionNextStep({
      siteUrl: "https://group.org.uk",
      groupApex: "group.org.uk",
      extraMx: true,
      inboundReady: false,
      incomingRepairable: false
    })).toEqual(ConversionNextStep.MOVE_INBOUND);
  });

  it("asks to enable incoming mail when MX is already Cloudflare and routing is off", () => {
    expect(conversionNextStep({
      siteUrl: "https://group.org.uk",
      groupApex: "group.org.uk",
      extraMx: false,
      inboundReady: false,
      incomingRepairable: true
    })).toEqual(ConversionNextStep.ENABLE_INCOMING);
  });

  it("has no next step when inbound is ready", () => {
    expect(conversionNextStep({
      siteUrl: "https://group.org.uk",
      groupApex: "group.org.uk",
      extraMx: false,
      inboundReady: true,
      incomingRepairable: false
    })).toEqual(ConversionNextStep.NONE);
  });
});
