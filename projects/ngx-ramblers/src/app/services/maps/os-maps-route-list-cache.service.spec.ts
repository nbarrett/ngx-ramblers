import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemberLoginService } from "../member/member-login.service";
import { OsMapsAccountScope, OsMapsRouteListing } from "../../models/os-maps-export.model";
import { StoredValue } from "../../models/ui-actions";
import { OsMapsRouteListCacheService } from "./os-maps-route-list-cache.service";

describe("OS Maps route list cache", () => {
  const member = {loggedInMember: () => ({memberId: "member-admin"})};

  beforeEach(() => {
    window.sessionStorage.clear();
    TestBed.configureTestingModule({providers: [
      {provide: MemberLoginService, useValue: member}
    ]});
  });

  afterEach(() => {
    window.sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it("returns a saved listing for the current member and account", () => {
    const cache = TestBed.inject(OsMapsRouteListCacheService);
    const listing = {listedAt: 9, routes: [{id: "route-one", title: "Hillside Park"}]} as OsMapsRouteListing;
    cache.save(OsMapsAccountScope.GROUP, listing);
    expect(cache.snapshot(OsMapsAccountScope.GROUP)).toEqual(listing);
    expect(cache.snapshot(OsMapsAccountScope.PERSONAL)).toBeNull();
  });

  it("restores a listing from session storage after a new service instance", () => {
    const first = TestBed.inject(OsMapsRouteListCacheService);
    first.save(OsMapsAccountScope.GROUP, {listedAt: 4, routes: []});
    expect(window.sessionStorage.getItem(StoredValue.OS_MAPS_ROUTE_LIST_CACHE)).toContain("member-admin");
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [
      {provide: MemberLoginService, useValue: member}
    ]});
    expect(TestBed.inject(OsMapsRouteListCacheService).snapshot(OsMapsAccountScope.GROUP)).toEqual({listedAt: 4, routes: []});
  });

  it("does not return another member's stored listing", () => {
    TestBed.inject(OsMapsRouteListCacheService).save(OsMapsAccountScope.GROUP, {listedAt: 4, routes: []});
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [
      {provide: MemberLoginService, useValue: {loggedInMember: () => ({memberId: "someone-else"})}}
    ]});
    expect(TestBed.inject(OsMapsRouteListCacheService).snapshot(OsMapsAccountScope.GROUP)).toBeNull();
  });
});
