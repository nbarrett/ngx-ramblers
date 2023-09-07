import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import isNaN from "lodash-es/isNaN";
import without from "lodash-es/without";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { ApiResponse } from "../../models/api-response.model";
import { Member } from "../../models/member.model";
import { RamblersUploadAuditApiResponse } from "../../models/ramblers-upload-audit.model";
import {
  GroupListRequest,
  GroupWalk,
  RamblersGroupsApiResponse,
  RamblersGroupsApiResponseApiResponse,
  RamblersWalkResponse,
  RamblersWalksApiResponse,
  RamblersWalksRawApiResponse,
  RamblersWalksRawApiResponseApiResponse,
  RamblersWalksUploadRequest,
  WalkListRequest,
  WalkUploadColumnHeading,
  WalkUploadRow
} from "../../models/ramblers-walks-manager";
import { Ramblers } from "../../models/system.model";
import {
  Walk,
  WalkAscent,
  WalkDateAscending,
  WalkDateDescending,
  WalkDateGreaterThanOrEqualTo,
  WalkDateLessThan,
  WalkDateLessThanOrEqualTo,
  WalkDistance,
  WalkExport,
  WalkType
} from "../../models/walk.model";
import { WalkDisplayService } from "../../pages/walks/walk-display.service";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { CommitteeConfigService } from "../committee/commitee-config.service";
import { CommitteeReferenceData } from "../committee/committee-reference-data";
import { CommonDataService } from "../common-data-service";
import { DateUtilsService } from "../date-utils.service";
import { enumForKey, enumValues } from "../enums";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { MemberNamingService } from "../member/member-naming.service";
import { StringUtilsService } from "../string-utils.service";
import { SystemConfigService } from "../system/system-config.service";
import { UrlService } from "../url.service";
import { AscentValidationService } from "./ascent-validation.service";
import { DistanceValidationService } from "./distance-validation.service";
import { WalksLocalService } from "./walks-local.service";
import { DataQueryOptions } from "../../models/api-request.model";
import isEqual from "lodash-es/isEqual";

@Injectable({
  providedIn: "root"
})
export class RamblersWalksAndEventsService {
  private readonly logger: Logger;
  private auditSubject = new ReplaySubject<RamblersUploadAuditApiResponse>();
  private walksSubject = new ReplaySubject<RamblersWalksApiResponse>();
  private rawWalksSubject = new ReplaySubject<RamblersWalksRawApiResponseApiResponse>();
  private groupsSubject = new ReplaySubject<RamblersGroupsApiResponseApiResponse>();
  private committeeReferenceData: CommitteeReferenceData;
  private ramblers: Ramblers;
  private WALKS_MANAGER_CSV_DATE_FORMAT = "DD/MM/YYYY";
  private WALKS_MANAGER_API_DATE_FORMAT = "YYYY-MM-DD";
  private BASE_URL = "/api/ramblers/walks-manager";
  private NEAREST_TOWN_PREFIX = "Nearest Town is ";

