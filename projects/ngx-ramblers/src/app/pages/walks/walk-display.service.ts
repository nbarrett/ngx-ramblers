import { Injectable } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import find from "lodash-es/find";
import isEmpty from "lodash-es/isEmpty";
import isNumber from "lodash-es/isNumber";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../models/member.model";
import { EventPopulation, Organisation } from "../../models/system.model";
import { WalkAccessMode } from "../../models/walk-edit-mode.model";
import { WalkEventType } from "../../models/walk-event-type.model";
import { ExpandedWalk } from "../../models/walk-expanded-view.model";
import { DisplayedWalk, EventType, GoogleMapsConfig, Walk, WalkType, WalkViewMode } from "../../models/walk.model";
import { enumValues } from "../../functions/enums";
import { GoogleMapsService } from "../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { MemberService } from "../../services/member/member.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";
import { WalkEventService } from "../../services/walks/walk-event.service";
import { WalksQueryService } from "../../services/walks/walks-query.service";
import { WalksReferenceService } from "../../services/walks/walks-reference-data.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { Observable, ReplaySubject } from "rxjs";
import { StringUtilsService } from "../../services/string-utils.service";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { BuiltInRole } from "../../models/committee.model";

@Injectable({
  providedIn: "root"
})

export class WalkDisplayService {
  private subject = new ReplaySubject<Member[]>();
  public relatedLinksMediaWidth = 22;
  public expandedWalks: ExpandedWalk [] = [];
  private logger: Logger;
  public grades = ["Easy access", "Easy", "Leisurely", "Moderate", "Strenuous", "Technical"];
  public walkTypes = enumValues(WalkType);
  private nextWalkId: string;
  public members: Member[] = [];
  public googleMapsConfig: GoogleMapsConfig;
  public group: Organisation;
  private committeeReferenceData: CommitteeReferenceData;

