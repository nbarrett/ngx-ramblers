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
import { SocialEventsService } from "../social-events/social-events.service";
import { WalksQueryService } from "../walks/walks-query.service";
import { WalksAndEventsService } from "../walks/walks-and-events.service";
import { CommitteeConfigService } from "./commitee-config.service";
import { CommitteeFileService } from "./committee-file.service";
import { CommitteeReferenceData } from "./committee-reference-data";
import { toMongoIds } from "../mongo-utils";
import { isNumericRamblersId } from "../path-matchers";
import { MediaQueryService } from "./media-query.service";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { ExtendedGroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})

export class CommitteeQueryService {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeQueryService", NgxLoggerLevel.ERROR);
  display = inject(CommitteeDisplayService);
  private dateUtils = inject(DateUtilsService);
  private mediaQueryService = inject(MediaQueryService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private memberService = inject(MemberService);
  private walksQueryService = inject(WalksQueryService);
  private committeeFileService = inject(CommitteeFileService);
  private committeeDisplayService = inject(CommitteeDisplayService);
  private socialEventsService = inject(SocialEventsService);
  private memberLoginService = inject(MemberLoginService);
  private displayDatePipe = inject(DisplayDatePipe);
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
    const fromDate = groupEventsFilter.fromDate.value;
    const toDate = groupEventsFilter.toDate.value;
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

    if (groupEventsFilter.includeWalks) {
      const textBasedCriteria = groupEventsFilter.search?.length > 0 ? {["groupEvent.title"]: regex} : null;
      promises.push(
        this.walksAndEventsService.all({
          criteria: textBasedCriteria || idBasedCriteria || {
            walkDate: {
              $gte: fromDate,
              $lte: toDate
            }
          }
        }, [], [RamblersEventType.GROUP_WALK])
          .then((walks: ExtendedGroupEvent[]) => this.walksQueryService.activeWalks(walks))
          .then((walks: ExtendedGroupEvent[]) => walks?.forEach(walk => events.push({
            id: walk.id,
            selected: true,
            eventType: this.display.groupEventType(walk),
            eventDate: this.dateUtils.asMoment(walk.groupEvent.start_date_time),
            eventTime: walk.groupEvent.start_date_time,
            distance: walk.groupEvent.distance_miles.toString(),
            location: null,
            postcode: walk.groupEvent.start_location?.postcode,
            title: walk.groupEvent.title || "Awaiting walk details",
            description: walk.groupEvent.description,
            contactName: walk.fields.contactDetails.phone || "Awaiting walk leader",
            contactPhone: walk.fields.contactDetails.phone,
            contactEmail: walk.fields.contactDetails.email,
            image: this.mediaQueryService.imageUrlFrom(walk.groupEvent)
          }))));
    }
    if (groupEventsFilter.includeCommitteeEvents) {
      const textBasedCriteria = groupEventsFilter.search?.length > 0 ? {"fileNameData.title": regex} : null;
      promises.push(
        this.committeeFileService.all({
          criteria: textBasedCriteria || idBasedCriteria || {
            eventDate: {
              $gte: fromDate,
              $lte: toDate
            }
          }
        })
          .then(committeeFiles => committeeFiles.forEach(committeeFile => events.push({
            id: committeeFile.id,
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
    if (groupEventsFilter.includeSocialEvents) {
      const textBasedCriteria = groupEventsFilter.search?.length > 0 ? {briefDescription: regex} : null;
      promises.push(
        this.socialEventsService.all({
          criteria: textBasedCriteria || idBasedCriteria || {
            eventDate: {
              $gte: fromDate,
              $lte: toDate
            }
          }
        })
          .then((socialEvents: ExtendedGroupEvent[]) => socialEvents.forEach(socialEvent => {
            this.logger.info("social event:", socialEvent);
            events.push({
              id: socialEvent.id,
              selected: true,
              eventType: GroupEventTypes.SOCIAL,
              eventDate: this.dateUtils.asMoment(socialEvent.groupEvent.start_date_time).valueOf(),
              eventTime: socialEvent.groupEvent.start_date_time,
              location: socialEvent.groupEvent.location.description,
              postcode: socialEvent.groupEvent.location.postcode,
              title: socialEvent.groupEvent.title,
              description: socialEvent.groupEvent.description,
              contactName: socialEvent.fields.contactDetails.displayName,
              contactPhone: socialEvent.fields.contactDetails.phone,
              contactEmail: socialEvent.fields.contactDetails.email,
              image: this.mediaQueryService.imageSource(socialEvent)?.url
            });
          })));
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
