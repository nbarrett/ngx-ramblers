import { Component, inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCopy, faEye, faShareNodes } from "@fortawesome/free-solid-svg-icons";
import { RelatedLinkComponent } from "./related-link";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
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
import { NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { WalkShareService } from "../../../pages/walks/walk-share.service";

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
    @if (displayedWalk.walkLink && showLink('relatedLinkShowThisWalk')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <fa-icon title [icon]="faShareNodes" class="fa-icon share-icon"
                 tooltip="Share this {{display.eventTypeTitle(displayedWalk.walk)}}"
                 role="button" (click)="shareWalk()"></fa-icon>
        <div content class="walk-link-dropdown" dropdown dropup container="body"
             (mouseenter)="showDropdown()" (mouseleave)="scheduleHide()"
             #walkLinkDropdown="bs-dropdown">
          <a dropdownToggle class="tooltip-link rams-text-decoration-pink walk-link-toggle">
            This {{ display.eventTypeTitle(displayedWalk.walk) }}
          </a>
          <ul *dropdownMenu class="dropdown-menu walk-link-dropdown-menu"
              (mouseenter)="showDropdown()" (mouseleave)="scheduleHide()">
            <li>
              <a class="dropdown-item" [href]="displayedWalk.walkLink" target="_blank">
                <fa-icon [icon]="faEye" class="fa-icon me-2"/>View this {{ display.eventTypeTitle(displayedWalk.walk).toLowerCase() }}
              </a>
            </li>
            <li>
              <a class="dropdown-item walk-link-action" role="button" (click)="shareWalk()">
                <fa-icon [icon]="faShareNodes" class="fa-icon me-2"/>Share this {{ display.eventTypeTitle(displayedWalk.walk).toLowerCase() }}
              </a>
            </li>
            <li>
              <a class="dropdown-item walk-link-action" role="button" (click)="copyLink()">
                <fa-icon [icon]="faCopy" class="fa-icon me-2"/>Copy link
              </a>
            </li>
          </ul>
        </div>
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
    @if (links?.osMapsRoute && showLink('relatedLinkShowOsMaps')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <img title class="related-links-image"
             src="/assets/images/local/ordnance-survey.png"
             alt="View map on OS Maps"/>
        <a content tooltip="Click to view the route for This Walk on Ordnance Survey Maps"
           target="_blank"
           [href]="links.osMapsRoute.href">
          View map on OS Maps
        </a>
      </div>
    }
    @if (displayedWalk?.walk?.groupEvent?.start_location?.w3w && showLink('relatedLinkShowWhat3words')) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <img title class="w3w-image"
             src="/assets/images/local/w3w.png"
             alt="View start location in what3words"/>
        <a content tooltip="Click to view the start location in what3words"
           target="_blank"
           [href]="'https://what3words.com/'+displayedWalk?.walk?.groupEvent.start_location.w3w">
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
    .share-icon
      cursor: pointer

    .walk-link-dropdown
      position: relative
      display: inline-block

    .walk-link-toggle
      cursor: pointer

    .walk-link-dropdown-menu
      margin-bottom: -2px
      background-color: #eeeeee
      border: 1px solid #ddd

    .walk-link-dropdown-menu .dropdown-item
      text-decoration: none !important
      background-image: none !important
      background-color: #eeeeee
      font-weight: bold
      color: inherit

    .walk-link-dropdown-menu .walk-link-action
      cursor: pointer
  `],
  imports: [FontAwesomeModule, RelatedLinkComponent, TooltipDirective, VenueIconPipe, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective]
})
export class RelatedLinksComponent implements OnInit, OnChanges, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("RelatedLinksComponent", NgxLoggerLevel.ERROR);
  public googleMapsService = inject(GoogleMapsService);
  public meetupService = inject(MeetupService);
  public display = inject(WalkDisplayService);
  private linksService = inject(LinksService);
  private venueService = inject(VenueService);
  private walksConfigService = inject(WalksConfigService);
  private notifierService = inject(NotifierService);
  private walkShareService = inject(WalkShareService);
  @Input() displayedWalk: DisplayedWalk;
  @Input() walksConfigOverride?: WalksConfig;
  public links: Links = null;
  public walksConfig: WalksConfig;
  public notifyTarget: AlertTarget = {};
  private subscriptions: Subscription[] = [];
  private notify = this.notifierService.createAlertInstance(this.notifyTarget);
  private hideTimeout: ReturnType<typeof setTimeout>;
  @ViewChild("walkLinkDropdown") walkLinkDropdown?: BsDropdownDirective;
  protected readonly faShareNodes = faShareNodes;
  protected readonly faEye = faEye;
  protected readonly faCopy = faCopy;

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
    clearTimeout(this.hideTimeout);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshLinks(): void {
    this.links = this.linksService.linksFrom(this.displayedWalk?.walk);
    this.logger.info("refreshLinks:links:", this.links, "from displayedWalk?.walk?.fields.links:", this.displayedWalk?.walk?.fields.links);
  }

  venueLabel(): string {
    return this.venueService.venueLabel(this.displayedWalk?.walk?.fields?.venue?.isMeetingPlace);
  }

  showLink(key: keyof WalksConfig): boolean {
    return (this.walksConfig?.[key] as boolean | undefined) !== false;
  }

  showDropdown(): void {
    clearTimeout(this.hideTimeout);
    this.walkLinkDropdown?.show();
  }

  scheduleHide(): void {
    this.hideTimeout = setTimeout(() => {
      this.walkLinkDropdown?.hide();
    }, 200);
  }

  shareWalk(): Promise<void> {
    return this.walkShareService.shareWalk(this.displayedWalk, this.notify);
  }

  copyLink(): Promise<void> {
    return this.walkShareService.copyLink(this.displayedWalk, this.notify);
  }
}
