import { Injectable } from "@angular/core";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { chain } from "../../functions/chain";
import { CommitteeFile, CommitteeMember, CommitteeYear, GroupEvent, GroupEventsFilter, GroupEventTypes } from "../../models/committee.model";
import { Member } from "../../models/member.model";
import { CommitteeDisplayService } from "../../pages/committee/committee-display.service";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { descending, sortBy } from "../arrays";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { MemberService } from "../member/member.service";
import { SocialEventsService } from "../social-events/social-events.service";
import { UrlService } from "../url.service";
import { WalksQueryService } from "../walks/walks-query.service";
import { WalksService } from "../walks/walks.service";
import { CommitteeConfigService } from "./commitee-config.service";
import { CommitteeFileService } from "./committee-file.service";
import { CommitteeReferenceData } from "./committee-reference-data";

@Injectable({
  providedIn: "root"
})

export class CommitteeQueryService {
  private logger: Logger;
  private committeeReferenceData: CommitteeReferenceData;
  public committeeFiles: CommitteeFile[] = [];
  public committeeMembers: Member[] = [];

  constructor(
    public display: CommitteeDisplayService,
    private dateUtils: DateUtilsService,
    private walksService: WalksService,
    private memberService: MemberService,
    private walksQueryService: WalksQueryService,
    private committeeFileService: CommitteeFileService,
    private committeeDisplayService: CommitteeDisplayService,
    private socialEventsService: SocialEventsService,
    private memberLoginService: MemberLoginService,
    private displayDatePipe: DisplayDatePipe,
    private urlService: UrlService,
    private committeeConfig: CommitteeConfigService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeQueryService, NgxLoggerLevel.OFF);
    committeeConfig.events().subscribe(data => this.committeeReferenceData = data);
    this.queryCommitteeMembers();
  }

  groupEvents(groupEventsFilter: GroupEventsFilter): Promise<GroupEvent[]> {
    this.logger.debug("groupEventsFilter", groupEventsFilter);
    const fromDate = groupEventsFilter.fromDate.value;
    const toDate = groupEventsFilter.toDate.value;
    this.logger.debug("groupEventsFilter:fromDate", this.displayDatePipe.transform(fromDate), "toDate", this.displayDatePipe.transform(toDate));
    const events: GroupEvent[] = [];
    const promises = [];
    const committeeContactDetails: CommitteeMember = this.committeeReferenceData?.committeeMembersForRole("secretary")[0];
    if (groupEventsFilter.includeWalks) {
      promises.push(
        this.walksService.all({criteria: {walkDate: {$gte: fromDate, $lte: toDate}}})
          .then(walks => this.walksQueryService.activeWalks(walks))
          .then(walks => walks.forEach(walk => events.push({
            id: walk.id,
            selected: true,
            eventType: GroupEventTypes.WALK,
            eventDate: walk.walkDate,
            eventTime: walk.startTime,
            distance: walk.distance,
            postcode: walk.postcode,
            title: walk.briefDescriptionAndStartPoint || "Awaiting walk details",
            description: walk.longerDescription,
            contactName: walk.displayName || "Awaiting walk leader",
            contactPhone: walk.contactPhone,
            contactEmail: walk.contactEmail
          }))));
    }
    if (groupEventsFilter.includeCommitteeEvents) {
      promises.push(
        this.committeeFileService.all({criteria: {eventDate: {$gte: fromDate, $lte: toDate}}})
          .then(committeeFiles => committeeFiles.forEach(committeeFile => events.push({
            id: committeeFile.id,
            selected: true,
            eventType: GroupEventTypes.COMMITTEE,
            eventDate: committeeFile.eventDate,
            postcode: committeeFile.postcode,
            description: committeeFile.fileType,
            title: this.committeeDisplayService.fileTitle(committeeFile),
            contactName: committeeContactDetails.fullName,
            contactEmail: committeeContactDetails.email
          }))));
    }
    if (groupEventsFilter.includeSocialEvents) {
      promises.push(
        this.socialEventsService.all({criteria: {eventDate: {$gte: fromDate, $lte: toDate}}})
          .then(socialEvents => socialEvents.forEach(socialEvent => events.push({
            id: socialEvent.id,
            selected: true,
            eventType: GroupEventTypes.SOCIAL,
            eventDate: socialEvent.eventDate,
            eventTime: socialEvent.eventTimeStart,
            postcode: socialEvent.postcode,
            title: socialEvent.briefDescription,
            description: socialEvent.longerDescription,
            contactName: socialEvent.displayName,
            contactPhone: socialEvent.contactPhone,
            contactEmail: socialEvent.contactEmail
          }))));
    }

    return Promise.all(promises).then(() => {
      this.logger.debug("performed total of", promises.length, "events types containing total of", events.length, "events:", events);
      return events.sort(sortBy(groupEventsFilter.sortBy || "eventDate"));
    });
  }

  queryAllFiles(): Promise<void> {
    return this.queryFiles();
  }

  queryCommitteeMembers() {
    this.memberService.all({
      criteria: {committee: {$eq: true}}, sort: {firstName: 1, lastName: 1}
    }).then(members => {
      this.logger.info("queried committeeMembers:", members);
      this.committeeMembers = members;
    });
  }

  queryFiles(committeeFileId?: string): Promise<void> {
    this.logger.debug("queryFiles:committeeFileId:", committeeFileId);
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
    this.logger.debug("applyFiles:committee file count:", this.committeeFiles.length);
  }

  committeeFilesLatestFirst() {
    return this.committeeFiles.sort(sortBy("-eventDate"));
  }

  latestYear(): number {
    return this.extractYear(first(this.committeeFilesLatestFirst()));
  }

  committeeFilesForYear(year: number): CommitteeFile[] {
    this.logger.off("committeeFilesForYear", year, "file count:", this.committeeFilesLatestFirst()?.length);
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
    this.logger.debug("latestYearValue", latestYearValue);
    const years = chain(this.committeeFiles)
      .map(file => this.extractYear(file))
      .filter(year => !isNaN(year))
      .unique()
      .map(item => this.addLatestYearFlag(item, latestYearValue))
      .value()
      .sort(descending());
    this.logger.debug("committeeFileYears", years);
    return years.length === 0 ? [{year: this.latestYear(), latestYear: true}] : years;
  }

  thisCommitteeYear(): CommitteeYear {
    return {year: this.latestYear(), latestYear: true};
  }
}
