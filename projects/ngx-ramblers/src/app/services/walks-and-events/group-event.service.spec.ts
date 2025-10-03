import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { StringUtilsService } from "../string-utils.service";
import { GroupEventService } from "./group-event.service";
import { createExtendedGroupEvent } from "../../pages/walks/walk-display.service.spec";
import { DateUtilsService } from "../date-utils.service";
import { EventType } from "../../models/walk.model";
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
    expect(audit.changedItems.find(item => item.fieldName === "groupEvent.start_date_time")).toBeUndefined();
  });
});
