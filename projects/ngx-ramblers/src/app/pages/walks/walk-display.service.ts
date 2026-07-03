import { Location } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { Params, Router } from "@angular/router";
import { toPairs, find, isEmpty, isNumber, isUndefined } from "es-toolkit/compat";
import { PathSegment } from "../../models/content-text.model";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../models/member.model";
import { EventPopulation, Organisation, WalkLeaderPhoneAction } from "../../models/system.model";
import { EventContactService } from "../../services/walks-and-events/event-contact.service";
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
import { EventDefaultsService } from "../../services/event-defaults.service";
import { WalksAndEventsService } from "../../services/walks-and-events/walks-and-events.service";
import { WalksConfigService } from "../../services/system/walks-config.service";
import { MemberResourcesReferenceDataService } from "../../services/member/member-resources-reference-data.service";
import { WalksReferenceService } from "../../services/walks/walks-reference-data.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { Observable, ReplaySubject } from "rxjs";
import { StringUtilsService } from "../../services/string-utils.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { Difficulty, LocationDetails, RamblersEventType } from "../../models/ramblers-walks-manager";
import { EventsData } from "../../models/group-events.model";
import { BuiltInRole } from "../../models/committee.model";
import { MediaQueryService } from "../../services/committee/media-query.service";
import { ExtendedGroupEvent, InputSource } from "../../models/group-event.model";
import { AccessLevel } from "../../models/member-resource.model";
import { FeaturesService } from "../../services/features.service";
import { validEmail } from "../../functions/strings";
import { PageService } from "../../services/page.service";
import { StoredValue } from "../../models/ui-actions";

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
  private location = inject(Location);
  private urlService = inject(UrlService);
  protected stringUtils = inject(StringUtilsService);
  private sanitiser = inject(DomSanitizer);
  private walkEventService = inject(GroupEventService);
  private walksReferenceService = inject(WalksReferenceService);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private committeeConfig = inject(CommitteeConfigService);
  private dateUtils = inject(DateUtilsService);
  private pageService = inject(PageService);
  private eventContactService = inject(EventContactService);
  private eventDefaultsService = inject(EventDefaultsService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private walksConfigService = inject(WalksConfigService);
  private memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  private subject = new ReplaySubject<Member[]>();
  public relatedLinksMediaWidth = 22;
  public expandedWalks: ExpandedWalk [] = [];
  public walkTypes: WalkType[] = enumValues(WalkType);
  private nextWalkStartDateByGroupCode: Record<string, number> = {};
  private nextWalkStartDatesRequested = false;
  private viewReturnUrl: string;
  public members: Member[] = [];
  public googleMapsConfig: GoogleMapsConfig;
  public group: Organisation;
  private committeeReferenceData: CommitteeReferenceData;

  constructor() {
    this.applyConfig();
    this.logger.debug("this.memberLoginService", this.memberLoginService.loggedInMember());
  }

  walksArea(): string {
    return this.urlService.area();
  }

  groupEventArea(): string {
    return this.pageService.groupEventPage()?.href;
  }

  public notAwaitingLeader(walk: ExtendedGroupEvent): boolean {
    return !this.awaitingLeader(walk);
  }

  public awaitingLeader(walk: ExtendedGroupEvent): boolean {
    return this.walkEventService.latestEvent(walk)?.eventType === EventType.AWAITING_LEADER;
  }

  public hasWalkLeader(walk: ExtendedGroupEvent): boolean {
    const contactDetails = walk?.fields?.contactDetails;
    return !!contactDetails?.memberId || !!contactDetails?.displayName || this.hasRamblersContactChannel(walk);
  }

  public hasVisibleLeaderContactDetails(walk: ExtendedGroupEvent): boolean {
    const contactDetails = walk?.fields?.contactDetails;
    return !!contactDetails?.email
      || (this.walkContactDetailsPublic() && !!(contactDetails?.phone || contactDetails?.displayName));
  }

  public walkDetailsComplete(walk: ExtendedGroupEvent): boolean {
    const eventType = this.walkEventService.latestEventWithStatusChange(walk)?.eventType;
    return !!eventType && eventType !== EventType.AWAITING_LEADER && eventType !== EventType.AWAITING_WALK_DETAILS;
  }

  private hasRamblersContactChannel(walk: ExtendedGroupEvent): boolean {
    const contact = walk?.groupEvent?.item_type === RamblersEventType.GROUP_EVENT
      ? walk?.groupEvent?.event_organiser
      : walk?.groupEvent?.walk_leader;
    return !!contact?.has_email || !!contact?.email_form;
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
    const walkViewMode = expandedWalk ? expandedWalk.mode : this.urlService.pathContainsEventIdOrSlug() ? WalkViewMode.VIEW_SINGLE : this.urlService.pathContains(PathSegment.EDIT) ? WalkViewMode.EDIT_FULL_SCREEN : WalkViewMode.LIST;
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

  edit(walkDisplay: DisplayedWalk, options?: { bypassLeaderInit?: boolean }): void {
    const queryParams = options?.bypassLeaderInit ? {[StoredValue.AS]: WalksReferenceService.walkAccessModes.edit.caption} : undefined;
    if (walkDisplay?.walk?.groupEvent?.item_type === RamblersEventType.GROUP_EVENT) {
      void this.urlService.navigateTo([this.groupEventArea(), this.editIdentifierFor(walkDisplay?.walk), PathSegment.EDIT], queryParams);
    } else {
      void this.editFullScreen(walkDisplay.walk, queryParams);
    }
  }

  list(walk: ExtendedGroupEvent): ExpandedWalk {
    this.logger.debug("listing walk:", walk);
    return this.toggleExpandedViewFor(walk, WalkViewMode.LIST);
  }

  view(walk: ExtendedGroupEvent): ExpandedWalk {
    return this.toggleExpandedViewFor(walk, WalkViewMode.VIEW);
  }

  statusFor(walk: ExtendedGroupEvent): EventType {
    return this.walkEventService.statusFor(walk);
  }

  async editFullScreen(walk: ExtendedGroupEvent, queryParams?: Params): Promise<ExpandedWalk> {
    this.logger.debug("editing walk fullscreen:", walk);
    this.viewReturnUrl = this.location.path();
    await this.router.navigate(["/" + this.walksArea(), PathSegment.EDIT, this.editIdentifierFor(walk)], queryParams ? {queryParams} : undefined);
    this.logger.debug("area is now", this.urlService.area());
    return this.toggleExpandedViewFor(walk, WalkViewMode.EDIT_FULL_SCREEN);
  }

  memberCanAddWalk(eventsData?: EventsData): boolean {
    return !!eventsData?.eventTypes?.includes(RamblersEventType.GROUP_WALK)
      && this.memberLoginService.memberLoggedIn()
      && this.walkPopulationLocal()
      && this.memberMeetsWalkCreationAccess();
  }

  private memberMeetsWalkCreationAccess(): boolean {
    const accessLevel = this.walksConfigService.walksConfig()?.walkCreationAccessLevel ?? AccessLevel.HIDDEN;
    return !!this.memberResourcesReferenceData.accessLevelFor(accessLevel)?.filter();
  }

  memberWalkButtonLabel(): string {
    const configured = this.walksConfigService.walksConfig()?.regularWalkDay ?? 7;
    const weekday = configured >= 1 && configured <= 7 ? configured : 7;
    return `Add non-${this.dateUtils.daysOfWeek()[weekday - 1]} walk`;
  }

  async addMemberLedWalk(): Promise<void> {
    const member = this.memberLoginService.loggedInMember();
    const walk = this.eventDefaultsService.createDefault({fields: {inputSource: InputSource.MANUALLY_CREATED}});
    walk.fields.contactDetails = {
      contactId: null,
      memberId: member.memberId,
      displayName: [member.firstName, member.lastName].filter(item => !!item).join(" "),
      email: null,
      phone: null
    };
    walk.events = [this.walkEventService.createEventIfRequired(walk, this.walksReferenceService.walkEventTypeMappings.awaitingWalkDetails.eventType, "Walk created by leader")];
    const saved = await this.walksAndEventsService.createOrUpdate(walk);
    await this.editFullScreen(saved);
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
        this.editFullScreen(walk);
      }
    }
    return existingWalk;
  }

  latestEventTypeFor(walk: ExtendedGroupEvent): WalkEventType {
    const lookupType: EventType = this.walkEventService.statusFor(walk);
    const eventType = this.walksReferenceService.toWalkEventType(lookupType) as WalkEventType;
    if (!eventType) {
      this.logger.error("given lookupType", lookupType, "eventType", eventType, "walk.events", walk.events);
    }
    return eventType;
  }

  gridReferenceLink(gridReference: string): string {
    return `https://gridreferencefinder.com/?gr=${gridReference}`;
  }

  toWalkAccessMode(walk: ExtendedGroupEvent): WalkAccessMode {
    const accessMode = this.resolveWalkAccessMode(walk);
    this.logger.debug("toWalkAccessMode:returnValue:", accessMode, "walk:", walk);
    return accessMode;
  }

  private resolveWalkAccessMode(walk: ExtendedGroupEvent): WalkAccessMode {
    if (!this.memberLoginService.memberLoggedIn()) {
      return WalksReferenceService.walkAccessModes.view;
    }
    const eventType = this.walkEventService.latestEventWithStatusChange(walk)?.eventType;
    if (eventType === EventType.AWAITING_LEADER && this.walkPopulationLocal()) {
      return {...WalksReferenceService.walkAccessModes.lead, walkWritable: true};
    }
    if (this.loggedInMemberIsLeadingWalk(walk) || this.memberLoginService.allowWalkAdminEdits()) {
      return {...WalksReferenceService.walkAccessModes.edit, walkWritable: true};
    }
    return WalksReferenceService.walkAccessModes.view;
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

  editIdentifierFor(extendedGroupEvent: ExtendedGroupEvent): string {
    return this.walkSlug(extendedGroupEvent) || extendedGroupEvent?.id;
  }

  walkSlug(extendedGroupEvent: ExtendedGroupEvent): string {
    const urlToUse = extendedGroupEvent?.groupEvent?.url
      || this.stringUtils.kebabCase(extendedGroupEvent?.groupEvent?.title, this.dateUtils.yearMonthDayWithDashes(extendedGroupEvent?.groupEvent?.start_date_time))
      || extendedGroupEvent?.groupEvent?.id
      || extendedGroupEvent?.id;
    return this.stringUtils.lastItemFrom(urlToUse);
  }

  walkLink(extendedGroupEvent: ExtendedGroupEvent): string {
    this.logger.info("walkLink:groupEvent:url:", extendedGroupEvent?.groupEvent.url, "title:", extendedGroupEvent?.groupEvent?.title);
    return this.urlService.linkUrl({
      area: this.walksArea(),
      id: this.walkSlug(extendedGroupEvent)
    });
  }

  walkPublicLink(extendedGroupEvent: ExtendedGroupEvent): string {
    return this.urlService.publicLinkUrl({
      area: this.walksArea(),
      id: this.walkSlug(extendedGroupEvent)
    });
  }

  walkRouterLink(extendedGroupEvent: ExtendedGroupEvent): string {
    const relativeUrl = this.urlService.linkUrl({
      area: this.walksArea(),
      id: this.walkSlug(extendedGroupEvent),
      relative: true
    });
    return this.urlService.routerLinkUrl(relativeUrl);
  }

  walkViewLink(extendedGroupEvent: ExtendedGroupEvent): string[] {
    this.viewReturnUrl = this.location.path();
    return ["/" + this.walksArea(), PathSegment.VIEW, this.walkSlug(extendedGroupEvent)];
  }

  ramblersLink(walk: ExtendedGroupEvent): string {
    return walk?.groupEvent?.url;
  }

  contactEmailHref(email: string): string {
    const normalised = (email || "").trim();
    const lowerCase = normalised.toLowerCase();
    if (!normalised) {
      return null;
    } else if (lowerCase.startsWith("mailto:")) {
      const address = normalised.substring(7).trim();
      return validEmail(address.toLowerCase()) ? `mailto:${address}` : null;
    } else if (validEmail(lowerCase)) {
      return `mailto:${normalised}`;
    } else if (this.urlService.isRemoteUrl(normalised)) {
      return normalised;
    } else {
      return null;
    }
  }

  isNextWalk(walk: ExtendedGroupEvent): boolean {
    const startDate = walk?.groupEvent?.start_date_time;
    const groupCode = walk?.groupEvent?.group_code;
    const nextStartDateForGroup = groupCode ? this.nextWalkStartDateByGroupCode[groupCode] : undefined;
    return !!startDate && !!nextStartDateForGroup && this.dateUtils.asValueNoTime(startDate) === nextStartDateForGroup;
  }

  refreshNextWalkStartDate(): void {
    if (this.nextWalkStartDatesRequested) {
      return;
    }
    this.nextWalkStartDatesRequested = true;
    this.extendedGroupEventQueryService.fetchNextWalkStartDate().subscribe({
      next: (response) => {
        const byGroupCode: Record<string, number> = {};
        toPairs(response.nextWalkStartDates || {}).forEach(([groupCode, startDate]) => {
          if (startDate) {
            byGroupCode[groupCode] = this.dateUtils.asValueNoTime(startDate);
          }
        });
        this.nextWalkStartDateByGroupCode = byGroupCode;
        this.logger.info("refreshNextWalkStartDate: per-group next walk start dates:", response.nextWalkStartDates);
      },
      error: (error) => {
        this.nextWalkStartDatesRequested = false;
        this.logger.error("refreshNextWalkStartDate: failed to fetch next walk start date:", error);
      }
    });
  }

  closeEditView(walk: ExtendedGroupEvent) {
    const rawReturnUrl = this.viewReturnUrl || "/" + this.walksArea();
    this.viewReturnUrl = null;
    const [pathWithQuery, fragment] = rawReturnUrl.split("#");
    const [path, queryString] = pathWithQuery.split("?");
    const queryParams: Record<string, string> = {};
    if (queryString) {
      queryString.split("&").forEach(pair => {
        const [key, value] = pair.split("=");
        queryParams[decodeURIComponent(key)] = decodeURIComponent(value || "");
      });
    }
    this.logger.info("closeEditView:rawReturnUrl:", rawReturnUrl, "path:", path, "queryParams:", queryParams, "fragment:", fragment);
    this.router.navigate([path], {queryParams, fragment, queryParamsHandling: "merge"});
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

  showWalkOnRamblersLink(): boolean {
    return this.group?.showWalkOnRamblersLink !== false;
  }

  showWalkRelatedLinks(): boolean {
    return this.group?.showWalkRelatedLinks !== false;
  }

  showWalkShareInHeader(): boolean {
    return this.group?.showWalkShareInHeader === true;
  }

  isContactUsContact(event?: ExtendedGroupEvent): boolean {
    return this.eventContactService.isContactUsContact(event);
  }

  contactWalkLeader(walk: ExtendedGroupEvent) {
    this.eventContactService.contactEventLeader(walk);
  }

  phoneActions(): WalkLeaderPhoneAction[] {
    return [WalkLeaderPhoneAction.TEL, WalkLeaderPhoneAction.SMS, WalkLeaderPhoneAction.WHATSAPP, WalkLeaderPhoneAction.COPY];
  }

  phoneActionHref(phone: string, action: WalkLeaderPhoneAction): string {
    const cleaned = phone?.replace(/\s/g, "");
    if (action === WalkLeaderPhoneAction.WHATSAPP) {
      const international = cleaned?.replace(/^\+/, "").replace(/^0/, "44");
      return `https://wa.me/${international}`;
    } else if (action === WalkLeaderPhoneAction.SMS) {
      return `sms:${cleaned}`;
    } else if (action === WalkLeaderPhoneAction.COPY) {
      return null;
    }
    return `tel:${cleaned}`;
  }

  phoneActionLabel(action: WalkLeaderPhoneAction): string {
    if (action === WalkLeaderPhoneAction.WHATSAPP) {
      return "WhatsApp";
    } else if (action === WalkLeaderPhoneAction.SMS) {
      return "SMS";
    } else if (action === WalkLeaderPhoneAction.COPY) {
      return "Copy number";
    }
    return "Call";
  }

  phoneActionTooltip(displayName: string, phone: string, action: WalkLeaderPhoneAction): string {
    if (action === WalkLeaderPhoneAction.WHATSAPP) {
      return `Open WhatsApp chat with ${displayName} on ${phone}`;
    } else if (action === WalkLeaderPhoneAction.SMS) {
      return `Send an SMS to ${displayName} on ${phone}`;
    } else if (action === WalkLeaderPhoneAction.COPY) {
      return `Copy ${phone} to clipboard`;
    }
    return `Call ${displayName} on ${phone}`;
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
