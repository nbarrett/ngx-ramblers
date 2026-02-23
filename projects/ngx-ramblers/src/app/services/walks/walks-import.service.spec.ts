import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { of } from "rxjs";
import { InputSource } from "../../models/group-event.model";
import { Member, MemberAction } from "../../models/member.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { EventType } from "../../models/walk.model";
import { LoggerFactory } from "../logger-factory.service";
import { MemberService } from "../member/member.service";
import { LocalWalksAndEventsService } from "../walks-and-events/local-walks-and-events.service";
import { WalksImportService } from "./walks-import.service";
import { SystemConfigService } from "../system/system-config.service";
import { DateUtilsService } from "../date-utils.service";
import { NumberUtilsService } from "../number-utils.service";
import { GroupEventService } from "../walks-and-events/group-event.service";
import { StringUtilsService } from "../string-utils.service";
import { MemberBulkLoadService } from "../member/member-bulk-load.service";
import { MemberNamingService } from "../member/member-naming.service";
import { RamblersWalksAndEventsService } from "../walks-and-events/ramblers-walks-and-events.service";
import { ExtendedGroupEventQueryService } from "../walks-and-events/extended-group-event-query.service";
import { EventDefaultsService } from "../event-defaults.service";
import { MediaQueryService } from "../committee/media-query.service";
import { FileUtilsService } from "../../file-utils.service";
import { AlertInstance } from "../notifier.service";

