import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { MeetupEventResponse } from "../../models/meetup-event-response.model";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { AuditDeltaValuePipe } from "../../pipes/audit-delta-value.pipe";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../../pipes/member-id-to-full-name.pipe";
import { ValueOrDefaultPipe } from "../../pipes/value-or-default.pipe";
import { GoogleMapsService } from "../../services/google-maps.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { WalksReferenceService } from "../../services/walks/walks-reference-data.service";
import { WalkDisplayService } from "./walk-display.service";

const anyWalkDate = 123364;
const walkLeaderMemberId = "walk-leader-id";
const dontCare = [];

const googleConfig = {
  getConfig: () => {
  }
};

const meetupService = {
  config: () => Promise.resolve(),
  eventsForStatus: () => Promise.resolve([] as MeetupEventResponse[])
};

const memberLoginService = {
  memberLoggedIn: () => false,
  loggedInMember: () => {
  },
  allowWalkAdminEdits: () => false
};

const memberService = {
  allLimitedFields: () => Promise.resolve({email: "test@example.com"}),
  filterFor: {GROUP_MEMBERS: ""}
};

describe("WalkDisplayService", () => {
  let spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        LoggerTestingModule,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        AuditDeltaChangedItemsPipePipe,
        FullNameWithAliasPipe,
        FullNamePipe,
        AuditDeltaValuePipe,
        DisplayDatePipe,
        MemberIdToFullNamePipe,
        ValueOrDefaultPipe,
        GoogleMapsService,
        {provide: MemberLoginService, useValue: memberLoginService},
        {provide: "MemberAuditService", useValue: {}},
        {provide: "WalkNotificationService", useValue: {}},
        {provide: "MailchimpSegmentService", useValue: {}},
        {provide: "MailchimpConfigDocument", useValue: {}},
        {provide: "MailchimpCampaignService", useValue: {}},
        {provide: "MeetupService", useValue: meetupService},
        {provide: "ClipboardService", useValue: {}},
        {provide: "MemberService", useValue: memberService}
      ]
    });
    const emptyPromise = Promise.resolve({}) as any;
    spy = spyOn(googleConfig, "getConfig").and.returnValue(emptyPromise);
  });

  describe("toWalkAccessMode", () => {
    it("should return edit if user is logged in and admin", () => {
      spy = spyOn(memberLoginService, "memberLoggedIn").and.returnValue(true);
      spy = spyOn(memberLoginService, "allowWalkAdminEdits").and.returnValue(true);
      const val = {memberId: "some-other-id"} as any;
      spy = spyOn(memberLoginService, "loggedInMember").and.returnValue(val);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      expect(service.toWalkAccessMode({walkLeaderMemberId: "any-walk-id", events: dontCare, walkDate: anyWalkDate})).toEqual(WalksReferenceService.walkAccessModes.edit);
    });

    it("should return edit if user is logged in and not admin but is leader", () => {
      spy = spyOn(memberLoginService, "memberLoggedIn").and.returnValue(true);
      spy = spyOn(memberLoginService, "allowWalkAdminEdits").and.returnValue(false);
      spy = spyOn(memberLoginService, "loggedInMember").and.returnValue({memberId: "leader-id"} as any);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      expect(service.toWalkAccessMode({walkLeaderMemberId: "leader-id", events: dontCare, walkDate: anyWalkDate})).toEqual(WalksReferenceService.walkAccessModes.edit);
    });

    it("should return lead if user is logged in and not admin and walk doest have a leader", () => {
      spy = spyOn(memberLoginService, "memberLoggedIn").and.returnValue(true);
      spy = spyOn(memberLoginService, "allowWalkAdminEdits").and.returnValue(false);
      spy = spyOn(memberLoginService, "loggedInMember").and.returnValue({memberId: "leader-id"} as any);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      expect(service.toWalkAccessMode({events: dontCare, walkDate: 0})).toEqual(WalksReferenceService.walkAccessModes.lead);
    });

    it("should return view if user is not logged in", () => {
      spy = spyOn(memberLoginService, "memberLoggedIn").and.returnValue(false);
      spy = spyOn(memberLoginService, "allowWalkAdminEdits").and.returnValue(false);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      expect(service.toWalkAccessMode({walkLeaderMemberId, events: dontCare, walkDate: anyWalkDate})).toEqual(WalksReferenceService.walkAccessModes.view);
    });

    it("should return view if user is not member admin and not leading the walk", () => {
      spy = spyOn(memberLoginService, "memberLoggedIn").and.returnValue(true);
      spy = spyOn(memberLoginService, "allowWalkAdminEdits").and.returnValue(false);
      spy = spyOn(memberLoginService, "loggedInMember").and.returnValue({memberId: "leader-id"} as any);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      expect(service.toWalkAccessMode({walkLeaderMemberId: "another-walk-leader-id", events: dontCare, walkDate: anyWalkDate})).toEqual(WalksReferenceService.walkAccessModes.view);
    });
  });

});
