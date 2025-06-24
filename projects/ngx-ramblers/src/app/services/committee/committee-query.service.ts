// @ts-ignore
import mongoose from "mongoose";
import { inject, Injectable } from "@angular/core";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { chain } from "../../functions/chain";
import {
  CommitteeFile,
  CommitteeMember,
  CommitteeYear,
  GroupEventsFilter,
  GroupEventSummary,
  GroupEventTypes
} from "../../models/committee.model";
import { Member } from "../../models/member.model";
import { CommitteeDisplayService } from "../../pages/committee/committee-display.service";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { descending, sortBy } from "../../functions/arrays";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { MemberService } from "../member/member.service";
import { ExtendedGroupEventQueryService } from "../walks-and-events/extended-group-event-query.service";
import { WalksAndEventsService } from "../walks-and-events/walks-and-events.service";
import { CommitteeConfigService } from "./commitee-config.service";
import { CommitteeFileService } from "./committee-file.service";
import { CommitteeReferenceData } from "./committee-reference-data";
import { toMongoIds } from "../mongo-utils";
import { isNumericRamblersId } from "../path-matchers";
import { MediaQueryService } from "./media-query.service";
import { EventQueryParameters, RamblersEventType } from "../../models/ramblers-walks-manager";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { GROUP_EVENT_START_DATE } from "../../models/walk.model";
import { DateValue } from "../../models/date.model";
import { DisplayTimePipe } from "../../pipes/display-time.pipe";
import { DistanceValidationService } from "../walks/distance-validation.service";
import { StringUtilsService } from "../string-utils.service";

@Injectable({
  providedIn: "root"
})

