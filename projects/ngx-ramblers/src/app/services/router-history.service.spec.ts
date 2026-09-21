import { TestBed } from "@angular/core/testing";
import { NavigationEnd, Router } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { Subject } from "rxjs";
import { PageService } from "./page.service";
import { RouterHistoryService } from "./router-history.service";
import { UrlService } from "./url.service";

describe("RouterHistoryService app navigation", () => {
  const state = {
    events: new Subject<NavigationEnd>(),
    router: {url: "/app", navigateByUrl: vi.fn()}
  };

  beforeEach(() => {
    state.events = new Subject<NavigationEnd>();
    state.router = {url: "/app", navigateByUrl: vi.fn().mockResolvedValue(true)};
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        RouterHistoryService,
        {provide: Router, useValue: {...state.router, events: state.events}},
        {provide: PageService, useValue: {group: {pages: []}}},
        {provide: UrlService, useValue: {navigateTo: vi.fn(), navigateUnconditionallyTo: vi.fn()}}
      ]
    });
  });

  it("uses Walks as the back destination after a direct launch", () => {
    const service = TestBed.inject(RouterHistoryService);
    expect(service.appBackDestination()).toBe("/app");
    service.navigateBackWithinApp();
    expect(state.router.navigateByUrl).toHaveBeenCalledWith("/app");
  });

  it("walks backwards through in-app pages without bouncing forwards", () => {
    const service = TestBed.inject(RouterHistoryService);
    const router = TestBed.inject(Router);
    state.events.next(new NavigationEnd(1, "/app", "/app"));
    state.events.next(new NavigationEnd(2, "/app/follow", "/app/follow"));
    state.events.next(new NavigationEnd(3, "/walks/a", "/walks/a"));
    Object.assign(router, {url: "/walks/a"});
    expect(service.appBackDestination()).toBe("/app/follow");
    service.navigateBackWithinApp();
    state.events.next(new NavigationEnd(4, "/app/follow", "/app/follow"));
    Object.assign(router, {url: "/app/follow"});
    expect(service.appBackDestination()).toBe("/app");
    service.navigateBackWithinApp();
    expect(state.router.navigateByUrl).toHaveBeenNthCalledWith(1, "/app/follow");
    expect(state.router.navigateByUrl).toHaveBeenNthCalledWith(2, "/app");
  });

  it("does not return to a follow screen after Close", () => {
    const service = TestBed.inject(RouterHistoryService);
    const router = TestBed.inject(Router);
    state.events.next(new NavigationEnd(1, "/app", "/app"));
    state.events.next(new NavigationEnd(2, "/app/follow", "/app/follow"));
    Object.assign(router, {url: "/app/follow"});
    service.forgetCurrentPage();
    state.events.next(new NavigationEnd(3, "/walks/a", "/walks/a"));
    Object.assign(router, {url: "/walks/a"});
    expect(service.appBackDestination()).toBe("/app");
  });
});
