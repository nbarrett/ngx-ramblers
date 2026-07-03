import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { of } from "rxjs";
import { vi } from "vitest";
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
import { AddressQueryService } from "./address-query.service";
import { DateTime } from "luxon";

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

    const sarahMitchell: Member = {
        id: "member-sarah",
        firstName: "Sarah",
        lastName: "Mitchell",
        displayName: "Sarah Mitchell",
        email: "sarah@example.com",
        mobileNumber: "07999 333333",
        contactId: "contact-sarah"
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

    const localWalksAndEventsService = {
        all: vi.fn().mockName("LocalWalksAndEventsService.all"),
        allWithPagination: vi.fn().mockName("LocalWalksAndEventsService.allWithPagination"),
        urlFromTitle: vi.fn().mockName("LocalWalksAndEventsService.urlFromTitle"),
        update: vi.fn().mockName("LocalWalksAndEventsService.update"),
        create: vi.fn().mockName("LocalWalksAndEventsService.create")
    };
    localWalksAndEventsService.all.mockResolvedValue([]);
    localWalksAndEventsService.allWithPagination.mockResolvedValue({ response: [], pagination: { total: 0 } });
    localWalksAndEventsService.urlFromTitle.mockResolvedValue("test-walk-url");
    localWalksAndEventsService.update.mockImplementation(async (walk) => walk);
    localWalksAndEventsService.create.mockImplementation(async (walk) => walk);

    const dateUtilsService = {
        displayDate: (value: string) => value,
        parseCsvDate: (dateValue: string, timeValue: string) => dateValue && timeValue ? `${dateValue}T${timeValue}` : dateValue || null,
        asDateTime: (value: string) => DateTime.fromISO(value || "1970-01-01"),
        durationInMsecsForDistanceInMiles: (distance: string | number, milesPerHour: number) => (Number(distance) / milesPerHour) * 60 * 60 * 1000,
        isoDateTime: (value: number) => DateTime.fromMillis(Number(value)).toISO()
    };

    const numberUtilsService = {
        asNumber: (value: string) => Number(value?.replace(/\D/g, "")) || 0,
        humanFileSize: (size: number) => `${size} bytes`
    };

    const groupEventService = {
        createEventIfRequired: () => ({ eventType: EventType.APPROVED }),
        writeEventIfRequired: () => null
    };

    const stringUtilsService = {
        pluraliseWithCount: (count: number, label: string) => `${count} ${label}${count === 1 ? "" : "s"}`,
        decodeString: (value: string) => value,
        asBoolean: (value: string) => value === "TRUE",
        kebabCase: (value: string) => value?.toLowerCase().replace(/\s+/g, "-")
    };

    const memberBulkLoadService = {
        bulkLoadMemberAndMatchFor: vi.fn().mockName("MemberBulkLoadService.bulkLoadMemberAndMatchFor")
    };
    memberBulkLoadService.bulkLoadMemberAndMatchFor.mockImplementation((ramblersMemberAndContact: any, existingMembers: Member[]) => {
        const matchedMember = existingMembers.find(member => member.displayName === ramblersMemberAndContact?.contact?.name);
        return {
            memberMatch: matchedMember ? MemberAction.found : MemberAction.created,
            memberMatchType: matchedMember ? "contact name" : null,
            member: matchedMember || {id: null},
            ramblersMember: ramblersMemberAndContact?.ramblersMember,
            contact: ramblersMemberAndContact?.contact
        };
    });

    const memberService = {
        all: vi.fn().mockName("MemberService.all"),
        createOrUpdate: vi.fn().mockName("MemberService.createOrUpdate")
    };
    memberService.all.mockResolvedValue([matchingMember, unmatchedMember, sarahMitchell]);
    memberService.createOrUpdate.mockResolvedValue(null);

    const memberNamingService = {
        firstAndLastNameFrom: (name: string) => {
            const parts = name?.split(" ") || [];
            return {
                firstName: parts[0] || "",
                lastName: parts.slice(1).join(" ") || ""
            };
        }
    };

    const ramblersWalksAndEventsService = {
        all: vi.fn().mockName("RamblersWalksAndEventsService.all"),
        queryWalkLeaders: vi.fn().mockName("RamblersWalksAndEventsService.queryWalkLeaders"),
        toFeature: vi.fn().mockName("RamblersWalksAndEventsService.toFeature"),
        toExtendedGroupEvent: vi.fn().mockName("RamblersWalksAndEventsService.toExtendedGroupEvent")
    };
    ramblersWalksAndEventsService.all.mockResolvedValue([]);
    ramblersWalksAndEventsService.queryWalkLeaders.mockResolvedValue([]);
    ramblersWalksAndEventsService.toFeature.mockImplementation((feature: string) => ({ code: feature, description: feature }));
    ramblersWalksAndEventsService.toExtendedGroupEvent.mockImplementation((groupEvent: any, inputSource: InputSource, migratedFromId?: string) => ({
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
                ramblers: { publish: true, contactName: null },
                meetup: { publish: false, contactName: null }
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
        dataQueryOptions: () => ({ criteria: {}, sort: { walkDate: 1 } }),
        dataQueryOptionsFrom: (eventQueryParameters: any) => eventQueryParameters?.dataQueryOptions ?? { criteria: {} }
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

    const addressQueryService = {
        placeNameLookup: vi.fn().mockName("AddressQueryService.placeNameLookup"),
        gridReferenceLookup: vi.fn().mockName("AddressQueryService.gridReferenceLookup"),
        geocodeFromText: vi.fn().mockName("AddressQueryService.geocodeFromText")
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
                    ramblers: { publish: true, contactName: "Alex Example" },
                    meetup: { publish: false, contactName: null }
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
                { provide: FileUtilsService, useValue: fileUtilsService },
                { provide: AddressQueryService, useValue: addressQueryService }
            ]
        });
        localWalksAndEventsService.create.mockClear();
        localWalksAndEventsService.update.mockClear();
        memberService.createOrUpdate.mockClear();
        addressQueryService.placeNameLookup.mockReset();
        addressQueryService.gridReferenceLookup.mockReset();
        addressQueryService.geocodeFromText.mockReset();
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
        const notify = {
            warning: vi.fn().mockName("notify.warning"),
            success: vi.fn().mockName("notify.success"),
            progress: vi.fn().mockName("notify.progress")
        } as unknown as AlertInstance;
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
                    ramblers: { publish: true, contactName: "Unknown Leader" },
                    meetup: { publish: false, contactName: null }
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
        const createdWalk = vi.mocked(localWalksAndEventsService.create).mock.lastCall[0];
        expect(createdWalk.fields.contactDetails.memberId).toBeNull();
        expect(createdWalk.fields.contactDetails.displayName).toEqual("Unknown Leader");
    });

    describe("file import joint walk leaders", () => {
        function fileImportWalk(displayName: string, overrides?: any): any {
            return {
                id: null,
                groupEvent: {
                    id: null,
                    item_type: RamblersEventType.GROUP_WALK,
                    title: "Downland Walk",
                    group_code: "EKWG",
                    group_name: "East Kent Weekend Group",
                    area_code: "SE",
                    start_date_time: "2026-04-10T10:00:00",
                    end_date_time: "2026-04-10T14:00:00",
                    url: "downland-walk",
                    walk_leader: {
                        is_overridden: false,
                        id: null,
                        name: displayName,
                        telephone: null,
                        has_email: false
                    }
                },
                fields: {
                    inputSource: InputSource.FILE_IMPORT,
                    migratedFromId: "walk-100",
                    attendees: [],
                    contactDetails: {
                        contactId: null,
                        memberId: null,
                        displayName,
                        email: null,
                        phone: null
                    },
                    publishing: {
                        ramblers: { publish: true, contactName: displayName },
                        meetup: { publish: false, contactName: null }
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

        function csvRow(walkLeaders: string): Record<string, string> {
            return {
                "Walk ID": "walk-100",
                "Title": "Downland Walk",
                "Date": "10/04/2026",
                "Walk leaders": walkLeaders
            };
        }

        const groupCodeAndName = { group_code: "EKWG", group_name: "East Kent Weekend Group" };

        it("normalises joint walk leaders from csv rows into walk_leader name and contact display name", () => {
            const service = TestBed.inject(WalksImportService);
            const result = service.csvRowToExtendedGroupEvent(csvRow("Sarah Mitchell;Tom Gamble"), groupCodeAndName);
            expect(result.groupEvent.walk_leader.name).toEqual("Sarah Mitchell; Tom Gamble");
            expect(result.fields.contactDetails.displayName).toEqual("Sarah Mitchell; Tom Gamble");
        });

        it("leaves single walk leader names unchanged from csv rows", () => {
            const service = TestBed.inject(WalksImportService);
            const result = service.csvRowToExtendedGroupEvent(csvRow("Sarah Mitchell"), groupCodeAndName);
            expect(result.groupEvent.walk_leader.name).toEqual("Sarah Mitchell");
            expect(result.fields.contactDetails.displayName).toBeNull();
        });

        it("matches the first listed joint leader to a member in prepareImportOfEvents", async () => {
            const service = TestBed.inject(WalksImportService);
            const importData = service.importDataDefaults(InputSource.FILE_IMPORT);
            const walk = fileImportWalk("Sarah Mitchell; Tom Gamble");
            const result = await service.prepareImportOfEvents(importData, [walk]);
            const row = result.bulkLoadMembersAndMatchesToWalks[0];
            expect(row.bulkLoadMemberAndMatch.contact?.name).toEqual("Sarah Mitchell");
            expect(row.bulkLoadMemberAndMatch.memberMatch).toEqual(MemberAction.found);
            expect(row.bulkLoadMemberAndMatch.member?.id).toEqual(sarahMitchell.id);
        });

        it("uses the first listed name for matching when the joint order is reversed", async () => {
            const service = TestBed.inject(WalksImportService);
            const importData = service.importDataDefaults(InputSource.FILE_IMPORT);
            const walk = fileImportWalk("Tom Gamble; Sarah Mitchell");
            const result = await service.prepareImportOfEvents(importData, [walk]);
            const row = result.bulkLoadMembersAndMatchesToWalks[0];
            expect(row.bulkLoadMemberAndMatch.contact?.name).toEqual("Tom Gamble");
            expect(row.bulkLoadMemberAndMatch.memberMatch).toEqual(MemberAction.notFound);
            expect(row.bulkLoadMemberAndMatch.member).toBeNull();
        });

        function importDataWithMatchedWalk(service: WalksImportService, walk: any, existingWalksWithinRange: any[]): any {
            return {
                ...service.importDataDefaults(InputSource.FILE_IMPORT),
                existingWalksWithinRange,
                bulkLoadMembersAndMatchesToWalks: [
                    {
                        include: true,
                        bulkLoadMemberAndMatch: {
                            memberMatch: MemberAction.found,
                            memberMatchType: "contact name",
                            member: sarahMitchell,
                            ramblersMember: null,
                            contact: {
                                is_overridden: false,
                                id: null,
                                name: "Sarah Mitchell",
                                telephone: null,
                                has_email: false
                            }
                        },
                        event: walk
                    }
                ]
            };
        }

        it("applies matched member contact details but preserves the joint display name when saving a new walk", async () => {
            const service = TestBed.inject(WalksImportService);
            const notify = {
                warning: vi.fn().mockName("notify.warning"),
                success: vi.fn().mockName("notify.success"),
                progress: vi.fn().mockName("notify.progress")
            } as unknown as AlertInstance;
            const walk = fileImportWalk("Sarah Mitchell; Tom Gamble");
            await service.saveImportedWalks(importDataWithMatchedWalk(service, walk, []), notify);
            expect(localWalksAndEventsService.create).toHaveBeenCalledTimes(1);
            const createdWalk = vi.mocked(localWalksAndEventsService.create).mock.lastCall[0];
            expect(createdWalk.fields.contactDetails.displayName).toEqual("Sarah Mitchell; Tom Gamble");
            expect(createdWalk.fields.contactDetails.memberId).toEqual(sarahMitchell.id);
            expect(createdWalk.fields.contactDetails.email).toEqual(sarahMitchell.email);
            expect(createdWalk.fields.contactDetails.phone).toEqual(sarahMitchell.mobileNumber);
            expect(createdWalk.groupEvent.walk_leader.name).toEqual("Sarah Mitchell; Tom Gamble");
            expect(createdWalk.groupEvent.walk_leader.id).toEqual(sarahMitchell.id);
        });

        it("overwrites a single leader name with the matched member's display name when saving a new walk", async () => {
            const service = TestBed.inject(WalksImportService);
            const notify = {
                warning: vi.fn().mockName("notify.warning"),
                success: vi.fn().mockName("notify.success"),
                progress: vi.fn().mockName("notify.progress")
            } as unknown as AlertInstance;
            const walk = fileImportWalk("Sarah Mitchell");
            await service.saveImportedWalks(importDataWithMatchedWalk(service, walk, []), notify);
            expect(localWalksAndEventsService.create).toHaveBeenCalledTimes(1);
            const createdWalk = vi.mocked(localWalksAndEventsService.create).mock.lastCall[0];
            expect(createdWalk.fields.contactDetails.displayName).toEqual(sarahMitchell.displayName);
            expect(createdWalk.fields.contactDetails.memberId).toEqual(sarahMitchell.id);
            expect(createdWalk.groupEvent.walk_leader.name).toEqual(sarahMitchell.displayName);
        });

        it("preserves the joint display name when re-importing over an existing walk", async () => {
            const service = TestBed.inject(WalksImportService);
            const notify = {
                warning: vi.fn().mockName("notify.warning"),
                success: vi.fn().mockName("notify.success"),
                progress: vi.fn().mockName("notify.progress")
            } as unknown as AlertInstance;
            const existingWalk = fileImportWalk("Sarah Mitchell; Tom Gamble", { id: "existing-1" });
            existingWalk.fields.contactDetails = {
                contactId: sarahMitchell.contactId,
                memberId: sarahMitchell.id,
                displayName: "Sarah Mitchell; Tom Gamble",
                email: sarahMitchell.email,
                phone: sarahMitchell.mobileNumber
            };
            const incomingWalk = fileImportWalk("Sarah Mitchell; Tom Gamble");
            await service.saveImportedWalks(importDataWithMatchedWalk(service, incomingWalk, [existingWalk]), notify);
            expect(localWalksAndEventsService.update).toHaveBeenCalledTimes(1);
            const updatedWalk = vi.mocked(localWalksAndEventsService.update).mock.lastCall[0];
            expect(updatedWalk.id).toEqual("existing-1");
            expect(updatedWalk.fields.contactDetails.displayName).toEqual("Sarah Mitchell; Tom Gamble");
            expect(updatedWalk.fields.contactDetails.memberId).toEqual(sarahMitchell.id);
            expect(updatedWalk.fields.contactDetails.email).toEqual(sarahMitchell.email);
            expect(updatedWalk.groupEvent.walk_leader.name).toEqual("Sarah Mitchell; Tom Gamble");
        });
    });

    describe("location enrichment free-text fallback", () => {
        function importDataWithWalk(service: WalksImportService, walk: any): any {
            return {
                ...service.importDataDefaults(InputSource.FILE_IMPORT),
                existingWalksWithinRange: [],
                bulkLoadMembersAndMatchesToWalks: [
                    {
                        include: true,
                        bulkLoadMemberAndMatch: {
                            memberMatch: MemberAction.found,
                            memberMatchType: "contact name",
                            member: sarahMitchell,
                            ramblersMember: null,
                            contact: {
                                is_overridden: false,
                                id: null,
                                name: "Sarah Mitchell",
                                telephone: null,
                                has_email: false
                            }
                        },
                        event: walk
                    }
                ]
            };
        }

        function notifyMock(): AlertInstance {
            return {
                warning: vi.fn().mockName("notify.warning"),
                success: vi.fn().mockName("notify.success"),
                progress: vi.fn().mockName("notify.progress")
            } as unknown as AlertInstance;
        }

        it("geocodes a location with only a description via geocodeFromText and merges the result", async () => {
            const service = TestBed.inject(WalksImportService);
            addressQueryService.geocodeFromText.mockResolvedValue({
                latlng: {lat: 51.6212, lng: -1.0135},
                gridReference6: "SU668873",
                gridReference8: "SU66838735",
                gridReference10: "SU6683387356",
                postcode: "RG9 5SJ",
                description: "Nuffield, Oxfordshire, England, United Kingdom"
            });
            const walk = walksManagerWalk();
            walk.groupEvent.start_location = {description: "Nuffield"};
            await service.saveImportedWalks(importDataWithWalk(service, walk), notifyMock());
            expect(addressQueryService.geocodeFromText).toHaveBeenCalledWith("Nuffield", undefined);
            expect(addressQueryService.placeNameLookup).not.toHaveBeenCalled();
            expect(addressQueryService.gridReferenceLookup).not.toHaveBeenCalled();
            expect(localWalksAndEventsService.create).toHaveBeenCalledTimes(1);
            const createdWalk = vi.mocked(localWalksAndEventsService.create).mock.lastCall[0];
            expect(createdWalk.groupEvent.start_location.latitude).toEqual(51.6212);
            expect(createdWalk.groupEvent.start_location.longitude).toEqual(-1.0135);
            expect(createdWalk.groupEvent.start_location.grid_reference_6).toEqual("SU668873");
            expect(createdWalk.groupEvent.start_location.postcode).toEqual("RG9 5SJ");
            expect(createdWalk.groupEvent.start_location.description).toEqual("Nuffield");
        });

        it("does not call geocodeFromText when a postcode is present", async () => {
            const service = TestBed.inject(WalksImportService);
            addressQueryService.gridReferenceLookup.mockResolvedValue({
                latlng: {lat: 51.28, lng: 1.08},
                gridReference6: "TR145575",
                postcode: "CT1 2EH",
                description: "Canterbury"
            });
            const walk = walksManagerWalk();
            walk.groupEvent.start_location = {description: "Canterbury", postcode: "CT1 2EH"};
            await service.saveImportedWalks(importDataWithWalk(service, walk), notifyMock());
            expect(addressQueryService.gridReferenceLookup).toHaveBeenCalledWith("CT1 2EH");
            expect(addressQueryService.geocodeFromText).not.toHaveBeenCalled();
        });
    });

    describe("importWalksFromFile line ending handling", () => {
        const header = "Date,Title,Description";
        const dataRows = [
            "01/02/2026,Walk one,First",
            "02/02/2026,Walk two,Second",
            "03/02/2026,Walk three,Third",
            "04/02/2026,Walk four,Fourth"
        ];

        function csvFile(content: string): File {
            return new File([content], "walks.csv", {type: "text/csv"});
        }

        async function importedRows(content: string): Promise<Record<string, string>[]> {
            const service = TestBed.inject(WalksImportService);
            return service.importWalksFromFile(csvFile(content), null);
        }

        it("parses all rows in an LF-only file", async () => {
            const rows = await importedRows([header, ...dataRows].join("\n") + "\n");
            expect(rows.length).toEqual(4);
            expect(rows[3].Title).toEqual("Walk four");
        });

        it("parses all rows in a CRLF file", async () => {
            const rows = await importedRows([header, ...dataRows].join("\r\n") + "\r\n");
            expect(rows.length).toEqual(4);
            expect(rows[3].Description).toEqual("Fourth");
        });

        it("parses all rows when the header ends CRLF but the body is LF-only", async () => {
            const rows = await importedRows(header + "\r\n" + dataRows.join("\n") + "\n");
            expect(rows.length).toEqual(4);
            expect(rows[0].Description).toEqual("First");
        });

        it("parses all rows in a CR-only file", async () => {
            const rows = await importedRows([header, ...dataRows].join("\r"));
            expect(rows.length).toEqual(4);
        });

        it("strips trailing carriage returns from field values in mixed-ending files", async () => {
            const rows = await importedRows(header + "\n" + dataRows[0] + "\r\n" + dataRows[1] + "\n");
            expect(rows.length).toEqual(2);
            expect(rows[0].Description).toEqual("First");
        });

        it("preserves newlines inside quoted fields regardless of line endings", async () => {
            const quotedRow = "05/02/2026,Walk five,\"multi\nline\"";
            const rows = await importedRows([header, ...dataRows, quotedRow].join("\n") + "\n");
            expect(rows.length).toEqual(5);
            expect(rows[4].Description).toEqual("multi\nline");
        });
    });
});
