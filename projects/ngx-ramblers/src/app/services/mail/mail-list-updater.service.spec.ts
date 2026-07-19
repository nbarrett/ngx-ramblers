import { HttpClient } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { cloneDeep } from "es-toolkit/compat";
import { of } from "rxjs";
import { vi } from "vitest";
import { LoggerFactory } from "../logger-factory.service";
import { CommonDataService } from "../common-data-service";
import { DateUtilsService } from "../date-utils.service";
import { StringUtilsService } from "../string-utils.service";
import { MemberService } from "../member/member.service";
import { BroadcastService } from "../broadcast-service";
import { SalesforceConfigService } from "../salesforce/salesforce-config.service";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MailListUpdaterService } from "./mail-list-updater.service";
import { MailMessagingService } from "./mail-messaging.service";
import { MailListAuditService } from "./mail-list-audit.service";
import { MailService } from "./mail.service";
import { ListSubscriptionOutcome, ListSubscriptionRow } from "../../models/mail-list-subscription.model";
import { ListInfo, ListSetting, MailSubscription } from "../../models/mail.model";
import { MailSettings, Member } from "../../models/member.model";

describe("MailListUpdaterService", () => {
    let service: MailListUpdaterService;
    let mailMessagingServiceSpy: { events: ReturnType<typeof vi.fn>, subscribed: ReturnType<typeof vi.fn>, toMemberMergeVariables: ReturnType<typeof vi.fn> };
    let memberServiceSpy: { createOrUpdateAll: ReturnType<typeof vi.fn> };
    let broadcastServiceSpy: { broadcast: ReturnType<typeof vi.fn> };

    const UNSUBSCRIBED_NOW = 1700000000000;
    const UNSUBSCRIBED_EARLIER = 1600000000000;
    const allMembers: ListInfo = {id: 2, name: "All Members"} as ListInfo;
    const fridayEmail: ListInfo = {id: 4, name: "Friday Email"} as ListInfo;
    const lists: ListInfo[] = [allMembers, fridayEmail];
    const autoSubscribeSetting: ListSetting = {id: 2, autoSubscribeNewMembers: true} as ListSetting;

    function mailWith(...subscriptions: MailSubscription[]): MailSettings {
        return {subscriptions, email: "joanne@example.com", id: 1};
    }

    function member(overrides: Partial<Member>): Member {
        return {
            id: "member-1",
            firstName: "Joanne",
            lastName: "Wilson",
            email: "joanne@example.com",
            membershipNumber: "1000",
            groupMember: true,
            mail: mailWith({id: 2, subscribed: false}, {id: 4, subscribed: false}),
            ...overrides
        } as Member;
    }

    function row(overrides: Partial<ListSubscriptionRow>): ListSubscriptionRow {
        return {
            email: "joanne@example.com",
            listName: "All Members",
            subscribed: "Yes",
            ...overrides
        };
    }

    beforeEach(() => {
        const loggerFactorySpy = {
            createLogger: vi.fn().mockName("LoggerFactory.createLogger")
        };
        loggerFactorySpy.createLogger.mockReturnValue({
            info: vi.fn().mockName("Logger.info"),
            off: vi.fn().mockName("Logger.off"),
            warn: vi.fn().mockName("Logger.warn"),
            debug: vi.fn().mockName("Logger.debug"),
            error: vi.fn().mockName("Logger.error")
        });
        mailMessagingServiceSpy = {
            events: vi.fn().mockName("MailMessagingService.events").mockReturnValue(of(null)),
            subscribed: vi.fn().mockName("MailMessagingService.subscribed"),
            toMemberMergeVariables: vi.fn().mockName("MailMessagingService.toMemberMergeVariables").mockReturnValue({})
        };
        memberServiceSpy = {createOrUpdateAll: vi.fn().mockName("MemberService.createOrUpdateAll").mockResolvedValue([])};
        broadcastServiceSpy = {broadcast: vi.fn().mockName("BroadcastService.broadcast")};

        TestBed.configureTestingModule({
            providers: [
                MailListUpdaterService,
                {provide: LoggerFactory, useValue: loggerFactorySpy},
                {provide: HttpClient, useValue: {post: vi.fn()}},
                {provide: CommonDataService, useValue: {responseFrom: vi.fn()}},
                {provide: DateUtilsService, useValue: {nowAsValue: vi.fn().mockReturnValue(UNSUBSCRIBED_NOW)}},
                {provide: StringUtilsService, useValue: {pluraliseWithCount: vi.fn().mockReturnValue("")}},
                {provide: MailMessagingService, useValue: mailMessagingServiceSpy},
                {provide: MailService, useValue: {queryContacts: vi.fn()}},
                {provide: MailListAuditService, useValue: {createOrUpdateAll: vi.fn()}},
                {provide: MemberService, useValue: memberServiceSpy},
                {provide: SalesforceConfigService, useValue: {cached: vi.fn().mockReturnValue({})}},
                {provide: BroadcastService, useValue: broadcastServiceSpy},
                {provide: FullNamePipe, useValue: {transform: vi.fn().mockReturnValue("Joanne Wilson")}}
            ]
        });
        service = TestBed.inject(MailListUpdaterService);
    });

    describe("setSubscription", () => {
        it("should record the time of an unsubscribe, as unchecking the member admin checkbox does", () => {
            const existing = member({mail: mailWith({id: 2, subscribed: true})});

            service.setSubscription(existing, 2, false);

            expect(service.subscriptionFor(existing, 2).subscribed).toBe(false);
            expect(service.subscriptionFor(existing, 2).unsubscribedAt).toBe(UNSUBSCRIBED_NOW);
        });

        it("should clear the unsubscribe time when subscribing again, as re-checking the checkbox does", () => {
            const existing = member({mail: mailWith({id: 2, subscribed: false, unsubscribedAt: UNSUBSCRIBED_NOW})});

            service.setSubscription(existing, 2, true);

            expect(service.subscriptionFor(existing, 2).subscribed).toBe(true);
            expect(service.subscriptionFor(existing, 2).unsubscribedAt).toBeUndefined();
        });

        it("should add a subscription for a list the member has never had one for", () => {
            const existing = member({mail: mailWith()});

            service.setSubscription(existing, 4, true);

            expect(service.subscriptionFor(existing, 4)).toEqual({id: 4, subscribed: true, unsubscribedAt: undefined});
        });

        it("should not record an unsubscribe for a member who was never subscribed", () => {
            const neverSubscribed = member({mail: mailWith({id: 2, subscribed: false})});

            service.setSubscription(neverSubscribed, 2, false);

            expect(service.subscriptionFor(neverSubscribed, 2).subscribed).toBe(false);
            expect(service.subscriptionFor(neverSubscribed, 2).unsubscribedAt).toBeUndefined();
        });

        it("should not record an unsubscribe when adding a subscription that starts out unsubscribed", () => {
            const existing = member({mail: mailWith()});

            service.setSubscription(existing, 4, false);

            expect(service.subscriptionFor(existing, 4)).toEqual({id: 4, subscribed: false});
        });

        it("should keep the original unsubscribe time rather than restamping it", () => {
            const optedOut = member({mail: mailWith({id: 2, subscribed: false, unsubscribedAt: UNSUBSCRIBED_EARLIER})});

            service.setSubscription(optedOut, 2, false);

            expect(service.subscriptionFor(optedOut, 2).unsubscribedAt).toBe(UNSUBSCRIBED_EARLIER);
        });

        it("should leave a member in the same state however the unsubscribe was made", () => {
            const viaCheckbox = member({id: "member-1", mail: mailWith({id: 2, subscribed: true})});
            const viaImport = member({id: "member-2", mail: mailWith({id: 2, subscribed: true})});

            service.setSubscription(viaCheckbox, 2, false);
            service.applyRows([row({subscribed: "No", email: "pete@example.com"})], [member({id: "member-2", email: "pete@example.com", mail: viaImport.mail})], lists);

            expect(service.subscriptionFor(viaImport, 2)).toEqual(service.subscriptionFor(viaCheckbox, 2));
        });
    });

    describe("rowsFrom", () => {
        it("should produce one row per member and list combination, subscribed or not", () => {
            const subscribedToAllMembers = member({mail: mailWith({id: 2, subscribed: true}, {id: 4, subscribed: false})});

            const rows = service.rowsFrom([subscribedToAllMembers], lists);

            expect(rows).toEqual([
                {email: "joanne@example.com", listName: "All Members", subscribed: "Yes"},
                {email: "joanne@example.com", listName: "Friday Email", subscribed: "No"}
            ]);
        });

        it("should produce a row per list for every member", () => {
            const rows = service.rowsFrom([member({id: "member-1"}), member({id: "member-2"})], lists);

            expect(rows.length).toBe(4);
        });

        it("should leave out a member with no email address, as no row could be matched back to them", () => {
            const rows = service.rowsFrom([member({email: null})], lists);

            expect(rows).toEqual([]);
        });

        it("should leave out a member whose email is blank space", () => {
            const rows = service.rowsFrom([member({email: "   "})], lists);

            expect(rows).toEqual([]);
        });

        it("should keep members who have an email when others do not", () => {
            const withEmail = member({id: "member-1", email: "joanne@example.com"});
            const withoutEmail = member({id: "member-2", email: null});

            const rows = service.rowsFrom([withEmail, withoutEmail], lists);

            expect(rows.every(row => row.email === "joanne@example.com")).toBe(true);
            expect(rows.length).toBe(lists.length);
        });

        it("should sort rows by email then list name, whatever order they arrive in", () => {
            const pete = member({id: "member-1", email: "pete@example.com"});
            const joanne = member({id: "member-2", email: "Joanne@example.com"});

            const rows = service.rowsFrom([pete, joanne], [fridayEmail, allMembers]);

            expect(rows.map(row => `${row.email} / ${row.listName}`)).toEqual([
                "Joanne@example.com / All Members",
                "Joanne@example.com / Friday Email",
                "pete@example.com / All Members",
                "pete@example.com / Friday Email"
            ]);
        });
    });

    describe("applyRows", () => {
        it("should subscribe a matched member and report the member as changed", () => {
            const existing = member({});

            const summary = service.applyRows([row({})], [existing], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.SUBSCRIBED);
            expect(service.subscribedToList(existing, 2)).toBe(true);
            expect(summary.membersChanged).toEqual([existing]);
        });

        it("should unsubscribe a matched member and record when it happened", () => {
            const existing = member({mail: mailWith({id: 2, subscribed: true})});

            const summary = service.applyRows([row({subscribed: "No"})], [existing], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.UNSUBSCRIBED);
            expect(service.subscribedToList(existing, 2)).toBe(false);
            expect(service.subscriptionFor(existing, 2).unsubscribedAt).toBe(UNSUBSCRIBED_NOW);
        });

        it("should change several lists for the same member across rows", () => {
            const existing = member({mail: mailWith({id: 2, subscribed: false}, {id: 4, subscribed: true})});

            const summary = service.applyRows([
                row({listName: "All Members", subscribed: "Yes"}),
                row({listName: "Friday Email", subscribed: "No"})
            ], [existing], lists);

            expect(summary.results.map(result => result.outcome))
                .toEqual([ListSubscriptionOutcome.SUBSCRIBED, ListSubscriptionOutcome.UNSUBSCRIBED]);
            expect(service.subscribedToList(existing, 2)).toBe(true);
            expect(service.subscribedToList(existing, 4)).toBe(false);
            expect(summary.membersChanged).toEqual([existing]);
        });

        it("should report each outcome against the row it came from", () => {
            const summary = service.applyRows([row({}), row({listName: "Nope"})], [member({})], lists);

            expect(summary.results[0].row.listName).toBe("All Members");
            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.SUBSCRIBED);
            expect(summary.results[1].row.listName).toBe("Nope");
            expect(summary.results[1].outcome).toBe(ListSubscriptionOutcome.UNKNOWN_LIST);
        });

        it("should report a row as unchanged and not mark the member changed when already as requested", () => {
            const existing = member({mail: mailWith({id: 2, subscribed: true})});

            const summary = service.applyRows([row({})], [existing], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.UNCHANGED);
            expect(summary.membersChanged).toEqual([]);
        });

        it("should report a list that does not exist on the site and create nothing", () => {
            const existing = member({});

            const summary = service.applyRows([row({listName: "Some Other List"})], [existing], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.UNKNOWN_LIST);
            expect(summary.membersChanged).toEqual([]);
        });

        it("should report a row matching no member rather than creating one", () => {
            const summary = service.applyRows([row({email: "nobody@example.com"})], [member({})], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.NO_MATCHING_MEMBER);
            expect(summary.membersChanged).toEqual([]);
        });

        it("should report a row matching more than one member without applying it", () => {
            const first = member({id: "member-1"});
            const second = member({id: "member-2"});

            const summary = service.applyRows([row({})], [first, second], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.AMBIGUOUS_MEMBER_MATCH);
            expect(summary.membersChanged).toEqual([]);
        });

        it("should report a row with no email address as skipped, since a member cannot be matched without one", () => {
            const existing = member({email: null});

            const summary = service.applyRows([row({email: ""})], [existing], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.NO_EMAIL_ADDRESS);
            expect(summary.membersChanged).toEqual([]);
        });

        it("should report a subscribed value it cannot interpret", () => {
            const summary = service.applyRows([row({subscribed: "maybe"})], [member({})], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.UNRECOGNISED_SUBSCRIBED_VALUE);
        });

        it("should treat an empty subscribed cell as No and unsubscribe the member", () => {
            const existing = member({mail: mailWith({id: 2, subscribed: true})});

            const summary = service.applyRows([row({subscribed: ""})], [existing], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.UNSUBSCRIBED);
            expect(service.subscribedToList(existing, 2)).toBe(false);
        });

        it("should leave an unsubscribed member alone when the subscribed cell is empty", () => {
            const summary = service.applyRows([row({subscribed: ""})], [member({})], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.UNCHANGED);
            expect(summary.membersChanged).toEqual([]);
        });

        it("should match a member whose email differs only by case or spacing", () => {
            const existing = member({});

            const summary = service.applyRows([row({email: "  JOANNE@example.com "})], [existing], lists);

            expect(summary.results[0].outcome).toBe(ListSubscriptionOutcome.SUBSCRIBED);
        });

        it("should accept common spellings of yes and no", () => {
            expect(service.applyRows([row({subscribed: "TRUE"})], [member({})], lists).results[0].outcome)
                .toBe(ListSubscriptionOutcome.SUBSCRIBED);
            expect(service.applyRows([row({subscribed: "n"})], [member({mail: mailWith({id: 2, subscribed: true})})], lists).results[0].outcome)
                .toBe(ListSubscriptionOutcome.UNSUBSCRIBED);
        });

        it("should count subscribes and unsubscribes separately for each list", () => {
            const before = [member({mail: mailWith({id: 2, subscribed: false}, {id: 4, subscribed: true})})];
            const after = cloneDeep(before);

            const summary = service.applyRows([
                row({listName: "All Members", subscribed: "Yes"}),
                row({listName: "Friday Email", subscribed: "No"})
            ], after, lists);

            expect(service.changeCountsByList(summary.results, before, after, lists)).toEqual([
                {listName: "All Members", subscribersBefore: 0, subscribing: 1, unsubscribing: 0, subscribersAfter: 1},
                {listName: "Friday Email", subscribersBefore: 1, subscribing: 0, unsubscribing: 1, subscribersAfter: 0}
            ]);
        });

        it("should report the subscriber totals each list held before and would hold after", () => {
            const before = [
                member({id: "member-1", email: "joanne@example.com"}),
                member({id: "member-2", email: "pete@example.com", mail: mailWith({id: 2, subscribed: true})})
            ];
            const after = cloneDeep(before);

            const summary = service.applyRows([row({})], after, lists);

            expect(service.changeCountsByList(summary.results, before, after, lists))
                .toEqual([{listName: "All Members", subscribersBefore: 1, subscribing: 1, unsubscribing: 0, subscribersAfter: 2}]);
        });

        it("should not count a subscribed member with no email address in either total", () => {
            const before = [
                member({id: "member-1", email: null, mail: mailWith({id: 2, subscribed: true})}),
                member({id: "member-2", email: "pete@example.com"})
            ];
            const after = cloneDeep(before);

            const summary = service.applyRows([row({email: "pete@example.com"})], after, lists);

            expect(service.changeCountsByList(summary.results, before, after, lists))
                .toEqual([{listName: "All Members", subscribersBefore: 0, subscribing: 1, unsubscribing: 0, subscribersAfter: 1}]);
        });

        it("should leave out lists where nothing would change", () => {
            const before = [member({mail: mailWith({id: 2, subscribed: true})})];
            const after = cloneDeep(before);

            const summary = service.applyRows([row({})], after, lists);

            expect(service.changeCountsByList(summary.results, before, after, lists)).toEqual([]);
        });

        it("should leave out rows it could not apply", () => {
            const before = [member({})];
            const after = cloneDeep(before);

            const summary = service.applyRows([row({listName: "Nope"}), row({email: "nobody@example.com"})], after, lists);

            expect(service.changeCountsByList(summary.results, before, after, lists)).toEqual([]);
        });
    });

    describe("retrospectivePreview", () => {
        it("should report no changes when members already match the settings", () => {
            mailMessagingServiceSpy.subscribed.mockReturnValue(false);

            const preview = service.retrospectivePreview(allMembers, autoSubscribeSetting, [member({})]);

            expect(preview.changes).toEqual([]);
            expect(preview.subscribingCount).toBe(0);
            expect(preview.unsubscribingCount).toBe(0);
        });

        it("should report members the settings would now subscribe", () => {
            mailMessagingServiceSpy.subscribed.mockReturnValue(true);
            const existing = member({});

            const preview = service.retrospectivePreview(allMembers, autoSubscribeSetting, [existing]);

            expect(preview.listId).toBe(2);
            expect(preview.listName).toBe("All Members");
            expect(preview.subscribingCount).toBe(1);
            expect(preview.unsubscribingCount).toBe(0);
            expect(preview.changes[0].member).toBe(existing);
            expect(preview.changes[0].subscribed).toBe(true);
        });

        it("should report members the settings would now unsubscribe", () => {
            mailMessagingServiceSpy.subscribed.mockReturnValue(false);
            const existing = member({mail: mailWith({id: 2, subscribed: true})});

            const preview = service.retrospectivePreview(allMembers, autoSubscribeSetting, [existing]);

            expect(preview.unsubscribingCount).toBe(1);
            expect(preview.subscribingCount).toBe(0);
            expect(preview.changes[0].subscribed).toBe(false);
        });

        it("should never subscribe a member who has an unsubscribe on record", () => {
            mailMessagingServiceSpy.subscribed.mockReturnValue(true);
            const optedOut = member({mail: mailWith({id: 2, subscribed: false, unsubscribedAt: UNSUBSCRIBED_NOW})});

            const preview = service.retrospectivePreview(allMembers, autoSubscribeSetting, [optedOut]);

            expect(preview.changes).toEqual([]);
            expect(preview.subscribingCount).toBe(0);
            expect(preview.keptUnsubscribedCount).toBe(1);
        });

        it("should still subscribe members who never unsubscribed", () => {
            mailMessagingServiceSpy.subscribed.mockReturnValue(true);

            const preview = service.retrospectivePreview(allMembers, autoSubscribeSetting, [member({})]);

            expect(preview.subscribingCount).toBe(1);
            expect(preview.keptUnsubscribedCount).toBe(0);
        });

        it("should subscribe the willing while leaving those who unsubscribed alone", () => {
            mailMessagingServiceSpy.subscribed.mockReturnValue(true);
            const willing = member({id: "member-1"});
            const optedOut = member({id: "member-2", mail: mailWith({id: 2, subscribed: false, unsubscribedAt: UNSUBSCRIBED_NOW})});

            const preview = service.retrospectivePreview(allMembers, autoSubscribeSetting, [willing, optedOut]);

            expect(preview.changes.map(change => change.member)).toEqual([willing]);
            expect(preview.keptUnsubscribedCount).toBe(1);
        });

        it("should still unsubscribe a member who has an unsubscribe on record when the settings now exclude them", () => {
            mailMessagingServiceSpy.subscribed.mockReturnValue(false);
            const resubscribed = member({mail: mailWith({id: 2, subscribed: true, unsubscribedAt: UNSUBSCRIBED_NOW})});

            const preview = service.retrospectivePreview(allMembers, autoSubscribeSetting, [resubscribed]);

            expect(preview.unsubscribingCount).toBe(1);
            expect(preview.keptUnsubscribedCount).toBe(0);
        });

        it("should count subscribing, unsubscribing and overrides across members", () => {
            const toSubscribe = member({id: "member-1"});
            const toUnsubscribe = member({id: "member-2", mail: mailWith({id: 2, subscribed: true})});
            mailMessagingServiceSpy.subscribed.mockImplementation((_listSetting: ListSetting, subject: Member) => subject.id === "member-1");

            const preview = service.retrospectivePreview(allMembers, autoSubscribeSetting, [toSubscribe, toUnsubscribe]);

            expect(preview.subscribingCount).toBe(1);
            expect(preview.unsubscribingCount).toBe(1);
            expect(preview.changes.length).toBe(2);
        });
    });

    describe("applyRetrospective", () => {
        it("should apply each change and return the members it changed", () => {
            mailMessagingServiceSpy.subscribed.mockReturnValue(true);
            const existing = member({});
            const preview = service.retrospectivePreview(allMembers, autoSubscribeSetting, [existing]);

            const changed = service.applyRetrospective(preview);

            expect(service.subscribedToList(existing, 2)).toBe(true);
            expect(changed).toEqual([existing]);
        });

        it("should leave members untouched when the preview is not applied", () => {
            mailMessagingServiceSpy.subscribed.mockReturnValue(true);
            const existing = member({});

            service.retrospectivePreview(allMembers, autoSubscribeSetting, [existing]);

            expect(service.subscribedToList(existing, 2)).toBe(false);
        });
    });

    describe("saveAndSyncChanges", () => {
        const notify = {success: vi.fn(), error: vi.fn()} as any;

        it("should save the changed members and hand them to the same mail provider sync every other save uses", async () => {
            const syncSpy = vi.spyOn(service, "syncChangedMembersToBrevo").mockResolvedValue(undefined);
            const changed = member({});

            await service.saveAndSyncChanges(notify, [changed], [changed]);

            expect(memberServiceSpy.createOrUpdateAll).toHaveBeenCalledWith([changed]);
            expect(syncSpy).toHaveBeenCalledWith(notify, [changed]);
        });

        it("should leave announcing the change to the sync rather than announcing it twice", async () => {
            vi.spyOn(service, "syncChangedMembersToBrevo").mockResolvedValue(undefined);

            await service.saveAndSyncChanges(notify, [member({})], [member({})]);

            expect(broadcastServiceSpy.broadcast).not.toHaveBeenCalled();
        });

        it("should write nothing when no member changed", async () => {
            const syncSpy = vi.spyOn(service, "syncChangedMembersToBrevo").mockResolvedValue(undefined);

            await service.saveAndSyncChanges(notify, [], [member({})]);

            expect(memberServiceSpy.createOrUpdateAll).not.toHaveBeenCalled();
            expect(syncSpy).not.toHaveBeenCalled();
            expect(broadcastServiceSpy.broadcast).not.toHaveBeenCalled();
        });
    });
});
