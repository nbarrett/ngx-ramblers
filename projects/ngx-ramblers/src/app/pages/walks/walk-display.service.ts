import { inject, Injectable } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { find, isEmpty, isNumber, isUndefined } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../models/member.model";
import { EventPopulation, Organisation } from "../../models/system.model";
import { WalkAccessMode } from "../../models/walk-edit-mode.model";
import { WalkEventType } from "../../models/walk-event-type.model";
import { ExpandedWalk } from "../../models/walk-expanded-view.model";
import {
  DisplayedWalk,
  EventType,
  GoogleMapsConfig,
  WALK_GRADES,
  WalkGrade,
  WalkType,
  WalkViewMode
} from "../../models/walk.model";
import { enumValueForKey, enumValues } from "../../functions/enums";
import { GoogleMapsService } from "../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { MemberService } from "../../services/member/member.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";
import { GroupEventService } from "../../services/walks-and-events/group-event.service";
import { ExtendedGroupEventQueryService } from "../../services/walks-and-events/extended-group-event-query.service";
import { WalksReferenceService } from "../../services/walks/walks-reference-data.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { Observable, ReplaySubject } from "rxjs";
import { StringUtilsService } from "../../services/string-utils.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { Difficulty, LocationDetails, RamblersEventType } from "../../models/ramblers-walks-manager";
import { BuiltInRole } from "../../models/committee.model";
import { MediaQueryService } from "../../services/committee/media-query.service";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { FeaturesService } from "../../services/features.service";

@Injectable({
  providedIn: "root"
})

