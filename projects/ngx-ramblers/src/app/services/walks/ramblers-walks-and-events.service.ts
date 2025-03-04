import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import isNaN from "lodash-es/isNaN";
import without from "lodash-es/without";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { ApiResponse } from "../../models/api-response.model";
import { Member } from "../../models/member.model";
import { RamblersUploadAuditApiResponse } from "../../models/ramblers-upload-audit.model";
import {
  ALL_EVENT_TYPES,
  Contact,
  DateFormat,
  EventsListRequest,
  GroupListRequest,
  GroupWalk,
  Metadata,
  PublishStatus,
  RamblersEventType,
  RamblersGroupsApiResponse,
  RamblersGroupsApiResponseApiResponse,
  RamblersWalkResponse,
  RamblersWalksApiResponse,
  RamblersWalksRawApiResponse,
  RamblersWalksRawApiResponseApiResponse,
  RamblersWalksUploadRequest,
  WALKS_MANAGER_GO_LIVE_DATE,
  WalkUploadColumnHeading,
  WalkUploadRow
} from "../../models/ramblers-walks-manager";
import { Ramblers } from "../../models/system.model";
import {
  EventType,
  FileUploadSummary,
  LocalAndRamblersWalk,
  LocalContact,
  MongoIdsSupplied,
  Walk,
  WalkAscent,
  WalkDateAscending,
  WalkDateDescending,
  WalkDateGreaterThanOrEqualTo,
  WalkDateLessThan,
  WalkDateLessThanOrEqualTo,
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
import { enumForKey, enumValues } from "../../functions/enums";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { MemberNamingService } from "../member/member-naming.service";
import { StringUtilsService } from "../string-utils.service";
import { SystemConfigService } from "../system/system-config.service";
import { AscentValidationService } from "./ascent-validation.service";
import { DistanceValidationService } from "./distance-validation.service";
import { WalksLocalService } from "./walks-local.service";
import { DataQueryOptions } from "../../models/api-request.model";
import isEqual from "lodash-es/isEqual";
import { isNumericRamblersId } from "../path-matchers";
import { RiskAssessmentService } from "./risk-assessment.service";
import { AlertMessage } from "../../models/alert-target.model";
import { sortBy } from "../../functions/arrays";
import { SocialEvent } from "../../models/social-events.model";
import { MediaQueryService } from "../committee/media-query.service";
import { UrlService } from "../url.service";
import { WalksConfigService } from "../system/walks-config.service";
import { WalksConfig } from "../../models/walk-notification.model";
import { BuiltInRole } from "../../models/committee.model";
import { AlertInstance } from "../notifier.service";
import { WalkEventService } from "./walk-event.service";
import { WalksReferenceService } from "./walks-reference-data.service";

@Injectable({
  providedIn: "root"
})
export class RamblersWalksAndEventsService {

  private logger: Logger = inject(LoggerFactory).createLogger("RamblersWalksAndEventsService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private mediaQueryService: MediaQueryService = inject(MediaQueryService);
  private riskAssessmentService: RiskAssessmentService = inject(RiskAssessmentService);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  private walksService: WalksLocalService = inject(WalksLocalService);
  private walksConfigService: WalksConfigService = inject(WalksConfigService);
  private memberNamingService: MemberNamingService = inject(MemberNamingService);
  private distanceValidationService: DistanceValidationService = inject(DistanceValidationService);
  private ascentValidationService: AscentValidationService = inject(AscentValidationService);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private urlService: UrlService = inject(UrlService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private displayDate: DisplayDatePipe = inject(DisplayDatePipe);
  private walkDisplayService: WalkDisplayService = inject(WalkDisplayService);
  private memberLoginService: MemberLoginService = inject(MemberLoginService);
  private commonDataService: CommonDataService = inject(CommonDataService);
  private walkEventService: WalkEventService = inject(WalkEventService);
  private walksReferenceService: WalksReferenceService = inject(WalksReferenceService);
  private walksConfig: WalksConfig;
  private auditSubject = new ReplaySubject<RamblersUploadAuditApiResponse>();
  private walkLeadersSubject = new ReplaySubject<WalkLeadersApiResponse>();
  private walksSubject = new ReplaySubject<RamblersWalksApiResponse>();
  private rawWalksSubject = new ReplaySubject<RamblersWalksRawApiResponseApiResponse>();
  private groupsSubject = new ReplaySubject<RamblersGroupsApiResponseApiResponse>();
  private committeeReferenceData: CommitteeReferenceData;
  private ramblers: Ramblers;
  private BASE_URL = "/api/ramblers/walks-manager";
  private NEAREST_TOWN_PREFIX = "Starting Location is ";

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

  static isWalkDateGreaterThanOrEqualTo(response: any): response is WalkDateGreaterThanOrEqualTo {
    return (response as WalkDateGreaterThanOrEqualTo)?.walkDate?.$gte !== undefined;
  }

  static isWalkDateLessThan(response: any): response is WalkDateLessThan {
    return (response as WalkDateLessThan)?.walkDate?.$lt !== undefined;
  }

  static isWalkDateLessThanOrEqualTo(response: any): response is WalkDateLessThanOrEqualTo {
    return (response as WalkDateLessThanOrEqualTo)?.walkDate?.$lte !== undefined;
  }

  groupNotifications(): Observable<RamblersGroupsApiResponseApiResponse> {
    return this.groupsSubject.asObservable();
  }

  uploadRamblersWalks(data: RamblersWalksUploadRequest): Promise<ApiResponse> {
    return this.commonDataService.responseFrom(this.logger, this.http.post<RamblersUploadAuditApiResponse>(`${this.BASE_URL}/upload-walks`, data), this.auditSubject);
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

  async walkForId(walkId: string): Promise<Walk> {
    this.logger.debug("getByIdIfPossible:walkId", walkId, "is valid MongoId");
    const walks = await this.listRamblersWalksRawData(null, [walkId])
      .then((ramblersWalksRawApiResponse: RamblersWalksRawApiResponse) => ramblersWalksRawApiResponse.data.map(remoteWalk => this.toWalk(remoteWalk)));
    if (walks?.length === 1) {
      return walks[0];
    } else {
      this.logger.warn("walkId", walkId, "returned", this.stringUtilsService.pluraliseWithCount(walks.length, "walk"), "returning null - walks were:", walks);
      return null;
    }
  }

  async socialEventForId(socialEventId: string): Promise<SocialEvent> {
    this.logger.debug("getByIdIfPossible:socialEventId", socialEventId, "is valid MongoId");
    const socialEvents = await this.listRamblersWalksRawData(null, [socialEventId])
      .then((ramblersWalksRawApiResponse: RamblersWalksRawApiResponse) => ramblersWalksRawApiResponse.data.map(remoteWalk => this.toSocialEvent(remoteWalk)));
    if (socialEvents?.length === 1) {
      return socialEvents[0];
    } else {
      this.logger.warn("walkId", socialEventId, "returned", this.stringUtilsService.pluraliseWithCount(socialEvents.length, "walk"), "returning null - socialEvents were:", socialEvents);
      return null;
    }
  }

  async getByIdIfPossible(walkId: string): Promise<Walk> {
    if (isNumericRamblersId(walkId)) {
      return this.walkForId(walkId);
    } else {
      this.logger.debug("getByIdIfPossible:walkId", walkId, "is not valid MongoId - returning null");
      return Promise.resolve(null);
    }
  }

  async listRamblersWalks(): Promise<RamblersWalkResponse[]> {
    const body: EventsListRequest = {
      types: ALL_EVENT_TYPES
    };
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<RamblersWalksApiResponse>(`${this.BASE_URL}/list-events`, body), this.walksSubject);
    this.logger.debug("received", apiResponse);
    return apiResponse.response;
  }

  async listRamblersWalksRawData(dataQueryOptions: DataQueryOptions, ids?: string[], types?: RamblersEventType[]): Promise<RamblersWalksRawApiResponse> {
    const walkIdsFromCriteria = this.extractWalkIds(dataQueryOptions?.criteria);
    const usedIds = ids || walkIdsFromCriteria;
    const order = isEqual(dataQueryOptions?.sort, WalkDateDescending) ? "desc" : "asc";
    const sort = isEqual(dataQueryOptions?.sort, WalkDateDescending) || isEqual(dataQueryOptions?.sort, WalkDateAscending) ? "date" : "date";
    const date = usedIds.length > 0 ? null : this.createStartDate(dataQueryOptions?.criteria);
    const dateEnd = usedIds.length > 0 ? null : this.createEndDate(dataQueryOptions?.criteria);
    const body: EventsListRequest = {
      types: types || ALL_EVENT_TYPES,
      date,
      dateEnd,
      order,
      sort,
      rawData: true,
      limit: 300,
      ids: usedIds
    };
    this.logger.off("listRamblersWalksRawData:dataQueryOptions:", dataQueryOptions, "ids:", ids, "usedIds:", usedIds, "body:", body);
    const rawData = await this.commonDataService.responseFrom(this.logger, this.http.post<RamblersWalksRawApiResponseApiResponse>(`${this.BASE_URL}/list-events`, body), this.rawWalksSubject);
    return rawData.response;
  }

  private createStartDate(criteria: object): string {
    if (RamblersWalksAndEventsService.isWalkDateGreaterThanOrEqualTo(criteria)) {
      return this.dateUtils.asMoment(criteria?.walkDate.$gte).format(DateFormat.WALKS_MANAGER_API);
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
      return this.dateUtils.asMoment(criteria?.walkDate?.$lt).subtract(1, "day").format(DateFormat.WALKS_MANAGER_API);
    } else if (RamblersWalksAndEventsService.isWalkDateLessThanOrEqualTo(criteria)) {
      return this.dateUtils.asMoment(criteria?.walkDate?.$lte).format(DateFormat.WALKS_MANAGER_API);
    } else {
      return this.dateUtils.asMoment().add(2, "year").format(DateFormat.WALKS_MANAGER_API);
    }
  }

  async listRamblersGroups(groups: string[]): Promise<RamblersGroupsApiResponse[]> {
    const body: GroupListRequest = {limit: 1000, groups};
    const rawData = await this.commonDataService.responseFrom(this.logger, this.http.post<RamblersGroupsApiResponseApiResponse>(`${this.BASE_URL}/list-groups`, body), this.groupsSubject);
    return rawData.response;
  }

  exportWalksFileName(omitExtension?: boolean): string {
    return `walks-export-${this.dateUtils.asMoment().format("DD-MMMM-YYYY-HH-mm")}${omitExtension ? "" : ".csv"}`;
  }

  selectedExportableWalks(walkExports: WalkExport[]): WalkExport[] {
    return walkExports.filter(walkExport => walkExport.selected)
      .sort(walkExport => walkExport.displayedWalk.walk.walkDate);
  }

  walkUploadRows(walkExports: WalkExport[]): WalkUploadRow[] {
    return this.selectedExportableWalks(walkExports).map(walkExport => walkExport.displayedWalk.walk).map((walk: Walk) => this.walkToUploadRow(walk));
  }

  createWalksForExportPrompt(walks): Promise<WalkExport[]> {
    return this.listRamblersWalks()
      .then((ramblersWalksResponses: RamblersWalkResponse[]) => this.updateWalksWithRamblersWalkData(ramblersWalksResponses, walks))
      .then((updatedWalks: LocalAndRamblersWalk[]) => this.returnWalksExport(updatedWalks));
  }

  updateWalksWithRamblersWalkData(ramblersWalksResponses: RamblersWalkResponse[], walks: Walk[]): Promise<LocalAndRamblersWalk[]> {
    let unreferencedUrls: string[] = this.collectExistingRamblersUrlsFrom(walks);
    this.logger.info(this.stringUtilsService.pluraliseWithCount(unreferencedUrls.length, "existing ramblers walk url"), "found:", unreferencedUrls);
    this.logger.info(this.stringUtilsService.pluraliseWithCount(walks.length, "saved walk"), "found:", walks);
    const savePromises = [];
    this.logger.info("ramblersWalksResponses:", ramblersWalksResponses);
    ramblersWalksResponses.forEach((ramblersWalksResponse: RamblersWalkResponse) => {
      const walkMatchedByDate: Walk = walks.find(walk => this.dateUtils.asString(walk.walkDate, undefined, "dddd, Do MMMM YYYY") === ramblersWalksResponse.startDate);
      if (!walkMatchedByDate) {
        this.logger.info("no date match found for ramblersWalksResponse", ramblersWalksResponse);
      } else {
        unreferencedUrls = without(unreferencedUrls, ramblersWalksResponse.url);
        if (walkMatchedByDate) {
          if (this.notMatchedByIdOrUrl(walkMatchedByDate, ramblersWalksResponse)) {
            this.logger.info("updating walk from", walkMatchedByDate.ramblersWalkId || "empty", "->", ramblersWalksResponse.id, "and", walkMatchedByDate.ramblersWalkUrl || "empty", "->", ramblersWalksResponse.url, "on", this.displayDate.transform(walkMatchedByDate.walkDate));
            walkMatchedByDate.ramblersWalkId = ramblersWalksResponse.id;
            walkMatchedByDate.ramblersWalkUrl = ramblersWalksResponse.url;
            walkMatchedByDate.startLocationW3w = ramblersWalksResponse.start_location?.w3w;
            savePromises.push(this.walksService.createOrUpdate(walkMatchedByDate));
            this.logger.info("walk updated to:", walkMatchedByDate);
          }
          if (this.mediaExistsOnWalksManagerNotLocal(walkMatchedByDate, ramblersWalksResponse)) {
            this.logger.info("mediaMismatch:updating walk from", walkMatchedByDate.media || "empty", "->", ramblersWalksResponse.media, "on", this.displayDate.transform(walkMatchedByDate.walkDate));
            walkMatchedByDate.media = ramblersWalksResponse.media;
            savePromises.push(this.walksService.createOrUpdate(walkMatchedByDate));
            this.logger.info("walk updated to:", walkMatchedByDate);
          }
        } else {
          this.logger.info("no update required for walk", walkMatchedByDate.id, walkMatchedByDate.walkDate, this.dateUtils.displayDay(walkMatchedByDate.walkDate));
        }
      }
    });

    if (unreferencedUrls.length > 0) {
      this.logger.off("removing", this.stringUtilsService.pluraliseWithCount(unreferencedUrls.length, "old ramblers walk"), unreferencedUrls, "from existing walks");
      unreferencedUrls.map((url: string) => {
        const walkMatchedByUrl: Walk = walks.find(walk => walk.ramblersWalkUrl === url);
        if (walkMatchedByUrl) {
          this.logger.off("removing ramblers walkMatchedByUrl", walkMatchedByUrl.ramblersWalkId, "from walkMatchedByUrl on", this.displayDate.transform(walkMatchedByUrl.walkDate));
          delete walkMatchedByUrl.ramblersWalkId;
          delete walkMatchedByUrl.ramblersWalkUrl;
          savePromises.push(this.walksService.createOrUpdate(walkMatchedByUrl));
        }
      });
    }
    return Promise.all(savePromises).then(() => this.integrate(walks, ramblersWalksResponses));
  }

  private integrate(walks: Walk[], ramblersWalksResponses: RamblersWalkResponse[]): LocalAndRamblersWalk[] {
    return walks.map(walk => ({
      localWalk: walk,
      ramblersWalk: ramblersWalksResponses.find(item => item.id === walk.ramblersWalkId)
    }));
  }

  private notMatchedByIdOrUrl(walkMatchedByDate: Walk, ramblersWalksResponse: RamblersWalkResponse): boolean {
    return walkMatchedByDate.ramblersWalkUrl !== ramblersWalksResponse.url || walkMatchedByDate.ramblersWalkId !== ramblersWalksResponse.id;
  }

  collectExistingRamblersUrlsFrom(walks: Walk[]): string[] {
    return walks?.filter(walk => walk.ramblersWalkUrl)
      ?.map(walk => walk.ramblersWalkUrl);
  }

  returnWalksExport(localAndRamblersWalks: LocalAndRamblersWalk[]): WalkExport[] {
    const todayValue = this.dateUtils.momentNowNoTime().valueOf();
    return localAndRamblersWalks
      .filter(walk => (walk.localWalk.walkDate >= todayValue) && walk.localWalk.briefDescriptionAndStartPoint)
      .map(walk => this.validateWalk(walk));
  }

  uploadToRamblers(walkExports: WalkExport[], members: Member[], notify: AlertInstance): Promise<FileUploadSummary> {
    notify.setBusy();
    const walkIdDeletionList = this.walkDeletionList(walkExports);
    this.logger.debug("sourceData", walkExports);
    const rows = this.walkUploadRows(walkExports);
    const fileName = this.exportWalksFileName();
    const walksUploadRequest: RamblersWalksUploadRequest = {
      headings: this.walkUploadHeadings(),
      rows,
      fileName,
      walkIdDeletionList,
      ramblersUser: this.memberLoginService.loggedInMember().firstName
    };
    this.logger.off("exporting", walksUploadRequest);
    notify.warning({
      title: "Ramblers walks upload",
      message: `Uploading ${this.stringUtilsService.pluraliseWithCount(rows.length, "walk")} to Ramblers...`
    });
    return this.uploadRamblersWalks(walksUploadRequest)
      .then(response => {
        notify.warning({
          title: "Ramblers walks upload",
          message: `Upload of ${this.stringUtilsService.pluraliseWithCount(rows.length, "walk")} to Ramblers has been submitted. Monitor the Walk upload audit tab for progress`
        });
        this.logger.debug("success response data", response);
        notify.clearBusy();
        return {fileName, error: false};
      })
      .catch(response => {
        this.logger.debug("error response data", response);
        notify.error({
          title: "Ramblers walks upload failed",
          message: response
        });
        return {fileName, error: true};
      });
  }

  public walkDeletionList(walkExports: WalkExport[]): string[] {
    return this.selectedExportableWalks(walkExports).map(walkExport => walkExport.displayedWalk.walk)
      .filter(walk => !isEmpty(walk.ramblersWalkUrl)).map(walk => this.transformUrl(walk));
  }

  private transformUrl(walk: Walk) {
    const transformed = walk.ramblersWalkUrl?.replace(this.ramblers?.mainSite?.href, this.ramblers?.walksManager?.href);
    this.logger.off("transformUrl:ramblersWalkUrl:", walk.ramblersWalkUrl, "from:", this.ramblers?.mainSite?.href, "to:", this.ramblers?.walksManager?.href, "transformed:", transformed);
    return transformed;
  }

  private walkUploadHeadings() {
    return enumValues(WalkUploadColumnHeading);
  }

  validateWalk(localAndRamblersWalk: LocalAndRamblersWalk): WalkExport {
    const validationMessages = [];
    const walk: Walk = localAndRamblersWalk.localWalk;
    const walkDistance: WalkDistance = this.distanceValidationService.parse(walk);
    const walkAscent: WalkAscent = this.ascentValidationService.parse(walk);
    this.logger.off("validateWalk:walk:", walk, "walkDistance:", walkDistance);
    const contactIdMessage = this.memberLoginService.allowWalkAdminEdits() ? "This can be entered on the Walk Leader tab" : "This will need to be setup for you by " + this.committeeReferenceData.contactUsFieldForBuiltInRole(BuiltInRole.WALKS_CO_ORDINATOR, "fullName");
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
      if (isEmpty(walk.startTime)) {
        validationMessages.push("start time is missing");
      }
      if (this.walkStartTime(walk) === "Invalid date") {
        validationMessages.push("start time [" + walk.startTime + "] is invalid");
      }
      if (isEmpty(walk.grade)) {
        validationMessages.push("grade is missing");
      }
      if (isEmpty(walk.longerDescription)) {
        validationMessages.push("description is missing");
      }

      if (isEmpty(walk?.start_location?.postcode) && isEmpty(this.walkDisplayService.gridReferenceFrom(walk?.start_location))) {
        validationMessages.push("both starting postcode and grid reference are missing");
      }

      if (isEmpty(walk.contactId)) {
        validationMessages.push("Walk leader has no Walks Manager Contact Name entered on their member record. " + contactIdMessage);
      }

      if (!isNaN(+walk.contactId)) {
        validationMessages.push(`Walk leader has an old Ramblers contact Id (${walk.contactId}) setup on their member record. This needs to be updated to an Walks Manager Contact Name. ${contactIdMessage}`);
      }

      if (!walk?.finishTime) {
        validationMessages.push("Estimated Finish Time has not been entered");
      } else if (!walk?.finishTime.includes(":")) {
        validationMessages.push("Estimated Finish time must be entered using hh:mm format but it's been entered as " + walk?.finishTime);
      }

      if (isEmpty(walk.walkType)) {
        validationMessages.push("Display Name for walk leader is missing. This can be entered manually on the Walk Leader tab");
      }

      if (walk.walkType === WalkType.LINEAR && isEmpty(this.walkDisplayService.gridReferenceFrom(walk?.end_location))) {
        validationMessages.push(`Walk is ${WalkType.LINEAR} but no finish postcode has been entered in the Walk Details tab`);
      }

      if (walk.walkType === WalkType.CIRCULAR && !isEmpty(walk?.end_location?.postcode) && walk?.end_location?.postcode !== walk?.start_location?.postcode) {
        validationMessages.push(`Walk is ${WalkType.CIRCULAR} but the finish postcode ${walk?.end_location?.postcode} does not match the Starting Postcode ${walk?.start_location?.postcode} in the Walk Details tab`);
      }

      if (this.riskAssessmentService.unconfirmedRiskAssessmentsExist(walk.riskAssessment)) {
        const alertMessage: AlertMessage = this.riskAssessmentService.warningMessage(walk.riskAssessment);
        this.logger.off("unconfirmedRiskAssessmentsExist:given walk", walk, "riskAssessment:", walk.riskAssessment, "alertMessage:", alertMessage);
        validationMessages.push(`${alertMessage.title}. ${alertMessage.message}`);
      }
    }
    const publishStatus = this.publishStatus(localAndRamblersWalk);
    return {
      publishStatus,
      displayedWalk: this.walkDisplayService.toDisplayedWalk(walk),
      validationMessages,
      publishedOnRamblers: walk && !isEmpty(walk.ramblersWalkId),
      selected: publishStatus.publish
    };
  }

  startingLocationDetails(walk: Walk) {
    return walk.start_location?.description ? `${this.NEAREST_TOWN_PREFIX}${walk.start_location?.description}` : "";
  }

  finishingLocationDetails(walk: Walk) {
    return walk?.end_location?.description || "";
  }

  walkTitle(walk: Walk) {
    const walkDescription = [];
    if (walk.briefDescriptionAndStartPoint) {
      walkDescription.push(walk.briefDescriptionAndStartPoint);
    }
    return walkDescription.map(this.replaceSpecialCharacters).join(". ");
  }

  walkDescription(walk: Walk): string {
    return this.replaceSpecialCharacters(walk.longerDescription);
  }

  walkType(walk: Walk): string {
    return walk.walkType || "Circular";
  }

  asString(value): string {
    return value ? value : "";
  }

  walkLeader(walk: Walk): string {
    return walk.contactId ? this.replaceSpecialCharacters(walk.contactId) : "";
  }

  replaceSpecialCharacters(value: string): string {
    return value ? value
      ?.replace("’", "")
      ?.replace("é", "e")
      ?.replace("â€™", "")
      ?.replace("â€¦", "…")
      ?.replace("â€“", "–")
      ?.replace("â€™", "’")
      ?.replace("â€œ", "“")
      ?.replace(/(\r\n|\n|\r)/gm, " ") : "";
  }


  walkStartTime(walk: Walk): string {
    return walk.startTime ? this.dateUtils.asString(this.dateUtils.startTime(walk), null, "HH:mm") : "";
  }

  walkFinishTime(walk: Walk, milesPerHour: number): string {
    const distance: number = this.distanceValidationService.parse(walk).miles.value;
    return walk.startTime ? this.dateUtils.asString(this.dateUtils.startTime(walk) + this.dateUtils.durationForDistanceInMiles(distance, milesPerHour), null, "HH:mm") : "";
  }

  walkFinishTimeIfEmpty(walk: Walk, milesPerHour: number): string {
    return walk.finishTime || this.walkFinishTime(walk, milesPerHour);
  }

  startingGridReference(walk: Walk): string {
    return this.walkDisplayService.gridReferenceFrom(walk?.start_location);
  }


  startingPostcode(walk: Walk): string {
    return walk?.start_location?.postcode || "";
  }

  walkFinishGridReference(walk: Walk): string {
    return walk?.end_location?.grid_reference_10 || "";
  }

  walkFinishPostcode(walk: Walk): string {
    return this.walkDisplayService.gridReferenceFrom(walk?.end_location) ? "" : walk?.end_location?.postcode || "";
  }

  walkDate(walk: Walk, format: string): string {
    return this.dateUtils.asString(walk.walkDate, null, format);
  }

  walkToUploadRow(walk: Walk): WalkUploadRow {
    return this.walkToWalkUploadRow(walk);
  }

  async all(dataQueryOptions?: DataQueryOptions, ids?: string[], types?: RamblersEventType[]): Promise<Walk[]> {
    return this.listRamblersWalksRawData(dataQueryOptions, ids, types)
      .then((ramblersWalksRawApiResponse: RamblersWalksRawApiResponse) => ramblersWalksRawApiResponse.data.map(remoteWalk => this.toWalk(remoteWalk)));
  }

  async allSocialEvents(dataQueryOptions?: DataQueryOptions): Promise<SocialEvent[]> {
    return this.listRamblersWalksRawData(dataQueryOptions, null, [RamblersEventType.GROUP_EVENT])
      .then((ramblersWalksRawApiResponse: RamblersWalksRawApiResponse) => ramblersWalksRawApiResponse.data.map(remoteWalk => this.toSocialEvent(remoteWalk)));
  }

  private localContact(groupWalk: GroupWalk): LocalContact {
    const contact: Contact = groupWalk.walk_leader || groupWalk.event_organiser;
    const telephone = contact?.telephone;
    const id = contact?.id;
    const email = contact?.email_form;
    const contactName = contact?.name;
    const displayName = this.memberNamingService.createDisplayNameFromContactName(contactName);
    return {id, email, contactName, displayName, telephone};
  }

  toWalk(groupWalk: GroupWalk): Walk {
    const startMoment = this.dateUtils.asMoment(groupWalk.start_date_time);
    const contact: LocalContact = this.localContact(groupWalk);
    const walk: Walk = {
      eventType: groupWalk.item_type,
      media: groupWalk.media,
      ascent: groupWalk.ascent_feet?.toString(),
      briefDescriptionAndStartPoint: groupWalk.title,
      config: {meetup: null},
      contactEmail: contact?.email,
      contactId: contact?.id,
      contactName: contact?.contactName,
      contactPhone: groupWalk?.walk_leader?.telephone,
      displayName: contact?.displayName,
      distance: groupWalk?.distance_miles ? `${groupWalk?.distance_miles} miles` : "",
      events: [],
      grade: groupWalk.difficulty?.description,
      start_location: groupWalk.start_location || groupWalk.location,
      end_location: groupWalk?.end_location,
      id: groupWalk.id,
      longerDescription: groupWalk?.description,
      meetupEventDescription: null,
      meetupEventTitle: this.urlService.isMeetupUrl(groupWalk.external_url) ? groupWalk.title : null,
      meetupEventUrl: this.urlService.isMeetupUrl(groupWalk.external_url) ? groupWalk.external_url : null,
      meetupPublish: false,
      osMapsRoute: null,
      osMapsTitle: null,
      ramblersPublish: false,
      ramblersWalkId: groupWalk.id,
      ramblersWalkUrl: groupWalk.url,
      riskAssessment: [],
      startLocationW3w: groupWalk.start_location?.w3w,
      startTime: this.dateUtils.asString(startMoment, undefined, this.dateUtils.formats.displayTime),
      venue: undefined,
      walkDate: this.dateUtils.asValueNoTime(startMoment),
      walkLeaderMemberId: null,
      walkType: enumForKey(WalkType, groupWalk.shape),
      group: {
        groupCode: groupWalk.group_code,
        longName: groupWalk.group_name
      },
      features: (groupWalk.facilities || []).concat(groupWalk.transport || []).concat(groupWalk.accessibility || []).sort(sortBy("description")),
      additionalDetails: groupWalk.additional_details,
      organiser: groupWalk?.event_organiser?.name
    };
    this.logger.info("groupWalk:", groupWalk, "walk:", walk, "contactName:", contact.contactName, "displayName:", contact.displayName);
    return walk;
  }

  toSocialEvent(groupWalk: GroupWalk): SocialEvent {
    const startMoment = this.dateUtils.asMoment(groupWalk.start_date_time);
    const contact: LocalContact = this.localContact(groupWalk);
    const socialEvent: SocialEvent = {
      id: groupWalk.id,
      displayName: contact.displayName,
      briefDescription: groupWalk.title,
      contactEmail: contact?.email,
      contactPhone: contact?.telephone,
      eventContactMemberId: null,
      eventDate: this.dateUtils.asValueNoTime(startMoment),
      eventTimeStart: this.dateUtils.asString(startMoment, undefined, this.dateUtils.formats.displayTime),
      location: groupWalk.location?.description || groupWalk.start_location?.description,
      longerDescription: groupWalk?.description,
      postcode: groupWalk.start_location?.postcode || groupWalk.location.postcode,
      attendees: [],
      attachment: null,
      eventTimeEnd: null,
      fileNameData: null,
      link: groupWalk.external_url,
      linkTitle: null,
      mailchimp: null,
      notification: null,
      thumbnail: this.mediaQueryService.imageUrlFrom(groupWalk),
      media: groupWalk.media,
    };
    this.logger.info("groupWalk:", groupWalk, "socialEvent:", socialEvent, "contactName:", contact.contactName, "displayName:", contact.displayName);
    return socialEvent;
  }

  generateAllFeatures(): Metadata[] {
    return [
      "assistance-dogs",
      "back",
      "back-link",
      "back-round",
      "car-parking",
      "car-sharing",
      "chat",
      "clock",
      "coach-trip",
      "component-tick-desktop",
      "component-tick-mobile",
      "copyright",
      "cross",
      "cursor",
      "dog-friendly",
      "down",
      "email-icon",
      "external-link",
      "facebook",
      "facebook-icon",
      "family-friendly",
      "fast-pace",
      "footprint",
      "forward",
      "forward-round",
      "gate",
      "hat",
      "hiking",
      "home",
      "information",
      "instagram",
      "introductory-walk",
      "linkedin-in",
      "location",
      "mail",
      "may-be-muddy",
      "meetup",
      "menu",
      "no-car",
      "no-stiles",
      "play",
      "public-transport",
      "pushchair-friendly",
      "quote-end",
      "quote-start",
      "rain",
      "refreshments",
      "rest-stop-available",
      "search",
      "signpost",
      "slower-pace",
      "some-inclines",
      "sun",
      "tick",
      "toilets",
      "tree",
      "twitter",
      "twitter-icon",
      "uneven-ground",
      "up",
      "whatsapp",
      "wheelchair-accessible",
      "youtube"].map(feature => this.toFeature(feature));
  }

  walkToWalkUploadRow(walk: Walk): WalkUploadRow {
    const csvRecord: WalkUploadRow = {};
    const walkDistance: WalkDistance = this.distanceValidationService.parse(walk);
    this.logger.debug("walkDistance:", walkDistance);
    const walkAscent: WalkAscent = this.ascentValidationService.parse(walk);
    this.logger.debug("walkAscent:", walkAscent);
    csvRecord[WalkUploadColumnHeading.DATE] = this.walkDate(walk, DateFormat.WALKS_MANAGER_CSV);
    csvRecord[WalkUploadColumnHeading.TITLE] = this.walkTitle(walk);
    csvRecord[WalkUploadColumnHeading.DESCRIPTION] = this.walkDescription(walk);
    csvRecord[WalkUploadColumnHeading.ADDITIONAL_DETAILS] = "";
    csvRecord[WalkUploadColumnHeading.WEBSITE_LINK] = this.walkDisplayService.walkLink(walk);
    csvRecord[WalkUploadColumnHeading.WALK_LEADERS] = this.walkLeader(walk);
    csvRecord[WalkUploadColumnHeading.LINEAR_OR_CIRCULAR] = this.walkType(walk);
    csvRecord[WalkUploadColumnHeading.START_TIME] = this.walkStartTime(walk);
    csvRecord[WalkUploadColumnHeading.STARTING_LOCATION] = "";
    csvRecord[WalkUploadColumnHeading.STARTING_POSTCODE] = this.startingPostcode(walk);
    csvRecord[WalkUploadColumnHeading.STARTING_GRIDREF] = this.startingGridReference(walk);
    csvRecord[WalkUploadColumnHeading.STARTING_LOCATION_DETAILS] = this.startingLocationDetails(walk);
    csvRecord[WalkUploadColumnHeading.MEETING_TIME] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_LOCATION] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_POSTCODE] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_GRIDREF] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_LOCATION_DETAILS] = "";
    csvRecord[WalkUploadColumnHeading.EST_FINISH_TIME] = this.walkFinishTimeIfEmpty(walk, this.walksConfig?.milesPerHour);
    csvRecord[WalkUploadColumnHeading.FINISHING_LOCATION] = "";
    csvRecord[WalkUploadColumnHeading.FINISHING_POSTCODE] = this.walkFinishPostcode(walk);
    csvRecord[WalkUploadColumnHeading.FINISHING_GRIDREF] = this.walkFinishGridReference(walk);
    csvRecord[WalkUploadColumnHeading.FINISHING_LOCATION_DETAILS] = this.finishingLocationDetails(walk);
    csvRecord[WalkUploadColumnHeading.DIFFICULTY] = this.asString(walk.grade);
    csvRecord[WalkUploadColumnHeading.DISTANCE_KM] = walkDistance.kilometres.valueAsString;
    csvRecord[WalkUploadColumnHeading.DISTANCE_MILES] = walkDistance.miles.valueAsString;
    csvRecord[WalkUploadColumnHeading.ASCENT_METRES] = walkAscent.metres.valueAsString;
    csvRecord[WalkUploadColumnHeading.ASCENT_FEET] = walkAscent.feet.valueAsString;
    csvRecord[WalkUploadColumnHeading.DOG_FRIENDLY] = "";
    csvRecord[WalkUploadColumnHeading.INTRODUCTORY_WALK] = "";
    csvRecord[WalkUploadColumnHeading.NO_STILES] = "";
    csvRecord[WalkUploadColumnHeading.FAMILY_FRIENDLY] = "";
    csvRecord[WalkUploadColumnHeading.WHEELCHAIR_ACCESSIBLE] = "";
    csvRecord[WalkUploadColumnHeading.ACCESSIBLE_BY_PUBLIC_TRANSPORT] = "";
    csvRecord[WalkUploadColumnHeading.CAR_PARKING_AVAILABLE] = "";
    csvRecord[WalkUploadColumnHeading.CAR_SHARING_AVAILABLE] = "";
    csvRecord[WalkUploadColumnHeading.COACH_TRIP] = "";
    csvRecord[WalkUploadColumnHeading.REFRESHMENTS_AVAILABLE_PUB_CAFE] = "";
    csvRecord[WalkUploadColumnHeading.TOILETS_AVAILABLE] = "";
    return csvRecord;
  }

  private mediaExistsOnWalksManagerNotLocal(walkMatchedByDate: Walk, ramblersWalksResponse: RamblersWalkResponse) {
    return ramblersWalksResponse?.media?.length > 0 && (walkMatchedByDate?.media?.length || 0) === 0;
  }

  private toFeature(feature: string): Metadata {
    return {code: feature, description: this.stringUtilsService.asTitle(feature)};
  }

  private publishStatus(localAndRamblersWalk: LocalAndRamblersWalk): PublishStatus {
    const validateGridReferences = false;
    const publishStatus: PublishStatus = {actionRequired: false, publish: false, messages: []};
    const walk: Walk = localAndRamblersWalk.localWalk;
    const ramblersWalk: RamblersWalkResponse = localAndRamblersWalk.ramblersWalk;
    const eventType: EventType = this.walkEventService.latestEventWithStatusChange(walk).eventType;
    const isApproved = this.walkEventService.latestEventWithStatusChangeIs(walk, EventType.APPROVED);
    const publishRequired = true;
    const actionRequired = true;
    if (walk.ramblersPublish) {
      if (!ramblersWalk) {
        if (!isApproved) {
          publishStatus.messages.push("Walk is " + this.walksReferenceService.toWalkEventType(eventType)?.description);
          publishStatus.actionRequired = actionRequired;
        } else {
          publishStatus.messages.push("Walk is not yet published");
          publishStatus.publish = publishRequired;
        }
      } else {
        if (walk?.start_location?.postcode && walk?.start_location?.postcode !== ramblersWalk?.start_location?.postcode) {
          publishStatus.messages.push("Ramblers postcode is " + ramblersWalk?.start_location?.postcode + " but website postcode is " + walk?.start_location?.postcode);
          publishStatus.publish = publishRequired;
        }
        if (validateGridReferences && walk?.start_location?.grid_reference_10 && walk?.start_location?.grid_reference_10 !== ramblersWalk?.start_location?.grid_reference_10) {
          publishStatus.messages.push("Ramblers grid reference is " + ramblersWalk?.start_location?.grid_reference_10 + " but website grid reference is " + walk?.start_location?.grid_reference_10);
          publishStatus.publish = publishRequired;
        }
        if (walk?.end_location?.postcode && walk?.end_location?.postcode !== ramblersWalk?.end_location?.postcode) {
          publishStatus.messages.push("Ramblers postcode is " + ramblersWalk?.end_location?.postcode + " but website postcode is " + walk?.end_location?.postcode);
          publishStatus.publish = publishRequired;
        }
        if (validateGridReferences && walk?.end_location?.grid_reference_10 && walk?.end_location?.grid_reference_10 !== ramblersWalk?.end_location?.grid_reference_10) {
          publishStatus.messages.push("Ramblers grid reference is " + ramblersWalk?.end_location?.grid_reference_10 + " but website grid reference is " + walk?.end_location?.grid_reference_10);
          publishStatus.publish = publishRequired;
        }
        if (walk?.briefDescriptionAndStartPoint && walk?.briefDescriptionAndStartPoint !== ramblersWalk?.title) {
          publishStatus.messages.push("Ramblers title is " + ramblersWalk?.title + " but website title is " + walk?.briefDescriptionAndStartPoint);
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
    this.logger.off("publishStatus:walk:", walk, "ramblersWalk:", ramblersWalk, "publishStatus:", publishStatus);
    return publishStatus;
  }
}
