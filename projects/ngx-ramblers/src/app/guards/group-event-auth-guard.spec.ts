import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, convertToParamMap, Router } from "@angular/router";
import { GroupEventAuthGuard } from "./group-event-auth-guard";
import { MemberLoginService } from "../services/member/member-login.service";
import { PageService } from "../services/page.service";
import { WalksAndEventsService } from "../services/walks-and-events/walks-and-events.service";
import { GroupEventDisplayService } from "../pages/group-events/group-event-display.service";
import { RamblersEventType } from "../models/ramblers-walks-manager";
import { RouteParam } from "../models/content-text.model";
import { ExtendedGroupEvent } from "../models/group-event.model";

describe("social event organiser editing", () => {
  const login = {
    memberLoggedIn: vi.fn(),
    loggedInMember: () => ({memberId: "organiser-one"}),
    allowSocialAdminEdits: vi.fn()
  };
  const events = {queryById: vi.fn()};
  const fallback = {};
  const display = Object.create(GroupEventDisplayService.prototype) as GroupEventDisplayService;

  beforeEach(() => {
    login.memberLoggedIn.mockReturnValue(true);
    login.allowSocialAdminEdits.mockReturnValue(false);
    events.queryById.mockReset();
    display["memberLoginService"] = login as unknown as MemberLoginService;
    TestBed.configureTestingModule({providers: [
      {provide: MemberLoginService, useValue: login},
      {provide: PageService, useValue: {groupEventPage: () => ({href: "/social"})}},
      {provide: Router, useValue: {parseUrl: () => fallback}},
      {provide: WalksAndEventsService, useValue: events},
      {provide: GroupEventDisplayService, useValue: display}
    ]});
  });

  function event(memberId: string): ExtendedGroupEvent {
    return {groupEvent: {item_type: RamblersEventType.GROUP_EVENT, event_organiser: {id: memberId}}} as ExtendedGroupEvent;
  }

  async function access(identifier: string | null = "event-one") {
    const route = {paramMap: convertToParamMap(identifier ? {[RouteParam.ID]: identifier} : {})} as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => GroupEventAuthGuard(route));
  }

  it("allows the organiser identified by the event contact", async () => {
    events.queryById.mockResolvedValue(event("organiser-one"));
    expect(await access()).toBe(true);
  });

  it("allows the linked member when an imported contact identifier differs", async () => {
    events.queryById.mockResolvedValue({...event("external-contact"), fields: {contactDetails: {memberId: "organiser-one"}}});
    expect(await access()).toBe(true);
  });

  it("denies other members and ignores a stale walk leader on a social event", async () => {
    events.queryById.mockResolvedValue({groupEvent: {...event("organiser-two").groupEvent, walk_leader: {id: "organiser-one"}}});
    expect(await access()).toBe(fallback);
  });

  it("denies guests without fetching the event", async () => {
    login.memberLoggedIn.mockReturnValue(false);
    expect(await access()).toBe(fallback);
    expect(events.queryById).not.toHaveBeenCalled();
  });

  it("keeps creating events restricted to admins", async () => {
    expect(await access(null)).toBe(fallback);
    login.allowSocialAdminEdits.mockReturnValue(true);
    expect(await access(null)).toBe(true);
  });

  it("denies access when the event cannot be loaded", async () => {
    events.queryById.mockRejectedValue(new Error("Unavailable"));
    expect(await access()).toBe(fallback);
  });
});
