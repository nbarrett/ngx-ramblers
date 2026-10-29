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

  it("provides Inbox without a configured menu entry and removes manual duplicates", () => {
    const component = TestBed.createComponent(PageNavigatorComponent).componentInstance;
    expect(component.pages().filter(page => page.href === AdminPath.INBOX).length).toBe(1);
    state.pages = [...state.pages, {href: "/admin/inbox/", title: "Old inbox", accessLevel: AccessLevel.PUBLIC}];
    expect(component.pages().filter(page => page.href?.includes("inbox"))).toEqual([
      {href: AdminPath.INBOX, title: "Inbox", accessLevel: AccessLevel.COMMITTEE}
    ]);
    state.committee = false;
    expect(component.pages().some(page => page.href?.includes("inbox"))).toBe(false);
  });

  it("highlights Inbox alone for a bookmarked thread and Admin for other admin screens", () => {
    const component = TestBed.createComponent(PageNavigatorComponent).componentInstance;
    const router = TestBed.inject(Router);
    vi.spyOn(router, "url", "get").mockReturnValue("/admin/inbox?thread=walk-enquiry&mailbox-view=sent");
    expect(component.pages().filter(page => component.isOnPage(page)).map(page => page.title)).toEqual(["Inbox"]);
    vi.spyOn(router, "url", "get").mockReturnValue("/admin/member-admin");
    expect(component.pages().filter(page => component.isOnPage(page)).map(page => page.title)).toEqual(["Admin"]);
  });
});
