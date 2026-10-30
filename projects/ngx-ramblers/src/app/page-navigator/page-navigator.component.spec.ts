import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { AdminPath } from "../models/admin-route-paths.model";
import { AccessLevel } from "../models/member-resource.model";
import { Link } from "../models/page.model";
import { AccessLevelService } from "../services/access-level.service";
import { BroadcastService } from "../services/broadcast-service";
import { MobileAppAccessService } from "../services/maps/mobile-app-access.service";
import { NgxLiteService } from "../services/ngx-lite.service";
import { PageService } from "../services/page.service";
import { UrlService } from "../services/url.service";
import { PageNavigatorComponent } from "./page-navigator.component";

describe("automatic inbox navigation", () => {
  const state = {committee: true, pages: [] as Link[]};

  beforeEach(() => {
    state.committee = true;
    state.pages = [{href: "", title: "Home"}, {href: "admin", title: "Admin", accessLevel: AccessLevel.COMMITTEE}];
    TestBed.configureTestingModule({
      imports: [PageNavigatorComponent, LoggerTestingModule],
      providers: [
        provideRouter([]),
        {provide: BroadcastService, useValue: {}},
        {provide: PageService, useValue: {group: state}},
        {provide: UrlService, useValue: {}},
        {provide: MobileAppAccessService, useValue: {allowed: () => false}},
        {provide: NgxLiteService, useValue: {ngxLite: false}},
        {provide: AccessLevelService, useValue: {hasAccess: (link: Link) => link.accessLevel !== AccessLevel.COMMITTEE || state.committee}}
      ]
    });
  });

  it("keeps the navbar to System Config pages and offers Inbox only in the mobile menu for committee members", () => {
    const component = TestBed.createComponent(PageNavigatorComponent).componentInstance;
    expect(component.pages().some(page => page.href?.includes("inbox"))).toBe(false);
    expect(component.showMobileInbox()).toBe(true);
    state.committee = false;
    expect(component.showMobileInbox()).toBe(false);
  });

  it("does not add a mobile Inbox item when Inbox is already a navbar page", () => {
    state.pages = [...state.pages, {href: AdminPath.INBOX, title: "Inbox", accessLevel: AccessLevel.COMMITTEE}];
    const component = TestBed.createComponent(PageNavigatorComponent).componentInstance;
    expect(component.pages().filter(page => page.href === AdminPath.INBOX).length).toBe(1);
    expect(component.showMobileInbox()).toBe(false);
  });

  it("highlights a configured Inbox page for a bookmarked thread and Admin for other admin screens", () => {
    state.pages = [...state.pages, {href: AdminPath.INBOX, title: "Inbox", accessLevel: AccessLevel.COMMITTEE}];
    const component = TestBed.createComponent(PageNavigatorComponent).componentInstance;
    const router = TestBed.inject(Router);
    vi.spyOn(router, "url", "get").mockReturnValue("/admin/inbox?thread=walk-enquiry&mailbox-view=sent");
    expect(component.pages().filter(page => component.isOnPage(page)).map(page => page.title)).toEqual(["Inbox"]);
    vi.spyOn(router, "url", "get").mockReturnValue("/admin/member-admin");
    expect(component.pages().filter(page => component.isOnPage(page)).map(page => page.title)).toEqual(["Admin"]);
  });

  it("selects the mobile Inbox item instead of Admin while reading mail", () => {
    const component = TestBed.createComponent(PageNavigatorComponent).componentInstance;
    const router = TestBed.inject(Router);
    vi.spyOn(router, "url", "get").mockReturnValue("/admin/inbox?thread=walk-enquiry");
    expect(component.isOnPage(component.inboxLink)).toBe(true);
    expect(component.isOnPage(component.pages().find(page => page.title === "Admin"))).toBe(false);
    expect(component.pages().filter(page => component.isOnPage(page)).map(page => page.title)).toEqual([]);
    vi.spyOn(router, "url", "get").mockReturnValue("/admin/member-admin");
    expect(component.isOnPage(component.inboxLink)).toBe(false);
    expect(component.pages().filter(page => component.isOnPage(page)).map(page => page.title)).toEqual(["Admin"]);
  });
});
