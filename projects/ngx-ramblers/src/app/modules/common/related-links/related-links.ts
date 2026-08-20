import { Component, inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGoogle, faMicrosoft } from "@fortawesome/free-brands-svg-icons";
import { faCalendarPlus, faRoute } from "@fortawesome/free-solid-svg-icons";
import { isBrowser } from "es-toolkit";
import { CalendarApp, CalendarClientHints, CalendarPreviewEvent, DeviceKind } from "../../../models/inbox.model";
import { calendarAppLabel, calendarAppsForDevice, calendarEventFromGroupEvent, calendarHrefFor, deviceKindFromUserAgent } from "../../../functions/calendar-add";
import { RelatedLinkComponent } from "./related-link";
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
        <a content tooltip="Click to view on Ramblers Walks and Events Manager" target="_blank"
           [href]="displayedWalk?.ramblersLink">On Ramblers</a>
      </div>
    }
    @if (links?.meetup && showLink('relatedLinkShowMeetup')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <img title class="related-links-image"
             src="/assets/images/local/meetup.ico"
             alt="View {{meetupService.meetupPublishedStatus(displayedWalk)}} event on Meetup"/>
        <a content target="_blank" tooltip="Click to view the route for This Walk on Meetup"
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
           target="_blank"
           [href]="osMapsHref()">
          View map on OS Maps
        </a>
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
    @if (calendarDownloadUrl() && showLink('relatedLinkShowCalendar')) {
      @for (app of calendarApps; track app) {
        @if (calendarHref(app); as href) {
          <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
               class="col-sm-12">
            <fa-icon title [icon]="calendarIcon(app)" class="fa-icon"></fa-icon>
            <a content
               tooltip="Click to add this {{display.eventTypeTitle(displayedWalk.walk).toLowerCase()}} to {{calendarDestination(app)}}"
               [href]="href"
               [attr.target]="app === CalendarApp.LOCAL ? null : '_blank'"
               [attr.rel]="app === CalendarApp.LOCAL ? null : 'noopener'">
              {{ calendarLabel(app) }}
            </a>
          </div>
        }
      }
    }
    @if (what3wordsHref() && showLink('relatedLinkShowWhat3words')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <img title class="w3w-image"
             src="/assets/images/local/w3w.png"
             alt="View start location in what3words"/>
        <a content tooltip="Click to view the start location in what3words"
           target="_blank"
           [href]="what3wordsHref()">
          View start location in what3words
        </a>
      </div>
    }
    @if (displayedWalk?.walk?.fields?.venue?.venuePublish && (displayedWalk?.walk?.fields?.venue?.url || displayedWalk?.walk?.fields?.venue?.postcode) && showLink('relatedLinkShowVenue')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
        <fa-icon title [icon]="displayedWalk?.walk?.fields.venue.type | toVenueIcon" class="fa-icon"></fa-icon>
        <a content [href]="displayedWalk?.walk?.fields?.venue?.url || googleMapsService.urlForPostcode(displayedWalk?.walk?.fields.venue.postcode)"
           target="_blank"
           tooltip="{{displayedWalk?.walk?.fields?.venue?.url ? 'Visit ' + displayedWalk?.walk?.fields.venue.name + ' website' : 'View ' + venueLabel() + ' on Google Maps'}}">{{ venueLabel() }}: {{ displayedWalk?.walk?.fields.venue.name }}</a>
      </div>
    }
  `,
  styles: [`
  `],
  imports: [FontAwesomeModule, RelatedLinkComponent, TooltipDirective, VenueIconPipe]
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
  public links: Links = null;
  public walksConfig: WalksConfig;
  private subscriptions: Subscription[] = [];
  protected readonly faRoute = faRoute;
  protected readonly faCalendarPlus = faCalendarPlus;
  protected readonly faGoogle = faGoogle;
  protected readonly faMicrosoft = faMicrosoft;
  protected readonly CalendarApp = CalendarApp;
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
    }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.displayedWalk) {
      this.refreshLinks();
    }
    if (changes.walksConfigOverride && this.walksConfigOverride) {
      this.walksConfig = this.walksConfigOverride;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshLinks(): void {
    this.links = this.linksService.linksFrom(this.displayedWalk?.walk);
    this.calendarEvent = calendarEventFromGroupEvent(this.displayedWalk?.walk ?? null);
    this.logger.info("refreshLinks:links:", this.links, "from displayedWalk?.walk?.fields.links:", this.displayedWalk?.walk?.fields.links);
  }

  venueLabel(): string {
    return this.venueService.venueLabel(this.displayedWalk?.walk?.fields?.venue?.isMeetingPlace);
  }

  showLink(key: keyof WalksConfig): boolean {
    return (this.walksConfig?.[key] as boolean | undefined) !== false;
  }

  osMapsHref(): string | null {
    const routeHref = this.links?.osMapsRoute?.href || null;
    const coords = this.startCoordinates();
    let href: string | null = null;
    if (routeHref) {
      href = routeHref;
    } else if (coords) {
      href = `https://explore.osmaps.com/pin?lat=${coords.latitude}&lon=${coords.longitude}&zoom=15`;
    }
    return href;
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

  calendarLabel(app: CalendarApp): string {
    return calendarAppLabel(app);
  }

  calendarDestination(app: CalendarApp): string {
    if (app === CalendarApp.GOOGLE) {
      return "Google Calendar";
    } else if (app === CalendarApp.OUTLOOK) {
      return "Outlook";
    } else {
      return "your calendar";
    }
  }

  calendarIcon(app: CalendarApp) {
    if (app === CalendarApp.GOOGLE) {
      return this.faGoogle;
    } else if (app === CalendarApp.OUTLOOK) {
      return this.faMicrosoft;
    } else {
      return this.faCalendarPlus;
    }
  }

  calendarHref(app: CalendarApp): string | null {
    return calendarHrefFor(app, this.calendarEvent, this.calendarDownloadUrl() || null, this.calendarClientHints);
  }

  gpxDownloadFileName(): string {
    const gpxFile: FileNameData | undefined = this.displayedWalk?.walk?.fields?.gpxFile;
    return gpxFile?.originalFileName || gpxFile?.awsFileName || "route.gpx";
  }
}
