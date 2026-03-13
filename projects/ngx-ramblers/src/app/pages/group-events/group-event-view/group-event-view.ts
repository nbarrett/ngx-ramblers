import { Component, inject, Input, OnInit } from "@angular/core";
import { faEnvelope, faFile, faHouse, faMapMarkerAlt, faPhone } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { GroupEventDisplayService } from "../group-event-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { PageService } from "../../../services/page.service";
import { MarkdownComponent } from "ngx-markdown";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { RouterLink } from "@angular/router";
import { EventDatesAndTimesPipe } from "../../../pipes/event-times-and-dates.pipe";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { LinksService } from "../../../services/links.service";
import { FALLBACK_MEDIA, Links } from "../../../models/walk.model";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { BasicMedia } from "../../../models/ramblers-walks-manager";
import { BookingFormComponent } from "../../admin/bookings/booking-form.component";

@Component({
  selector: "app-group-event-view",
  template: `
    <div class="card mb-3">
      <div class="wrapper w-100 position-relative">
        <img class="h-100 w-100 position-absolute" (error)="imageError($event)" (load)="imageLoad($event)"
             role="presentation" src="{{image.url}}"
             alt="{{image.alt}}"/>
      </div>
      <div class="card-body">
        <div class="position-relative">
          @if (display.allow.edits) {
            <input type="submit" value="edit"
                   (click)="editGroupEvent()" [disabled]="notifyTarget.busy"
                   title="Edit event" class="btn btn-primary float-end">
          }
        </div>
        <div class="card-title mb-4"><h2>{{ groupEvent?.groupEvent?.title }}</h2></div>
        @if (display.allow.detailView) {
          <div class="row">
            <div class="col-sm-12">
              <h3>{{ groupEvent?.groupEvent | eventDatesAndTimes }}</h3>
            </div>
          </div>
          <div class="row">
            <div class="col-sm-12">
              <p class="list-arrow" markdown [data]="groupEvent?.groupEvent?.description"></p>
            </div>
          </div>
          <div class="row">
            <div class="col-sm-6">
              <div class="event-panel rounded">
                <h1>Location and Links</h1>
                <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                  <app-copy-icon [icon]="faMapMarkerAlt" title
                                 [value]="googleMapsService.urlForPostcode(groupEvent?.groupEvent?.location?.postcode)"
                                 elementName="Google Maps link for {{groupEvent?.groupEvent?.location?.postcode}}"/>
                  <div content>
                    <div class="me-2">{{ groupEvent?.groupEvent?.location?.description }}</div>
                  </div>
                </div>
                <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                  <app-copy-icon [icon]="faMapMarkerAlt" title [value]="groupEvent?.groupEvent?.location?.postcode"
                                 elementName="Postcode {{groupEvent?.groupEvent?.location?.postcode}}"/>
                  <div content>
                    <a
                      tooltip="Click to locate postcode {{groupEvent?.groupEvent?.location?.postcode}} on Google Maps"
                      [href]="googleMapsService.urlForPostcode(groupEvent?.groupEvent?.location?.postcode)"
                      target="_blank">{{ groupEvent?.groupEvent?.location?.postcode }}</a>
                  </div>
                </div>
                @if (links.meetup) {
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12"
                       [mediaWidth]="display.relatedLinksMediaWidth">
                    <img title class="related-links-image"
                         src="/assets/images/local/meetup.ico"
                         alt="View event on Meetup"/>
                    <a content target="_blank" tooltip="Click to view this event on Meetup"
                       [href]="links.meetup.href">View event on Meetup</a>
                  </div>
                }
                @if (links.venue) {
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                    <app-copy-icon [icon]="faHouse" title [value]="links.venue.href"
                                   [elementName]="links.venue.href"/>
                    <div content>
                      <a tooltip="Click to visit {{links.venue.title}}" [href]="links.venue.href"
                         target="_blank">{{ links.venue.title || 'Event Venue' }}</a>
                    </div>
                  </div>
                }
                @if (groupEvent?.fields?.attachment) {
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                    <fa-icon title [icon]="faFile" class="fa-icon"/>
                    <div content>
                      <a tooltip="Click to view attachment" [href]="display.attachmentUrl(groupEvent)"
                         target="_blank">{{ display.attachmentTitle(groupEvent) }}</a>
                    </div>
                  </div>
                }
                <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                  <app-copy-icon title [value]="display.groupEventLink(groupEvent, false)"
                                 [elementName]="'This event'"/>
                  <div content>
                    <a [href]="display.groupEventLink(groupEvent, true)" target="_blank">This Event</a>
                  </div>
                </div>
                @if (!display.groupEventPopulationLocal() && groupEvent?.groupEvent?.url && display.showSocialOnRamblersLink()) {
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                       class="col-sm-12">
                    <img title class="related-links-ramblers-image"
                         src="favicon.ico"
                         alt="On Ramblers"/>
                    <a content tooltip="Click to view on Ramblers Walks and Events Manager" target="_blank"
                       [href]="groupEvent.groupEvent.url">On Ramblers</a>
                  </div>
                }
              </div>
            </div>
            <div class="col-sm-6">
              <div class="event-panel rounded h-100">
                <h1>Contact Details</h1>
                <div class="col-sm-12">
                  @if (!display.groupEventPopulationLocal()) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                      <fa-icon title tooltip="contact organiser {{groupEvent?.fields?.contactDetails?.displayName}}"
                               [icon]="faEnvelope"
                               class="fa-icon pointer"/>
                      <a content
                         [href]="groupEvent?.fields?.contactDetails?.email">{{ groupEvent?.fields?.contactDetails?.displayName || "Contact Via Ramblers" }}</a>
                    </div>
                  }
                  @if (display.groupEventPopulationLocal()) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                      <app-copy-icon [icon]="faEnvelope" title [value]="groupEvent?.fields?.contactDetails?.email"
                                     [elementName]="'email address for '+ groupEvent?.fields?.contactDetails?.displayName "/>
                      <div content>
                        <a [href]="'mailto' + groupEvent?.fields?.contactDetails?.email"
                           tooltip="Click to email {{groupEvent?.fields?.contactDetails?.displayName}} at {{groupEvent?.fields?.contactDetails?.email}}">
                          {{ groupEvent?.fields?.contactDetails?.displayName }}
                        </a>
                      </div>
                    </div>
                  }
                  @if (groupEvent?.fields?.contactDetails?.phone) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                      <app-copy-icon [icon]="faPhone" title [value]="groupEvent?.fields?.contactDetails?.phone"
                                     [elementName]="'phone number for '+ groupEvent?.fields?.contactDetails?.displayName "/>
                      <div content>
                        <a [href]="'tel:' + groupEvent?.fields?.contactDetails?.phone"
                           tooltip="Click to ring {{groupEvent?.fields?.contactDetails?.displayName}} on {{groupEvent?.fields?.contactDetails?.phone}}">
                          {{ groupEvent?.fields?.contactDetails?.phone }}
                        </a>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
          <div class="mt-3 mb-1">
            <app-booking-form [extendedGroupEvent]="groupEvent" [eventLink]="display.groupEventLink(groupEvent, false)"></app-booking-form>
          </div>
        }
        @if (showSensitiveDetailsAlert()) {
          <div>
            @if (notifyTarget.showAlert) {
              <div class="col-12 alert alert-warning mt-3 mb-0">
                <fa-icon [icon]="notifyTarget.alert.icon"/>
                <strong class="ms-2">Some of the information on this event is hidden</strong>
                {{ notifyTarget.alertMessage }} <a [routerLink]="'/login'" type="button"
                                                   class="rams-text-decoration-pink">Login to see more</a>
              </div>
            }
          </div>
        }
        @if (this.urlService.pathContainsEventIdOrSlug()) {
          <div>
            @if (notifyTarget.showAlert) {
              <div class="col-12 alert {{notifyTarget.alertClass}} mt-0 mb-0">
                <fa-icon [icon]="notifyTarget.alert.icon"/>
                <strong class="ms-2">{{ notifyTarget.alertTitle }}</strong>
                {{ notifyTarget.alertMessage }}
                <a [routerLink]="'/' + display.groupEventArea()" type="button"
                   class="rams-text-decoration-pink">Back to {{ pageService.areaTitle() }}</a>
              </div>
            }
          </div>
        }
      </div>
    </div>`,
  styleUrls: ["group-event-view.sass"],
  imports: [MarkdownComponent, RelatedLinkComponent, CopyIconComponent, TooltipDirective, FontAwesomeModule, RouterLink, EventDatesAndTimesPipe, BookingFormComponent]
})
export class GroupEventView implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventView", NgxLoggerLevel.ERROR);
  protected pageService = inject(PageService);
  googleMapsService = inject(GoogleMapsService);
  private notifierService = inject(NotifierService);
  display = inject(GroupEventDisplayService);
  linksService = inject(LinksService);
  urlService = inject(UrlService);
  private systemConfigService = inject(SystemConfigService);
  private walksAndEventsService = inject(WalksAndEventsService);
  protected mediaQueryService = inject(MediaQueryService);
  @Input()
  public groupEvent: ExtendedGroupEvent;
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  faEnvelope = faEnvelope;
  faPhone = faPhone;
  faMapMarkerAlt = faMapMarkerAlt;
  faHouse = faHouse;
  faFile = faFile;
  public links: Links = null;
  public image: BasicMedia;

  ngOnInit() {
    this.logger.info("ngOnInit:groupEvent:", this.groupEvent);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.image = this.mediaQueryService.imageSourceWithFallback(this.groupEvent);
    this.systemConfigService.events().subscribe(async item => {
      if (this.groupEvent) {
        this.logger.info("groupEvent from input:", this.groupEvent);
        this.notifyGroupEventDisplayed();
      } else if (this.urlService.pathContainsEventIdOrSlug()) {
        const groupEventId = this.urlService.lastPathSegment();
        this.logger.info("finding groupEvent from groupEventId:", groupEventId);
        const data: ExtendedGroupEvent = await this.walksAndEventsService.queryById(groupEventId);
        this.groupEvent = data;
        this.image = this.mediaQueryService.imageSourceWithFallback(this.groupEvent);
        this.logger.info("found group event:", data);
        this.notifyGroupEventDisplayed();
      } else if (this.display.inNewEventMode()) {
        this.editGroupEvent();
      }
      this.pageService.setTitle();
    });
    this.links = this.linksService.linksFrom(this.groupEvent);
  }

  notifyGroupEventDisplayed() {
    this.notify.success({
      title: "Single event showing",
      message: " - "
    });
  }

  imageError(event: ErrorEvent) {
    this.logger.error("imageError:", event);
    this.image = FALLBACK_MEDIA;
  }

  imageLoad($event: Event) {
    this.logger.info("imageLoad:", $event);
  }

  editGroupEvent() {
    this.display.confirm.clear();
    const existingRecordEditEnabled = this.display.allow.edits;
    this.display.allow.copy = existingRecordEditEnabled;
    this.display.allow.delete = existingRecordEditEnabled;
    if (this?.groupEvent?.id) {
      const eventPath = this.display.groupEventLink(this.groupEvent, true);
      this.logger.info("editing existing event:", this.groupEvent.id, "eventPath:", eventPath);
      this.urlService.navigateUnconditionallyTo([eventPath, "edit"]);
    } else {
      this.logger.info("creating new event");
      this.urlService.navigateUnconditionallyTo([this.urlService.area(), "new"]);
    }
  }

  showSensitiveDetailsAlert() {
    return !this.display.loggedIn() && !this.systemConfigService?.systemConfig()?.group?.socialDetailsPublic;
  }


}
