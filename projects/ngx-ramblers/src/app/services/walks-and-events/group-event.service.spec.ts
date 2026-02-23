import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { cloneDeep } from "es-toolkit/compat";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { StringUtilsService } from "../string-utils.service";
import { GroupEventService } from "./group-event.service";
import { createExtendedGroupEvent } from "../../pages/walks/walk-display.service.spec";
import { DateUtilsService } from "../date-utils.service";
import { EventType, GroupEventField } from "../../models/walk.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { WalksConfigService } from "../system/walks-config.service";

const memberLoginServiceStub = {
  memberLoggedIn: () => true,
  loggedInMember: () => ({memberId: "member-id"}),
  allowWalkAdminEdits: () => true
};

const walksConfigServiceStub = {
  walksConfig: () => ({milesPerHour: 2.13}),
  events: () => ({
    pipe: () => ({
      subscribe: () => {
      }
    })
  }),
  refresh: () => Promise.resolve()
};

describe("GroupEventService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule, RouterTestingModule],
      providers: [
        AuditDeltaChangedItemsPipePipe,
        StringUtilsService,
        DateUtilsService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {provide: "MemberService", useValue: memberLoginServiceStub},
        {provide: "MemberAuditService", useValue: {}},
        {provide: "MemberLoginService", useValue: memberLoginServiceStub},
        {provide: WalksConfigService, useValue: walksConfigServiceStub}
      ]
    });
  });

  function walkWithContact(contactId: string | null): ExtendedGroupEvent {
    const dateUtils = TestBed.inject(DateUtilsService);
    const base = createExtendedGroupEvent(dateUtils, 12, [], "walk-id", {
      latitude: 0,
      longitude: 0,
      grid_reference_6: "",
      grid_reference_8: "",
      grid_reference_10: "",
      postcode: "TN1 1AA",
      description: "start",
      w3w: ""
    });
    base.fields.contactDetails.memberId = "member-id";
    base.fields.contactDetails.displayName = "Leader";
    base.fields.contactDetails.email = "leader@example.com";
    base.fields.contactDetails.phone = "01234";
    base.fields.contactDetails.contactId = contactId;
    base.fields.publishing = base.fields.publishing || {ramblers: {}, meetup: {}};
    base.fields.publishing.ramblers = base.fields.publishing.ramblers || {};
    base.fields.publishing.ramblers.contactName = contactId;
    return base;
  }

  function walkEventFromFullDeepCopy(event: ExtendedGroupEvent) {
    const eventData = JSON.parse(JSON.stringify(event)) as ExtendedGroupEvent;
    return {eventType: EventType.AWAITING_APPROVAL, memberId: "member-id", date: 1, data: eventData};
  }

  it("treats missing contactId and null contactId as equal", () => {
    const service = TestBed.inject(GroupEventService);
    const previousWalk = walkWithContact(null);
    const currentWalk = walkWithContact(null);
    currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
    const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
    expect(audit.changedItems.find(item => item.fieldName === "fields.contactDetails")).toBeUndefined();
  });

  it("treats equivalent ISO timestamps as unchanged", () => {
    const service = TestBed.inject(GroupEventService);
    const dateUtils = TestBed.inject(DateUtilsService);
    const previousWalk = walkWithContact(null);
    previousWalk.groupEvent.start_date_time = "2025-11-02T00:00:00Z";
    const currentWalk = walkWithContact(null);
    currentWalk.groupEvent.start_date_time = "2025-11-02T00:00:00+00:00";
    currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
    const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
    expect(audit.changedItems.find(item => item.fieldName === GroupEventField.START_DATE)).toBeUndefined();
  });

  it("treats trimmed description and additional details as unchanged", () => {
    const service = TestBed.inject(GroupEventService);
    const previousWalk = walkWithContact(null);
    previousWalk.groupEvent.description = "Walk description";
    previousWalk.groupEvent.additional_details = "Additional details";
    const currentWalk = walkWithContact(null);
    currentWalk.groupEvent.description = "  Walk description  ";
    currentWalk.groupEvent.additional_details = "\nAdditional details\n";
    currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
    const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
    expect(audit.changedItems.find(item => item.fieldName === "groupEvent.description")).toBeUndefined();
    expect(audit.changedItems.find(item => item.fieldName === "groupEvent.additional_details")).toBeUndefined();
  });

  it("treats walk leader empty telephone and null as unchanged", () => {
    const service = TestBed.inject(GroupEventService);
    const previousWalk = walkWithContact(null);
    previousWalk.groupEvent.walk_leader = {
      name: "Oli P",
      telephone: "",
      has_email: true,
      is_overridden: true,
      email_form: "mailto:oliver.parkes@hotmail.co.uk"
    };
    const currentWalk = walkWithContact(null);
    currentWalk.groupEvent.walk_leader = {
      name: "Oli P",
      telephone: null,
      has_email: true,
      is_overridden: true,
      email_form: "mailto:oliver.parkes@hotmail.co.uk"
    };
    currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
    const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
    expect(audit.changedItems.find(item => item.fieldName === "groupEvent.walk_leader")).toBeUndefined();
  });

  it("treats links with omitted optional title and undefined title as unchanged", () => {
    const service = TestBed.inject(GroupEventService);
    const previousWalk = walkWithContact(null);
    previousWalk.fields.links = [{
      source: "venue",
      href: "https://maps.google.co.uk/maps?q=HP23 6AR",
      title: undefined
    } as any];
    const currentWalk = walkWithContact(null);
    currentWalk.fields.links = [{
      source: "venue",
      href: "https://maps.google.co.uk/maps?q=HP23 6AR"
    } as any];
    currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
    const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
    expect(audit.changedItems.find(item => item.fieldName === "fields.links")).toBeUndefined();
  });

  describe("venue isMeetingPlace change detection", () => {
    function walkWithVenue(isMeetingPlace: boolean): ExtendedGroupEvent {
      const dateUtils = TestBed.inject(DateUtilsService);
      const base = createExtendedGroupEvent(dateUtils, 12, [], "walk-id", {
        latitude: 0,
        longitude: 0,
        grid_reference_6: "",
        grid_reference_8: "",
        grid_reference_10: "",
        postcode: "TN1 1AA",
        description: "start",
        w3w: ""
      }) as ExtendedGroupEvent;
      (base.fields as any).venue = {
        type: "PUB",
        name: "Test Venue",
        postcode: "TN1 1AA",
        isMeetingPlace: isMeetingPlace,
        venuePublish: false
      };
      return base;
    }

    it("detects change when isMeetingPlace changes from false to true", () => {
      const service = TestBed.inject(GroupEventService);
      const previousWalk = walkWithVenue(false);
      const currentWalk = walkWithVenue(true);
      currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
      const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
      const venueChange = audit.changedItems.find(item => item.fieldName === "fields.venue");
      expect(venueChange).toBeDefined();
      expect(audit.dataChanged).toBeTrue();
    });

    it("detects change when isMeetingPlace changes from true to false", () => {
      const service = TestBed.inject(GroupEventService);
      const previousWalk = walkWithVenue(true);
      const currentWalk = walkWithVenue(false);
      currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
      const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
      const venueChange = audit.changedItems.find(item => item.fieldName === "fields.venue");
      expect(venueChange).toBeDefined();
      expect(audit.dataChanged).toBeTrue();
    });

    it("does not detect change when isMeetingPlace stays the same", () => {
      const service = TestBed.inject(GroupEventService);
      const previousWalk = walkWithVenue(false);
      const currentWalk = walkWithVenue(false);
      currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
      const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
      const venueChange = audit.changedItems.find(item => item.fieldName === "fields.venue");
      expect(venueChange).toBeUndefined();
    });

    it("changedItemsBetween returns empty array for changes in non-audited fields", () => {
      const service = TestBed.inject(GroupEventService);
      const currentData = {isMeetingPlace: true, name: "Test"};
      const previousData = {isMeetingPlace: false, name: "Test"};
      const changedItems = service.changedItemsBetween(currentData, previousData);
      expect(changedItems.length).toBe(0);
    });

    it("detects change when isMeetingPlace changes from undefined to false", () => {
      const service = TestBed.inject(GroupEventService);
      const dateUtils = TestBed.inject(DateUtilsService);
      const base = createExtendedGroupEvent(dateUtils, 12, [], "walk-id", {
        latitude: 0,
        longitude: 0,
        grid_reference_6: "",
        grid_reference_8: "",
        grid_reference_10: "",
        postcode: "TN1 1AA",
        description: "start",
        w3w: ""
      }) as ExtendedGroupEvent;

      const previousWalk = cloneDeep(base) as ExtendedGroupEvent;
      (previousWalk.fields as any).venue = {
        type: "PUB",
        name: "Test Venue",
        postcode: "TN1 1AA",
        venuePublish: false
      };

      const currentWalk = cloneDeep(base) as ExtendedGroupEvent;
      (currentWalk.fields as any).venue = {
        type: "PUB",
        name: "Test Venue",
        postcode: "TN1 1AA",
        isMeetingPlace: false,
        venuePublish: false
      };
      currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];

      const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
      const venueChange = audit.changedItems.find(item => item.fieldName === "fields.venue");

      expect(venueChange).toBeDefined();
      expect(audit.dataChanged).toBeTrue();
    });
  });
});
