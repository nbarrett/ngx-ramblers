import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { RelatedLinkComponent } from "./related-link";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DisplayedWalk, Links } from "../../../models/walk.model";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { MeetupService } from "../../../services/meetup.service";
import { CopyIconComponent } from "../copy-icon/copy-icon";
import { VenueIconPipe } from "../../../pipes/venue-icon.pipe";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { LinksService } from "../../../services/links.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Component({
  selector: "app-related-links",
  template: `
    @if (displayedWalk?.walk?.groupEvent?.id) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <img title class="related-links-ramblers-image"
             src="favicon.ico"
             alt="On Ramblers"/>
        <a content tooltip="Click to view on Ramblers Walks and Events Manager" target="_blank"
           [href]="displayedWalk?.ramblersLink">On Ramblers</a>
      </div>
    }
    @if (displayedWalk.walkLink) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
           class="col-sm-12">
        <app-copy-icon title [value]="displayedWalk.walkLink"
                       elementName="This {{display.eventTypeTitle(displayedWalk.walk)}}"/>
        <div content>
          <a [href]="displayedWalk.walkLink "
             target="_blank">This {{ display.eventTypeTitle(displayedWalk.walk) }}</a>
        </div>
      </div>
    }
    @if (links?.meetup) {
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
    @if (links?.osMapsRoute) {
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
    @if (displayedWalk?.walk?.groupEvent?.start_location?.w3w) {
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
    @if (displayedWalk?.walk?.fields?.venue?.venuePublish && (displayedWalk?.walk?.fields?.venue?.url || displayedWalk?.walk?.fields?.venue?.postcode)) {
      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
        <fa-icon title [icon]="displayedWalk?.walk?.fields.venue.type | toVenueIcon" class="fa-icon"></fa-icon>
        <a content [href]="displayedWalk?.walk?.fields?.venue?.url || googleMapsService.urlForPostcode(displayedWalk?.walk?.fields.venue.postcode)"
           target="_blank"
           tooltip="{{displayedWalk?.walk?.fields?.venue?.url ? 'Visit ' + displayedWalk?.walk?.fields.venue.name + ' website' : 'View ' + venueLabel() + ' on Google Maps'}}">{{ venueLabel() }}: {{ displayedWalk?.walk?.fields.venue.name }}</a>
      </div>
    }
  `,
  imports: [FontAwesomeModule, RelatedLinkComponent, TooltipDirective, CopyIconComponent, VenueIconPipe]
})
export class RelatedLinksComponent implements OnInit, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("RelatedLinksComponent", NgxLoggerLevel.ERROR);
  public googleMapsService = inject(GoogleMapsService);
  public meetupService = inject(MeetupService);
  public display = inject(WalkDisplayService);
  private linksService = inject(LinksService);
  @Input() displayedWalk: DisplayedWalk;
  public links: Links = null;

  ngOnInit(): void {
    this.refreshLinks();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.displayedWalk) {
      this.refreshLinks();
    }
  }

  private refreshLinks(): void {
    this.links = this.linksService.linksFrom(this.displayedWalk?.walk);
    this.logger.info("refreshLinks:links:", this.links, "from displayedWalk?.walk?.fields.links:", this.displayedWalk?.walk?.fields.links);
  }

  venueLabel(): string {
    return this.displayedWalk?.walk?.fields?.venue?.isMeetingPlace ? "Meeting place" : "Venue";
  }
}
