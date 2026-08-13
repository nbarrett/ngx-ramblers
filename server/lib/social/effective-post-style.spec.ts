import expect from "expect";
import { describe, it } from "mocha";
import { effectivePostStyle } from "./event-publish";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { FacebookPostStyle } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";

describe("effectivePostStyle", () => {

  function configWith(eventPostStyle?: FacebookPostStyle): SystemConfig {
    return {externalSystems: {facebook: {eventPostStyle}}} as unknown as SystemConfig;
  }

  it("posts photos when the event has images and nothing is configured", () => {
    expect(effectivePostStyle(configWith(), 2)).toEqual(FacebookPostStyle.PHOTO_WITH_LINK);
  });

  it("falls back to a link card when the event has no images", () => {
    expect(effectivePostStyle(configWith(), 0)).toEqual(FacebookPostStyle.LINK_PREVIEW);
  });

  it("honours a configured link card even when images are available", () => {
    expect(effectivePostStyle(configWith(FacebookPostStyle.LINK_PREVIEW), 3)).toEqual(FacebookPostStyle.LINK_PREVIEW);
  });

  it("still falls back to a link card when photos are configured but none exist", () => {
    expect(effectivePostStyle(configWith(FacebookPostStyle.PHOTO_WITH_LINK), 0)).toEqual(FacebookPostStyle.LINK_PREVIEW);
  });
});
