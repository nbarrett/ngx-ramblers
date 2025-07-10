import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import isNaN from "lodash-es/isNaN";
import without from "lodash-es/without";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import {
  ALL_EVENT_TYPES,
  Contact,
  DateFormat,
  EventQueryParameters,
  EventsListRequest,
  GroupListRequest,
  Metadata,
  PublishStatus,
  RamblersEventsApiResponse,
  RamblersEventSummaryApiResponse,
  RamblersEventSummaryResponse,
  RamblersEventType,
  RamblersGroupEventsRawApiResponse,
  RamblersGroupsApiResponse,
  RamblersGroupsApiResponseApiResponse,
  RamblersWalksUploadRequest,
  WALKS_MANAGER_GO_LIVE_DATE,
  WalkUploadColumnHeading,
  WalkUploadRow
} from "../../models/ramblers-walks-manager";
import { Ramblers } from "../../models/system.model";
import {
  EventStartDateAscending,
  EventStartDateDescending,
  EventStartDateGreaterThanOrEqualTo,
  EventStartDateLessThan,
  EventStartDateLessThanOrEqualTo,
  EventType,
  GroupEventField,
  LinkSource,
  LinkWithSource,
  LocalAndRamblersWalk,
  LocalContact,
  MongoIdsSupplied,
  WalkAscent,
  WalkDistance,
  WalkExport,
  WalkLeadersApiResponse,
  WalkType
} from "../../models/walk.model";
import { WalkDisplayService } from "../../pages/walks/walk-display.service";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { CommitteeConfigService } from "../committee/commitee-config.service";
import { CommitteeReferenceData } from "../committee/committee-reference-data";
import { CommonDataService } from "../common-data-service";
import { DateUtilsService } from "../date-utils.service";
import { enumKeyValues, enumValueForKey, enumValues } from "../../functions/enums";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { StringUtilsService } from "../string-utils.service";
import { SystemConfigService } from "../system/system-config.service";
import { AscentValidationService } from "../walks/ascent-validation.service";
import { DistanceValidationService } from "../walks/distance-validation.service";
import { LocalWalksAndEventsService } from "./local-walks-and-events.service";
import isEqual from "lodash-es/isEqual";
import { RiskAssessmentService } from "../walks/risk-assessment.service";
import { AlertMessage } from "../../models/alert-target.model";
import { sortBy } from "../../functions/arrays";
import { HasMedia } from "../../models/social-events.model";
import { WalksConfigService } from "../system/walks-config.service";
import { WalksConfig } from "../../models/walk-notification.model";
import { BuiltInRole } from "../../models/committee.model";
import { AlertInstance } from "../notifier.service";
import { GroupEventService } from "./group-event.service";
import { WalksReferenceService } from "../walks/walks-reference-data.service";
import { ALL_DESCRIBED_FEATURES, DescribedFeature, Feature } from "../../models/walk-feature.model";
import { marked } from "marked";
import { ExtendedFields, ExtendedGroupEvent, GroupEvent } from "../../models/group-event.model";
import { MemberNamingService } from "../member/member-naming.service";
import { UrlService } from "../url.service";
import isString from "lodash-es/isString";
import { FeaturesService } from "../features.service";
import keys from "lodash-es/keys";
import cloneDeep from "lodash-es/clone";
import { LinksService } from "../links.service";

@Injectable({
  providedIn: "root"
})
export class RamblersWalksAndEventsService {

  private logger: Logger = inject(LoggerFactory).createLogger("RamblersWalksAndEventsService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private riskAssessmentService: RiskAssessmentService = inject(RiskAssessmentService);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  private localWalksAndEventsService: LocalWalksAndEventsService = inject(LocalWalksAndEventsService);
  private walksConfigService: WalksConfigService = inject(WalksConfigService);
  private distanceValidationService: DistanceValidationService = inject(DistanceValidationService);
  private ascentValidationService: AscentValidationService = inject(AscentValidationService);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private displayDate: DisplayDatePipe = inject(DisplayDatePipe);
  private linksService: LinksService = inject(LinksService);
  private walkDisplayService: WalkDisplayService = inject(WalkDisplayService);
  private memberLoginService: MemberLoginService = inject(MemberLoginService);
  private commonDataService: CommonDataService = inject(CommonDataService);
  private walkEventService: GroupEventService = inject(GroupEventService);
  private walksReferenceService: WalksReferenceService = inject(WalksReferenceService);
  private memberNamingService: MemberNamingService = inject(MemberNamingService);
  private featuresService: FeaturesService = inject(FeaturesService);
  private urlService: UrlService = inject(UrlService);
  private walksConfig: WalksConfig;
  private walkLeadersSubject = new ReplaySubject<WalkLeadersApiResponse>();
  private walksSubject = new ReplaySubject<RamblersEventSummaryApiResponse>();
  private rawWalksSubject = new ReplaySubject<RamblersEventsApiResponse>();
  private groupsSubject = new ReplaySubject<RamblersGroupsApiResponseApiResponse>();
  private committeeReferenceData: CommitteeReferenceData;
  private ramblers: Ramblers;
  private BASE_URL = "/api/ramblers/walks-manager";
  private conversionOptions = {markdownToHtml: false, markdownLinksToText: true};
  private dryRun = false;

  constructor() {
    inject(CommitteeConfigService).committeeReferenceDataEvents().subscribe(data => this.committeeReferenceData = data);
    this.systemConfigService.events().subscribe(item => {
      this.ramblers = item.national;
      this.logger.off("systemConfigService:ramblers:", this.ramblers, "item.system", item);
    });
    this.walksConfigService.events().subscribe(walksConfig => {
      this.walksConfig = walksConfig;
      this.logger.info("walksConfigService:walksConfig:", walksConfig);
    });
  }

  static areMongoIdsSupplied(response: any): response is MongoIdsSupplied {
    return (response as MongoIdsSupplied)?._id?.$in !== undefined;
  }

  static isEventStartDateGreaterThanOrEqualTo(response: any): response is EventStartDateGreaterThanOrEqualTo {
    return (response as EventStartDateGreaterThanOrEqualTo)?.[GroupEventField.START_DATE]?.$gte !== undefined;
  }

  static isWalkDateLessThan(response: any): response is EventStartDateLessThan {
    return (response as EventStartDateLessThan)?.[GroupEventField.START_DATE]?.$lt !== undefined;
  }

  static isWalkDateLessThanOrEqualTo(response: any): response is EventStartDateLessThanOrEqualTo {
    return (response as EventStartDateLessThanOrEqualTo)?.[GroupEventField.START_DATE]?.$lte !== undefined;
  }

  groupNotifications(): Observable<RamblersGroupsApiResponseApiResponse> {
    return this.groupsSubject.asObservable();
  }

  async queryWalkLeaders(): Promise<Contact[]> {
    this.logger.info("queryWalkLeaders:");
    const date = WALKS_MANAGER_GO_LIVE_DATE;
    const dateEnd = this.dateUtils.asMoment().add(12, "month").format(DateFormat.WALKS_MANAGER_API);
    const body: EventsListRequest = {types: [RamblersEventType.GROUP_WALK], date, dateEnd, limit: 2000};
    this.logger.info("queryWalkLeaders:body:", body);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<WalkLeadersApiResponse>(`${this.BASE_URL}/walk-leaders`, body), this.walkLeadersSubject);
    return apiResponse.response;
  }