describe("WalksImportService Walks Manager matching", () => {
  const systemConfig = {
    group: {
      shortName: "EKWG",
      longName: "East Kent Weekend Group",
      groupCode: "EKWG"
    },
    area: {
      groupCode: "SE"
    },
    images: {
      imageLists: {
        defaultMaxImageSize: 256000
      }
    }
  } as any;

  const matchingMember: Member = {
    id: "member-1",
    firstName: "Alex",
    lastName: "Example",
    displayName: "Different Local Display Name",
    email: "alex@example.com",
    mobileNumber: "07999 111111",
    contactId: "contact-1"
  };

  const unmatchedMember: Member = {
    id: "member-2",
    firstName: "Jamie",
    lastName: "Else",
    displayName: "Jamie Else",
    email: "jamie@example.com",
    mobileNumber: "07999 222222",
    contactId: "contact-2"
  };

  const loggerFactory = {
    createLogger: () => ({
      info: () => null,
      off: () => null,
      error: () => null,
      warn: () => null,
      debug: () => null
    })
  };

  const systemConfigService = {
    events: () => of(systemConfig)
  };

  const localWalksAndEventsService = jasmine.createSpyObj("LocalWalksAndEventsService", ["all", "urlFromTitle", "update", "create"]);
  localWalksAndEventsService.all.and.resolveTo([]);
  localWalksAndEventsService.urlFromTitle.and.resolveTo("test-walk-url");
  localWalksAndEventsService.update.and.callFake(async walk => walk);
  localWalksAndEventsService.create.and.callFake(async walk => walk);

  const dateUtilsService = {
    displayDate: (value: string) => value
  };

  const numberUtilsService = {
    asNumber: (value: string) => Number(value?.replace(/\D/g, "")) || 0
  };

  const groupEventService = {
    createEventIfRequired: () => ({eventType: EventType.APPROVED}),
    writeEventIfRequired: () => null
  };

  const stringUtilsService = {
    pluraliseWithCount: (count: number, label: string) => `${count} ${label}${count === 1 ? "" : "s"}`,
    decodeString: (value: string) => value,
    asBoolean: (value: string) => value === "TRUE",
    kebabCase: (value: string) => value?.toLowerCase().replace(/\s+/g, "-")
  };

  const memberBulkLoadService = {
    bulkLoadMemberAndMatchFor: () => null
  };

  const memberService = jasmine.createSpyObj("MemberService", ["all", "createOrUpdate"]);
  memberService.all.and.resolveTo([matchingMember, unmatchedMember]);
  memberService.createOrUpdate.and.resolveTo(null);

  const memberNamingService = {
    firstAndLastNameFrom: (name: string) => {
      const parts = name?.split(" ") || [];
      return {
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || ""
      };
    }
  };

  const ramblersWalksAndEventsService = jasmine.createSpyObj("RamblersWalksAndEventsService", ["all", "queryWalkLeaders", "toFeature", "toExtendedGroupEvent"]);
  ramblersWalksAndEventsService.all.and.resolveTo([]);
  ramblersWalksAndEventsService.queryWalkLeaders.and.resolveTo([]);
  ramblersWalksAndEventsService.toFeature.and.callFake((feature: string) => ({code: feature, description: feature}));
  ramblersWalksAndEventsService.toExtendedGroupEvent.and.callFake((groupEvent: any, inputSource: InputSource, migratedFromId?: string) => ({
    groupEvent,
    fields: {
      inputSource,
      migratedFromId: migratedFromId || null,
      attendees: [],
      contactDetails: {
        contactId: null,
        memberId: null,
        displayName: null,
        email: null,
        phone: null
      },
      publishing: {
        ramblers: {publish: true, contactName: null},
        meetup: {publish: false, contactName: null}
      },
      links: [],
      meetup: null,
      milesPerHour: 3,
      notifications: [],
      riskAssessment: [],
      venue: null
    },
    events: []
  }));

  const extendedGroupEventQueryService = {
    dataQueryOptions: () => ({criteria: {}, sort: {walkDate: 1}})
  };

  const eventDefaultsService = {
    nameToContact: (name: string) => ({
      is_overridden: false,
      id: null,
      name,
      telephone: null,
      has_email: false
    }),
    memberToContact: (member: Member) => ({
      is_overridden: false,
      id: member.id,
      name: member.displayName,
      telephone: member.mobileNumber || null,
      has_email: !!member.email
    }),
    contactDetailsFrom: (member: Member) => ({
      contactId: member.contactId,
      memberId: member.id,
      displayName: member.displayName,
      email: member.email,
      phone: member.mobileNumber
    })
  };

  const mediaQueryService = {
    events: () => of(null)
  };

  const fileUtilsService = {
    upload: () => Promise.resolve(null)
  };

  function walksManagerWalk(overrides?: any): any {
    return {
      id: null,
      groupEvent: {
        id: "wm-1",
        item_type: RamblersEventType.GROUP_WALK,
        title: "Coastal Walk",
        group_code: "EKWG",
        group_name: "East Kent Weekend Group",
        area_code: "SE",
        start_date_time: "2026-03-10T09:00:00",
        end_date_time: "2026-03-10T13:00:00",
        url: "coastal-walk"
      },
      fields: {
        inputSource: InputSource.WALKS_MANAGER_CACHE,
        migratedFromId: null,
        attendees: [],
        contactDetails: {
          contactId: "wm-contact-1",
          memberId: null,
          displayName: "Alex Example",
          email: "alex@example.com",
          phone: "07999 111111"
        },
        publishing: {
          ramblers: {publish: true, contactName: "Alex Example"},
          meetup: {publish: false, contactName: null}
        },
        links: [],
        meetup: null,
        milesPerHour: 3,
        notifications: [],
        riskAssessment: [],
        venue: null
      },
      events: [],
      ...overrides
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        WalksImportService,
        { provide: LoggerFactory, useValue: loggerFactory },
        { provide: SystemConfigService, useValue: systemConfigService },
        { provide: LocalWalksAndEventsService, useValue: localWalksAndEventsService },
        { provide: DateUtilsService, useValue: dateUtilsService },
        { provide: NumberUtilsService, useValue: numberUtilsService },
        { provide: GroupEventService, useValue: groupEventService },
        { provide: StringUtilsService, useValue: stringUtilsService },
        { provide: MemberBulkLoadService, useValue: memberBulkLoadService },
        { provide: MemberService, useValue: memberService },
        { provide: MemberNamingService, useValue: memberNamingService },
        { provide: RamblersWalksAndEventsService, useValue: ramblersWalksAndEventsService },
        { provide: ExtendedGroupEventQueryService, useValue: extendedGroupEventQueryService },
        { provide: EventDefaultsService, useValue: eventDefaultsService },
        { provide: MediaQueryService, useValue: mediaQueryService },
        { provide: FileUtilsService, useValue: fileUtilsService }
      ]
    });
    localWalksAndEventsService.create.calls.reset();
    memberService.createOrUpdate.calls.reset();
  });

  it("auto-matches Walks Manager leaders in prepareImportOfEvents", async () => {
    const service = TestBed.inject(WalksImportService);
    const importData = service.importDataDefaults(InputSource.WALKS_MANAGER_CACHE);
    const walk = walksManagerWalk();

    const result = await service.prepareImportOfEvents(importData, [walk]);
    const row = result.bulkLoadMembersAndMatchesToWalks[0];

    expect(row.bulkLoadMemberAndMatch.memberMatch).toEqual(MemberAction.found);
    expect(row.bulkLoadMemberAndMatch.member?.id).toEqual(matchingMember.id);
  });

  it("saves unmatched Walks Manager walks without creating members", async () => {
    const service = TestBed.inject(WalksImportService);
    const notify = jasmine.createSpyObj<AlertInstance>("notify", ["warning", "success"]);
    const walk = walksManagerWalk({
      fields: {
        inputSource: InputSource.WALKS_MANAGER_CACHE,
        migratedFromId: null,
        attendees: [],
        contactDetails: {
          contactId: "wm-contact-1",
          memberId: null,
          displayName: "Unknown Leader",
          email: null,
          phone: null
        },
        publishing: {
          ramblers: {publish: true, contactName: "Unknown Leader"},
          meetup: {publish: false, contactName: null}
        },
        links: [],
        meetup: null,
        milesPerHour: 3,
        notifications: [],
        riskAssessment: [],
        venue: null
      }
    });

    const importData = {
      ...service.importDataDefaults(InputSource.WALKS_MANAGER_CACHE),
      existingWalksWithinRange: [],
      bulkLoadMembersAndMatchesToWalks: [
        {
          include: true,
          bulkLoadMemberAndMatch: {
            memberMatch: MemberAction.notFound,
            memberMatchType: "none",
            member: null,
            ramblersMember: null,
            contact: null
          },
          event: walk
        }
      ]
    } as any;

    await service.saveImportedWalks(importData, notify);

    expect(memberService.createOrUpdate).not.toHaveBeenCalled();
    expect(localWalksAndEventsService.create).toHaveBeenCalledTimes(1);
    const createdWalk = localWalksAndEventsService.create.calls.mostRecent().args[0];
    expect(createdWalk.fields.contactDetails.memberId).toBeNull();
    expect(createdWalk.fields.contactDetails.displayName).toEqual("Unknown Leader");
  });
});