  constructor(
    private systemConfigService: SystemConfigService,
    private googleMapsService: GoogleMapsService,
    private memberService: MemberService,
    private memberLoginService: MemberLoginService,
    private router: Router,
    private urlService: UrlService,
    protected stringUtils: StringUtilsService,
    private route: ActivatedRoute,
    private sanitiser: DomSanitizer,
    private walkEventService: WalkEventService,
    private walksReferenceService: WalksReferenceService,
    private walksQueryService: WalksQueryService,
    private committeeConfig: CommitteeConfigService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkDisplayService, NgxLoggerLevel.ERROR);
    this.applyConfig();
    this.refreshCachedData();
    this.logger.debug("this.memberLoginService", this.memberLoginService.loggedInMember());
  }

  public memberEvents(): Observable<Member[]> {
    return this.subject.asObservable();
  }

  loggedIn(): boolean {
    return this.memberLoginService.memberLoggedIn();
  }

  findWalk(walk: Walk): ExpandedWalk {
    return find(this.expandedWalks, {walkId: walk.id}) as ExpandedWalk;
  }

  walkMode(walk: Walk): WalkViewMode {
    const expandedWalk = find(this.expandedWalks, {walkId: walk?.id}) as ExpandedWalk;
    const walkViewMode = expandedWalk ? expandedWalk.mode : this.urlService.pathContainsEventId() ? WalkViewMode.VIEW_SINGLE : this.urlService.pathContains("edit") ? WalkViewMode.EDIT_FULL_SCREEN : WalkViewMode.LIST;
    this.logger.debug("walkMode:", walkViewMode, "expandedWalk:", expandedWalk);
    return walkViewMode;
  }

  isExpanded(walk: Walk): boolean {
    return !!this.findWalk(walk);
  }

  isEdit(walk: Walk) {
    const expandedWalk = this.findWalk(walk);
    return expandedWalk && expandedWalk.mode === WalkViewMode.EDIT;
  }

  googleMapsUrl(showDrivingDirections: boolean, fromPostcode: string, toPostcode: string): SafeResourceUrl {
    this.logger.info("googleMapsUrl:showDrivingDirections:", showDrivingDirections, "fromPostcode:", fromPostcode, "toPostcode:", toPostcode);
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

  public shouldShowFullDetails(displayedWalk: DisplayedWalk): boolean {
    return this.walkPopulationWalksManager()
      || !!(displayedWalk?.walkAccessMode?.walkWritable && displayedWalk?.walk?.postcode)
      || displayedWalk?.latestEventType?.showDetails;
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

  walkLeaderOrAdmin(walk: Walk) {
    return this.loggedInMemberIsLeadingWalk(walk) || this.allowAdminEdits();
  }

  loggedInMemberIsLeadingWalk(walk: Walk) {
    return this.memberLoginService.memberLoggedIn() && walk && walk.walkLeaderMemberId === this.memberLoginService.loggedInMember().memberId;
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

  list(walk: Walk): ExpandedWalk {
    this.logger.debug("listing walk:", walk);
    return this.toggleExpandedViewFor(walk, WalkViewMode.LIST);
  }

  view(walk: Walk): ExpandedWalk {
    return this.toggleExpandedViewFor(walk, WalkViewMode.VIEW);
  }

  statusFor(walk: Walk): EventType {
    const walkEvent = this.walkEventService.latestEventWithStatusChange(walk);
    return walkEvent && walkEvent.eventType;
  }

  editFullscreen(walk: Walk): Promise<ExpandedWalk> {
    this.logger.debug("editing walk fullscreen:", walk);
    return this.router.navigate(["walks/edit/" + walk.id], {relativeTo: this.route}).then(() => {
      this.logger.debug("area is now", this.urlService.area());
      return this.toggleExpandedViewFor(walk, WalkViewMode.EDIT_FULL_SCREEN);
    });
  }

  toggleExpandedViewFor(walk: Walk, toggleTo: WalkViewMode): ExpandedWalk {
    const walkId = walk.id;
    const existingWalk: ExpandedWalk = this.findWalk(walk);
    if (existingWalk && toggleTo === WalkViewMode.LIST) {
      this.expandedWalks = this.expandedWalks.filter(expandedWalk => expandedWalk.walkId !== walkId);
      this.logger.info("display.toggleViewFor", toggleTo, "removed", walkId);
    } else if (existingWalk) {
      existingWalk.mode = toggleTo;
      this.logger.info("display.toggleViewFor", toggleTo, "updated", existingWalk);
    } else {
      const newWalk = {walkId, mode: toggleTo};
      this.expandedWalks.push(newWalk);
      this.logger.info("display.toggleViewFor", toggleTo, "added", newWalk);
      if (this.urlService.pathContainsEventId() && toggleTo === WalkViewMode.EDIT) {
        this.editFullscreen(walk);
      }
    }
    return existingWalk;
  }

  latestEventTypeFor(walk: Walk): WalkEventType {
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

  toWalkAccessMode(walk: Walk): WalkAccessMode {
    this.logger.off("toWalkAccessMode:", walk);
    let returnValue = WalksReferenceService.walkAccessModes.view;
    if (this.memberLoginService.memberLoggedIn()) {
      if (this.loggedInMemberIsLeadingWalk(walk) ||
        this.memberLoginService.allowWalkAdminEdits()) {
        returnValue = {...WalksReferenceService.walkAccessModes.edit, walkWritable: this.walkPopulationLocal()};
      } else if (this.walkEventService.latestEvent(walk)?.eventType !== EventType.APPROVED) {
        returnValue = {...WalksReferenceService.walkAccessModes.lead, walkWritable: this.walkPopulationLocal()};
      }
    }
    return returnValue;
  }

  toDisplayedWalk(walk: Walk): DisplayedWalk {
    return {
      walk,
      walkAccessMode: this.toWalkAccessMode(walk),
      status: this.statusFor(walk),
      latestEventType: this.latestEventTypeFor(walk),
      walkLink: this.walkLink(walk),
      ramblersLink: this.ramblersLink(walk),
      showEndpoint: walk.walkType === WalkType.LINEAR && !isEmpty(walk.postcodeFinish)
    };
  }

  refreshDisplayedWalk(displayedWalk: DisplayedWalk): void {
    displayedWalk.walkAccessMode = this.toWalkAccessMode(displayedWalk.walk);
    displayedWalk.status = this.statusFor(displayedWalk.walk);
    displayedWalk.latestEventType = this.latestEventTypeFor(displayedWalk.walk);
    displayedWalk.walkLink = this.walkLink(displayedWalk.walk);
    displayedWalk.ramblersLink = this.ramblersLink(displayedWalk.walk);
  }
  walkLink(walk: Walk): string {
    return walk?.id ? this.urlService.linkUrl({area: "walks", id: walk.id}) : null;
  }

  ramblersLink(walk: Walk): string {
    return walk.ramblersWalkUrl || (walk.ramblersWalkId ? `https://www.ramblers.org.uk/go-walking/find-a-walk-or-route/walk-detail.aspx?walkID=${walk.ramblersWalkId}` : null);
  }

  isNextWalk(walk: Walk): boolean {
    return walk && walk.id === this.nextWalkId;
  }

  setNextWalkId(walks: Walk[]) {
    this.nextWalkId = this.walksQueryService.nextWalkId(walks);
  }

  setExpandedWalks(expandedWalks: ExpandedWalk[]) {
    this.expandedWalks = expandedWalks;
  }

  closeEditView(walk: Walk) {
    if (this.urlService.pathContains("edit")) {
      this.urlService.navigateTo(["walks"]);
    }
    this.toggleExpandedViewFor(walk, WalkViewMode.VIEW);
  }

  public walksCoordinatorName() {
    return this.committeeReferenceData.contactUsFieldForBuiltInRole(BuiltInRole.WALKS_CO_ORDINATOR, "fullName");
  }

  private applyConfig() {
    this.logger.info("applyConfig called");
    this.committeeConfig.committeeReferenceDataEvents().subscribe(committeeReferenceData => this.committeeReferenceData = committeeReferenceData);
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.logger.info("group:", this.group);
    });
    this.googleMapsService.events().subscribe(config => {
      this.googleMapsConfig = {zoomLevel: 12, apiKey: config.apiKey};
      this.logger.info("googleMapsConfig:", this.googleMapsConfig);
    });
  }

  allowEdits(walk: Walk) {
    return this.loggedInMemberIsLeadingWalk(walk) || this.allowAdminEdits();
  }

  allowAdminEdits() {
    return this.memberLoginService.allowWalkAdminEdits();
  }

  eventType(walk: Walk): string {
    return walk?.eventType || RamblersEventType.GROUP_WALK;
  }

  eventTypeTitle(walk: Walk): string {
    return this.stringUtils.asTitle(walk?.eventType) || "Walk";
  }

  isWalk(walk: Walk): boolean {
    return !walk?.eventType || walk.eventType === RamblersEventType.GROUP_WALK;
  }
}
