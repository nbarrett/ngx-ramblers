import { Component, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarDay, faCalendarPlus, faDiamondTurnRight, faMapLocationDot, faRoute } from "@fortawesome/free-solid-svg-icons";
import { faGoogle, faMicrosoft } from "@fortawesome/free-brands-svg-icons";
import { isBrowser } from "es-toolkit";
import { CalendarApp, CalendarClientHints, CalendarPreviewEvent, DeviceKind } from "../../../models/inbox.model";
import { calendarAppLabel, calendarAppsForDevice, calendarEventFromGroupEvent, calendarHrefFor, deviceKindFromUserAgent } from "../../../functions/calendar-add";
import { ContactAction, ContactActionDropdownComponent } from "../contact-action-dropdown/contact-action-dropdown";
import { nativeShareSupported, shareOrOpen } from "../../../functions/native-share";
import { RelatedLinkComponent } from "./related-link";
import { directionsLinks } from "../../../functions/locate";
import { AppShellService } from "../../../services/maps/app-shell.service";
import { DirectionsLink } from "../../../models/locate.model";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DisplayedWalk, Links } from "../../../models/walk.model";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { MeetupService } from "../../../services/meetup.service";
import { VenueIconPipe } from "../../../pipes/venue-icon.pipe";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { LinksService } from "../../../services/links.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { VenueService } from "../../../services/venue/venue.service";
import { WalksConfig } from "../../../models/walks-config.model";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { Subscription } from "rxjs";
import { UrlService } from "../../../services/url.service";
import { FileNameData } from "../../../models/aws-object.model";

