import TurndownService from "turndown";
import Papa from "papaparse";
import { HttpClient } from "@angular/common/http";
import { inject, Injectable, Injector } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { EventField, EventType, ImageSource, ImportData, ImportStage, WalkImageRow } from "../../models/walk.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { LocalWalksAndEventsService } from "../walks-and-events/local-walks-and-events.service";
import { RamblersWalksAndEventsService } from "../walks-and-events/ramblers-walks-and-events.service";
import { Organisation, RootFolder, SystemConfig } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";
import { first, groupBy, isEqual, last, omit } from "es-toolkit/compat";
import { DateUtilsService } from "../date-utils.service";
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
import { AwsFileUploadResponse, AwsFileUploadResponseData, ServerFileNameData } from "../../models/aws-object.model";
import { enumValues, TypedKeyValue } from "../../functions/enums";
import { mergeFieldsOnSync } from "../../functions/walks/ramblers-event.mapper";
import {
  leaderMatchResult,
  priorMatchesFromWalks,
  shouldAutoLinkLeaderMatch
} from "../../functions/walks/walk-leader-member-match";
import { PriorContactMemberMatch, WalkLeaderMatchConfidence } from "../../models/walk-leader-match.model";
import { Feature } from "../../models/walk-feature.model";
import { ExtendedGroupEventQueryService } from "../walks-and-events/extended-group-event-query.service";
import { EventDefaultsService } from "../event-defaults.service";
import { MediaQueryService } from "../committee/media-query.service";
import { S3_BASE_URL } from "../../models/content-metadata.model";
import { FileUtilsService } from "../../file-utils.service";

@Injectable({
  providedIn: "root"
})
export class WalksImportService {

