import expect from "expect";
import { describe, it } from "mocha";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { Organisation } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { RamblersEventType } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {
  eventHasIndexablePublicSlug,
  eventListRootsFrom,
  eventRedirectTarget,
  homeRedirectTarget,
  isReservedSeoAppPath,
  missingPageSeoDescriptor
} from "./public-path-indexability";

describe("public-path-indexability", () => {

  it("keeps known app routes out of the not-found response", () => {
    expect(isReservedSeoAppPath("admin/members")).toBe(true);
    expect(isReservedSeoAppPath("login")).toBe(true);
    expect(isReservedSeoAppPath("search")).toBe(true);
    expect(isReservedSeoAppPath("walks")).toBe(true);
    expect(isReservedSeoAppPath("social")).toBe(true);
    expect(isReservedSeoAppPath("walks/add")).toBe(true);
    expect(isReservedSeoAppPath("walks/my-walks")).toBe(true);
    expect(isReservedSeoAppPath("walks/abc123/edit")).toBe(true);
    expect(isReservedSeoAppPath("home")).toBe(true);
    expect(isReservedSeoAppPath("committee/minutes/unsubscribe")).toBe(true);
    expect(isReservedSeoAppPath("home/extra")).toBe(false);
    expect(isReservedSeoAppPath("search/extra")).toBe(false);
  });

  it("does not treat unknown public pages as reserved app routes", () => {
    expect(isReservedSeoAppPath("this-page-does-not-exist-xyz")).toBe(false);
    expect(isReservedSeoAppPath("walks/missing-walk-slug")).toBe(false);
    expect(isReservedSeoAppPath("social/missing-event-slug")).toBe(false);
    expect(isReservedSeoAppPath("how-to/committee/missing")).toBe(false);
  });

  it("honours configured walk and social list roots", () => {
    const roots = eventListRootsFrom({walksBasePath: "/our-walks/", socialEventsBasePath: "events"} as Organisation);
    expect(roots).toEqual(expect.arrayContaining(["our-walks", "events", "walks", "social"]));
    expect(isReservedSeoAppPath("our-walks", roots)).toBe(true);
    expect(isReservedSeoAppPath("events", roots)).toBe(true);
    expect(isReservedSeoAppPath("our-walks/add", roots)).toBe(true);
  });

  it("describes a missing page as a not-found response crawlers should ignore", () => {
    expect(missingPageSeoDescriptor()).toEqual({
      title: "Page not found",
      description: "",
      contentHtml: "",
      robots: "noindex",
      httpStatus: 404
    });
  });

  it("redirects an object-id walk address to the slug address", () => {
    const event = {
      id: "64b7f0c2e1a2b3c4d5e6f708",
      groupEvent: {url: "https://example.org/walks/chilham-circular", item_type: RamblersEventType.GROUP_WALK}
    } as unknown as ExtendedGroupEvent;
    expect(eventRedirectTarget("walks/64b7f0c2e1a2b3c4d5e6f708", event, {} as Organisation))
      .toEqual("/walks/chilham-circular");
  });

  it("redirects a social event filed under walks to the social address", () => {
    const event = {
      id: "abc123",
      groupEvent: {url: "christmas-meal", item_type: RamblersEventType.GROUP_EVENT}
    } as unknown as ExtendedGroupEvent;
    expect(eventRedirectTarget("walks/christmas-meal", event, {} as Organisation)).toEqual("/social/christmas-meal");
  });

  it("does not redirect when the request is already the official address", () => {
    const event = {
      id: "abc123",
      groupEvent: {url: "chilham-circular", item_type: RamblersEventType.GROUP_WALK}
    } as unknown as ExtendedGroupEvent;
    expect(eventRedirectTarget("walks/chilham-circular", event, {} as Organisation)).toBeNull();
  });

  it("only treats a real slug as publicly indexable", () => {
    expect(eventHasIndexablePublicSlug({
      groupEvent: {url: "https://example.org/walks/chilham-circular"}
    } as unknown as ExtendedGroupEvent)).toBe(true);
    expect(eventHasIndexablePublicSlug({
      id: "64b7f0c2e1a2b3c4d5e6f708",
      groupEvent: {url: "64b7f0c2e1a2b3c4d5e6f708"}
    } as unknown as ExtendedGroupEvent)).toBe(false);
    expect(eventHasIndexablePublicSlug({
      id: "64b7f0c2e1a2b3c4d5e6f708",
      groupEvent: {url: null}
    } as unknown as ExtendedGroupEvent)).toBe(false);
  });

  it("collapses /home onto the site root", () => {
    expect(homeRedirectTarget("/home")).toEqual("/");
    expect(homeRedirectTarget("/home/")).toEqual("/");
    expect(homeRedirectTarget("/")).toBeNull();
    expect(homeRedirectTarget("/contact-us")).toBeNull();
  });
});