@Component({
  selector: "app-related-links",
  template: `
    @if (displayedWalk?.walk?.groupEvent?.id && display.showWalkOnRamblersLink() && showLink('relatedLinkShowOnRamblers')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <img title class="related-links-ramblers-image"
             src="favicon.ico"
             alt="On Ramblers"/>
        <a content tooltip="Click to view on Ramblers Walks and Events Manager"
           [href]="displayedWalk?.ramblersLink">On Ramblers</a>
      </div>
    }
    @if (links?.meetup && showLink('relatedLinkShowMeetup')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <img title class="related-links-image"
             src="/assets/images/local/meetup.ico"
             alt="View {{meetupService.meetupPublishedStatus(displayedWalk)}} event on Meetup"/>
        <a content tooltip="Click to view the route for This Walk on Meetup"
           [href]="links.meetup.href">View {{ meetupService.meetupPublishedStatus(displayedWalk) }}
          event on Meetup</a>
      </div>
    }
    @if (osMapsHref() && showLink('relatedLinkShowOsMaps')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <img title class="related-links-image"
             src="/assets/images/local/ordnance-survey.png"
             alt="View map on OS Maps"/>
        <a content tooltip="Click to view this walk start on Ordnance Survey Maps"
           [href]="osMapsHref()">
          View map on OS Maps
        </a>
      </div>
    }
    @if (locateStartLink()) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
        <fa-icon title [icon]="faMapLocationDot" class="fa-icon"/>
        <a content [href]="locateStartLink()" tooltip="Show the start on the OS map, with the grid reference, postcode and directions">Locate the start on the map</a>
      </div>
    }
    @if (showLink('relatedLinkShowDirections') && directionsToStart().length > 0) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
        <fa-icon title [icon]="faDirections" class="fa-icon"/>
        <a content [href]="directionsToStart()[0].url" target="_blank" rel="noopener"
           (click)="shareDirections($event)"
           tooltip="Directions to the start from where you are - opens your maps app">Directions to the start</a>
      </div>
    }
    @if (gpxDownloadUrl() && showLink('relatedLinkShowGpx')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <fa-icon title [icon]="faRoute" class="fa-icon"></fa-icon>
        <a content tooltip="Click to download the GPX route for this {{display.eventTypeTitle(displayedWalk.walk).toLowerCase()}}"
           [href]="gpxDownloadUrl()"
           [download]="gpxDownloadFileName()">
          Download GPX route
        </a>
      </div>
    }
    @if (calendarDownloadUrl() && showLink('relatedLinkShowCalendar') && choosableCalendarApps().length > 0) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <fa-icon title [icon]="faCalendarPlus" class="fa-icon"></fa-icon>
        <app-contact-action-dropdown content [actions]="calendarActions()">Add to calendar</app-contact-action-dropdown>
      </div>
    }
    @if (what3wordsHref() && showLink('relatedLinkShowWhat3words')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <img title class="w3w-image"
             src="/assets/images/local/w3w.png"
             alt="View start location in what3words"/>
        <a content tooltip="Click to view the start location in what3words"
           [href]="what3wordsHref()">
          View start location in what3words
        </a>
      </div>
    }
    @if (displayedWalk?.walk?.fields?.venue?.venuePublish && (displayedWalk?.walk?.fields?.venue?.url || displayedWalk?.walk?.fields?.venue?.postcode) && showLink('relatedLinkShowVenue')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
        <fa-icon title [icon]="displayedWalk?.walk?.fields.venue.type | toVenueIcon" class="fa-icon"></fa-icon>
        <a content [href]="displayedWalk?.walk?.fields?.venue?.url || googleMapsService.urlForPostcode(displayedWalk?.walk?.fields.venue.postcode)"
           tooltip="{{displayedWalk?.walk?.fields?.venue?.url ? 'Visit ' + displayedWalk?.walk?.fields.venue.name + ' website' : 'View ' + venueLabel() + ' on Google Maps'}}">{{ venueLabel() }}: {{ displayedWalk?.walk?.fields.venue.name }}</a>
      </div>
    }
  `,
  styles: [`
  `],
  imports: [FontAwesomeModule, RelatedLinkComponent, TooltipDirective, VenueIconPipe, ContactActionDropdownComponent]
})
export class RelatedLinksComponent implements OnInit, OnChanges, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("RelatedLinksComponent", NgxLoggerLevel.ERROR);
  public googleMapsService = inject(GoogleMapsService);
  public meetupService = inject(MeetupService);
  public display = inject(WalkDisplayService);
  private linksService = inject(LinksService);
  private venueService = inject(VenueService);
  private walksConfigService = inject(WalksConfigService);
  private urlService = inject(UrlService);
  @Input() displayedWalk: DisplayedWalk;
  @Input() walksConfigOverride?: WalksConfig;
  @Output() hasAnyLinkChange = new EventEmitter<boolean>();
  public links: Links = null;
  public walksConfig: WalksConfig;
  private subscriptions: Subscription[] = [];
  protected readonly faRoute = faRoute;
  protected readonly faDirections = faDiamondTurnRight;
  protected readonly faMapLocationDot = faMapLocationDot;
  private appShell = inject(AppShellService);
  protected readonly faCalendarPlus = faCalendarPlus;
  protected readonly deviceKind: DeviceKind = deviceKindFromUserAgent(
    isBrowser() ? navigator.userAgent : "",
    isBrowser() ? navigator.platform : null
  );
  protected readonly calendarApps: CalendarApp[] = calendarAppsForDevice(this.deviceKind);
  private readonly calendarClientHints: CalendarClientHints = {
    userAgent: isBrowser() ? navigator.userAgent : "",
    origin: isBrowser() ? window.location.origin : null
  };
  protected calendarEvent: CalendarPreviewEvent | null = null;

  ngOnInit(): void {
    this.refreshLinks();
    this.walksConfig = this.walksConfigOverride ?? this.walksConfigService.walksConfig() ?? this.walksConfigService.default();
    this.subscriptions.push(this.walksConfigService.events().subscribe(config => {
      if (!this.walksConfigOverride) {
        this.walksConfig = config;
      }
      this.emitHasAnyLink();
    }));
    this.emitHasAnyLink();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.displayedWalk) {
      this.refreshLinks();
    }
    if (changes.walksConfigOverride && this.walksConfigOverride) {
      this.walksConfig = this.walksConfigOverride;
    }
    this.emitHasAnyLink();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshLinks(): void {
    this.links = this.linksService.linksFrom(this.displayedWalk?.walk);
    this.calendarEvent = calendarEventFromGroupEvent(this.displayedWalk?.walk ?? null);
    if (this.calendarEvent && this.displayedWalk?.walk) {
      const walk = this.displayedWalk.walk;
      const contactDetails = walk.fields?.contactDetails;
      this.calendarEvent.url = this.display.walkPublicLink(walk);
      this.calendarEvent.organiser = this.display.visibleLeaderDisplayName(walk) || null;
      this.calendarEvent.organiserPhone = this.display.contactPhoneVisible(walk) ? contactDetails?.phone || null : null;
      this.calendarEvent.organiserEmail = this.display.showMailtoEmail(walk) ? contactDetails?.email || null : null;
    }
    this.logger.info("refreshLinks:links:", this.links, "from displayedWalk?.walk?.fields.links:", this.displayedWalk?.walk?.fields.links);
  }

  venueLabel(): string {
    return this.venueService.venueLabel(this.displayedWalk?.walk?.fields?.venue?.isMeetingPlace);
  }

  showLink(key: keyof WalksConfig): boolean {
    return (this.walksConfig?.[key] as boolean | undefined) !== false;
  }

  private computeHasAnyLink(): boolean {
    return !!(this.displayedWalk?.walk?.groupEvent?.id && this.display.showWalkOnRamblersLink() && this.showLink("relatedLinkShowOnRamblers"))
      || !!(this.links?.meetup && this.showLink("relatedLinkShowMeetup"))
      || !!(this.osMapsHref() && this.showLink("relatedLinkShowOsMaps"))
      || !!this.locateStartLink()
      || (this.showLink("relatedLinkShowDirections") && this.directionsToStart().length > 0)
      || !!(this.gpxDownloadUrl() && this.showLink("relatedLinkShowGpx"))
      || (!!this.calendarDownloadUrl() && this.showLink("relatedLinkShowCalendar") && this.calendarApps.some(app => !!this.calendarHref(app)))
      || !!(this.what3wordsHref() && this.showLink("relatedLinkShowWhat3words"))
      || !!(this.displayedWalk?.walk?.fields?.venue?.venuePublish
        && (this.displayedWalk?.walk?.fields?.venue?.url || this.displayedWalk?.walk?.fields?.venue?.postcode)
        && this.showLink("relatedLinkShowVenue"));
  }

  private emitHasAnyLink(): void {
    this.hasAnyLinkChange.emit(this.computeHasAnyLink());
  }

  osMapsHref(): string | null {
    return this.links?.osMapsRoute?.href || null;
  }

  what3wordsHref(): string | null {
    const start = this.displayedWalk?.walk?.groupEvent?.start_location;
    const words = `${start?.w3w || ""}`.trim().replace(/^\/+/, "");
    const coords = this.startCoordinates();
    let href: string | null = null;
    if (words) {
      href = `https://what3words.com/${words}`;
    } else if (coords) {
      href = `https://what3words.com/map/@${coords.latitude},${coords.longitude}`;
    }
    return href;
  }

  locateStartLink(): string | null {
    const start = this.displayedWalk?.walk?.groupEvent?.start_location;
    const gridReference = this.display.gridReferenceFrom(start);
    return gridReference ? this.display.gridReferenceLink(gridReference) : (start?.postcode ? this.display.postcodeLink(start.postcode) : null);
  }

  directionsToStart(): DirectionsLink[] {
    const coords = this.startCoordinates();
    return coords ? directionsLinks(coords.latitude, coords.longitude, this.appShell.platform()) : [];
  }

  private startCoordinates(): { latitude: number; longitude: number } | null {
    const start = this.displayedWalk?.walk?.groupEvent?.start_location;
    const latitude = Number(start?.latitude);
    const longitude = Number(start?.longitude);
    const valid = !!start
      && Number.isFinite(latitude)
      && Number.isFinite(longitude)
      && !(latitude === 0 && longitude === 0);
    return valid ? {latitude, longitude} : null;
  }

  gpxDownloadUrl(): string | undefined {
    const gpxFile: FileNameData | undefined = this.displayedWalk?.walk?.fields?.gpxFile;
    if (!gpxFile?.awsFileName) {
      return undefined;
    }
    const rootFolder = (gpxFile as FileNameData & { rootFolder?: string }).rootFolder;
    const filePath = rootFolder && !gpxFile.awsFileName.startsWith(`${rootFolder}/`)
      ? `${rootFolder}/${gpxFile.awsFileName}`
      : gpxFile.awsFileName;
    if (this.urlService.isRemoteUrl(filePath)) {
      return filePath;
    }
    return this.urlService.resourceRelativePathForAWSFileName(filePath) || undefined;
  }

  calendarDownloadUrl(): string | undefined {
    const eventId = this.displayedWalk?.walk?.id;
    return eventId ? `/api/calendar/event/${eventId}` : undefined;
  }

  calendarHref(app: CalendarApp): string | null {
    return calendarHrefFor(app, this.calendarEvent, this.calendarDownloadUrl() || null, this.calendarClientHints);
  }

  choosableCalendarApps(): CalendarApp[] {
    return this.calendarApps.filter(app => !!this.calendarHref(app));
  }

  calendarActions(): ContactAction[] {
    const eventType = this.display.eventTypeTitle(this.displayedWalk?.walk).toLowerCase();
    return this.choosableCalendarApps().map(app => ({
      label: calendarAppLabel(app),
      icon: this.calendarIcon(app),
      tooltip: `${calendarAppLabel(app)} for this ${eventType}`,
      href: this.calendarHref(app),
      target: app === CalendarApp.LOCAL ? "_self" : "_blank"
    }));
  }

  private calendarIcon(app: CalendarApp): IconDefinition {
    if (app === CalendarApp.GOOGLE) {
      return faGoogle;
    } else if (app === CalendarApp.OUTLOOK) {
      return faMicrosoft;
    } else {
      return faCalendarDay;
    }
  }

  shareDirections(event: MouseEvent): void {
    const link = this.directionsToStart()[0];
    if (this.appShell.mobilePlatform() && nativeShareSupported() && link) {
      event.preventDefault();
      const title = `Directions to ${this.displayedWalk?.walk?.groupEvent?.title || "the start"}`;
      void shareOrOpen({title, url: link.url}, link.url);
    }
  }

  gpxDownloadFileName(): string {
    const gpxFile: FileNameData | undefined = this.displayedWalk?.walk?.fields?.gpxFile;
    return gpxFile?.originalFileName || gpxFile?.awsFileName || "route.gpx";
  }
}
