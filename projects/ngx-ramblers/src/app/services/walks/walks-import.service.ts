import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { EventType } from "../../models/walk.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { LocalWalksAndEventsService } from "../walks-and-events/local-walks-and-events.service";
import { RamblersWalksAndEventsService } from "../walks-and-events/ramblers-walks-and-events.service";
import { Organisation, SystemConfig } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";
import first from "lodash-es/first";
import last from "lodash-es/last";
import { DateUtilsService } from "../date-utils.service";
import omit from "lodash-es/omit";
import { GroupEventService } from "../walks-and-events/group-event.service";
import { MemberService } from "../member/member.service";
import { NumberUtilsService } from "../number-utils.service";
import { MemberBulkLoadService } from "../member/member-bulk-load.service";
import {
  BulkLoadMemberAndMatchToWalks,
  Member,
  MemberAction,
  RamblersMember,
  RamblersMemberAndContact,
  WalksImportPreparation
} from "../../models/member.model";
import { MemberNamingService } from "../member/member-naming.service";
import { DataQueryOptions } from "../../models/api-request.model";
import { StringUtilsService } from "../string-utils.service";
import { Contact, RamblersEventType } from "../../models/ramblers-walks-manager";
import { AlertInstance } from "../notifier.service";
import { ExtendedGroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class WalksImportService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksImportService", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private localWalksAndEventsService = inject(LocalWalksAndEventsService);
  private dateUtils = inject(DateUtilsService);
  private numberUtils = inject(NumberUtilsService);
  private walkEventService = inject(GroupEventService);
  private stringUtils = inject(StringUtilsService);
  private memberBulkLoadService = inject(MemberBulkLoadService);
  private memberService = inject(MemberService);
  private memberNamingService = inject(MemberNamingService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  public group: Organisation;
  private systemConfig: SystemConfig;

  constructor() {
    this.applyConfig();
  }

  private applyConfig() {
    this.logger.info("applyConfig called");
    this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
      this.logger.info("systemConfig:", this.systemConfig);
    });
  }

  async prepareImport(messages: string[]): Promise<WalksImportPreparation> {
    const searchString = "Penny";
    const dataQueryOptions: DataQueryOptions = {criteria: {}, sort: {walkDate: 1}};
    const walksToImport = await this.ramblersWalksAndEventsService.all({
      dataQueryOptions,
      types: [RamblersEventType.GROUP_WALK]
    });
    messages.push(`Found ${this.stringUtils.pluraliseWithCount(walksToImport.length, "walk")} to import`);
    const walkLeaders = await this.ramblersWalksAndEventsService.queryWalkLeaders();
    messages.push(`Found ${this.stringUtils.pluraliseWithCount(walkLeaders.length, "walk leader")} to import`);
    const firstWalk = first(walksToImport);
    const lastWalk = last(walksToImport);
    const walksWithContactId: ExtendedGroupEvent[] = walksToImport.filter(item => item?.fields?.contactDetails?.contactId);
    const walksWithContactNameSearchString: ExtendedGroupEvent[] = walksToImport.filter(item => JSON.stringify(item).includes(searchString));
    this.logger.info("firstWalk:", firstWalk, "on", this.dateUtils.displayDate(firstWalk?.groupEvent?.start_date_time), "lastWalk:", lastWalk, "on", this.dateUtils.displayDate(lastWalk?.groupEvent?.start_date_time), "walksWithContactId:", walksWithContactId, "walksWithContactNameSearchString:", `${searchString}:`, walksWithContactNameSearchString);
    messages.push(`First walk is on ${this.dateUtils.displayDate(firstWalk?.groupEvent?.start_date_time)}`);
    messages.push(`Last walk is on ${this.dateUtils.displayDate(lastWalk.groupEvent.start_date_time)}`);
    const existingWalks: ExtendedGroupEvent[] = await this.localWalksAndEventsService.all();
    const existingWalksWithinRange: ExtendedGroupEvent[] = existingWalks.filter(walk => walk.groupEvent.start_date_time >= firstWalk.groupEvent.start_date_time && walk.groupEvent.start_date_time <= lastWalk.groupEvent.start_date_time);
    messages.push(`${this.stringUtils.pluraliseWithCount(existingWalksWithinRange.length, "existing walk")} within date range`);
    this.logger.info("existingWalks:", existingWalks, "walks to import within range",);
    this.logger.info("walkLeaders:", walkLeaders);
    const members = await this.memberService.all();
    const ramblersMemberAndContacts: RamblersMemberAndContact[] = walkLeaders.map((walkLeader: Contact) => {
      const firstAndLastName = this.memberNamingService.firstAndLastNameFrom(walkLeader.name);
      const ramblersMember: RamblersMember = {
        mobileNumber: walkLeader.telephone,
        firstName: firstAndLastName?.firstName,
        lastName: firstAndLastName?.lastName,
        email: null,
        membershipNumber: null,
        postcode: null,
        emailMarketingConsent: null,
        emailPermissionLastUpdated: null,
        jointWith: null,
        landlineTelephone: null,
        title: null,
        type: null,
      };
      return {
        contact: walkLeader,
        ramblersMember
      };
    });
    const unmatched: BulkLoadMemberAndMatchToWalks = {
      bulkLoadMemberAndMatch: {
        memberMatchType: "none",
        member: null,
        ramblersMember: null,
        contact: null,
        memberMatch: MemberAction.notFound
      }, walks: []
    };
    const bulkLoadMembersAndMatchesToWalks: BulkLoadMemberAndMatchToWalks[] = ramblersMemberAndContacts
      .map(ramblersMemberAndContact => this.memberBulkLoadService.bulkLoadMemberAndMatchFor(ramblersMemberAndContact, members, this.systemConfig))
      .map(bulkLoadMemberAndMatch => ({bulkLoadMemberAndMatch, walks: []})).concat(unmatched);

    const unmatchedToMember: BulkLoadMemberAndMatchToWalks = bulkLoadMembersAndMatchesToWalks
      .find(bulkLoadMemberAndMatch => bulkLoadMemberAndMatch === unmatched);

    walksToImport.forEach(walk => {
      const matchToWalk: BulkLoadMemberAndMatchToWalks = bulkLoadMembersAndMatchesToWalks
        .find(bulkLoadMemberAndMatch => {
          if (bulkLoadMemberAndMatch.bulkLoadMemberAndMatch?.contact?.name) {
            return bulkLoadMemberAndMatch.bulkLoadMemberAndMatch?.contact?.name === walk?.fields?.contactDetails?.displayName;
          } else if (bulkLoadMemberAndMatch.bulkLoadMemberAndMatch?.member?.mobileNumber) {
            return this.numberUtils.asNumber(bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.member.mobileNumber) === this.numberUtils.asNumber(walk?.fields?.contactDetails?.phone);
          } else if (bulkLoadMemberAndMatch.bulkLoadMemberAndMatch?.contact?.id) {
            return bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.contact.id === walk.fields.publishing.ramblers.contactName;
          }
        });
      if (matchToWalk) {
        matchToWalk.walks.push(walk);
      } else {
        if (unmatchedToMember) {
          unmatchedToMember.walks.push(walk);
        }
      }
    });
    bulkLoadMembersAndMatchesToWalks.forEach(bulkLoadMemberAndMatchToWalks => {
      if (bulkLoadMemberAndMatchToWalks.walks.length === 0) {
        bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch = MemberAction.skipped;
      }
    });
    const bulkLoadMembersAndMatchesToWalksWithContactNameSearchString: BulkLoadMemberAndMatchToWalks[] = bulkLoadMembersAndMatchesToWalks.filter(item => JSON.stringify(item).includes(searchString));
    this.logger.info("bulkLoadMemberAndMatches:", bulkLoadMembersAndMatchesToWalks, "bulkLoadMembersAndMatchesToWalksWithContactNameSearchString:", `${searchString}:`, bulkLoadMembersAndMatchesToWalksWithContactNameSearchString);
    messages.push(`${walksToImport.length - unmatchedToMember.walks.length} out of ${walksToImport?.length} were matched to a walk leader`);
    return Promise.resolve({bulkLoadMembersAndMatchesToWalks, existingWalksWithinRange});
  }

  async performImport(walksImportPreparation: WalksImportPreparation, messages: string[], notify: AlertInstance): Promise<any> {
    const errorMessages: string[]=[];
    let createdWalks = 0;
    let createdMembers = 0;
    const deletions = await Promise.all(walksImportPreparation.existingWalksWithinRange.map(walk => this.localWalksAndEventsService.delete(walk)));
    messages.push(`${deletions.length} existing walks deleted`);
    const imports = await Promise.all(walksImportPreparation.bulkLoadMembersAndMatchesToWalks.map(async bulkLoadMemberAndMatchToWalks => {
      const member = bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.member;
      if (bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch === MemberAction.found) {
        return bulkLoadMemberAndMatchToWalks.walks.map(walk => {
          createdWalks++;
          return this.applyWalkLeaderIfSuppliedAndSaveWalk(walk, member);
        });
      } else if (bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch === MemberAction.created) {
        if (bulkLoadMemberAndMatchToWalks.walks.length > 0) {
          const qualifier = `for ${member.firstName} ${member.lastName}`;
          const createdMember: Member = await this.memberService.createOrUpdate(member)
            .then((savedMember: Member) => {
              notify.success({title: "Walks Import", message: `Member creation ${qualifier} was successful`});
              return savedMember;
            }).catch(response => {
              this.logger.error("member save error for member:", member, "response:", response);
              bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch = MemberAction.error;
              const message = `Member creation ${qualifier} failed`;
              errorMessages.push(message);
              messages.push(message);
              notify.warning({title: "Walks Import", message});
              return null;
            });
          createdMembers++;
          return bulkLoadMemberAndMatchToWalks.walks.map(walk => {
            createdWalks++;
            return this.applyWalkLeaderIfSuppliedAndSaveWalk(walk, createdMember);
          });
        } else {
          this.logger.info("member:", member, "was not matched to any walks");
          return Promise.resolve();
        }
      } else {
        this.logger.info("processing memberAction:", bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch, "with", this.stringUtils.pluraliseWithCount(bulkLoadMemberAndMatchToWalks.walks.length, "matched walk"));
        return bulkLoadMemberAndMatchToWalks.walks.map(walk => {
          createdWalks++;
          return this.applyWalkLeaderIfSuppliedAndSaveWalk(walk);
        });
      }
    }));
    this.logger.info("imports:", imports);
    messages.push(`${this.stringUtils.pluraliseWithCount(createdMembers, "new member")} created, ${this.stringUtils.pluraliseWithCount(createdWalks, "walk")} imported`);
    return errorMessages;
  }

  private applyWalkLeaderIfSuppliedAndSaveWalk(walk: ExtendedGroupEvent, member?: Member): Promise<ExtendedGroupEvent> {
    const unsavedWalk: ExtendedGroupEvent = omit(walk, ["_id", "id"]) as ExtendedGroupEvent;
    if (member) {
      unsavedWalk.fields.contactDetails.memberId = member.id;
    }
    const event = this.walkEventService.createEventIfRequired(unsavedWalk, EventType.APPROVED, "Imported from Walks Manager");
    this.walkEventService.writeEventIfRequired(unsavedWalk, event);
    return this.localWalksAndEventsService.createOrUpdate(unsavedWalk);
  }
}