export class WalkDisplayService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkDisplayService", NgxLoggerLevel.ERROR);
  mediaQueryService = inject(MediaQueryService);
  featuresService = inject(FeaturesService);
  private systemConfigService = inject(SystemConfigService);
  private googleMapsService = inject(GoogleMapsService);
  private memberService = inject(MemberService);
  private memberLoginService = inject(MemberLoginService);
  private router = inject(Router);
  private urlService = inject(UrlService);
  protected stringUtils = inject(StringUtilsService);
  private route = inject(ActivatedRoute);
  private sanitiser = inject(DomSanitizer);
  private walkEventService = inject(GroupEventService);
  private walksReferenceService = inject(WalksReferenceService);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private committeeConfig = inject(CommitteeConfigService);
  private dateUtils = inject(DateUtilsService);
  private subject = new ReplaySubject<Member[]>();
  public relatedLinksMediaWidth = 22;
  public expandedWalks: ExpandedWalk [] = [];
  public walkTypes: WalkType[] = enumValues(WalkType);
  private nextWalkId: string;
  public members: Member[] = [];
  public googleMapsConfig: GoogleMapsConfig;
  public group: Organisation;
  private committeeReferenceData: CommitteeReferenceData;

  constructor() {
    this.applyConfig();
    this.refreshCachedData();
    this.logger.debug("this.memberLoginService", this.memberLoginService.loggedInMember());

  }

  public notAwaitingLeader(walk: ExtendedGroupEvent): boolean {
    return !this.awaitingLeader(walk);
  }

  public awaitingLeader(walk: ExtendedGroupEvent): boolean {
    return this.walkEventService.latestEvent(walk)?.eventType === EventType.AWAITING_LEADER;
  }

  public hasWalkLeader(walk: ExtendedGroupEvent): boolean {
    const contactDetails = walk?.fields?.contactDetails;
    return !!contactDetails?.memberId || !!contactDetails?.displayName;
  }

  public memberEvents(): Observable<Member[]> {
    return this.subject.asObservable();
  }

  loggedIn(): boolean {
    return this.memberLoginService.memberLoggedIn();
  }

  findWalk(walk: ExtendedGroupEvent): ExpandedWalk {
    return find(this.expandedWalks, {walkId: this.walkIdFrom(walk)}) as ExpandedWalk;
  }

  walkMode(walk: ExtendedGroupEvent): WalkViewMode {
    const expandedWalk = find(this.expandedWalks, {walkId: this.walkIdFrom(walk)}) as ExpandedWalk;
    const walkViewMode = expandedWalk ? expandedWalk.mode : this.urlService.pathContainsEventIdOrSlug() ? WalkViewMode.VIEW_SINGLE : this.urlService.pathContains("edit") ? WalkViewMode.EDIT_FULL_SCREEN : WalkViewMode.LIST;
    this.logger.off("walkMode:", walkViewMode, "expandedWalk:", expandedWalk);
    return walkViewMode;
  }

  private walkIdFrom(walk: ExtendedGroupEvent) {
    return walk?.id || walk?.groupEvent?.id;
  }

  isExpanded(walk: ExtendedGroupEvent): boolean {
    return !!this.findWalk(walk);
  }

  isEdit(walk: ExtendedGroupEvent) {
    const expandedWalk = this.findWalk(walk);
    return expandedWalk && expandedWalk.mode === WalkViewMode.EDIT;
  }

  googleMapsUrl(showDrivingDirections: boolean, fromPostcode: string, toPostcode: string): SafeResourceUrl {
    this.logger.debug("googleMapsUrl:showDrivingDirections:", showDrivingDirections, "fromPostcode:", fromPostcode, "toPostcode:", toPostcode);
    if (this.googleMapsConfig?.apiKey && this.googleMapsConfig?.zoomLevel) {
      const googleMapsUrl = this.sanitiser.bypassSecurityTrustResourceUrl(showDrivingDirections ?
        `https://www.google.com/maps/embed/v1/directions?origin=${fromPostcode}&destination=${toPostcode}&key=${this.googleMapsConfig?.apiKey}` :
        `https://www.google.com/maps/embed/v1/place?q=${toPostcode}&zoom=${this.googleMapsConfig?.zoomLevel || 12}&key=${this.googleMapsConfig?.apiKey}`);
      this.logger.debug("given showDrivingDirections:", showDrivingDirections, "googleMapsUrl set to:", googleMapsUrl);
      return googleMapsUrl;
    } else {
      this.logger.warn("can't set googleMapsUrl as apiKey:", this.googleMapsConfig?.apiKey, "zoomLevel:", this.googleMapsConfig?.zoomLevel);
    }
  }

  mapViewReady(googleMapsUrl: SafeResourceUrl): boolean {
    const zoomLevelValid = isNumber(this?.googleMapsConfig?.zoomLevel);
    const mapviewReady = !!(zoomLevelValid && googleMapsUrl);
    this.logger.debug("googleMapsUrl:", googleMapsUrl, "mapViewReady:", mapviewReady);
    return mapviewReady;
  }

  public walkPopulationWalksManager(): boolean {
    const result = this.group?.walkPopulation === EventPopulation.WALKS_MANAGER;
    this.logger.debug("walkPopulationWalksManager:walkPopulation:", this.group?.walkPopulation, "result:", result);
    return result;
  }

  public walkPopulationLocal(): boolean {
    const result = this.group?.walkPopulation === EventPopulation.LOCAL;
    this.logger.debug("walkPopulationWalksManager:walkPopulation:", this.group?.walkPopulation, "result:", result);
    return result;
  }

  walkLeaderOrAdmin(walk: ExtendedGroupEvent) {
    return this.loggedInMemberIsLeadingWalk(walk) || this.allowAdminEdits();
  }

  loggedInMemberIsLeadingWalk(walk: ExtendedGroupEvent) {
    return this.memberLoginService.memberLoggedIn() && walk?.fields?.contactDetails?.memberId === this.memberLoginService.loggedInMember()?.memberId;
  }

  async refreshCachedData() {
    if (this.memberLoginService.memberLoggedIn() && this.members.length === 0) {
      if (this.memberLoginService.allowWalkAdminEdits()) {
        this.members = await this.memberService.all().then(members => members.filter(this.memberService.filterFor.GROUP_MEMBERS));
      } else {
        this.members = await this.memberService.publicFields(this.memberService.filterFor.GROUP_MEMBERS);
      }
      this.subject.next(this.members);
    }
  }

  edit(walkDisplay: DisplayedWalk): ExpandedWalk {
    return this.toggleExpandedViewFor(walkDisplay.walk, WalkViewMode.EDIT);
  }

  list(walk: ExtendedGroupEvent): ExpandedWalk {
    this.logger.debug("listing walk:", walk);
    return this.toggleExpandedViewFor(walk, WalkViewMode.LIST);
  }

  view(walk: ExtendedGroupEvent): ExpandedWalk {
    return this.toggleExpandedViewFor(walk, WalkViewMode.VIEW);
  }

  statusFor(walk: ExtendedGroupEvent): EventType {
    return this.walkEventService.latestEventWithStatusChange(walk)?.eventType;
  }

  editFullscreen(walk: ExtendedGroupEvent): Promise<ExpandedWalk> {
    this.logger.debug("editing walk fullscreen:", walk);
    return this.router.navigate(["walks/edit/" + this.walkIdFrom(walk)], {relativeTo: this.route}).then(() => {
      this.logger.debug("area is now", this.urlService.area());
      return this.toggleExpandedViewFor(walk, WalkViewMode.EDIT_FULL_SCREEN);
    });
  }

  toggleExpandedViewFor(walk: ExtendedGroupEvent, toggleTo: WalkViewMode): ExpandedWalk {
    const walkId = this.walkIdFrom(walk);
    const existingWalk: ExpandedWalk = this.findWalk(walk);
    if (existingWalk && toggleTo === WalkViewMode.LIST) {
      this.expandedWalks = this.expandedWalks.filter(expandedWalk => expandedWalk.walkId !== walkId);
      this.logger.info("display.toggleViewFor", toggleTo, "removed", walkId, "expandedWalks:", this.expandedWalks);
    } else if (existingWalk) {
      existingWalk.mode = toggleTo;
      this.logger.info("display.toggleViewFor", toggleTo, "updated", existingWalk, "expandedWalks:", this.expandedWalks);
    } else {
      const newWalk = {walkId, mode: toggleTo};
      this.expandedWalks.push(newWalk);
      this.logger.info("display.toggleViewFor", toggleTo, "added", newWalk, "expandedWalks:", this.expandedWalks);
      if (this.urlService.pathContainsEventIdOrSlug() && toggleTo === WalkViewMode.EDIT) {
        this.editFullscreen(walk);
      }
    }
    return existingWalk;
  }

  latestEventTypeFor(walk: ExtendedGroupEvent): WalkEventType {
    const latestEventWithStatusChange = this.walkEventService.latestEventWithStatusChange(walk);
    let lookupType: EventType;
    if (latestEventWithStatusChange) {
      lookupType = latestEventWithStatusChange.eventType;
    } else {
      lookupType = EventType.AWAITING_WALK_DETAILS;
    }
    const eventType = this.walksReferenceService.toWalkEventType(lookupType) as WalkEventType;
    if (!eventType) {
      this.logger.error("given lookupType", lookupType, "-> latestEventWithStatusChange",
        latestEventWithStatusChange, "eventType", eventType, "walk.events", walk.events);
    }
    return eventType;
  }

  gridReferenceLink(gridReference: string): string {
    return `https://gridreferencefinder.com/?gr=${gridReference}`;
  }

  toWalkAccessMode(walk: ExtendedGroupEvent): WalkAccessMode {
    let returnValue = WalksReferenceService.walkAccessModes.view;
    if (this.memberLoginService.memberLoggedIn()) {
      if (this.loggedInMemberIsLeadingWalk(walk) || this.memberLoginService.allowWalkAdminEdits()) {
        returnValue = {...WalksReferenceService.walkAccessModes.edit, walkWritable: this.walkPopulationLocal()};
      } else {
        const walkEvent = this.walkEventService.latestEventWithStatusChange(walk);
        if (walkEvent?.eventType === EventType.AWAITING_LEADER) {
          returnValue = {...WalksReferenceService.walkAccessModes.lead, walkWritable: this.walkPopulationLocal()};
        }
      }
    }
    this.logger.debug("toWalkAccessMode:returnValue:", returnValue, "walk:", walk);
    return returnValue;
  }

  toDisplayedWalk(extendedGroupEvent: ExtendedGroupEvent): DisplayedWalk {
    const isLinear = enumValueForKey(WalkType, extendedGroupEvent?.groupEvent?.shape) === WalkType.LINEAR;
    this.logger.debug("toDisplayedWalk:extendedGroupEvent:", extendedGroupEvent, "shape:", extendedGroupEvent?.groupEvent?.shape, "isLinear:", isLinear);
    const startDate = extendedGroupEvent?.groupEvent?.start_date_time;
    const searchableText = [
      JSON.stringify(extendedGroupEvent),
      this.dateUtils.displayDate(startDate),
      this.dateUtils.displayDay(startDate)
    ].filter(item => item).join(" ");
    return {
      hasFeatures: this.featuresService.combinedFeatures(extendedGroupEvent?.groupEvent)?.length > 0,
      walk: extendedGroupEvent,
      walkAccessMode: this.toWalkAccessMode(extendedGroupEvent),
      status: this.statusFor(extendedGroupEvent),
      latestEventType: this.latestEventTypeFor(extendedGroupEvent),
      walkLink: this.walkLink(extendedGroupEvent),
      ramblersLink: this.ramblersLink(extendedGroupEvent),
      showEndpoint: isLinear && !isEmpty(extendedGroupEvent?.groupEvent?.end_location?.postcode),
      searchableText
    };
  }

  refreshDisplayedWalk(displayedWalk: DisplayedWalk): void {
    displayedWalk.walkAccessMode = this.toWalkAccessMode(displayedWalk.walk);
    displayedWalk.status = this.statusFor(displayedWalk.walk);
    displayedWalk.latestEventType = this.latestEventTypeFor(displayedWalk.walk);
    displayedWalk.walkLink = this.walkLink(displayedWalk.walk);
    displayedWalk.ramblersLink = this.ramblersLink(displayedWalk.walk);
  }

  walkLink(extendedGroupEvent: ExtendedGroupEvent): string {
    this.logger.info("walkLink:groupEvent:url:", extendedGroupEvent?.groupEvent.url, "title:", extendedGroupEvent?.groupEvent?.title);
    const urlToUse = extendedGroupEvent?.groupEvent?.url
      || this.stringUtils.kebabCase(extendedGroupEvent?.groupEvent?.title, this.dateUtils.yearMonthDayWithDashes(extendedGroupEvent?.groupEvent?.start_date_time))
      || extendedGroupEvent?.groupEvent?.id
      || extendedGroupEvent?.id;
    return this.urlService.linkUrl({
      area: "walks",
      id: this.stringUtils.lastItemFrom(urlToUse)
    });
  }

  ramblersLink(walk: ExtendedGroupEvent): string {
    return walk?.groupEvent?.url;
  }

  isNextWalk(walk: ExtendedGroupEvent): boolean {
    return walk && (walk.id === this.nextWalkId || walk.groupEvent?.id === this.nextWalkId);
  }

  setNextWalkId(walks: ExtendedGroupEvent[]) {
    this.nextWalkId = this.extendedGroupEventQueryService.nextWalkId(walks);
  }

  setExpandedWalks(expandedWalks: ExpandedWalk[]) {
    this.expandedWalks = expandedWalks;
  }

  closeEditView(walk: ExtendedGroupEvent) {
    if (this.urlService.pathContains("edit")) {
      this.urlService.navigateTo(["walks"]);
    }
    this.toggleExpandedViewFor(walk, WalkViewMode.VIEW);
  }

  public walksCoordinatorName() {
    return this.committeeReferenceData?.contactUsFieldForBuiltInRole(BuiltInRole.WALKS_CO_ORDINATOR, "fullName");
  }

  private applyConfig() {
    this.logger.debug("applyConfig called");
    this.committeeConfig.committeeReferenceDataEvents().subscribe(committeeReferenceData => {
      this.logger.info("applyConfig: committeeReferenceData:", committeeReferenceData);
      return this.committeeReferenceData = committeeReferenceData;
    });
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.logger.debug("group:", this.group);
    });
    this.googleMapsService.events().subscribe(config => {
      this.googleMapsConfig = {zoomLevel: 12, apiKey: config.apiKey};
      this.logger.debug("googleMapsConfig:", this.googleMapsConfig);
    });
  }

  allowEdits(walk: ExtendedGroupEvent) {
    return this.loggedInMemberIsLeadingWalk(walk) || this.allowAdminEdits();
  }

  allowAdminEdits() {
    return this.memberLoginService.allowWalkAdminEdits();
  }

  eventType(walk: ExtendedGroupEvent): string {
    return walk?.groupEvent?.item_type || RamblersEventType.GROUP_WALK;
  }

  eventTypeTitle(walk: ExtendedGroupEvent): string {
    return this.stringUtils.asTitle(walk?.groupEvent?.item_type) || RamblersEventType.GROUP_WALK;
  }

  isWalk(walk: ExtendedGroupEvent): boolean {
    return !walk?.groupEvent?.item_type || walk?.groupEvent?.item_type === RamblersEventType.GROUP_WALK;
  }

  gridReferenceFrom(location: LocationDetails) {
    return location?.grid_reference_10 || location?.grid_reference_8 || location?.grid_reference_6 || "";
  }

  walkContactDetailsPublic(): boolean {
    return this.group?.walkContactDetailsPublic;
  }

  displayMapAsImageFallback(walk: ExtendedGroupEvent): boolean {
    return !!(!this.mediaQueryService.imageSource(walk) && walk?.groupEvent?.start_location?.postcode);
  }

  displayMap(walk: ExtendedGroupEvent): boolean {
    return !!walk?.groupEvent?.start_location?.postcode;
  }

  displayImage(walk: ExtendedGroupEvent): boolean {
    return !!(this.mediaQueryService.imageSource(walk) || !walk?.groupEvent?.start_location?.postcode);
  }

  walkGradeFrom(gradeValue: string): WalkGrade {
    return WALK_GRADES.find((grade) => grade.description.toLowerCase() === gradeValue?.toLowerCase());
  }

  isWalkGrade(object: any): object is WalkGrade {
    const walkGrade: WalkGrade = object as WalkGrade;
    return !isUndefined(walkGrade?.code) && !isUndefined(walkGrade?.description);
  }

  public toDifficulty(grade: string | WalkGrade): Difficulty {
    const gradeValue: string = this.isWalkGrade(grade) ? grade.code : grade;
    this.logger.info("toDifficulty:grade:", grade, "gradeValue:", gradeValue);
    if (gradeValue) {
      const {code, description} = this.walkGradeFrom(gradeValue);
      return {code, description};
    } else {
      return null;
    }
  }

  public difficulties(): Difficulty[] {
    return WALK_GRADES.map(item => ({code: item.code, description: item.description}));
  }

}