  private http = inject(HttpClient);
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
  private mediaQueryService = inject(MediaQueryService);
  private injector = inject(Injector);
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
      maxImageSize: this.systemConfig.images?.imageLists?.defaultMaxImageSize || 256000,
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
    const priorMatches: PriorContactMemberMatch[] = importData.inputSource === InputSource.WALKS_MANAGER_CACHE
      ? await this.priorMatchesForWalksManager()
      : [];
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
    importData.messages.push(`${this.stringUtils.pluraliseWithCount(importData.existingWalksWithinRange.length, "existing walk")} within range of import will be updated; new walks will be added`);
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
      const bulkLoadMemberAndMatch = importData.inputSource === InputSource.WALKS_MANAGER_CACHE
        ? this.bulkLoadMemberAndMatchForWalksManager(event, members, contact, ramblersMember, priorMatches)
        : this.bulkLoadMemberAndMatchForFileImport(members, contact, ramblersMember);
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
    let failedWalks = 0;
    const duplicates = this.duplicateKeys(importData.bulkLoadMembersAndMatchesToWalks.map(item => item.event));
    if (duplicates.length > 0) {
      const skippedTitles = duplicates.map(d => d.key.title).join(", ");
      notify.warning({
        title: "Duplicate walks detected",
        message: `Skipping ${duplicates.length} duplicate walk(s): ${skippedTitles}`
      });
      importData.bulkLoadMembersAndMatchesToWalks = importData.bulkLoadMembersAndMatchesToWalks
        .filter(item => this.includeWalk(item.event, duplicates));
      importData.messages.push(`Skipped ${duplicates.length} duplicate walk(s): ${skippedTitles}`);
    }
    const existingById = new Map<string, ExtendedGroupEvent>(
      importData.existingWalksWithinRange
        .filter(walk => walk.groupEvent?.id)
        .map(walk => [walk.groupEvent.id, walk])
    );
    await Promise.all(importData.bulkLoadMembersAndMatchesToWalks
      .filter(item => item.include)
      .map(async bulkLoadMemberAndMatchToWalks => {
      const member = bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.member;
        const overwriteContactDetailsWithMember = importData.inputSource === InputSource.FILE_IMPORT;
        if (this.isAMatchFor(bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch)) {
          try {
            bulkLoadMemberAndMatchToWalks.event = await this.applyWalkLeaderIfSuppliedAndMergeWalk(bulkLoadMemberAndMatchToWalks.event, existingById, member, overwriteContactDetailsWithMember);
            createdWalks++;
          } catch (error) {
            failedWalks++;
            const walkTitle = bulkLoadMemberAndMatchToWalks.event?.groupEvent?.title || "Unknown walk";
            const errorMessage = `Failed to save walk: ${walkTitle}`;
            this.logger.error(errorMessage, error);
            importData.errorMessages.push(errorMessage);
          }
          return Promise.resolve();
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
          if (createdMember) {
            try {
              bulkLoadMemberAndMatchToWalks.event = await this.applyWalkLeaderIfSuppliedAndMergeWalk(bulkLoadMemberAndMatchToWalks.event, existingById, createdMember, overwriteContactDetailsWithMember);
              createdMembers++;
              createdWalks++;
            } catch (error) {
              failedWalks++;
              const walkTitle = bulkLoadMemberAndMatchToWalks.event?.groupEvent?.title || "Unknown walk";
              const errorMessage = `Failed to save walk: ${walkTitle}`;
              this.logger.error(errorMessage, error);
              importData.errorMessages.push(errorMessage);
            }
          }
          return Promise.resolve();
        } else {
          this.logger.info("member:", member, "was not matched to any walks");
          return Promise.resolve();
        }
        } else {
          try {
            this.logger.info("processing memberAction:", bulkLoadMemberAndMatchToWalks.bulkLoadMemberAndMatch.memberMatch, "with event", bulkLoadMemberAndMatchToWalks.event);
            bulkLoadMemberAndMatchToWalks.event = await this.applyWalkLeaderIfSuppliedAndMergeWalk(bulkLoadMemberAndMatchToWalks.event, existingById, undefined, overwriteContactDetailsWithMember);
            createdWalks++;
          } catch (error) {
            failedWalks++;
            const walkTitle = bulkLoadMemberAndMatchToWalks.event?.groupEvent?.title || "Unknown walk";
            const errorMessage = `Failed to save walk: ${walkTitle}`;
            this.logger.error(errorMessage, error);
            importData.errorMessages.push(errorMessage);
          }
          return Promise.resolve();
      }
    }));
    const successMessage = `${this.stringUtils.pluraliseWithCount(createdMembers, "new member")} created, ${this.stringUtils.pluraliseWithCount(createdWalks, "walk")} imported`;
    if (failedWalks > 0) {
      notify.warning({
        title: "Walks Import Completed with Errors",
        message: `${successMessage}. ${this.stringUtils.pluraliseWithCount(failedWalks, "walk")} failed to import.`
      });
    } else {
      notify.success({
        title: "Walks Import Completed",
        message: successMessage
      });
    }
  }

  private async applyWalkLeaderIfSuppliedAndMergeWalk(incomingWalk: ExtendedGroupEvent, existingById: Map<string, ExtendedGroupEvent>, member?: Member, overwriteContactDetailsWithMember = true): Promise<ExtendedGroupEvent> {
    const existingWalk = existingById.get(incomingWalk.groupEvent?.id);
    if (existingWalk) {
      const mergedWalk: ExtendedGroupEvent = {
        ...omit(incomingWalk, ["_id", "id"]) as ExtendedGroupEvent,
        id: existingWalk.id,
        fields: mergeFieldsOnSync(existingWalk.fields, incomingWalk.fields)
      };
      if (member) {
        if (overwriteContactDetailsWithMember) {
          mergedWalk.groupEvent.walk_leader = this.eventDefaultsService.memberToContact(member);
          mergedWalk.fields.contactDetails = this.eventDefaultsService.contactDetailsFrom(member);
        } else {
          mergedWalk.fields.contactDetails.memberId = member.id;
        }
      }
      mergedWalk.groupEvent.url = await this.localWalksAndEventsService.urlFromTitle(mergedWalk.groupEvent.title, mergedWalk.id);
      const event = this.walkEventService.createEventIfRequired(mergedWalk, EventType.APPROVED, "Imported from Walks Manager");
      this.walkEventService.writeEventIfRequired(mergedWalk, event);
      return this.localWalksAndEventsService.update(mergedWalk);
    } else {
      const unsavedWalk: ExtendedGroupEvent = omit(incomingWalk, ["_id", "id"]) as ExtendedGroupEvent;
      if (member) {
        if (overwriteContactDetailsWithMember) {
          unsavedWalk.groupEvent.walk_leader = this.eventDefaultsService.memberToContact(member);
          unsavedWalk.fields.contactDetails = this.eventDefaultsService.contactDetailsFrom(member);
        } else {
          unsavedWalk.fields.contactDetails.memberId = member.id;
        }
      }
      unsavedWalk.groupEvent.url = await this.localWalksAndEventsService.urlFromTitle(unsavedWalk.groupEvent.title, unsavedWalk.id);
      const event = this.walkEventService.createEventIfRequired(unsavedWalk, EventType.APPROVED, "Imported from Walks Manager");
      this.walkEventService.writeEventIfRequired(unsavedWalk, event);
      return this.localWalksAndEventsService.create(unsavedWalk);
    }
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

  public importImagesFromFile(file: File): Promise<Record<string, string>[]> {
    this.logger.info("importImagesFromFile:file:", file, "original file size:", this.numberUtils.humanFileSize(file.size));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event: any) => {
        const csvText = event.target.result;
        const parsed = Papa.parse(csvText, {header: true, skipEmptyLines: true});
        const nonCriticalErrors = parsed.errors.filter(error => error.code !== "TooFewFields");
        this.logger.info("importImagesFromFile:parsed:", parsed, "nonCriticalErrors:", nonCriticalErrors);
        if (nonCriticalErrors?.errors?.length > 0) {
          this.logger.error(this.stringUtilsService.pluraliseWithCount(nonCriticalErrors.errors, "CSV parse error"), "were found:", nonCriticalErrors.errors);
          reject(parsed.errors);
          return;
        }
        const rows = parsed.data as Record<string, string>[];
        this.logger.info("importImagesFromFile:file:", file, "rows:", rows);
        resolve(rows);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }


  private findWalkIdFromCsvRow(walk: ExtendedGroupEvent, fileImportRows: Record<string, string>[]): string | null {
    const matchingRow = fileImportRows.find(row => row["Title"] === walk.groupEvent.title);
    return matchingRow ? matchingRow["Walk ID"] : null;
  }

  public csvRowToExtendedGroupEvent(row: Record<string, string>, groupCodeAndName: HasGroupCodeAndName): ExtendedGroupEvent {
    const csv: Record<WalkUploadColumnHeading, string> = {} as any;
    enumValues(WalkUploadColumnHeading).forEach((heading: WalkUploadColumnHeading) => {
      csv[heading] = this.stringUtilsService.decodeString(row[heading]) || "";
    });

    const walkId = csv[WalkUploadColumnHeading.WALK_ID];
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
    return this.ramblersWalksAndEventsService.toExtendedGroupEvent(groupEvent, InputSource.FILE_IMPORT, walkId);
  }

  private isAMatchFor(memberMatch: MemberAction) {
    return [MemberAction.found, MemberAction.matched].includes(memberMatch);
  }

  private bulkLoadMemberAndMatchForWalksManager(event: ExtendedGroupEvent, members: Member[], contact: Contact, ramblersMember: RamblersMember, priorMatches: PriorContactMemberMatch[]): BulkLoadMemberAndMatch {
    const contactDetailsForMatch = {
      ...event?.fields?.contactDetails,
      displayName: event?.fields?.contactDetails?.displayName || event?.fields?.publishing?.ramblers?.contactName || null
    };
    const match = leaderMatchResult(members, contactDetailsForMatch, priorMatches);
    const matchedMember = shouldAutoLinkLeaderMatch(match) ? match.member : null;
    return {
      memberMatch: matchedMember ? MemberAction.found : MemberAction.notFound,
      memberMatchType: matchedMember ? `walk-leader-contact-details:${match.matchType}:${match.confidence}` : `walk-leader-contact-details:${match.matchType}:${WalkLeaderMatchConfidence.LOW}`,
      member: matchedMember,
      ramblersMember,
      contact
    };
  }

  private bulkLoadMemberAndMatchForFileImport(members: Member[], contact: Contact, ramblersMember: RamblersMember): BulkLoadMemberAndMatch {
    const ramblersMemberAndContact: RamblersMemberAndContact = {
      contact,
      ramblersMember
    };
    const bulkLoadMemberAndMatch: BulkLoadMemberAndMatch = this.memberBulkLoadService.bulkLoadMemberAndMatchFor(ramblersMemberAndContact, members, this.systemConfig);
    if (!bulkLoadMemberAndMatch.member.id) {
      bulkLoadMemberAndMatch.member = null;
      bulkLoadMemberAndMatch.memberMatch = MemberAction.notFound;
    }
    return bulkLoadMemberAndMatch;
  }

  private async priorMatchesForWalksManager(): Promise<PriorContactMemberMatch[]> {
    const priorMatchedWalks: ExtendedGroupEvent[] = await this.localWalksAndEventsService.all({
      inputSource: InputSource.WALKS_MANAGER_CACHE,
      suppressEventLinking: true,
      dataQueryOptions: {
        criteria: {
          [EventField.CONTACT_DETAILS_CONTACT_ID]: {$ne: null},
          [EventField.CONTACT_DETAILS_MEMBER_ID]: {$ne: null}
        },
        select: {
          [EventField.CONTACT_DETAILS]: 1
        }
      },
      types: [RamblersEventType.GROUP_WALK]
    });
    return priorMatchesFromWalks(priorMatchedWalks);
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

  public async processWalkImages(importData: ImportData, imageFiles: File[], notify: AlertInstance): Promise<void> {
    if (!importData.imageImportRows || importData.imageImportRows.length === 0) {
      this.logger.info("No image rows to process");
      return;
    }

    this.logger.info("processWalkImages: processing", importData.imageImportRows.length, "image rows with", imageFiles.length, "image files");

    const migratedWalkIds = importData.bulkLoadMembersAndMatchesToWalks
      .filter(item => item.include && item.event?.fields?.migratedFromId)
      .map(item => item.event.fields.migratedFromId);

    this.logger.info("Fetching", migratedWalkIds.length, "saved walks from database by migratedFromId");
    const savedWalks = await this.localWalksAndEventsService.all({
      inputSource: importData.inputSource,
      suppressEventLinking: true,
      groupCode: importData.groupCodeAndName.group_code
    });

    const walkIdToWalk = new Map<string, ExtendedGroupEvent>();
    savedWalks.forEach(walk => {
      const migratedFromId = walk.fields.migratedFromId;
      if (migratedFromId) {
        walkIdToWalk.set(migratedFromId, walk);
      }
    });

    this.logger.info("Built walkIdToWalk map with", walkIdToWalk.size, "entries from saved walks");
    if (walkIdToWalk.size === 0) {
      const noWalksMessage = "No saved walks matched the supplied image data";
      this.logger.info(noWalksMessage);
      notify.warning({title: "Image Import", message: noWalksMessage});
      return;
    }

    const fileLookup = this.fileLookup(imageFiles);
    const uploadsRequired = new Map<File, ExtendedGroupEvent[]>();
    let rowsWithoutWalk = 0;
    let rowsWithoutFile = 0;

    importData.imageImportRows.forEach((imageRow: WalkImageRow) => {
      const walk = walkIdToWalk.get(imageRow["Walk ID"]);
      if (!walk) {
        rowsWithoutWalk++;
        return;
      }
      const file = this.fileForRow(imageRow, fileLookup);
      if (!file) {
        rowsWithoutFile++;
        return;
      }
      const queue = uploadsRequired.get(file) || [];
      queue.push(walk);
      uploadsRequired.set(file, queue);
    });

    if (uploadsRequired.size === 0) {
      const message = "No images to upload after matching files to walks";
      this.logger.info(message);
      notify.warning({title: "Image Import", message});
      return;
    }

    let savedImages = 0;
    let failedUploads = 0;
    const totalFiles = uploadsRequired.size;
    let processedFiles = 0;

    for (const [file, walks] of uploadsRequired.entries()) {
      try {
        const uploadResponse = await this.uploadSingleWalkImage(file, notify, importData.maxImageSize || 500000);
        processedFiles++;
        const percent = Math.round(processedFiles / totalFiles * 100);
        importData.imageUploadProgress = percent;
        notify.progress({
          title: "Image Import",
          message: `Uploaded ${processedFiles} of ${totalFiles} images`
        });

        if (uploadResponse) {
          const imageUrl = `${uploadResponse.fileNameData.rootFolder}/${uploadResponse.fileNameData.awsFileName}`;
          this.logger.info("Uploaded image:", file.name, "to:", imageUrl, "applying to", walks.length, "walks");
          for (const walk of walks) {
            this.logger.info("Applying image to walk:", walk.groupEvent.title, "ID:", walk.id);
            this.applyImageToWalk(walk, imageUrl);
            this.logger.info("After applyImageToWalk, media:", walk.groupEvent.media);
            const savedWalk = await this.localWalksAndEventsService.createOrUpdate(walk);
            this.logger.info("Saved walk with media:", savedWalk.groupEvent.media);
            savedImages++;
          }
        } else {
          failedUploads++;
        }
      } catch (error) {
        this.logger.error("Failed to upload image", file.name, error);
        failedUploads++;
        processedFiles++;
        importData.imageUploadProgress = Math.round(processedFiles / totalFiles * 100);
      }
    }

    importData.imageUploadProgress = 0;

    const summaryParts: string[] = [];
    summaryParts.push(`${this.stringUtils.pluraliseWithCount(savedImages, "image")} saved`);
    if (rowsWithoutWalk > 0) {
      summaryParts.push(`${this.stringUtils.pluraliseWithCount(rowsWithoutWalk, "image row")} had no matching walk`);
    }
    if (rowsWithoutFile > 0) {
      summaryParts.push(`${this.stringUtils.pluraliseWithCount(rowsWithoutFile, "image row")} had no matching file`);
    }
    if (failedUploads > 0) {
      summaryParts.push(`${this.stringUtils.pluraliseWithCount(failedUploads, "image")} failed to upload`);
    }
    const summary = summaryParts.join(". ");
    if (rowsWithoutWalk > 0 || rowsWithoutFile > 0 || failedUploads > 0) {
      notify.warning({title: "Image Import Complete", message: summary}, true);
    } else {
      notify.success({title: "Image Import Complete", message: summary}, true);
    }
  }

  private applyImageToWalk(walk: ExtendedGroupEvent, imageUrl: string) {
    this.mediaQueryService.applyImageSource(walk.groupEvent, walk.groupEvent.title, imageUrl);
    if (!walk.fields.imageConfig) {
      walk.fields.imageConfig = this.eventDefaultsService.defaultImageConfig(ImageSource.LOCAL);
    }
    walk.fields.imageConfig.source = ImageSource.LOCAL;
  }

  private fileLookup(imageFiles: File[]): Map<string, File> {
    const lookup = new Map<string, File>();
    imageFiles.forEach(file => {
      const normalised = this.normaliseFileName(file.name);
      const baseName = this.baseName(normalised);
      lookup.set(normalised, file);
      lookup.set(baseName, file);
    });
    return lookup;
  }

  private fileForRow(imageRow: WalkImageRow, fileLookup: Map<string, File>): File | undefined {
    const localFileName = this.normaliseFileName(imageRow["Local Filename"]);
    const localFileNameWithoutPath = localFileName ? localFileName.split("/").pop() : null;
    const imageGuid = this.normaliseFileName(imageRow["Image GUID"]);
    return fileLookup.get(localFileName)
      || fileLookup.get(localFileNameWithoutPath)
      || fileLookup.get(this.baseName(localFileName))
      || fileLookup.get(this.baseName(localFileNameWithoutPath))
      || fileLookup.get(imageGuid);
  }

  private normaliseFileName(fileName: string): string {
    return fileName ? fileName.trim().toLowerCase() : null;
  }

  private baseName(fileName: string): string {
    if (!fileName) {
      return fileName;
    }
    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex > -1 ? fileName.substring(0, lastDotIndex) : fileName;
  }

  private uploadsByName(uploadResponses: AwsFileUploadResponseData[]): Map<string, AwsFileUploadResponseData> {
    const uploads = new Map<string, AwsFileUploadResponseData>();
    uploadResponses.forEach(upload => {
      const originalName = this.normaliseFileName(upload?.uploadedFile?.originalname);
      const awsFileName = this.normaliseFileName(upload?.fileNameData?.awsFileName);
      if (originalName) {
        uploads.set(originalName, upload);
        uploads.set(this.baseName(originalName), upload);
      }
      if (awsFileName) {
        uploads.set(awsFileName, upload);
        uploads.set(this.baseName(awsFileName), upload);
      }
    });
    return uploads;
  }

  private uploadForFile(file: File, uploads: Map<string, AwsFileUploadResponseData>): AwsFileUploadResponseData {
    const name = this.normaliseFileName(file?.name);
    const baseName = this.baseName(name);
    return uploads.get(name) || uploads.get(baseName);
  }

  private async uploadSingleWalkImage(file: File, notify: AlertInstance, maxBytes: number): Promise<AwsFileUploadResponseData | null> {
    const fileUtilsService = this.injector.get(FileUtilsService);
    let fileToUpload = file;

    if (fileUtilsService.isResizableName(file.name) && file.size > maxBytes) {
      try {
        const base64Content = await this.fileToBase64(file);
        const resizedBase64 = await fileUtilsService.resizeBase64Image(base64Content, file.name, maxBytes, 1200);
        if (resizedBase64) {
          fileToUpload = this.base64ToFile(resizedBase64, file.name);
        }
      } catch (error) {
        this.logger.warn("Failed to resize", file.name, error);
      }
    }

    const formData = new FormData();
    formData.append("file", fileToUpload, fileToUpload.name);

    try {
      const response: AwsFileUploadResponse = await this.http.post<AwsFileUploadResponse>(
        `${S3_BASE_URL}/file-upload?root-folder=${RootFolder.walkImages}`,
        formData
      ).toPromise();

      if (response?.errors?.length > 0) {
        this.logger.error("Upload error for", file.name, response.errors);
        return null;
      }
      return response?.responses?.[0] || null;
    } catch (error) {
      this.logger.error("Upload failed for", file.name, error);
      return null;
    }
  }

  private async uploadWalkImages(files: File[], notify: AlertInstance, maxBytes: number): Promise<AwsFileUploadResponseData[]> {
    if (!files.length) {
      return [];
    }

    notify.progress({title: "Image Import", message: `Preparing ${this.stringUtils.pluraliseWithCount(files.length, "image")} for upload...`});

    const resizedFiles: File[] = [];
    let resizedCount = 0;

    for (const [i, file] of files.entries()) {
      const fileUtilsService = this.injector.get(FileUtilsService);

      if (fileUtilsService.isResizableName(file.name) && file.size > maxBytes) {
        try {
          const base64Content = await this.fileToBase64(file);
          const resizedBase64 = await fileUtilsService.resizeBase64Image(base64Content, file.name, maxBytes, 1200);

          if (resizedBase64) {
            const resizedFile = this.base64ToFile(resizedBase64, file.name);
            resizedFiles.push(resizedFile);
            resizedCount++;
            notify.progress({
              title: "Image Import",
              message: `Resized ${resizedCount} of ${files.length} images (${Math.round((i + 1) / files.length * 100)}%)`
            });
          } else {
            resizedFiles.push(file);
          }
        } catch (error) {
          this.logger.warn("Failed to resize", file.name, error);
          resizedFiles.push(file);
        }
      } else {
        resizedFiles.push(file);
      }
    }

    if (resizedCount > 0) {
      notify.success({
        title: "Image Resize Complete",
        message: `Resized ${this.stringUtils.pluraliseWithCount(resizedCount, "image")}`
      });
    }

    notify.progress({title: "Image Import", message: `Uploading ${this.stringUtils.pluraliseWithCount(resizedFiles.length, "image")}...`});

    const formData = new FormData();
    resizedFiles.forEach(file => formData.append("file", file, file.name));
    const response: AwsFileUploadResponse = await this.http.post<AwsFileUploadResponse>(`${S3_BASE_URL}/file-upload?root-folder=${RootFolder.walkImages}`, formData).toPromise();
    if (response?.errors?.length > 0) {
      notify.error({title: "Image Import", message: response.errors});
    }
    return response?.responses || [];
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private base64ToFile(base64: string, fileName: string): File {
    const arr = base64.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(Array.from(bstr, c => c.charCodeAt(0)));
    return new File([u8arr], fileName, { type: mime });
  }
}
