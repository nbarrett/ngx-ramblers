import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
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
import { createExtendedGroupEvent } from "../../testing/create-extended-group-event";

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
    allLimitedFields: () => Promise.resolve({ email: "test@example.com" }),
    filterFor: { GROUP_MEMBERS: "" }
};

describe("WalkDisplayService", () => {
    let spy: Mock;
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
                { provide: MemberLoginService, useValue: memberLoginService },
                { provide: "MemberAuditService", useValue: {} },
                { provide: "WalkNotificationService", useValue: {} },
                { provide: "MailchimpSegmentService", useValue: {} },
                { provide: "MailchimpConfigDocument", useValue: {} },
                { provide: "MailchimpCampaignService", useValue: {} },
                { provide: "MeetupService", useValue: meetupService },
                { provide: "ClipboardService", useValue: {} },
                { provide: "MemberService", useValue: memberService },
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
        const emptyPromise = Promise.resolve({}) as any;
        spy = vi.spyOn(googleConfig, "getConfig").mockReturnValue(emptyPromise);
    });

    describe("toWalkAccessMode", () => {
        it("should return edit if user is logged in and admin", () => {
            spy = vi.spyOn(memberLoginService, "memberLoggedIn").mockReturnValue(true);
            spy = vi.spyOn(memberLoginService, "allowWalkAdminEdits").mockReturnValue(true);
            const val = { memberId: "some-other-id" } as any;
            spy = vi.spyOn(memberLoginService, "loggedInMember").mockReturnValue(val);
            const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
            const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
            service.group = { walkPopulation: EventPopulation.LOCAL } as Organisation;
            expect(service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, anyWalkDate, dontCare, "any-walk-id")))
                .toEqual(WalksReferenceService.walkAccessModes.edit);
        });

        it("should return edit if user is logged in and not admin but is leader", () => {
            spy = vi.spyOn(memberLoginService, "memberLoggedIn").mockReturnValue(true);
            spy = vi.spyOn(memberLoginService, "allowWalkAdminEdits").mockReturnValue(false);
            spy = vi.spyOn(memberLoginService, "loggedInMember").mockReturnValue({ memberId: "leader-id" } as any);
            const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
            const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
            service.group = { walkPopulation: EventPopulation.LOCAL } as Organisation;
            expect(service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, anyWalkDate, dontCare, "leader-id")))
                .toEqual(WalksReferenceService.walkAccessModes.edit);
        });

        it("should return lead if user is logged in and not admin and walk doest have a leader", () => {
            spy = vi.spyOn(memberLoginService, "memberLoggedIn").mockReturnValue(true);
            spy = vi.spyOn(memberLoginService, "allowWalkAdminEdits").mockReturnValue(false);
            spy = vi.spyOn(memberLoginService, "loggedInMember").mockReturnValue({ memberId: "leader-id" } as any);
            const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
            const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
            const expectedEvent: any = { eventType: EventType.AWAITING_LEADER };
            service.group = { walkPopulation: EventPopulation.LOCAL } as Organisation;
            const dateValue = 0;
            expect(service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, dateValue, expectedEvent, walkLeaderMemberId)))
                .toEqual(WalksReferenceService.walkAccessModes.lead);
        });

        it("should return view if user is not logged in", () => {
            spy = vi.spyOn(memberLoginService, "memberLoggedIn").mockReturnValue(false);
            spy = vi.spyOn(memberLoginService, "allowWalkAdminEdits").mockReturnValue(false);
            const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
            const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
            expect(service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, anyWalkDate, dontCare, walkLeaderMemberId)))
                .toEqual(WalksReferenceService.walkAccessModes.view);
        });

        it("should return view if user is not member admin and not leading the walk", () => {
            spy = vi.spyOn(memberLoginService, "memberLoggedIn").mockReturnValue(true);
            spy = vi.spyOn(memberLoginService, "allowWalkAdminEdits").mockReturnValue(false);
            spy = vi.spyOn(memberLoginService, "loggedInMember").mockReturnValue({ memberId: "leader-id" } as any);
            const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
            const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
            const walkEventService = TestBed.inject(GroupEventService);
            vi.spyOn(service, "walkPopulationLocal").mockReturnValue(true);
            vi.spyOn(walkEventService, "latestEvent").mockReturnValue({
                eventType: EventType.APPROVED,
                data: undefined,
                date: 0,
                memberId: ""
            });
            const actual = service.toWalkAccessMode(createExtendedGroupEvent(dateUtilsService, anyWalkDate, dontCare, "another-walk-leader-id"));
            expect(actual).toEqual(WalksReferenceService.walkAccessModes.view);
        });
    });

    describe("contactEmailHref", () => {
        it("returns mailto for plain email addresses", () => {
            const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
            expect(service.contactEmailHref("oliver.parkes@hotmail.co.uk")).toEqual("mailto:oliver.parkes@hotmail.co.uk");
        });

        it("returns http links unchanged", () => {
            const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
            expect(service.contactEmailHref("https://www.ramblers.org.uk/go-walking/group-walks/example#contact"))
                .toEqual("https://www.ramblers.org.uk/go-walking/group-walks/example#contact");
        });

        it("normalises existing mailto values", () => {
            const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
            expect(service.contactEmailHref("mailto:oliver.parkes@hotmail.co.uk")).toEqual("mailto:oliver.parkes@hotmail.co.uk");
        });

        it("returns null for non-email non-url values", () => {
            const service: WalkDisplayService = TestBed.inject(WalkDisplayService);
            expect(service.contactEmailHref("contact-via-admin")).toBeNull();
        });
    });

});
