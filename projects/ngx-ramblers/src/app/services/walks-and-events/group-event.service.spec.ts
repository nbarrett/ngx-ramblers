import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { cloneDeep } from "es-toolkit/compat";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { StringUtilsService } from "../string-utils.service";
import { GroupEventService } from "./group-event.service";
import { DateUtilsService } from "../date-utils.service";
import { EventField, EventType, GroupEventField, LinkSource } from "../../models/walk.model";
import { ExtendedGroupEvent, InputSource } from "../../models/group-event.model";
import { WalksConfigService } from "../system/walks-config.service";
import { createExtendedGroupEvent } from "../../testing/create-extended-group-event";
import { AUDITED_FIELDS } from "../../models/walk-event.model";
import { WALK_NOTIFICATION_FIELDS } from "../../models/walk-notification-fields";
import { WalkNotificationValueService } from "./walk-notification-value.service";

const memberLoginServiceStub = {
    memberLoggedIn: () => true,
    loggedInMember: () => ({ memberId: "member-id" }),
    allowWalkAdminEdits: () => true
};

const walksConfigServiceStub = {
    walksConfig: () => ({ milesPerHour: 2.13 }),
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
                { provide: "MemberService", useValue: memberLoginServiceStub },
                { provide: "MemberAuditService", useValue: {} },
                { provide: "MemberLoginService", useValue: memberLoginServiceStub },
                { provide: WalksConfigService, useValue: walksConfigServiceStub }
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
        base.fields.publishing = base.fields.publishing || { ramblers: {}, meetup: {} };
        base.fields.publishing.ramblers = base.fields.publishing.ramblers || {};
        base.fields.publishing.ramblers.contactName = contactId;
        return base;
    }

    function walkEventFromFullDeepCopy(event: ExtendedGroupEvent) {
        const eventData = JSON.parse(JSON.stringify(event)) as ExtendedGroupEvent;
        return { eventType: EventType.AWAITING_APPROVAL, memberId: "member-id", date: 1, data: eventData };
    }

    it("treats missing contactId and null contactId as equal", () => {
        const service = TestBed.inject(GroupEventService);
        const previousWalk = walkWithContact(null);
        const currentWalk = walkWithContact(null);
        currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
        const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
      expect(audit.changedItems.find(item => item.field === EventField.CONTACT_DETAILS)).toBeUndefined();
    });

    it("configures a recipient-facing descriptor for every audited field", () => {
        expect(AUDITED_FIELDS.filter(fieldName => !WALK_NOTIFICATION_FIELDS[fieldName])).toEqual([]);
    });

  it("summarises changed contact details as one recipient-facing field", () => {
        const service = TestBed.inject(GroupEventService);
        const changedItems = service.changedItemsBetween({
            fields: {
                contactDetails: {
                    contactId: "Jane Bloggs",
                    displayName: "Jane B",
                    email: "jane@example.com",
                    memberId: "member-id"
                }
            }
        }, {
            fields: {
                contactDetails: {
                    displayName: "Jane A",
                    email: "jane@example.com",
                    memberId: "member-id"
                }
            }
        });
        const notificationChangedItems = service.notificationChangedItems(changedItems);

        expect(notificationChangedItems).toEqual([{
          field: EventField.CONTACT_DETAILS,
          label: "Leader contact details",
          from: "Jane A, jane@example.com",
          to: "Jane B, jane@example.com"
        }]);
    });

  it("summarises image changes without exposing URLs, dimensions or credits", () => {
    const service = TestBed.inject(GroupEventService);
    const changedItems = service.changedItemsBetween({
      groupEvent: {
        media: [{
          title: "Woodland path",
          alt: "Trees beside a path",
          credit: "Jane Smith",
          caption: "",
          styles: [{style: "large", url: "https://internal/new.jpg", width: 1200, height: 800}]
        }, {
          title: "View from the ridge",
          alt: "A view",
          credit: "Jane Smith",
          caption: "",
          styles: [{style: "large", url: "https://internal/ridge.jpg", width: 1200, height: 800}]
        }]
      }
    }, {
      groupEvent: {
        media: [{
          title: "Woodland path",
          alt: "Trees beside a path",
          credit: "Jane Smith",
          caption: "",
          styles: [{style: "large", url: "https://internal/old.jpg", width: 600, height: 400}]
        }]
      }
    });

    expect(service.notificationChangedItems(changedItems)).toEqual([{
      field: GroupEventField.MEDIA,
      label: "Walk images",
      from: "1 image: “Woodland path”, description “Trees beside a path”",
      to: "2 images: “Woodland path”, description “Trees beside a path”; “View from the ridge”, description “A view”"
    }]);
  });

  it("groups images with matching recipient-facing details", () => {
    const formatter = TestBed.inject(WalkNotificationValueService);

    const formatted = formatter.format(GroupEventField.MEDIA, [{
      title: "Circular walk",
      alt: "Circular walk"
    }, {
      title: "Circular walk",
      alt: "Circular walk"
    }, {
      title: "Circular walk",
      alt: "Circular walk"
    }, {
      title: "Castle view",
      alt: "Castle view"
    }]);

    expect(formatted).toBe("4 images: 3 × “Circular walk”; “Castle view”");
  });

    it("retains internal-only changes in the audit without requiring a recipient-facing change", () => {
        const service = TestBed.inject(GroupEventService);
        const previousWalk = walkWithContact(null);
        const currentWalk = walkWithContact(null);
        currentWalk.fields.contactDetails.contactId = "Jane Bloggs";
        currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];

        const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);

    expect(audit.changedItems.find(item => item.field === EventField.CONTACT_DETAILS)).toBeDefined();
        expect(audit.notificationChangedItems).toEqual([]);
        expect(audit.dataChanged).toBe(true);
    });

    it("suppresses technical history changes when their friendly summaries are identical", () => {
        const service = TestBed.inject(GroupEventService);
        const changedItems = [{
            field: EventField.RISK_ASSESSMENT,
            from: [{confirmed: true, riskAssessmentKey: "traffic"}],
            to: [{confirmed: true, riskAssessmentKey: "traffic", riskAssessmentSection: "Traffic"}]
        }];

        expect(service.describedChangedItems(changedItems)).toEqual([]);
        expect(service.notificationChangedItems(changedItems)).toEqual([]);
    });

    it("expresses date and time changes with both the date and time", () => {
    const formatter = TestBed.inject(WalkNotificationValueService);

    const formatted = formatter.format(GroupEventField.START_DATE, "2026-08-16T10:30:00+01:00");

    expect(formatted).toContain("Sunday, 16 August 2026");
    expect(formatted).toContain("10:30:00 am");
  });

  it("expresses locations without exposing coordinates", () => {
    const formatter = TestBed.inject(WalkNotificationValueService);

    const formatted = formatter.format(GroupEventField.START_LOCATION, {
      description: "Ashdown Forest car park",
      postcode: "TN22 3JD",
      grid_reference_8: "TQ 4567 3210",
      latitude: 51.0712,
      longitude: 0.0315,
      w3w: "walks.paths.views"
    });

    expect(formatted).toBe("Ashdown Forest car park, TN22 3JD, grid reference TQ 4567 3210, what3words walks.paths.views");
    expect(formatted).not.toContain("51.0712");
  });

  it("describes the generated local link as the group website", () => {
    const formatter = TestBed.inject(WalkNotificationValueService);

    const formatted = formatter.format(EventField.LINKS, [{
      source: LinkSource.LOCAL,
      title: "this walk",
      href: "/walks/example"
    }]);

    expect(formatted).toBe("Group website: link to this walk");
  });

  it("expresses expected walking speed in miles and kilometres per hour", () => {
    const formatter = TestBed.inject(WalkNotificationValueService);

    expect(formatter.format(EventField.MILES_PER_HOUR, 2.5)).toBe("2.5 mph / 4 km/h");
    expect(formatter.format(EventField.MILES_PER_HOUR, 2.6)).toBe("2.6 mph / 4.2 km/h");
  });

  it("expresses publishing changes without exposing contact identifiers", () => {
    const service = TestBed.inject(GroupEventService);
    const changedItems = service.changedItemsBetween({
      fields: {publishing: {ramblers: {publish: true, contactName: "internal-new"}, meetup: {publish: false}}}
    }, {
      fields: {publishing: {ramblers: {publish: false, contactName: "internal-old"}, meetup: {publish: false}}}
    });

    expect(service.notificationChangedItems(changedItems)).toEqual([{
      field: EventField.PUBLISHING,
      label: "Publishing",
      from: "Ramblers: not selected for publishing; Meetup: not selected for publishing",
      to: "Ramblers: will be published; Meetup: not selected for publishing"
    }]);
  });

  it("suppresses a publishing change that only alters an internal contact reference", () => {
    const service = TestBed.inject(GroupEventService);
    const changedItems = service.changedItemsBetween({
      fields: {publishing: {ramblers: {publish: true, contactName: "internal-new"}, meetup: {publish: false}}}
    }, {
      fields: {publishing: {ramblers: {publish: true, contactName: "internal-old"}, meetup: {publish: false}}}
    });

    expect(service.notificationChangedItems(changedItems)).toEqual([]);
  });

  it("expresses risk assessment progress without exposing member identifiers", () => {
    const formatter = TestBed.inject(WalkNotificationValueService);

    const formatted = formatter.format(EventField.RISK_ASSESSMENT, [{
      riskAssessmentSection: "Route",
      riskAssessmentKey: "route",
      confirmed: true,
      confirmationText: "Steep descent after rain",
      memberId: "internal-member-id",
      confirmationDate: 12345
    }, {
      riskAssessmentSection: "Weather",
      riskAssessmentKey: "weather",
      confirmed: false,
      memberId: "internal-member-id",
      confirmationDate: null
    }]);

    expect(formatted).toBe("2 sections, 1 confirmed — Route: confirmed; notes “Steep descent after rain”; Weather: awaiting confirmation");
    expect(formatted).not.toContain("internal-member-id");
    expect(formatted).not.toContain("12345");
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
    expect(audit.changedItems.find(item => item.field === GroupEventField.START_DATE)).toBeUndefined();
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
      expect(audit.changedItems.find(item => item.field === GroupEventField.DESCRIPTION)).toBeUndefined();
      expect(audit.changedItems.find(item => item.field === GroupEventField.ADDITIONAL_DETAILS)).toBeUndefined();
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
      expect(audit.changedItems.find(item => item.field === GroupEventField.WALK_LEADER)).toBeUndefined();
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
      expect(audit.changedItems.find(item => item.field === EventField.LINKS)).toBeUndefined();
    });

    describe("statusFor", () => {
        it("returns the latest status change event type when event history exists", () => {
            const service = TestBed.inject(GroupEventService);
            const walk = walkWithContact(null);
            walk.events = [{ eventType: EventType.APPROVED, memberId: "member-id", date: 1, data: {} }];
            expect(service.statusFor(walk)).toBe(EventType.APPROVED);
        });

        it("returns approved for a walks-manager-cache walk with no event history", () => {
            const service = TestBed.inject(GroupEventService);
            const walk = walkWithContact(null);
            walk.events = [];
            walk.fields.inputSource = InputSource.WALKS_MANAGER_CACHE;
            expect(service.statusFor(walk)).toBe(EventType.APPROVED);
        });

        it("returns approved for a file-import walk with no event history", () => {
            const service = TestBed.inject(GroupEventService);
            const walk = walkWithContact(null);
            walk.events = [];
            walk.fields.inputSource = InputSource.FILE_IMPORT;
            expect(service.statusFor(walk)).toBe(EventType.APPROVED);
        });

        it("returns awaiting walk details for a manually created walk with no event history", () => {
            const service = TestBed.inject(GroupEventService);
            const walk = walkWithContact(null);
            walk.events = [];
            walk.fields.inputSource = InputSource.MANUALLY_CREATED;
            expect(service.statusFor(walk)).toBe(EventType.AWAITING_WALK_DETAILS);
        });

        it("prefers event history over the imported walk fallback", () => {
            const service = TestBed.inject(GroupEventService);
            const walk = walkWithContact(null);
            walk.events = [{ eventType: EventType.DELETED, memberId: "member-id", date: 1, data: {} }];
            walk.fields.inputSource = InputSource.WALKS_MANAGER_CACHE;
            expect(service.statusFor(walk)).toBe(EventType.DELETED);
        });
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
          const venueChange = audit.changedItems.find(item => item.field === EventField.VENUE);
            expect(venueChange).toBeDefined();
            expect(audit.dataChanged).toBe(true);
        });

        it("detects change when isMeetingPlace changes from true to false", () => {
            const service = TestBed.inject(GroupEventService);
            const previousWalk = walkWithVenue(true);
            const currentWalk = walkWithVenue(false);
            currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
            const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
          const venueChange = audit.changedItems.find(item => item.field === EventField.VENUE);
            expect(venueChange).toBeDefined();
            expect(audit.dataChanged).toBe(true);
        });

        it("does not detect change when isMeetingPlace stays the same", () => {
            const service = TestBed.inject(GroupEventService);
            const previousWalk = walkWithVenue(false);
            const currentWalk = walkWithVenue(false);
            currentWalk.events = [walkEventFromFullDeepCopy(previousWalk)];
            const audit = service.walkDataAuditFor(currentWalk, EventType.AWAITING_APPROVAL, true);
          const venueChange = audit.changedItems.find(item => item.field === EventField.VENUE);
            expect(venueChange).toBeUndefined();
        });

        it("changedItemsBetween returns empty array for changes in non-audited fields", () => {
            const service = TestBed.inject(GroupEventService);
            const currentData = { isMeetingPlace: true, name: "Test" };
            const previousData = { isMeetingPlace: false, name: "Test" };
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
          const venueChange = audit.changedItems.find(item => item.field === EventField.VENUE);

            expect(venueChange).toBeDefined();
            expect(audit.dataChanged).toBe(true);
        });
    });
});