  constructor(private http: HttpClient,
              private systemConfigService: SystemConfigService,
              private walksService: WalksLocalService,
              private urlService: UrlService,
              private memberNamingService: MemberNamingService,
              private distanceValidationService: DistanceValidationService,
              private ascentValidationService: AscentValidationService,
              private stringUtilsService: StringUtilsService,
              private dateUtils: DateUtilsService,
              private displayDate: DisplayDatePipe,
              private walkDisplayService: WalkDisplayService,
              private memberLoginService: MemberLoginService,
              private commonDataService: CommonDataService,
              committeeConfig: CommitteeConfigService,
              loggerFactory: LoggerFactory) {
    committeeConfig.events().subscribe(data => this.committeeReferenceData = data);
    this.logger = loggerFactory.createLogger("RamblersWalksAndEventsService", NgxLoggerLevel.OFF);
    this.systemConfigService.events().subscribe(item => {
      this.ramblers = item.national;
      this.logger.info("systemConfigService:ramblers:", this.ramblers, "item.system", item);
    });

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

  auditNotifications(): Observable<RamblersUploadAuditApiResponse> {
    return this.auditSubject.asObservable();
  }

  groupNotifications(): Observable<RamblersGroupsApiResponseApiResponse> {
    return this.groupsSubject.asObservable();
  }

  uploadRamblersWalks(data: RamblersWalksUploadRequest): Promise<ApiResponse> {
    return this.commonDataService.responseFrom(this.logger, this.http.post<RamblersUploadAuditApiResponse>(`${this.BASE_URL}/upload-walks`, data), this.auditSubject);
  }

  async listRamblersWalks(): Promise<RamblersWalkResponse[]> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<RamblersWalksApiResponse>(`${this.BASE_URL}/list-walks`, {}), this.walksSubject);
    this.logger.info("received", apiResponse);
    return apiResponse.response;
  }

  async listRamblersWalksRawData(dataQueryOptions: DataQueryOptions): Promise<RamblersWalksRawApiResponse> {
    const order = isEqual(dataQueryOptions.sort, WalkDateDescending) ? "desc" : "asc";
    const sort = isEqual(dataQueryOptions.sort, WalkDateDescending) || isEqual(dataQueryOptions.sort, WalkDateAscending) ? "date" : "date";
    const date = this.createStartDate(dataQueryOptions.criteria);
    const dateEnd = this.createEndDate(dataQueryOptions.criteria);
    const body: WalkListRequest = {date, dateEnd, order, sort, rawData: true, limit: 200};
    this.logger.info("listRamblersWalksRawData:dataQueryOptions:", dataQueryOptions, "body:", body);
    const rawData = await this.commonDataService.responseFrom(this.logger, this.http.post<RamblersWalksRawApiResponseApiResponse>(`${this.BASE_URL}/list-walks`, body), this.rawWalksSubject);
    return rawData.response;
  }

  private createStartDate(criteria: object): string {
    if (RamblersWalksAndEventsService.isWalkDateGreaterThanOrEqualTo(criteria)) {
      return this.dateUtils.asMoment(criteria.walkDate.$gte).format(this.WALKS_MANAGER_API_DATE_FORMAT);
    } else if(RamblersWalksAndEventsService.isWalkDateLessThan(criteria) || isEmpty(criteria)) {
      return this.dateUtils.asMoment().subtract(2, "year").format(this.WALKS_MANAGER_API_DATE_FORMAT);
    } else {
      return this.dateUtils.asMoment().format(this.WALKS_MANAGER_API_DATE_FORMAT);
    }
  }

  private createEndDate(criteria: any): string {
    this.logger.info("createEndDate.criteria:", criteria, "walkDate value:", criteria.walkDate, "walkDate formatted:", this.dateUtils.asMoment(criteria.walkDate).format(this.WALKS_MANAGER_API_DATE_FORMAT));
    if (RamblersWalksAndEventsService.isWalkDateLessThan(criteria)) {
      return this.dateUtils.asMoment(criteria.walkDate.$lt).subtract(1, "day").format(this.WALKS_MANAGER_API_DATE_FORMAT);
    } else if (RamblersWalksAndEventsService.isWalkDateLessThanOrEqualTo(criteria)) {
      return this.dateUtils.asMoment(criteria.walkDate.$lte).format(this.WALKS_MANAGER_API_DATE_FORMAT);
    } else {
      return this.dateUtils.asMoment().add(2, "year").format(this.WALKS_MANAGER_API_DATE_FORMAT);
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
      .then(ramblersWalksResponses => this.updateWalksWithRamblersWalkData(ramblersWalksResponses, walks))
      .then(updatedWalks => this.returnWalksExport(updatedWalks));
  }

  updateWalksWithRamblersWalkData(ramblersWalksResponses: RamblersWalkResponse[], walks: Walk[]) {
    let unreferencedUrls: string[] = this.collectExistingRamblersUrlsFrom(walks);
    this.logger.info(this.stringUtilsService.pluraliseWithCount(unreferencedUrls.length, "existing ramblers walk url"), "found:", unreferencedUrls);
    this.logger.info(this.stringUtilsService.pluraliseWithCount(walks.length, "saved walk"), "found:", walks);
    const savePromises = [];
    ramblersWalksResponses.forEach((ramblersWalksResponse: RamblersWalkResponse) => {
      const walkMatchedByDate = walks.find(walk => this.dateUtils.asString(walk.walkDate, undefined, "dddd, Do MMMM YYYY") === ramblersWalksResponse.startDate);
      if (!walkMatchedByDate) {
        this.logger.info("no date match found for ramblersWalksResponse", ramblersWalksResponse);
      } else {
        unreferencedUrls = without(unreferencedUrls, ramblersWalksResponse.url);
        if (walkMatchedByDate && this.matchByIdOrUrl(walkMatchedByDate, ramblersWalksResponse)) {
          this.logger.info("updating walk from", walkMatchedByDate.ramblersWalkId || "empty", "->", ramblersWalksResponse.id, "and", walkMatchedByDate.ramblersWalkUrl || "empty", "->", ramblersWalksResponse.url, "on", this.displayDate.transform(walkMatchedByDate.walkDate));
          walkMatchedByDate.ramblersWalkId = ramblersWalksResponse.id;
          walkMatchedByDate.ramblersWalkUrl = ramblersWalksResponse.url;
          walkMatchedByDate.startLocationW3w = ramblersWalksResponse.startLocationW3w;
          savePromises.push(this.walksService.createOrUpdate(walkMatchedByDate));
          this.logger.info("walk updated to:", walkMatchedByDate);
        } else {
          this.logger.info("no update required for walk", walkMatchedByDate.id, walkMatchedByDate.walkDate, this.dateUtils.displayDay(walkMatchedByDate.walkDate));
        }
      }
    });

    if (unreferencedUrls.length > 0) {
      this.logger.info("removing", this.stringUtilsService.pluraliseWithCount(unreferencedUrls.length, "old ramblers walk"), unreferencedUrls, "from existing walks");
      unreferencedUrls.map((url: string) => {
        const walkMatchedByUrl: Walk = walks.find(walk => walk.ramblersWalkUrl === url);
        if (walkMatchedByUrl) {
          this.logger.info("removing ramblers walkMatchedByUrl", walkMatchedByUrl.ramblersWalkId, "from walkMatchedByUrl on", this.displayDate.transform(walkMatchedByUrl.walkDate));
          delete walkMatchedByUrl.ramblersWalkId;
          delete walkMatchedByUrl.ramblersWalkUrl;
          savePromises.push(this.walksService.createOrUpdate(walkMatchedByUrl));
        }
      });
    }
    return Promise.all(savePromises).then(() => walks);
  }

  private matchByIdOrUrl(walkMatchedByDate: Walk, ramblersWalksResponse: RamblersWalkResponse): boolean {
    return walkMatchedByDate.ramblersWalkUrl !== ramblersWalksResponse.url || walkMatchedByDate.ramblersWalkId !== ramblersWalksResponse.id;
  }

  collectExistingRamblersUrlsFrom(walks: Walk[]): string[] {
    return walks.filter(walk => walk.ramblersWalkUrl)
      .map(walk => walk.ramblersWalkUrl);
  }

  returnWalksExport(walks: Walk[]): WalkExport[] {
    const todayValue = this.dateUtils.momentNowNoTime().valueOf();
    return walks
      .filter(walk => (walk.walkDate >= todayValue) && walk.briefDescriptionAndStartPoint)
      .sort(walk => walk.walkDate)
      .map(walk => this.validateWalk(walk));
  }

  uploadToRamblers(walkExports: WalkExport[], members: Member[], notify): Promise<string> {
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
    this.logger.info("exporting", walksUploadRequest);
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
        return fileName;
      })
      .catch(response => {
        this.logger.debug("error response data", response);
        return notify.error({
          title: "Ramblers walks upload failed",
          message: response
        });
      });
  }

  public walkDeletionList(walkExports: WalkExport[]): string[] {
    return this.selectedExportableWalks(walkExports).map(walkExport => walkExport.displayedWalk.walk)
      .filter(walk => !isEmpty(walk.ramblersWalkUrl)).map(walk => this.transformUrl(walk));
  }

  private transformUrl(walk: Walk) {
    const transformed = walk.ramblersWalkUrl.replace(this.ramblers?.mainSite?.href, this.ramblers?.walksManager?.href);
    this.logger.info("transformUrl:ramblersWalkUrl:", walk.ramblersWalkUrl, "from:", this.ramblers?.mainSite?.href, "to:", this.ramblers?.walksManager?.href, "transformed:", transformed);
    return transformed;
  }

  private walkUploadHeadings() {
    return enumValues(WalkUploadColumnHeading);
  }

  validateWalk(walk: Walk): WalkExport {
    const validationMessages = [];
    const walkDistance: WalkDistance = this.distanceValidationService.parse(walk);
    const walkAscent: WalkAscent = this.ascentValidationService.parse(walk);
    this.logger.info("walkDistance:", walkDistance);
    const contactIdMessage = this.memberLoginService.allowWalkAdminEdits() ? "This can be entered on the Walk Leader tab" : "This will need to be setup for you by " + this.committeeReferenceData.contactUsField("walks", "fullName");
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

      if (isEmpty(walk.postcode) && isEmpty(walk.gridReference)) {
        validationMessages.push("both postcode and grid reference are missing");
      }

      if (isEmpty(walk.contactId)) {
        validationMessages.push("Walk leader has no Ramblers Assemble Name entered on their member record. " + contactIdMessage);
      }

      if (!isNaN(+walk.contactId)) {
        validationMessages.push(`Walk leader has an old Ramblers contact Id (${walk.contactId}) setup on their member record. This needs to be updated to an Assemble Full Name. ${contactIdMessage}`);
      }

      if (isEmpty(walk.walkType)) {
        validationMessages.push("Display Name for walk leader is missing. This can be entered manually on the Walk Leader tab");
      }

      if (walk.walkType === WalkType.LINEAR && isEmpty(walk.postcodeFinish)) {
        validationMessages.push(`Walk is ${WalkType.LINEAR} but no finish postcode has been entered in the Walk Details tab`);
      }

      if (walk.walkType === WalkType.CIRCULAR && !isEmpty(walk.postcodeFinish) && walk.postcodeFinish !== walk.postcode) {
        validationMessages.push(`Walk is ${WalkType.CIRCULAR} but the finish postcode ${walk.postcodeFinish} does not match the start postcode ${walk.postcode} in the Walk Details tab`);
      }
    }
    return {
      displayedWalk: this.walkDisplayService.toDisplayedWalk(walk),
      validationMessages,
      publishedOnRamblers: walk && !isEmpty(walk.ramblersWalkId),
      selected: walk && walk.ramblersPublish && validationMessages.length === 0 && isEmpty(walk.ramblersWalkId)
    };
  }

  nearestTown(walk: Walk) {
    return walk.nearestTown ? `${this.NEAREST_TOWN_PREFIX}${walk.nearestTown}` : "";
  }

  walkTitle(walk: Walk) {
    const walkDescription = [];
    if (walk.briefDescriptionAndStartPoint) {
      walkDescription.push(walk.briefDescriptionAndStartPoint);
    }
    return walkDescription.map(this.replaceSpecialCharacters).join(". ");
  }

  walkDescription(walk: Walk) {
    return this.replaceSpecialCharacters(walk.longerDescription);
  }

  walkType(walk: Walk) {
    return walk.walkType || "Circular";
  }

  asString(value) {
    return value ? value : "";
  }

  walkLeader(walk: Walk) {
    return walk.contactId ? this.replaceSpecialCharacters(walk.contactId) : "";
  }

  replaceSpecialCharacters(value) {
    return value ? value
      .replace("’", "")
      .replace("é", "e")
      .replace("â€™", "")
      .replace("â€¦", "…")
      .replace("â€“", "–")
      .replace("â€™", "’")
      .replace("â€œ", "“")
      .replace(/(\r\n|\n|\r)/gm, " ") : "";
  }


  walkStartTime(walk: Walk): string {
    return walk.startTime ? this.dateUtils.asString(this.dateUtils.startTime(walk), null, "HH:mm") : "";
  }

  walkFinishTime(walk) {
    return walk.startTime ? this.dateUtils.asString(this.dateUtils.startTime(walk) + this.dateUtils.durationForDistance(walk.distance), null, "HH:mm") : "";
  }

  walkStartGridReference(walk) {
    return walk.gridReference || "";
  }

  walkStartPostcode(walk) {
    return walk.gridReference ? "" : walk.postcode || "";
  }

  walkFinishGridReference(walk) {
    return walk.gridReferenceFinish || "";
  }

  walkFinishPostcode(walk) {
    return walk.gridReferenceFinish ? "" : walk.postcodeFinish || "";
  }

  walkDate(walk: Walk, format: string) {
    return this.dateUtils.asString(walk.walkDate, null, format);
  }

  walkToUploadRow(walk): WalkUploadRow {
    return this.walkToWalkUploadRow(walk);
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<Walk[]> {
    return this.listRamblersWalksRawData(dataQueryOptions)
      .then((ramblersWalksRawApiResponse: RamblersWalksRawApiResponse) => ramblersWalksRawApiResponse.data.map(remoteWalk => this.toWalk(remoteWalk)));
  }

  toWalk(groupWalk: GroupWalk): Walk {
    const startMoment = this.dateUtils.asMoment(groupWalk.start_date_time);
    const contactName = groupWalk?.walk_leader?.name;
    const displayName = this.memberNamingService.createDisplayNameFromContactName(contactName);
    const walk: Walk = {
      ascent: groupWalk.ascent_feet?.toString(),
      briefDescriptionAndStartPoint: groupWalk.title,
      config: {meetup: null},
      contactEmail: groupWalk?.walk_leader?.email_form,
      contactId: "n/a",
      contactName,
      contactPhone: groupWalk?.walk_leader?.telephone,
      displayName,
      distance: `${groupWalk?.distance_miles} miles`,
      events: [],
      grade: groupWalk.difficulty.description,
      gridReference: groupWalk.start_location?.grid_reference_8,
      gridReferenceFinish: groupWalk.end_location?.grid_reference_8,
      id: groupWalk.id,
      location: null,
      longerDescription: groupWalk.description,
      meetupEventDescription: null,
      meetupEventTitle: null,
      meetupEventUrl: null,
      meetupPublish: false,
      nearestTown: groupWalk.start_location.description.replace(this.NEAREST_TOWN_PREFIX, ""),
      osMapsRoute: null,
      osMapsTitle: null,
      postcode: groupWalk.start_location?.postcode,
      postcodeFinish: groupWalk.end_location?.postcode,
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
      }
    };
    this.logger.debug("groupWalk:", groupWalk, "walk:", walk, "contactName:", contactName, "displayName:", displayName);
    return walk;
  }

  walkToWalkUploadRow(walk): WalkUploadRow {
    const csvRecord: WalkUploadRow = {};
    const walkDistance: WalkDistance = this.distanceValidationService.parse(walk);
    this.logger.debug("walkDistance:", walkDistance);
    const walkAscent: WalkAscent = this.ascentValidationService.parse(walk);
    this.logger.debug("walkAscent:", walkAscent);
    csvRecord[WalkUploadColumnHeading.DATE] = this.walkDate(walk, this.WALKS_MANAGER_CSV_DATE_FORMAT);
    csvRecord[WalkUploadColumnHeading.TITLE] = this.walkTitle(walk);
    csvRecord[WalkUploadColumnHeading.DESCRIPTION] = this.walkDescription(walk);
    csvRecord[WalkUploadColumnHeading.ADDITIONAL_DETAILS] = "";
    csvRecord[WalkUploadColumnHeading.WEBSITE_LINK] = this.walkDisplayService.walkLink(walk);
    csvRecord[WalkUploadColumnHeading.WALK_LEADERS] = this.walkLeader(walk);
    csvRecord[WalkUploadColumnHeading.LINEAR_OR_CIRCULAR] = this.walkType(walk);
    csvRecord[WalkUploadColumnHeading.START_TIME] = this.walkStartTime(walk);
    csvRecord[WalkUploadColumnHeading.STARTING_LOCATION] = "";
    csvRecord[WalkUploadColumnHeading.STARTING_POSTCODE] = this.walkStartPostcode(walk);
    csvRecord[WalkUploadColumnHeading.STARTING_GRIDREF] = this.walkStartGridReference(walk);
    csvRecord[WalkUploadColumnHeading.STARTING_LOCATION_DETAILS] = this.nearestTown(walk);
    csvRecord[WalkUploadColumnHeading.MEETING_TIME] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_LOCATION] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_POSTCODE] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_GRIDREF] = "";
    csvRecord[WalkUploadColumnHeading.MEETING_LOCATION_DETAILS] = "";
    csvRecord[WalkUploadColumnHeading.EST_FINISH_TIME] = this.walkFinishTime(walk);
    csvRecord[WalkUploadColumnHeading.FINISHING_LOCATION] = "";
    csvRecord[WalkUploadColumnHeading.FINISHING_POSTCODE] = this.walkFinishPostcode(walk);
    csvRecord[WalkUploadColumnHeading.FINISHING_GRIDREF] = this.walkFinishGridReference(walk);
    csvRecord[WalkUploadColumnHeading.FINISHING_LOCATION_DETAILS] = "";
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

}
