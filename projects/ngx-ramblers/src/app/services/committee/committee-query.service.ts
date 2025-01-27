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
  GroupEvent,
  GroupEventsFilter,
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
import { WalksService } from "../walks/walks.service";
import { CommitteeConfigService } from "./commitee-config.service";
import { CommitteeFileService } from "./committee-file.service";
import { CommitteeReferenceData } from "./committee-reference-data";
import { toMongoIds } from "../mongo-utils";
import { SocialEvent } from "../../models/social-events.model";
import { isNumericRamblersId } from "../path-matchers";
import { MediaQueryService } from "./media-query.service";

@Injectable({
  providedIn: "root"
})

export class CommitteeQueryService {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeQueryService", NgxLoggerLevel.ERROR);
  display = inject(CommitteeDisplayService);
  private dateUtils = inject(DateUtilsService);
  private mediaQueryService = inject(MediaQueryService);
  private walksService = inject(WalksService);
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

  groupEvents(groupEventsFilter: GroupEventsFilter): Promise<GroupEvent[]> {
    this.logger.info("groupEventsFilter", groupEventsFilter);
    const fromDate = groupEventsFilter.fromDate.value;
    const toDate = groupEventsFilter.toDate.value;
    this.logger.info("groupEventsFilter:fromDate", this.displayDatePipe.transform(fromDate), "toDate", this.displayDatePipe.transform(toDate));
    const events: GroupEvent[] = [];
    const promises = [];
    const committeeContactDetails: CommitteeMember = first(this.committeeReferenceData?.committeeMembersForRole("secretary"));
    const mongoIds = this.mongoOrRawIdsFrom(groupEventsFilter);
    const idBasedCriteria = mongoIds?.length > 0 ? {_id: {$in: mongoIds}} : null;
    const regex = {
      $regex: groupEventsFilter.search,
      $options: "i"
    };

    if (groupEventsFilter.includeWalks) {
      const textBasedCriteria = groupEventsFilter.search?.length > 0 ? {briefDescriptionAndStartPoint: regex} : null;
      promises.push(
        this.walksService.all({
          criteria: textBasedCriteria || idBasedCriteria || {
            walkDate: {
              $gte: fromDate,
              $lte: toDate
            }
          }
        })
          .then(walks => this.walksQueryService.activeWalks(walks))
          .then(walks => walks?.forEach(walk => events.push({
            id: walk.id,
            selected: true,
            eventType: this.display.groupEventType(walk),
            eventDate: walk.walkDate,
            eventTime: walk.startTime,
            distance: walk.distance,
            location: null,
            postcode: walk.start_location?.postcode,
            title: walk.briefDescriptionAndStartPoint || "Awaiting walk details",
            description: walk.longerDescription,
            contactName: walk.displayName || "Awaiting walk leader",
            contactPhone: walk.contactPhone,
            contactEmail: walk.contactEmail,
            image: this.mediaQueryService.imageUrlFrom(walk)
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
          .then((socialEvents: SocialEvent[]) => socialEvents.forEach(socialEvent => {
            this.logger.info("social event:", socialEvent);
            events.push({
              id: socialEvent.id,
              selected: true,
              eventType: GroupEventTypes.SOCIAL,
              eventDate: socialEvent.eventDate,
              eventTime: socialEvent.eventTimeStart,
              location: socialEvent.location,
              postcode: socialEvent.postcode,
              title: socialEvent.briefDescription,
              description: socialEvent.longerDescription,
              contactName: socialEvent.displayName,
              contactPhone: socialEvent.contactPhone,
              contactEmail: socialEvent.contactEmail,
              image: this.mediaQueryService.imageFromSocialEvent(socialEvent)
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
