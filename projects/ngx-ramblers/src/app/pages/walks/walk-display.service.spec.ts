import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
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
import { EventPopulation, Organisation } from "../../models/system.model";
import { LocationDetails, RamblersEventType, WalkStatus } from "../../models/ramblers-walks-manager";
import { GroupEventService } from "../../services/walks-and-events/group-event.service";
import { EventType } from "../../models/walk.model";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { SearchFilterPipe } from "../../pipes/search-filter.pipe";
import { DateUtilsService } from "../../services/date-utils.service";
const anyWalkDate = 123364;
const walkLeaderMemberId = "walk-leader-id";
const dontCare = [];

const googleConfig = {
  getConfig: () => {
  }
};

const meetupService = {
  config: () => Promise.resolve(),
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

export function createExtendedGroupEvent(dateUtilsService: DateUtilsService, dateValue: number, expectedEvent: any, walkLeaderMemberId: string, startLocation?: LocationDetails) {
  return {
    fields: {
      contactDetails: {
        email: "",
        contactId: "",
        memberId: walkLeaderMemberId,
        displayName: "",
        phone: ""
      },
      attendees: [],
      links: [],
      meetup: null,
      milesPerHour: 0,
      notifications: [],
      publishing: null,
      riskAssessment: []
    },
    groupEvent: {
      item_type: RamblersEventType.GROUP_WALK,
      start_date_time: dateUtilsService.isoDateTimeString(dateValue),
      title: "",
      group_code: "",
      area_code: "",
      group_name: "",
      description: "",
      additional_details: "",
      end_date_time: "",
      meeting_date_time: "",
      start_location: startLocation,
      meeting_location: null,
      end_location: null,
      distance_km: 0,
      distance_miles: 0,
      ascent_feet: 0,
      ascent_metres: 0,
      difficulty: null,
      shape: "",
      duration: 0,
      walk_leader: null,
      url: "",
      external_url: "",
      status: WalkStatus.DRAFT,
      cancellation_reason: "",
      accessibility: [],
      facilities: [],
      transport: [],
      media: [],
      linked_event: "",
      date_created: "",
      date_updated: ""
    },
    events: [expectedEvent]
  };
}

describe("WalkDisplayService", () => {
  let spy: jasmine.Spy<any>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule,
        RouterTestingModule],
      providers: [
        AuditDeltaChangedItemsPipePipe,
        FullNameWithAliasPipe,
        FullNamePipe,
        AuditDeltaValuePipe,
        SearchFilterPipe,
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
        {provide: "MemberService", useValue: memberService},
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
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
      const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      service.group = {walkPopulation: EventPopulation.LOCAL} as Organisation;
      expect(service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, anyWalkDate, dontCare, "any-walk-id")))
        .toEqual(WalksReferenceService.walkAccessModes.edit);
    });

    it("should return edit if user is logged in and not admin but is leader", () => {
      spy = spyOn(memberLoginService, "memberLoggedIn").and.returnValue(true);
      spy = spyOn(memberLoginService, "allowWalkAdminEdits").and.returnValue(false);
      spy = spyOn(memberLoginService, "loggedInMember").and.returnValue({memberId: "leader-id"} as any);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
      service.group = {walkPopulation: EventPopulation.LOCAL} as Organisation;
      expect(service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, anyWalkDate, dontCare, "leader-id")))
        .toEqual(WalksReferenceService.walkAccessModes.edit);
    });

    it("should return lead if user is logged in and not admin and walk doest have a leader", () => {
      spy = spyOn(memberLoginService, "memberLoggedIn").and.returnValue(true);
      spy = spyOn(memberLoginService, "allowWalkAdminEdits").and.returnValue(false);
      spy = spyOn(memberLoginService, "loggedInMember").and.returnValue({memberId: "leader-id"} as any);
      const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      const expectedEvent: any = {eventType: EventType.AWAITING_LEADER};
      service.group = {walkPopulation: EventPopulation.LOCAL} as Organisation;
      const dateValue = 0;
      expect(service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, dateValue, expectedEvent, walkLeaderMemberId)))
        .toEqual(WalksReferenceService.walkAccessModes.lead);
    });

    it("should return view if user is not logged in", () => {
      spy = spyOn(memberLoginService, "memberLoggedIn").and.returnValue(false);
      spy = spyOn(memberLoginService, "allowWalkAdminEdits").and.returnValue(false);
      const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      expect(service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, anyWalkDate, dontCare, walkLeaderMemberId)))
        .toEqual(WalksReferenceService.walkAccessModes.view);
    });

    it("should return view if user is not member admin and not leading the walk", () => {
      spy = spyOn(memberLoginService, "memberLoggedIn").and.returnValue(true);
      spy = spyOn(memberLoginService, "allowWalkAdminEdits").and.returnValue(false);
      spy = spyOn(memberLoginService, "loggedInMember").and.returnValue({memberId: "leader-id"} as any);
      const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
      const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
      const walkEventService = TestBed.inject(GroupEventService);
      spyOn(service, "walkPopulationLocal").and.returnValue(true);
      spyOn(walkEventService, "latestEvent").and.returnValue({
        eventType: EventType.APPROVED,
        data: undefined,
        date: 0,
        memberId: ""
      });
      const actual = service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, anyWalkDate, dontCare, "another-walk-leader-id"));
      // console.log("actual", JSON.stringify(actual));
      expect(actual).toEqual(WalksReferenceService.walkAccessModes.view);
    });
  });

});