export class CommitteeQueryService {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeQueryService", NgxLoggerLevel.ERROR);
  private display = inject(CommitteeDisplayService);
  private dateUtils = inject(DateUtilsService);
  private mediaQueryService = inject(MediaQueryService);
  private memberService = inject(MemberService);
  private stringUtilsService = inject(StringUtilsService);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private committeeFileService = inject(CommitteeFileService);
  private committeeDisplayService = inject(CommitteeDisplayService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private memberLoginService = inject(MemberLoginService);
  private displayDatePipe = inject(DisplayDatePipe);
  private displayTimePipe = inject(DisplayTimePipe);
  public distanceValidationService = inject(DistanceValidationService);
  private committeeReferenceData: CommitteeReferenceData;
  public committeeFiles: CommitteeFile[] = [];
  public committeeMembers: Member[] = [];
  private committeeConfig = inject(CommitteeConfigService);
  loggerFactory = inject(LoggerFactory);

  constructor() {
    this.committeeConfig.committeeReferenceDataEvents().subscribe(data => this.committeeReferenceData = data);
    this.queryCommitteeMembers();
  }

  groupEvents(groupEventsFilter: GroupEventsFilter): Promise<GroupEventSummary[]> {
    this.logger.info("groupEventsFilter", groupEventsFilter);
    const fromDate: DateValue = groupEventsFilter.fromDate;
    const toDate: DateValue = groupEventsFilter.toDate;
    this.logger.info("groupEventsFilter:fromDate", this.displayDatePipe.transform(fromDate), "toDate", this.displayDatePipe.transform(toDate));
    const events: GroupEventSummary[] = [];
    const promises = [];
    const committeeContactDetails: CommitteeMember = first(this.committeeReferenceData?.committeeMembersForRole("secretary"));
    const mongoIds = this.mongoOrRawIdsFrom(groupEventsFilter);
    const idBasedCriteria = mongoIds?.length > 0 ? {_id: {$in: mongoIds}} : null;
    const regex = {
      $regex: groupEventsFilter.search,
      $options: "i"
    };

    if (groupEventsFilter.includeWalks || groupEventsFilter.includeSocialEvents) {
      const textBasedCriteria = groupEventsFilter.search?.length > 0 ? {["groupEvent.title"]: regex} : null;
      const eventQueryParameters: EventQueryParameters = {
        dataQueryOptions: {
          criteria: textBasedCriteria || idBasedCriteria || {
            [GROUP_EVENT_START_DATE]: {
              $gte: fromDate.date,
              $lte: toDate.date
            }
          }
        },
        types: [groupEventsFilter.includeSocialEvents ? RamblersEventType.GROUP_EVENT : null, groupEventsFilter.includeWalks ? RamblersEventType.GROUP_WALK : null].filter(Boolean)
      };
      promises.push(
        this.walksAndEventsService.all(eventQueryParameters)
          .then((extendedGroupEvents: ExtendedGroupEvent[]) => this.extendedGroupEventQueryService.activeEvents(extendedGroupEvents))
          .then((extendedGroupEvents: ExtendedGroupEvent[]) => extendedGroupEvents?.forEach(event => events.push({
            id: event.id || event?.groupEvent?.id,
            slug: this.stringUtilsService.lastItemFrom(event?.groupEvent?.url || this.stringUtilsService.kebabCase(event?.groupEvent?.title)),
            selected: true,
            eventType: this.display.groupEventType(event),
            eventDate: this.dateUtils.asMoment(event?.groupEvent?.start_date_time).valueOf(),
            eventTime: this.displayTimePipe.transform(event?.groupEvent?.start_date_time),
            distance: this.distanceValidationService.walkDistances(event),
            location: (event?.groupEvent?.start_location || event?.groupEvent?.location)?.description,
            postcode: (event.groupEvent.start_location || event.groupEvent.location)?.postcode,
            title: event.groupEvent.title || "Awaiting " + event.groupEvent.item_type + " details",
            description: event.groupEvent.description,
            contactName: event.fields?.contactDetails?.displayName || "Awaiting " + event.groupEvent.item_type + " leader",
            contactPhone: event.fields?.contactDetails?.phone,
            contactEmail: event.fields?.contactDetails?.email,
            image: this.mediaQueryService.imageUrlFrom(event.groupEvent)
          }))));
    }
    if (groupEventsFilter.includeCommitteeEvents) {
      const textBasedCriteria = groupEventsFilter.search?.length > 0 ? {"fileNameData.title": regex} : null;
      promises.push(
        this.committeeFileService.all({
          criteria: textBasedCriteria || idBasedCriteria || {
            eventDate: {
              $gte: fromDate.value,
              $lte: toDate.value
            }
          }
        })
          .then(committeeFiles => committeeFiles.forEach(committeeFile => events.push({
            id: committeeFile.id,
            slug: this.stringUtilsService.kebabCase(committeeFile.fileType, this.dateUtils.isoDateTimeString(committeeFile.eventDate)),
            selected: true,
            eventType: GroupEventTypes.COMMITTEE,
            eventDate: committeeFile.eventDate,
            location: null,
            postcode: committeeFile.postcode,
            description: committeeFile.fileType,
            title: this.committeeDisplayService.fileTitle(committeeFile),
            contactName: committeeContactDetails?.fullName,
            contactEmail: committeeContactDetails?.email
          }))));
    }
    return Promise.all(promises).then(() => {
      this.logger.info("queried total of", promises.length, "events types containing total of", events.length, "events:", events);
      return events.sort(sortBy(groupEventsFilter.sortBy || "eventDate"));
    });
  }

  private mongoOrRawIdsFrom(groupEventsFilter: GroupEventsFilter): string[] | mongoose.Types.ObjectId[] {
    const idsWithoutNumericsRamblersValues: string[] = groupEventsFilter?.eventIds?.filter(item => !isNumericRamblersId(item));
    this.logger.info("mongoOrRawIdsFrom:groupEventsFilter.eventIds:", groupEventsFilter?.eventIds, "idsWithoutNumericsRamblersValues:", idsWithoutNumericsRamblersValues);
    if (groupEventsFilter?.eventIds?.length > 0 && idsWithoutNumericsRamblersValues?.length === 0) {
      this.logger.info("mongoOrRawIdsFrom:returning raw eventIds:", idsWithoutNumericsRamblersValues);
      return groupEventsFilter?.eventIds || [];
    } else {
      const objectIds = toMongoIds(groupEventsFilter.eventIds);
      this.logger.info("mongoOrRawIdsFrom:returning mongo ids:", objectIds);
      return objectIds;
    }
  }

  queryAllFiles(): Promise<void> {
    return this.queryFiles();
  }

  queryCommitteeMembers() {
    this.logger.info("queryCommitteeMembers:loggedInMember:", this.memberLoginService.memberLoggedIn());
    if (this.memberLoginService.memberLoggedIn()) {
      this.memberService.all({
        criteria: {committee: {$eq: true}}, sort: {firstName: 1, lastName: 1}
      }).then(members => {
        this.logger.info("queried committeeMembers:", members);
        this.committeeMembers = members;
      });
    }
  }

  queryFiles(committeeFileId?: string): Promise<void> {
    this.logger.info("queryFiles:committeeFileId:", committeeFileId);
    if (committeeFileId) {
      return this.committeeFileService.getById(committeeFileId).then(response => this.applyFiles([response]));
    } else {
      return this.committeeFileService.all().then(response => this.applyFiles(response));
    }
  }

  applyFiles(files: CommitteeFile[]): void {
    this.committeeFiles = files
      .filter(file => this.display?.committeeReferenceData?.isPublic(file.fileType) || this.memberLoginService.allowCommittee() || this.memberLoginService.allowFileAdmin())
      .sort(sortBy("-fileDate"));
    this.logger.info("applyFiles:committee file count:", this.committeeFiles.length);
  }

  committeeFilesLatestFirst() {
    return this.committeeFiles.sort(sortBy("-eventDate"));
  }

  latestYear(): number {
    return this.extractYear(first(this.committeeFilesLatestFirst())) || this.dateUtils.currentYear();
  }

  committeeFilesForYear(year: number): CommitteeFile[] {
    this.logger.info("committeeFilesForYear", year, "file count:", this.committeeFilesLatestFirst()?.length);
    const latestYearValue = this.latestYear();
    const committeeFilesForYear = this.committeeFilesLatestFirst().filter(committeeFile => {
      const fileYear = this.extractYear(committeeFile);
      this.logger.off("fileYear", fileYear, "committeeFile", committeeFile);
      return (fileYear === year) || (isNaN(fileYear) && (latestYearValue === year));
    });
    this.logger.off("committeeFilesForYear", year, "committeeFilesForYear:", committeeFilesForYear);
    return committeeFilesForYear;
  }

  extractYear(committeeFile: CommitteeFile): number {
    return committeeFile ? this.dateUtils.yearFromDate(committeeFile.eventDate) : null;
  }

  addLatestYearFlag(committeeFileYear, latestYearValue: number): CommitteeYear {
    return {year: committeeFileYear, latestYear: latestYearValue === committeeFileYear};
  }

  committeeFileYears(): CommitteeYear[] {
    const latestYearValue = this.latestYear();
    this.logger.info("latestYearValue", latestYearValue);
    const years = chain(this.committeeFiles)
      .map(file => this.extractYear(file))
      .filter(year => !isNaN(year))
      .unique()
      .map(item => this.addLatestYearFlag(item, latestYearValue))
      .value()
      .sort(descending());
    this.logger.info("committeeFileYears", years);
    return years.length === 0 ? [{year: this.latestYear(), latestYear: true}] : years;
  }

}