  async queryById(walkId: string): Promise<ExtendedGroupEvent> {
    this.logger.info("queryById:walkId", walkId);
    const walksRawData: RamblersGroupEventsRawApiResponse = await this.listRamblersWalksRawData({ids: [walkId]});
    this.logger.info("queryById:walkId", walkId, "walksRawData:", walksRawData);
    const walks = walksRawData.data.map(remoteWalk => this.toExtendedGroupEvent(remoteWalk));
    if (walks?.length === 1) {
      this.logger.info("walkId", walkId, "returned", this.stringUtilsService.pluraliseWithCount(walks.length, "walk"), "walks were:", walks);
    } else {
      this.logger.warn("walkId", walkId, "returned", this.stringUtilsService.pluraliseWithCount(walks.length, "walk"), "walks were:", walks);
    }
    return walks?.[0];
  }

  async listRamblersWalks(): Promise<RamblersEventSummaryResponse[]> {
    const body: EventsListRequest = {types: ALL_EVENT_TYPES};
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<RamblersEventSummaryApiResponse>(`${this.BASE_URL}/list-events`, body), this.walksSubject);
    this.logger.debug("received", apiResponse);
    return apiResponse.response;
  }

  async listRamblersWalksRawData(eventQueryParameters: EventQueryParameters): Promise<RamblersGroupEventsRawApiResponse> {
    const walkIdsFromCriteria = this.extractWalkIds(eventQueryParameters.dataQueryOptions?.criteria);
    const usedIds = eventQueryParameters.ids || walkIdsFromCriteria;
    const order = isEqual(eventQueryParameters.dataQueryOptions?.sort, EventStartDateDescending) ? "desc" : "asc";
    const sort = isEqual(eventQueryParameters.dataQueryOptions?.sort, EventStartDateDescending) || isEqual(eventQueryParameters.dataQueryOptions?.sort, EventStartDateAscending) ? "date" : "date";
    const date = usedIds.length > 0 ? null : this.createStartDate(eventQueryParameters.dataQueryOptions?.criteria);
    const dateEnd = usedIds.length > 0 ? null : this.createEndDate(eventQueryParameters.dataQueryOptions?.criteria);
    const body: EventsListRequest = {
      types: eventQueryParameters.types || ALL_EVENT_TYPES,
      date,
      dateEnd,
      order,
      sort,
      rawData: true,
      limit: 300,
      ids: usedIds,
      groupCode: eventQueryParameters.groupCode
    };
    this.logger.info("listRamblersWalksRawData:eventQueryParameters:", eventQueryParameters, "body:", body);
    const rawData = await this.commonDataService.responseFrom(this.logger, this.http.post<RamblersEventsApiResponse>(`${this.BASE_URL}/list-events`, body), this.rawWalksSubject);
    return rawData.response;
  }

  private createStartDate(criteria: object): string {
    if (RamblersWalksAndEventsService.isEventStartDateGreaterThanOrEqualTo(criteria)) {
      return this.dateUtils.asMoment(criteria?.[GroupEventField.START_DATE]?.$gte)?.format(DateFormat.WALKS_MANAGER_API);
    } else if (RamblersWalksAndEventsService.isWalkDateLessThan(criteria) || isEmpty(criteria)) {
      return this.dateUtils.asMoment().subtract(2, "year").format(DateFormat.WALKS_MANAGER_API);
    } else {
      return this.dateUtils.asMoment().format(DateFormat.WALKS_MANAGER_API);
    }
  }

  private extractWalkIds(criteria: object): string[] {
    if (RamblersWalksAndEventsService.areMongoIdsSupplied(criteria)) {
      return criteria?._id.$in.map(item => item.toString()) || [];
    } else if (RamblersWalksAndEventsService.isWalkDateLessThan(criteria) || isEmpty(criteria)) {
      return [];
    } else {
      return [];
    }
  }

  private createEndDate(criteria: any): string {
    this.logger.off("createEndDate.criteria:", criteria, "walkDate value:", criteria?.walkDate, "walkDate formatted:", this.dateUtils.asMoment(criteria?.walkDate).format(DateFormat.WALKS_MANAGER_API));
    if (RamblersWalksAndEventsService.isWalkDateLessThan(criteria)) {
      return this.dateUtils.asMoment(criteria?.[GroupEventField.START_DATE]?.$lt).subtract(1, "day")?.format(DateFormat.WALKS_MANAGER_API);
    } else if (RamblersWalksAndEventsService.isWalkDateLessThanOrEqualTo(criteria)) {
      return this.dateUtils.asMoment(criteria?.[GroupEventField.START_DATE]?.$lte)?.format(DateFormat.WALKS_MANAGER_API);
    } else {
      return this.dateUtils.asMoment().add(2, "year")?.format(DateFormat.WALKS_MANAGER_API);
    }
  }

  async listRamblersGroups(groups: string[]): Promise<RamblersGroupsApiResponse[]> {
    const body: GroupListRequest = {limit: 1000, groups};
    const rawData = await this.commonDataService.responseFrom(this.logger, this.http.post<RamblersGroupsApiResponseApiResponse>(`${this.BASE_URL}/list-groups`, body), this.groupsSubject);
    return rawData.response.sort(sortBy("name"));
  }

  exportWalksFileName(omitExtension?: boolean): string {
    return `walks-export-${this.dateUtils.asMoment().format("DD-MMMM-YYYY-HH-mm")}${omitExtension ? "" : ".csv"}`;
  }

  selectedExportableWalks(walkExports: WalkExport[]): WalkExport[] {
    return walkExports.filter(walkExport => walkExport.selected)
      .sort(sortBy("displayedWalk.walk.groupEvent.start_date_time"));
  }

  async walkUploadRows(walkExports: WalkExport[]): Promise<WalkUploadRow[]> {
    return await Promise.all(this.selectedExportableWalks(walkExports).map(walkExport => walkExport.displayedWalk.walk).map((walk: ExtendedGroupEvent) => this.walkToUploadRow(walk)));
  }

  async createWalksForExportPrompt(walks: ExtendedGroupEvent[]): Promise<WalkExport[]> {
    const ramblersWalksResponses = await this.listRamblersWalks();
    const updatedWalks: LocalAndRamblersWalk[] = await this.updateWalksWithRamblersWalkData(ramblersWalksResponses, walks);
    this.logger.info("createWalksForExportPrompt:", this.stringUtilsService.pluraliseWithCount(ramblersWalksResponses.length, "ramblers walk"), "found:updatedWalks:", updatedWalks);
    return this.returnWalksExport(updatedWalks);
  }

  updateWalksWithRamblersWalkData(ramblersWalksResponses: RamblersEventSummaryResponse[], localEvents: ExtendedGroupEvent[]): Promise<LocalAndRamblersWalk[]> {
    let unreferencedUrls: string[] = this.collectExistingRamblersUrlsFrom(localEvents);
    this.logger.info(this.stringUtilsService.pluraliseWithCount(unreferencedUrls.length, "existing ramblers walk url"), "found:", unreferencedUrls);
    this.logger.info(this.stringUtilsService.pluraliseWithCount(localEvents.length, "local walk"), "found:", localEvents);
    const savePromises = [];
    this.logger.info(this.stringUtilsService.pluraliseWithCount(ramblersWalksResponses.length, "localEvents manager walk"), "found:", ramblersWalksResponses);
    ramblersWalksResponses.forEach((ramblersWalksResponse: RamblersEventSummaryResponse) => {
      const walkMatchedByDate: ExtendedGroupEvent = localEvents.find(walk => this.dateUtils.asString(walk?.groupEvent?.start_date_time, undefined, "dddd, Do MMMM YYYY") === ramblersWalksResponse.startDate);
      if (!walkMatchedByDate) {
        this.logger.info("no date match found for ramblersWalksResponse", ramblersWalksResponse);
      } else {
        unreferencedUrls = without(unreferencedUrls, ramblersWalksResponse.url);
        if (walkMatchedByDate) {
          if (this.notMatchedByIdOrUrl(walkMatchedByDate, ramblersWalksResponse)) {
            this.logger.info("updating walk from", walkMatchedByDate?.groupEvent?.id || "empty", "->", ramblersWalksResponse.id, "and", walkMatchedByDate?.groupEvent?.url || "empty", "->", ramblersWalksResponse.url, "on", this.displayDate.transform(walkMatchedByDate.groupEvent.start_date_time));
            walkMatchedByDate.groupEvent.id = ramblersWalksResponse.id;
            walkMatchedByDate.groupEvent.url = ramblersWalksResponse.url;
            const linkWithSource: LinkWithSource = {
              source: LinkSource.RAMBLERS,
              href: walkMatchedByDate.groupEvent.url,
              title: walkMatchedByDate.groupEvent.title
            };
            this.linksService.createOrUpdateLink(walkMatchedByDate.fields, linkWithSource);
            this.saveOrLog(savePromises, walkMatchedByDate);
          }
          if (this.copyMediaIfApplicable(walkMatchedByDate, ramblersWalksResponse)) {
            this.logger.info("mediaMismatch:updating walk from", walkMatchedByDate.groupEvent.media || "empty", "->", ramblersWalksResponse.media, "on", this.displayDate.transform(walkMatchedByDate.groupEvent.start_date_time));
            this.saveOrLog(savePromises, walkMatchedByDate);
          }
        } else {
          this.logger.info("no update required for walk", walkMatchedByDate.id, walkMatchedByDate.groupEvent.start_date_time, this.dateUtils.displayDay(walkMatchedByDate.groupEvent.start_date_time));
        }
      }
    });

    if (unreferencedUrls.length > 0) {
      this.logger.info("removing", this.stringUtilsService.pluraliseWithCount(unreferencedUrls.length, "unreferenced ramblers event url"), unreferencedUrls, "if they match existing", this.stringUtilsService.pluraliseWithCount(localEvents.length, "local event"));
      unreferencedUrls.map((url: string) => {
        const walkMatchedByUrl: ExtendedGroupEvent = localEvents.find(walk => walk.groupEvent.url === url && walk.groupEvent.id);
        if (walkMatchedByUrl) {
          this.logger.info("removing ramblers event id:", walkMatchedByUrl.groupEvent.id, "and url:", walkMatchedByUrl.groupEvent.url, "from local event on", this.displayDate.transform(walkMatchedByUrl.groupEvent.start_date_time), "walkMatchedByUrl:", walkMatchedByUrl);
          delete walkMatchedByUrl.groupEvent.id;
          delete walkMatchedByUrl.groupEvent.url;
          this.linksService.deleteLink(walkMatchedByUrl.fields, LinkSource.RAMBLERS);
          this.saveOrLog(savePromises, walkMatchedByUrl);
        }
      });
    }
    return Promise.all(savePromises).then(() => this.localAndRamblersWalksFrom(localEvents, ramblersWalksResponses));
  }

  private saveOrLog(savePromises: any[], localEvent: ExtendedGroupEvent) {
    if (this.dryRun) {
      this.logger.info("Would Update localEvent to:", localEvent, "but dry run is true");
    } else {
      savePromises.push(this.localWalksAndEventsService.createOrUpdate(localEvent));
      this.logger.info("localEvent updated to:", localEvent);
    }
  }

  private localAndRamblersWalksFrom(walks: ExtendedGroupEvent[], ramblersWalksResponses: RamblersEventSummaryResponse[]): LocalAndRamblersWalk[] {
    const mappedResults = walks.map(walk => ({
      localWalk: walk,
      ramblersWalk: ramblersWalksResponses.find(item => item.id === walk.groupEvent.id)
    }));
    this.logger.info("localAndRamblersWalksFrom:", this.stringUtilsService.pluraliseWithCount(mappedResults.length, "local and ramblers walk"), "found:", mappedResults);
    return mappedResults;
  }

  private notMatchedByIdOrUrl(localEvent: ExtendedGroupEvent, ramblersWalksResponse: RamblersEventSummaryResponse): boolean {
    const linkWithSource = this.linksService.linkWithSourceFrom(localEvent.fields, LinkSource.RAMBLERS);
    const urlMismatch = localEvent.groupEvent.url !== ramblersWalksResponse.url;
    const groupEventMismatch = localEvent.groupEvent.id !== ramblersWalksResponse.id;
    const linkUrlMismatch = linkWithSource?.href !== ramblersWalksResponse.url;
    const notMatched = urlMismatch || groupEventMismatch || linkUrlMismatch;
    this.logger.info("notMatchedByIdOrUrl:keys:", keys(cloneDeep(localEvent.groupEvent)));
    this.logger.info("notMatchedByIdOrUrl:localEvent.groupEvent.url:", localEvent.groupEvent.url,
      "ramblersWalksResponse.url:", ramblersWalksResponse.url,
      "urlMismatch:", urlMismatch,
      "localEvent.groupEvent.id:", localEvent.groupEvent.id,
      "ramblersWalksResponse.id:", ramblersWalksResponse.id,
      "groupEventMismatch:", groupEventMismatch,
      "linkWithSource.href:", linkWithSource?.href,
      "ramblersWalksResponse.url:", ramblersWalksResponse.url,
      "linkUrlMismatch:", linkUrlMismatch,
      "notMatched:", notMatched);
    return notMatched;
  }

  collectExistingRamblersUrlsFrom(walks: ExtendedGroupEvent[]): string[] {
    return walks?.filter(walk => walk.groupEvent.url)
      ?.map(walk => walk.groupEvent.url);
  }

  returnWalksExport(localAndRamblersWalks: LocalAndRamblersWalk[]): WalkExport[] {
    const todayValue = this.dateUtils.momentNowNoTime().format();
    return localAndRamblersWalks
      .filter(walk => (walk.localWalk.groupEvent.start_date_time >= todayValue) && walk.localWalk.groupEvent.title)
      .map(walk => this.toWalkExport(walk));
  }

  public notifyWalkUploadStarted(notify: AlertInstance, walksUploadRequest: RamblersWalksUploadRequest) {
    notify.warning({
      title: "Ramblers walks upload",
      message: `Upload of ${this.stringUtilsService.pluraliseWithCount(walksUploadRequest.rows.length, "walk")} to Ramblers has been submitted. Monitor the Walk upload audit tab for progress`
    });
  }

  public copyMediaIfApplicable(localWalk: ExtendedGroupEvent, hasMedia: HasMedia, alwaysCopy?: boolean) {
    if (alwaysCopy ? this.mediaExistsOnWalksManager(hasMedia) : this.mediaExistsOnWalksManagerNotLocal(localWalk.groupEvent, hasMedia)) {
      this.logger.info("mediaMismatch:updating walk from", localWalk.groupEvent.media || "empty", "->", hasMedia.media, "on", this.displayDate.transform(localWalk.groupEvent.start_date_time));
      localWalk.groupEvent.media = hasMedia.media;
      return true;
    } else {
      return false;
    }

  }

  public async createWalksUploadRequest(walkExports: WalkExport[]): Promise<RamblersWalksUploadRequest> {
    const walkIdDeletionList = this.walkDeletionList(walkExports);
    this.logger.debug("sourceData", walkExports);
    const rows: WalkUploadRow[] = await this.walkUploadRows(walkExports);
    const fileName = this.exportWalksFileName();
    return {
      headings: this.walkUploadHeadings(),
      rows,
      fileName,
      walkIdDeletionList,
      ramblersUser: this.memberLoginService.loggedInMember().firstName
    };
  }

  public walkDeletionList(walkExports: WalkExport[]): string[] {
    return this.selectedExportableWalks(walkExports).map(walkExport => walkExport.displayedWalk.walk)
      .filter(walk => !isEmpty(walk.groupEvent.url)).map(walk => this.transformUrl(walk));
  }

  private transformUrl(walk: ExtendedGroupEvent) {
    const transformed = walk.groupEvent.url?.replace(this.ramblers?.mainSite?.href, this.ramblers?.walksManager?.href);
    this.logger.off("transformUrl:groupEvent.url:", walk.groupEvent.url, "from:", this.ramblers?.mainSite?.href, "to:", this.ramblers?.walksManager?.href, "transformed:", transformed);
    return transformed;
  }

  private walkUploadHeadings() {
    return enumValues(WalkUploadColumnHeading);
  }

  public toWalkExport(localAndRamblersWalk: LocalAndRamblersWalk): WalkExport {
    this.logger.off("toWalkExport:localAndRamblersWalk:", localAndRamblersWalk, "entered");
    const validationMessages = [];
    const walk: ExtendedGroupEvent = localAndRamblersWalk.localWalk;
    const walkDistance: WalkDistance = this.distanceValidationService.parse(walk);
    const walkAscent: WalkAscent = this.ascentValidationService.parse(walk);
    this.logger.off("validateWalk:walk:", walk, "walkDistance:", walkDistance);
    if (walk?.groupEvent?.end_date_time && !isString(walk?.groupEvent?.end_date_time)) {
      this.logger.warn("toWalkExport:walk.groupEvent.end_date_time is not a string:", walk?.groupEvent?.end_date_time);
    }
    const contactIdMessage = this.memberLoginService.allowWalkAdminEdits() ? "This can be entered on the Walk Leader tab" : `This will need to be setup for you by ${this.committeeReferenceData.contactUsFieldForBuiltInRole(BuiltInRole.WALKS_CO_ORDINATOR, "fullName")}`;
    if (isEmpty(walk)) {
      validationMessages.push("walk does not exist");
    } else {
      if (isEmpty(this.walkTitle(walk))) {
        validationMessages.push("title is missing");
      }
      if (walkDistance.validationMessage) {
        validationMessages.push(walkDistance.validationMessage);
      }
      if (walkAscent.validationMessage) {
        validationMessages.push(walkAscent.validationMessage);
      }
      if (isEmpty(walk.groupEvent.start_date_time)) {
        validationMessages.push("start time is missing");
      }
      if (this.walkStartTime(walk) === "Invalid date") {
        validationMessages.push(`start time [${walk.groupEvent.start_date_time}] is invalid`);
      }
      if (isEmpty(walk.groupEvent.difficulty)) {
        validationMessages.push("grade is missing");
      }
      if (isEmpty(walk.groupEvent.description)) {
        validationMessages.push("description is missing");
      }

      if (isEmpty(walk?.groupEvent?.start_location?.postcode) && isEmpty(this.walkDisplayService.gridReferenceFrom(walk?.groupEvent?.start_location))) {
        validationMessages.push("both starting postcode and grid reference are missing");
      }

      if (isEmpty(walk?.fields?.publishing?.ramblers?.contactName)) {
        validationMessages.push(`Walk leader has no Walks Manager Contact Name entered on their member record. ${contactIdMessage}`);
      }

      if (!isNaN(+walk?.fields?.publishing?.ramblers?.contactName)) {
        validationMessages.push(`Walk leader has an old Ramblers contact Id (${walk?.fields.publishing.ramblers.contactName}) setup on their member record. This needs to be updated to an Walks Manager Contact Name. ${contactIdMessage}`);
      }
      if (!walk?.groupEvent?.end_date_time) {
        validationMessages.push("Estimated Finish Time has not been entered");
      } else if (!walk?.groupEvent?.end_date_time?.includes(":")) {
        validationMessages.push(`Estimated Finish time must be entered using hh:mm format but it's been entered as ${walk?.groupEvent?.end_date_time}`);
      }

      if (isEmpty(walk?.groupEvent?.shape)) {
        validationMessages.push("Display Name for walk leader is missing. This can be entered manually on the Walk Leader tab");
      }

      if (enumValueForKey(WalkType, walk?.groupEvent?.shape) === WalkType.LINEAR && isEmpty(this.walkDisplayService.gridReferenceFrom(walk?.groupEvent?.end_location))) {
        validationMessages.push(`Walk is ${WalkType.LINEAR} but no finish postcode has been entered in the Walk Details tab`);
      }

      if (enumValueForKey(WalkType, walk?.groupEvent?.shape) === WalkType.CIRCULAR && !isEmpty(walk?.groupEvent?.end_location?.postcode) && walk?.groupEvent?.end_location?.postcode !== walk?.groupEvent?.start_location?.postcode) {
        validationMessages.push(`Walk is ${WalkType.CIRCULAR} but the finish postcode ${walk?.groupEvent?.end_location?.postcode} does not match the Starting Postcode ${walk?.groupEvent?.start_location?.postcode} in the Walk Details tab`);
      }

      if (this.riskAssessmentService.unconfirmedRiskAssessmentsExist(walk?.fields.riskAssessment)) {
        const alertMessage: AlertMessage = this.riskAssessmentService.warningMessage(walk?.fields.riskAssessment);
        this.logger.off("unconfirmedRiskAssessmentsExist:given walk", walk, "riskAssessment:", walk?.fields.riskAssessment, "alertMessage:", alertMessage);
        validationMessages.push(`${alertMessage.title}. ${alertMessage.message}`);
      }
    }
    const publishStatus = this.toPublishStatus(localAndRamblersWalk);
    const returnValue = {
      publishStatus,
      displayedWalk: this.walkDisplayService.toDisplayedWalk(walk),
      validationMessages,
      publishedOnRamblers: walk && !isEmpty(walk.groupEvent.id),
      selected: publishStatus.publish && validationMessages.length === 0
    };
    this.logger.info("toWalkExport:localAndRamblersWalk:", localAndRamblersWalk, "returnValue:", returnValue);
    return returnValue;
  }

  startingLocationDetails(walk: ExtendedGroupEvent) {
    return walk.groupEvent.start_location?.description || "";
  }

  finishingLocationDetails(walk: ExtendedGroupEvent) {
    return walk?.groupEvent?.end_location?.description || "";
  }

  walkTitle(walk: ExtendedGroupEvent) {
    const walkDescription = [];
    if (walk.groupEvent.title) {
      walkDescription.push(walk.groupEvent.title);
    }
    return walkDescription.map(this.replaceSpecialCharacters).join(". ");
  }

  async walkDescription(walk: ExtendedGroupEvent): Promise<string> {
    return this.renderValueAsHtml(this.replaceSpecialCharacters(this.longerDescriptionPlusSuffixes(walk)));
  }

  private longerDescriptionPlusSuffixes(walk: ExtendedGroupEvent) {
    const assistanceDogsDescribedFeature: DescribedFeature = ALL_DESCRIBED_FEATURES.find(item => item.code === Feature.ASSISTANCE_DOGS);
    const walkDescription = walk.groupEvent.description.trim();
    if (this.featureSelected(Feature.ASSISTANCE_DOGS, walk) && !walk.groupEvent.description.includes(assistanceDogsDescribedFeature.description)) {
      const delimiter = this.stringUtilsService.right(walkDescription, 1) === "." ? " " : ". ";
      return `${walkDescription}${delimiter}${assistanceDogsDescribedFeature.description}.`;
    } else {
      return walkDescription;
    }
  }

  private transformMarkdownLinks(input: string): string {
    const markdownLinkRegex = /\[([^\]]+)]\((https?:\/\/[^)]+)\)/g;
    return input.replace(markdownLinkRegex, "$1: $2");
  }

  private async renderValueAsHtml(markdownValue: string): Promise<string> {
    const input = (this.conversionOptions.markdownLinksToText ? this.transformMarkdownLinks(markdownValue) : markdownValue) || "";
    const renderedMarkdown = this.conversionOptions.markdownToHtml ? await marked(input) : input;
    this.logger.info("renderMarked: markdownValue:", markdownValue, "renderedMarkdown:", renderedMarkdown);
    return renderedMarkdown;
  }

  walkType(walk: ExtendedGroupEvent): string {
    return enumValueForKey(WalkType, walk.groupEvent.shape || WalkType.CIRCULAR);
  }

  asString(value): string {
    return value ? value : "";
  }

  walkLeader(walk: ExtendedGroupEvent): string {
    return walk?.fields?.publishing?.ramblers?.contactName ? this.replaceSpecialCharacters(walk?.fields?.publishing?.ramblers?.contactName) : "";
  }

  replaceSpecialCharacters(value: string): string {
    return value ? value
      ?.replace(/’/g, "")
      ?.replace(/é/g, "e")
      ?.replace(/â€™/g, "")
      ?.replace(/â€¦/g, "…")
      ?.replace(/â€“/g, "–")
      ?.replace(/â€™/g, "’")
      ?.replace(/â€œ/g, "“") : "";
  }


  walkToUploadRow(walk: ExtendedGroupEvent): Promise<WalkUploadRow> {
    return this.walkToWalkUploadRow(walk);
  }

  async all(eventQueryParameters: EventQueryParameters): Promise<ExtendedGroupEvent[]> {
    return this.listRamblersWalksRawData(eventQueryParameters)
      .then((ramblersWalksRawApiResponse: RamblersGroupEventsRawApiResponse) => ramblersWalksRawApiResponse?.data?.map(remoteWalk => this.toExtendedGroupEvent(remoteWalk)));
  }

  async walkToWalkUploadRow(extendedGroupEvent: ExtendedGroupEvent): Promise<WalkUploadRow> {
    const csvRecord: WalkUploadRow = {};
    const walkDistance: WalkDistance = this.distanceValidationService.parse(extendedGroupEvent);
    this.logger.debug("walkDistance:", walkDistance);
    const walkAscent: WalkAscent = this.ascentValidationService.parse(extendedGroupEvent);
    this.logger.debug("walkAscent:", walkAscent);
    const walkDescription = await this.walkDescription(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.DATE] = this.walkDate(extendedGroupEvent, DateFormat.WALKS_MANAGER_CSV);
    csvRecord[WalkUploadColumnHeading.TITLE] = this.walkTitle(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.DESCRIPTION] = walkDescription;
    csvRecord[WalkUploadColumnHeading.ADDITIONAL_DETAILS] = "";
    csvRecord[WalkUploadColumnHeading.WEBSITE_LINK] = this.walkDisplayService.walkLink(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.WALK_LEADERS] = this.walkLeader(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.LINEAR_OR_CIRCULAR] = this.walkType(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.START_TIME] = this.walkStartTime(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.STARTING_LOCATION] = "";
    csvRecord[WalkUploadColumnHeading.STARTING_POSTCODE] = this.startingPostcode(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.STARTING_GRIDREF] = this.startingGridReference(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.STARTING_LOCATION_DETAILS] = this.startingLocationDetails(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.MEETING_TIME] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_LOCATION] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_POSTCODE] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_GRIDREF] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_LOCATION_DETAILS] = "";
    csvRecord[WalkUploadColumnHeading.EST_FINISH_TIME] = this.walkFinishTimeOrDefault(extendedGroupEvent, this.walksConfig?.milesPerHour);
    csvRecord[WalkUploadColumnHeading.FINISHING_LOCATION] = "";
    csvRecord[WalkUploadColumnHeading.FINISHING_POSTCODE] = this.walkFinishPostcode(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.FINISHING_GRIDREF] = this.walkFinishGridReference(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.FINISHING_LOCATION_DETAILS] = this.finishingLocationDetails(extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.DIFFICULTY] = this.asString(extendedGroupEvent?.groupEvent?.difficulty.description);
    csvRecord[WalkUploadColumnHeading.DISTANCE_KM] = walkDistance.kilometres.valueAsString;
    csvRecord[WalkUploadColumnHeading.DISTANCE_MILES] = walkDistance.miles.valueAsString;
    csvRecord[WalkUploadColumnHeading.ASCENT_METRES] = walkAscent.metres.valueAsString;
    csvRecord[WalkUploadColumnHeading.ASCENT_FEET] = walkAscent.feet.valueAsString;
    csvRecord[WalkUploadColumnHeading.DOG_FRIENDLY] = this.featureTrueOrFalseSelection(Feature.DOG_FRIENDLY, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.INTRODUCTORY_WALK] = this.featureTrueOrFalseSelection(Feature.INTRODUCTORY_WALK, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.NO_STILES] = this.featureTrueOrFalseSelection(Feature.NO_STILES, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.FAMILY_FRIENDLY] = this.featureTrueOrFalseSelection(Feature.FAMILY_FRIENDLY, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.WHEELCHAIR_ACCESSIBLE] = this.featureTrueOrFalseSelection(Feature.WHEELCHAIR_ACCESSIBLE, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.ACCESSIBLE_BY_PUBLIC_TRANSPORT] = this.featureTrueOrFalseSelection(Feature.PUBLIC_TRANSPORT, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.CAR_PARKING_AVAILABLE] = this.featureTrueOrFalseSelection(Feature.CAR_PARKING, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.CAR_SHARING_AVAILABLE] = this.featureTrueOrFalseSelection(Feature.CAR_SHARING, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.COACH_TRIP] = this.featureTrueOrFalseSelection(Feature.COACH_TRIP, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.REFRESHMENTS_AVAILABLE_PUB_CAFE] = this.featureTrueOrFalseSelection(Feature.REFRESHMENTS, extendedGroupEvent);
    csvRecord[WalkUploadColumnHeading.TOILETS_AVAILABLE] = this.featureTrueOrFalseSelection(Feature.TOILETS, extendedGroupEvent);
    return csvRecord;
  }

  public walkFinishTimeOrDefault(extendedGroupEvent: ExtendedGroupEvent, milesPerHour: number): string {
    const endTimeValid = extendedGroupEvent?.groupEvent?.end_date_time?.length > 5 && this.dateUtils.isDate(extendedGroupEvent?.groupEvent?.end_date_time);
    this.logger.info("walkFinishTimeOrDefault:groupEvent.end_date_time:", extendedGroupEvent?.groupEvent?.end_date_time, "endTimeValid:", endTimeValid, "of type", typeof extendedGroupEvent?.groupEvent?.end_date_time);
    if (endTimeValid) {
      return this.dateUtils.ramblersTime(extendedGroupEvent?.groupEvent?.end_date_time);
    } else {
      return this.walkFinishTime(extendedGroupEvent, milesPerHour);
    }
  }

  public walkFinishTime(extendedGroupEvent: ExtendedGroupEvent, milesPerHour?: number): string {
    const finishTimeMillis = this.dateUtils.startTimeAsValue(extendedGroupEvent) +
      this.dateUtils.durationInMsecsForDistanceInMiles(extendedGroupEvent?.groupEvent?.distance_miles, extendedGroupEvent.fields.milesPerHour || milesPerHour);
    let finishMoment = this.dateUtils.asMoment(finishTimeMillis);
    const minutes = finishMoment.minutes();
    const remainder = minutes % 15;
    if (remainder !== 0) {
      finishMoment = finishMoment.add(15 - remainder, "minutes");
    }
    finishMoment = finishMoment.seconds(0).milliseconds(0);

    return this.dateUtils.isoDateTime(finishMoment.valueOf());
  }

  walkStartTime(extendedGroupEvent: ExtendedGroupEvent): string {
    return extendedGroupEvent?.groupEvent?.start_date_time ? this.dateUtils.asString(this.dateUtils.startTimeAsValue(extendedGroupEvent), null, "HH:mm") : "";
  }

  startingGridReference(extendedGroupEvent: ExtendedGroupEvent): string {
    return this.walkDisplayService.gridReferenceFrom(extendedGroupEvent?.groupEvent?.start_location);
  }


  startingPostcode(extendedGroupEvent: ExtendedGroupEvent): string {
    return extendedGroupEvent?.groupEvent?.start_location?.postcode || "";
  }

  walkFinishGridReference(extendedGroupEvent: ExtendedGroupEvent): string {
    return extendedGroupEvent?.groupEvent?.end_location?.grid_reference_10 || "";
  }

  walkFinishPostcode(extendedGroupEvent: ExtendedGroupEvent): string {
    return this.walkDisplayService.gridReferenceFrom(extendedGroupEvent?.groupEvent?.end_location) ? "" : extendedGroupEvent?.groupEvent?.end_location?.postcode || "";
  }

  walkDate(extendedGroupEvent: ExtendedGroupEvent, format: string): string {
    return this.dateUtils.asString(extendedGroupEvent?.groupEvent?.start_date_time, null, format);
  }

  private mediaExistsOnWalksManagerNotLocal(localHasMedia: HasMedia, ramblersHasMedia: HasMedia) {
    return this.mediaExistsOnWalksManager(ramblersHasMedia) && (localHasMedia?.media?.length || 0) === 0;
  }

  private mediaExistsOnWalksManager(hasMedia: HasMedia) {
    return hasMedia?.media?.length > 0;
  }

  featureTrueOrFalseSelection(featureCode: Feature, extendedGroupEvent: ExtendedGroupEvent): string {
    return this.featureSelected(featureCode, extendedGroupEvent) ? "TRUE" : "FALSE";
  }

  featureSelected(featureCode: Feature, extendedGroupEvent: ExtendedGroupEvent): boolean {
    return this.featuresService.combinedFeatures(extendedGroupEvent.groupEvent).some(feature => feature.code === featureCode);
  }

  allFeatures(): Metadata[] {
    return enumKeyValues(Feature).map(feature => this.toFeature(feature.value as Feature));
  }

  toFeature(feature: Feature): Metadata {
    return {code: feature, description: ALL_DESCRIBED_FEATURES.find(item => item.code === feature)?.description};
  }

  private toPublishStatus(localAndRamblersWalk: LocalAndRamblersWalk): PublishStatus {
    const validateGridReferences = false;
    const publishStatus: PublishStatus = {actionRequired: false, publish: false, messages: []};
    const walk: ExtendedGroupEvent = localAndRamblersWalk.localWalk;
    const ramblersWalk: RamblersEventSummaryResponse = localAndRamblersWalk.ramblersWalk;
    const eventType: EventType = this.walkEventService.latestEventWithStatusChange(walk)?.eventType;
    const isApproved = this.walkEventService.latestEventWithStatusChangeIs(walk, EventType.APPROVED);
    const publishRequired = true;
    const actionRequired = true;
    if (walk?.fields.publishing.ramblers.publish) {
      if (!ramblersWalk) {
        if (!isApproved) {
          publishStatus.messages.push(`Walk is ${this.walksReferenceService.toWalkEventType(eventType)?.description}`);
          publishStatus.actionRequired = actionRequired;
        } else {
          publishStatus.messages.push("Walk is not yet published");
          publishStatus.publish = publishRequired;
        }
      } else {
        if (walk?.groupEvent?.start_location?.postcode && walk?.groupEvent?.start_location?.postcode !== ramblersWalk?.start_location?.postcode) {
          publishStatus.messages.push(`Ramblers postcode is ${ramblersWalk?.start_location?.postcode} but website postcode is ${walk?.groupEvent?.start_location?.postcode}`);
          publishStatus.publish = publishRequired;
        }
        if (validateGridReferences && walk?.groupEvent?.start_location?.grid_reference_10 && walk?.groupEvent?.start_location?.grid_reference_10 !== ramblersWalk?.start_location?.grid_reference_10) {
          publishStatus.messages.push(`Ramblers grid reference is ${ramblersWalk?.start_location?.grid_reference_10} but website grid reference is ${walk?.groupEvent?.start_location?.grid_reference_10}`);
          publishStatus.publish = publishRequired;
        }
        if (walk?.groupEvent?.end_location?.postcode && walk?.groupEvent?.end_location?.postcode !== ramblersWalk?.end_location?.postcode) {
          publishStatus.messages.push(`Ramblers postcode is ${ramblersWalk?.end_location?.postcode} but website postcode is ${walk?.groupEvent?.end_location?.postcode}`);
          publishStatus.publish = publishRequired;
        }
        if (validateGridReferences && walk?.groupEvent?.end_location?.grid_reference_10 && walk?.groupEvent?.end_location?.grid_reference_10 !== ramblersWalk?.end_location?.grid_reference_10) {
          publishStatus.messages.push(`Ramblers grid reference is ${ramblersWalk?.end_location?.grid_reference_10} but website grid reference is ${walk?.groupEvent?.end_location?.grid_reference_10}`);
          publishStatus.publish = publishRequired;
        }
        if (walk?.groupEvent?.title && walk?.groupEvent?.title !== ramblersWalk?.title) {
          publishStatus.messages.push(`Ramblers title is ${ramblersWalk?.title} but website title is ${walk?.groupEvent?.title}`);
          publishStatus.publish = publishRequired;
        }
        if (publishStatus.messages.length === 0) {
          publishStatus.messages.push("Walk is published to Ramblers and details are correct");
        }
      }
    } else {
      if (ramblersWalk) {
        publishStatus.messages.push("Walk needs to be unpublished from Ramblers");
        publishStatus.publish = publishRequired;
      } else {
        publishStatus.messages.push("Walk is not to be published");
      }
    }
    if (publishStatus.publish && !publishStatus.actionRequired) {
      publishStatus.actionRequired = actionRequired;
    }
    this.logger.off("toPublishStatus:walk:", walk, "ramblersWalk:", ramblersWalk, "toPublishStatus:", publishStatus);
    return publishStatus;
  }

  isWalk(groupEvent: GroupEvent): boolean {
    return groupEvent.item_type === RamblersEventType.GROUP_WALK;
  }

  private localContact(groupEvent: GroupEvent): LocalContact {
    const contact: Contact = groupEvent.walk_leader || groupEvent.event_organiser;
    const telephone = contact?.telephone;
    const id = contact?.id;
    const email = contact?.email_form;
    const contactName = contact?.name;
    const displayName = this.memberNamingService.createDisplayNameFromContactName(contactName);
    return {id, email, contactName, displayName, telephone};
  }

  toExtendedGroupEvent(groupEvent: GroupEvent): ExtendedGroupEvent {
    const localContact: LocalContact = this.localContact(groupEvent);
    this.logger.off("groupEvent:", groupEvent, "contactName:", localContact.contactName, "displayName:", localContact.displayName);

    const extendedFields: ExtendedFields = {
      migratedFromId: null,
      attachment: null,
      attendees: [],
      milesPerHour: 0,
      contactDetails: {
        memberId: null,
        displayName: localContact.displayName,
        email: localContact.email,
        phone: localContact.telephone,
        contactId: localContact.id
      },
      publishing: {
        ramblers: {
          publish: true,
          contactName: localContact.contactName
        },
        meetup: {
          publish: false,
          contactName: null
        }
      },
      links: this.toLinks(groupEvent),
      meetup: null,
      venue: null,
      riskAssessment: [],
      imageConfig: null,
      notifications: []
    };

    return {
      groupEvent,
      fields: extendedFields,
      events: [],
    };
  }

  private toLinks(groupEvent: GroupEvent): LinkWithSource[] {
    return [
      {
        title: `this ${this.isWalk(groupEvent)}` ? "walk" : "social event",
        href: this.walkDisplayService.walkLink({fields: null, id: null, groupEvent, events: []}),
        source: LinkSource.LOCAL
      },
      {
        title: groupEvent.title,
        href: groupEvent.url,
        source: LinkSource.RAMBLERS
      },
      {
        title: this.urlService.isMeetupUrl(groupEvent.external_url) ? groupEvent.title : null,
        href: this.urlService.isMeetupUrl(groupEvent.external_url) ? groupEvent.external_url : null,
        source: LinkSource.MEETUP
      }
    ].filter(item => item.href);
  }
}
