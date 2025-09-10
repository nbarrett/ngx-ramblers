import TurndownService from "turndown";
import Papa from "papaparse";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { EventType, ImportData, ImportStage } from "../../models/walk.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { LocalWalksAndEventsService } from "../walks-and-events/local-walks-and-events.service";
import { RamblersWalksAndEventsService } from "../walks-and-events/ramblers-walks-and-events.service";
import { Organisation, SystemConfig } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";
import { first } from "es-toolkit/compat";
import { last } from "es-toolkit/compat";
import { DateUtilsService } from "../date-utils.service";
import { omit } from "es-toolkit/compat";
import { GroupEventService } from "../walks-and-events/group-event.service";
import { MemberService } from "../member/member.service";
import { NumberUtilsService } from "../number-utils.service";
import { MemberBulkLoadService } from "../member/member-bulk-load.service";
import {
  BulkLoadMemberAndMatch,
  BulkLoadMemberAndMatchToWalk,
  Member,
  MemberAction,
  RamblersMember,
  RamblersMemberAndContact
} from "../../models/member.model";
import { MemberNamingService } from "../member/member-naming.service";
import { DataQueryOptions, FilterCriteria } from "../../models/api-request.model";
import { StringUtilsService } from "../string-utils.service";
import { Contact, RamblersEventType, WalkStatus, WalkUploadColumnHeading } from "../../models/ramblers-walks-manager";
import { AlertInstance } from "../notifier.service";
import {
  ExtendedGroupEvent,
  GroupEvent,
  GroupEventUniqueKey,
  HasGroupCodeAndName,
  InputSource
} from "../../models/group-event.model";
import { ServerFileNameData } from "../../models/aws-object.model";
import { enumValues, TypedKeyValue } from "../../functions/enums";
import { Feature } from "../../models/walk-feature.model";
import { ExtendedGroupEventQueryService } from "../walks-and-events/extended-group-event-query.service";
import { EventDefaultsService } from "../event-defaults.service";
import { groupBy } from "es-toolkit/compat";
import { isEqual } from "es-toolkit/compat";

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
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private eventDefaultsService = inject(EventDefaultsService);
  public group: Organisation;
  private systemConfig: SystemConfig;
  private turndownService = new TurndownService();
  private enrichWalkLeaders = false;
  private performMatches = false;
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

  private htmlToMarkdown(html: string): string {
    return this.turndownService.turndown(html || "");
  }

  importDataDefaults(inputSource: InputSource): ImportData {
    return {
      inputSource,
      groupCodeAndName: {
        group_name: this.systemConfig.group.shortName,
        group_code: this.systemConfig.group.groupCode
      },
      errorMessages: [],
      messages: [],
      importStage: ImportStage.NONE, fileImportRows: [],
      existingWalksWithinRange: [],
      bulkLoadMembersAndMatchesToWalks: []
    };
  }

  async prepareImport(importData: ImportData): Promise<ImportData> {
    const dataQueryOptions: DataQueryOptions = {criteria: {}, sort: {walkDate: 1}};
    const walksToImport: ExtendedGroupEvent[] = await this.ramblersWalksAndEventsService.all({
      inputSource: importData.inputSource,
      suppressEventLinking: true,
      dataQueryOptions,
      types: [RamblersEventType.GROUP_WALK]
    });
    return await this.prepareImportOfEvents(importData, walksToImport);
  }

  public async prepareImportOfEvents(importData: ImportData, walksToImport: ExtendedGroupEvent[]): Promise<ImportData> {
    const members = await this.memberService.all();
    if (this.enrichWalkLeaders) {
      const walkLeaders: Contact[] = await this.ramblersWalksAndEventsService.queryWalkLeaders();
      importData.messages.push(`Found ${this.stringUtils.pluraliseWithCount(walkLeaders.length, "walk leader")} to import`);
      this.addToWalkLeaders(walkLeaders, members);
      this.logger.info("walkLeaders:", walkLeaders);
    }
    const firstWalk = first(walksToImport);
    const lastWalk = last(walksToImport);
    const duplicateKeys = this.duplicateKeys(walksToImport);
    const walksWithContactId: ExtendedGroupEvent[] = walksToImport.filter(item => item?.fields?.contactDetails?.contactId);
    this.logger.info("firstWalk:", firstWalk, "on", this.dateUtils.displayDate(firstWalk?.groupEvent?.start_date_time), "lastWalk:", lastWalk, "on", this.dateUtils.displayDate(lastWalk?.groupEvent?.start_date_time), "walksWithContactId:", walksWithContactId);
    importData.messages.push(`First walk is on ${this.dateUtils.displayDate(firstWalk?.groupEvent?.start_date_time)}`);
    importData.messages.push(`Last walk is on ${this.dateUtils.displayDate(lastWalk.groupEvent.start_date_time)}`);
    const existingWalks: ExtendedGroupEvent[] = await this.localWalksAndEventsService.all({
      inputSource: importData.inputSource,
      suppressEventLinking: true,
      groupCode: importData.groupCodeAndName.group_code, types: [RamblersEventType.GROUP_WALK],
      dataQueryOptions: this.extendedGroupEventQueryService.dataQueryOptions({
        ascending: true,
        selectType: FilterCriteria.DATE_RANGE
      }, firstWalk?.groupEvent?.start_date_time, lastWalk?.groupEvent?.start_date_time)
    });
    importData.existingWalksWithinRange = existingWalks.filter(walk => {
      const withinRange = importData.groupCodeAndName.group_code === walk.groupEvent.group_code
        && walk.groupEvent.start_date_time >= firstWalk.groupEvent.start_date_time
        && walk.groupEvent.start_date_time <= lastWalk.groupEvent.start_date_time;
      this.logger.off("walk.groupEvent:", walk.groupEvent, "importData.groupCodeAndName:", importData.groupCodeAndName.group_code, "walk.groupEvent.group_code:", walk.groupEvent.group_code, "withinRange:", withinRange);
      return withinRange;
    });
    importData.messages.push(`${this.stringUtils.pluraliseWithCount(importData.existingWalksWithinRange.length, "existing walk")} within range of import will be deleted before import`);
    this.logger.info("existingWalks:", existingWalks, "walks to import within range");
    const bulkLoadMembersAndMatchesToWalks: BulkLoadMemberAndMatchToWalk[] = walksToImport.map(event => {
      const contact: Contact = this.eventDefaultsService.nameToContact(event.fields.contactDetails?.displayName);
      const firstAndLastName = this.memberNamingService.firstAndLastNameFrom(contact.name);
      const ramblersMember: RamblersMember = {
        mobileNumber: contact.telephone,
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
      const ramblersMemberAndContact: RamblersMemberAndContact = {
        contact,
        ramblersMember
      };
      const bulkLoadMemberAndMatch: BulkLoadMemberAndMatch = this.memberBulkLoadService.bulkLoadMemberAndMatchFor(ramblersMemberAndContact, members, this.systemConfig);
      if (!bulkLoadMemberAndMatch.member.id) {
        bulkLoadMemberAndMatch.member = null;
        bulkLoadMemberAndMatch.memberMatch = MemberAction.notFound;
      }
      return {
        include: this.includeWalk(event, duplicateKeys),
        bulkLoadMemberAndMatch,
        event
      };
    });
    importData.bulkLoadMembersAndMatchesToWalks = bulkLoadMembersAndMatchesToWalks;
    this.optionallyPerformMatching(bulkLoadMembersAndMatchesToWalks, walksToImport);
    this.logger.info("bulkLoadMemberAndMatches:", bulkLoadMembersAndMatchesToWalks, "importData.messages:", importData.messages);
    return Promise.resolve(importData);
  }

  private optionallyPerformMatching(bulkLoadMembersAndMatchesToWalks: BulkLoadMemberAndMatchToWalk[], walksToImport: ExtendedGroupEvent[]) {
    const unmatched: BulkLoadMemberAndMatchToWalk = {
      include: true,
      bulkLoadMemberAndMatch: {
        memberMatchType: "none",
        member: null,
        ramblersMember: null,
        contact: null,
        memberMatch: MemberAction.notFound
      }, event: null
    };

    if (this.performMatches) {
      const unmatchedToMember: BulkLoadMemberAndMatchToWalk = bulkLoadMembersAndMatchesToWalks
        .find(bulkLoadMemberAndMatch => bulkLoadMemberAndMatch === unmatched);

      walksToImport.forEach(walk => {
        const bulkLoadMemberAndMatchToWalk: BulkLoadMemberAndMatchToWalk = bulkLoadMembersAndMatchesToWalks
          .find(bulkLoadMemberAndMatch => {
            if (bulkLoadMemberAndMatch.bulkLoadMemberAndMatch?.contact?.name) {
              return bulkLoadMemberAndMatch.bulkLoadMemberAndMatch?.contact?.name === walk?.fields?.contactDetails?.displayName;
            } else if (bulkLoadMemberAndMatch.bulkLoadMemberAndMatch?.member?.mobileNumber) {
              return this.numberUtils.asNumber(bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.member.mobileNumber) === this.numberUtils.asNumber(walk?.fields?.contactDetails?.phone);
            } else if (bulkLoadMemberAndMatch.bulkLoadMemberAndMatch?.contact?.id) {
              return bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.contact.id === walk.fields.publishing.ramblers.contactName;
            }
          });
        if (bulkLoadMemberAndMatchToWalk) {
          bulkLoadMemberAndMatchToWalk.event = walk;
        } else {
          if (unmatchedToMember) {
            unmatchedToMember.event = walk;
          }
        }
      });
      bulkLoadMembersAndMatchesToWalks.forEach(bulkLoadMemberAndMatchToWalks => {
        if (!bulkLoadMemberAndMatchToWalks.event) {
          bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch = MemberAction.skipped;
        }
      });
    }
  }

  private addToWalkLeaders(walkLeaders: Contact[], members: Member[]): void {
    const contacts: Contact[] = members.map(member => this.eventDefaultsService.memberToContact(member));
    this.logger.info(this.stringUtilsService.pluraliseWithCount(walkLeaders.length, "walk leader"), "found, adding existing members:", members, "as contacts:", contacts);
    walkLeaders.push(...contacts);
  }

  async saveImportedWalks(importData: ImportData, notify: AlertInstance): Promise<void> {
    let createdWalks = 0;
    let createdMembers = 0;
    const deletions = await Promise.all(importData.existingWalksWithinRange.map(walk => this.localWalksAndEventsService.delete(walk)));
    importData.messages.push(`${deletions.length} existing walks deleted`);
    await Promise.all(importData.bulkLoadMembersAndMatchesToWalks
      .filter(item => item.include)
      .map(async bulkLoadMemberAndMatchToWalks => {
      const member = bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.member;
        if (this.isAMatchFor(bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch)) {
          createdWalks++;
          return this.applyWalkLeaderIfSuppliedAndSaveWalk(bulkLoadMemberAndMatchToWalks.event, member);
      } else if (bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch === MemberAction.created) {
          if (bulkLoadMemberAndMatchToWalks.event) {
          const qualifier = `for ${member.firstName} ${member.lastName}`;
          const createdMember: Member = await this.memberService.createOrUpdate(member)
            .then((savedMember: Member) => {
              notify.success({title: "Walks Import", message: `Member creation ${qualifier} was successful`});
              return savedMember;
            }).catch(response => {
              this.logger.error("member save error for member:", member, "response:", response);
              bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch = MemberAction.error;
              const message = `Member creation ${qualifier} failed`;
              importData.errorMessages.push(message);
              notify.warning({title: "Walks Import", message});
              return null;
            });
          createdMembers++;
            createdWalks++;
            return this.applyWalkLeaderIfSuppliedAndSaveWalk(bulkLoadMemberAndMatchToWalks.event, createdMember);
        } else {
          this.logger.info("member:", member, "was not matched to any walks");
          return Promise.resolve();
        }
      } else {
          this.logger.info("processing memberAction:", bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch, "with event", bulkLoadMemberAndMatchToWalks.event);
          createdWalks++;
          return this.applyWalkLeaderIfSuppliedAndSaveWalk(bulkLoadMemberAndMatchToWalks.event);
      }
    }));
    importData.messages.push(`${this.stringUtils.pluraliseWithCount(createdMembers, "new member")} created, ${this.stringUtils.pluraliseWithCount(createdWalks, "walk")} imported`);
  }

  private async applyWalkLeaderIfSuppliedAndSaveWalk(walk: ExtendedGroupEvent, member?: Member): Promise<ExtendedGroupEvent> {
    const unsavedWalk: ExtendedGroupEvent = omit(walk, ["_id", "id"]) as ExtendedGroupEvent;
    if (member) {
      unsavedWalk.groupEvent.walk_leader = this.eventDefaultsService.memberToContact(member);
      unsavedWalk.fields.contactDetails = this.eventDefaultsService.contactDetailsFrom(member);
    }
    const oldUrl = unsavedWalk.groupEvent.url;
    unsavedWalk.groupEvent.url = await this.localWalksAndEventsService.urlFromTitle(unsavedWalk.groupEvent.title, unsavedWalk.id);
    this.logger.info("applyWalkLeaderIfSuppliedAndSaveWalk: oldUrl:", oldUrl, "newUrl:", unsavedWalk.groupEvent.url, "for walk:", unsavedWalk.groupEvent.title);
    const event = this.walkEventService.createEventIfRequired(unsavedWalk, EventType.APPROVED, "Imported from Walks Manager");
    this.walkEventService.writeEventIfRequired(unsavedWalk, event);
    return this.localWalksAndEventsService.createOrUpdate(unsavedWalk);
  }

  public importWalksFromFile(file: File, fileNameData: ServerFileNameData): Promise<Record<string, string>[]> {
    this.logger.info("importWalksFromFile:file:", file, "fileNameData:", fileNameData, "original file size:", this.numberUtils.humanFileSize(file.size));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event: any) => {
        const csvText = event.target.result;
        const parsed = Papa.parse(csvText, {header: true, skipEmptyLines: true});
        const nonCriticalErrors = parsed.errors.filter(error => error.code !== "TooFewFields");
        this.logger.info("importWalksFromFile:parsed:", parsed, "nonCriticalErrors:", nonCriticalErrors);
        if (nonCriticalErrors?.errors?.length > 0) {
          this.logger.error(this.stringUtilsService.pluraliseWithCount(nonCriticalErrors.errors, "CSV parse error"), "were found:", nonCriticalErrors.errors);
          reject(parsed.errors);
          return;
        }
        const rows = parsed.data as Record<string, string>[];
        this.logger.info("importWalksFromFile:file:", file, "rows:", rows);
        resolve(rows);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }

  public csvRowToExtendedGroupEvent(row: Record<string, string>, groupCodeAndName: HasGroupCodeAndName): ExtendedGroupEvent {
    const csv: Record<WalkUploadColumnHeading, string> = {} as any;
    enumValues(WalkUploadColumnHeading).forEach((heading: WalkUploadColumnHeading) => {
      csv[heading] = this.stringUtilsService.decodeString(row[heading]) || "";
    });

    const groupEvent: GroupEvent = {
      additional_details: this.htmlToMarkdown(csv[WalkUploadColumnHeading.ADDITIONAL_DETAILS]),
      area_code: "",
      cancellation_reason: "",
      date_created: "",
      date_updated: "",
      duration: 0,
      external_url: "",
      facilities: [],
      group_code: groupCodeAndName.group_code,
      group_name: groupCodeAndName.group_name,
      item_type: RamblersEventType.GROUP_WALK,
      linked_event: null,
      media: [],
      meeting_date_time: null,
      meeting_location: null,
      status: WalkStatus.CONFIRMED,
      transport: [],
      url: this.stringUtilsService.kebabCase(csv[WalkUploadColumnHeading.TITLE]),
      walk_leader: this.eventDefaultsService.nameToContact(csv[WalkUploadColumnHeading.WALK_LEADERS]),
      title: csv[WalkUploadColumnHeading.TITLE],
      description: this.htmlToMarkdown(csv[WalkUploadColumnHeading.DESCRIPTION]),
      start_date_time: this.dateUtils.parseCsvDate(csv[WalkUploadColumnHeading.DATE], csv[WalkUploadColumnHeading.START_TIME]),
      end_date_time: this.dateUtils.parseCsvDate(csv[WalkUploadColumnHeading.DATE], csv[WalkUploadColumnHeading.EST_FINISH_TIME]),
      start_location: {
        postcode: csv[WalkUploadColumnHeading.STARTING_POSTCODE],
        grid_reference_10: csv[WalkUploadColumnHeading.STARTING_GRIDREF],
        description: csv[WalkUploadColumnHeading.STARTING_LOCATION_DETAILS],
        latitude: 0,
        longitude: 0,
        grid_reference_6: null,
        grid_reference_8: null,
        w3w: null
      },
      end_location: {
        postcode: csv[WalkUploadColumnHeading.FINISHING_POSTCODE],
        grid_reference_10: csv[WalkUploadColumnHeading.FINISHING_GRIDREF],
        description: csv[WalkUploadColumnHeading.FINISHING_LOCATION_DETAILS],
        latitude: 0,
        longitude: 0,
        grid_reference_6: null,
        grid_reference_8: null,
        w3w: null
      },
      difficulty: {description: csv[WalkUploadColumnHeading.DIFFICULTY]},
      distance_miles: this.numberUtils.asNumber(csv[WalkUploadColumnHeading.DISTANCE_MILES]),
      distance_km: this.numberUtils.asNumber(csv[WalkUploadColumnHeading.DISTANCE_KM]),
      ascent_metres: this.numberUtils.asNumber(csv[WalkUploadColumnHeading.ASCENT_METRES]),
      ascent_feet: this.numberUtils.asNumber(csv[WalkUploadColumnHeading.ASCENT_FEET]),
      shape: csv[WalkUploadColumnHeading.LINEAR_OR_CIRCULAR],
      accessibility: [
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.DOG_FRIENDLY]) ? this.ramblersWalksAndEventsService.toFeature(Feature.DOG_FRIENDLY) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.INTRODUCTORY_WALK]) ? this.ramblersWalksAndEventsService.toFeature(Feature.INTRODUCTORY_WALK) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.NO_STILES]) ? this.ramblersWalksAndEventsService.toFeature(Feature.NO_STILES) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.FAMILY_FRIENDLY]) ? this.ramblersWalksAndEventsService.toFeature(Feature.FAMILY_FRIENDLY) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.WHEELCHAIR_ACCESSIBLE]) ? this.ramblersWalksAndEventsService.toFeature(Feature.WHEELCHAIR_ACCESSIBLE) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.ACCESSIBLE_BY_PUBLIC_TRANSPORT]) ? this.ramblersWalksAndEventsService.toFeature(Feature.PUBLIC_TRANSPORT) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.CAR_PARKING_AVAILABLE]) ? this.ramblersWalksAndEventsService.toFeature(Feature.CAR_PARKING) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.CAR_SHARING_AVAILABLE]) ? this.ramblersWalksAndEventsService.toFeature(Feature.CAR_SHARING) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.COACH_TRIP]) ? this.ramblersWalksAndEventsService.toFeature(Feature.COACH_TRIP) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.REFRESHMENTS_AVAILABLE_PUB_CAFE]) ? this.ramblersWalksAndEventsService.toFeature(Feature.REFRESHMENTS) : null),
        (this.stringUtilsService.asBoolean(csv[WalkUploadColumnHeading.TOILETS_AVAILABLE]) ? this.ramblersWalksAndEventsService.toFeature(Feature.TOILETS) : null),
      ].filter(Boolean)
    };
    return this.ramblersWalksAndEventsService.toExtendedGroupEvent(groupEvent, InputSource.FILE_IMPORT);
  }

  private isAMatchFor(memberMatch: MemberAction) {
    return [MemberAction.found, MemberAction.matched].includes(memberMatch);
  }

  summary(bulkLoadMemberAndMatchToWalks: BulkLoadMemberAndMatchToWalk[]): string {
    const matched = bulkLoadMemberAndMatchToWalks?.filter(item => this.isAMatchFor(item?.bulkLoadMemberAndMatch.memberMatch));
    return `${matched?.length} out of ${this.stringUtilsService.pluraliseWithCount(bulkLoadMemberAndMatchToWalks.length, "event")} were matched to walk leaders and members`;
  }

  private duplicateKeys(walksToImport: ExtendedGroupEvent[]): TypedKeyValue<GroupEventUniqueKey, ExtendedGroupEvent[]>[] {
    const duplicateWalkDates = Object.entries(groupBy(walksToImport, walkToImport => JSON.stringify(this.toGroupEventUniqueKey(walkToImport))))
      .filter((entry: [path: string, duplicates: ExtendedGroupEvent[]]) => entry[1].length > 1)
      .map(item => ({key: JSON.parse(item[0]), value: item[1]}));
    this.logger.info("walksToImport:", walksToImport, "duplicateWalkDates:", duplicateWalkDates);
    return duplicateWalkDates;
  }

  private toGroupEventUniqueKey(walkToImport: ExtendedGroupEvent): GroupEventUniqueKey {
    return {
      start_date_time: walkToImport.groupEvent.start_date_time,
      item_type: walkToImport.groupEvent.item_type,
      title: walkToImport.groupEvent.title,
      group_code: walkToImport.groupEvent.group_code
    };
  }

  private includeWalk(event: ExtendedGroupEvent, duplicateKeys: TypedKeyValue<GroupEventUniqueKey, ExtendedGroupEvent[]>[]): boolean {
    const groupEventUniqueKey = this.toGroupEventUniqueKey(event);
    return !duplicateKeys.find(item  => isEqual(item.key, groupEventUniqueKey));
  }
}
