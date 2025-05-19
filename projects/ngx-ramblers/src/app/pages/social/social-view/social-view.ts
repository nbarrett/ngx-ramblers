import { Component, inject, Input, OnInit } from "@angular/core";
import { faEnvelope, faFile, faHouse, faMapMarkerAlt, faPhone } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { SocialDisplayService } from "../social-display.service";
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

@Component({
    selector: "app-social-view",
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
                     (click)="editSocialEvent()" [disabled]="notifyTarget.busy"
                     title="Edit social event" class="btn btn-primary button-form-right">
            }
          </div>
          <div class="card-title mb-4"><h2>{{ socialEvent?.groupEvent?.title }}</h2></div>
          @if (display.allow.detailView) {
            <div class="row">
              <div class="col-sm-12">
                <h3>{{ socialEvent | eventDatesAndTimes }}</h3>
              </div>
            </div>
          }
          @if (display.allow.detailView) {
            <div class="row">
              <div class="col-sm-12">
                <p class="list-arrow" markdown [data]="socialEvent?.groupEvent?.description"></p>
              </div>
            </div>
          }
          @if (display.allow.detailView) {
            <div class="row">
              <div class="col-sm-6">
                <div class="event-panel rounded">
                  <h1>Location and Links</h1>
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                    <app-copy-icon [icon]="faMapMarkerAlt" title
                                   [value]="googleMapsService.urlForPostcode(socialEvent?.groupEvent?.location?.postcode)"
                                   elementName="Google Maps link for {{socialEvent?.groupEvent?.location?.postcode}}"/>
                    <div content>
                      <div class="mr-2">{{ socialEvent?.groupEvent?.location?.description }}</div>
                    </div>
                  </div>
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                    <app-copy-icon [icon]="faMapMarkerAlt" title [value]="socialEvent?.groupEvent?.location?.postcode"
                                   elementName="Postcode {{socialEvent?.groupEvent?.location?.postcode}}"/>
                    <div content>
                      <a
                        tooltip="Click to locate postcode {{socialEvent?.groupEvent?.location?.postcode}} on Google Maps"
                        [href]="googleMapsService.urlForPostcode(socialEvent?.groupEvent?.location?.postcode)"
                        target="_blank">{{ socialEvent?.groupEvent?.location?.postcode }}</a>
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
                           target="_blank">{{ links.venue.title || 'Social Event Venue' }}</a>
                      </div>
                    </div>
                  }
                  @if (socialEvent?.fields?.attachment) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                      <fa-icon title [icon]="faFile" class="fa-icon"></fa-icon>
                      <div content>
                        <a tooltip="Click to view attachment" [href]="display.attachmentUrl(socialEvent)"
                           target="_blank">{{ display.attachmentTitle(socialEvent) }}</a>
                      </div>
                    </div>
                  }
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                    <app-copy-icon title [value]="display.socialEventLink(socialEvent, false)"
                                   [elementName]="'This social event'"/>
                    <div content>
                      <a [href]="display.socialEventLink(socialEvent, true)" target="_blank">This Social Event</a>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-sm-6">
                <div class="event-panel rounded">
                  <h1>Contact Details</h1>
                  <div class="col-sm-12">
                    @if (!display.socialPopulationLocal()) {
                      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                        <fa-icon title tooltip="contact organiser {{socialEvent?.fields?.contactDetails?.displayName}}"
                                 [icon]="faEnvelope"
                                 class="fa-icon pointer"></fa-icon>
                        <a content
                           [href]="socialEvent?.fields?.contactDetails?.email">{{ socialEvent?.fields?.contactDetails?.displayName || "Contact Via Ramblers" }}</a>
                      </div>
                    }
                    @if (display.socialPopulationLocal()) {
                      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                        <app-copy-icon [icon]="faEnvelope" title [value]="socialEvent?.fields?.contactDetails?.email"
                                       [elementName]="'email address for '+ socialEvent?.fields?.contactDetails?.displayName "/>
                        <div content>
                          <a [href]="'mailto' + socialEvent?.fields?.contactDetails?.email"
                             tooltip="Click to email {{socialEvent?.fields?.contactDetails?.displayName}} at {{socialEvent?.fields?.contactDetails?.email}}">
                            {{ socialEvent?.fields?.contactDetails?.displayName }}
                          </a>
                        </div>
                      </div>
                    }
                    @if (socialEvent?.fields?.contactDetails?.phone) {
                      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                        <app-copy-icon [icon]="faPhone" title [value]="socialEvent?.fields?.contactDetails?.phone"
                                       [elementName]="'phone number for '+ socialEvent?.fields?.contactDetails?.displayName "/>
                        <div content>
                          <a [href]="'tel:' + socialEvent?.fields?.contactDetails?.phone"
                             tooltip="Click to ring {{socialEvent?.fields?.contactDetails?.displayName}} on {{socialEvent?.fields?.contactDetails?.phone}}">
                            {{ socialEvent?.fields?.contactDetails?.phone }}
                          </a>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
          @if (showSensitiveDetailsAlert()) {
            <div>
              @if (notifyTarget.showAlert) {
                <div class="col-12 alert alert-warning mt-3 mb-0">
                  <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                  <strong class="ml-2">Some of the information on this event is hidden</strong>
                  {{ notifyTarget.alertMessage }} <a [routerLink]="'/login'" type="button"
                                                     class="rams-text-decoration-pink">Login to see more</a>
                </div>
              }
            </div>
          }
          @if (this.urlService.pathContainsEventId()) {
            <div>
              @if (notifyTarget.showAlert) {
                <div class="col-12 alert {{notifyTarget.alertClass}} mt-3 mb-0">
                  <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                  <strong class="ml-2">{{ notifyTarget.alertTitle }}</strong>
                  {{ notifyTarget.alertMessage }} <a [routerLink]="'/'+pageService.socialPage()?.href" type="button"
                                                     class="rams-text-decoration-pink">Back to all social events</a>
                </div>
              }
            </div>
          }
        </div>
      </div>`,
    styleUrls: ["social-view.sass"],
  imports: [MarkdownComponent, RelatedLinkComponent, CopyIconComponent, TooltipDirective, FontAwesomeModule, RouterLink, EventDatesAndTimesPipe]
})
export class SocialViewComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialViewComponent", NgxLoggerLevel.ERROR);
  protected pageService = inject(PageService);
  googleMapsService = inject(GoogleMapsService);
  private notifierService = inject(NotifierService);
  display = inject(SocialDisplayService);
  linksService = inject(LinksService);
  urlService = inject(UrlService);
  private systemConfigService = inject(SystemConfigService);
  private walksAndEventsService = inject(WalksAndEventsService);
  protected mediaQueryService = inject(MediaQueryService);
  @Input()
  public socialEvent: ExtendedGroupEvent;
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
    this.logger.info("ngOnInit:socialEvent:", this.socialEvent);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.image = this.mediaQueryService.imageSourceWithFallback(this.socialEvent);
    this.systemConfigService.events().subscribe(item => {
      if (this.socialEvent) {
        this.logger.info("socialEvent from input:", this.socialEvent);
        this.notifySocialEventDisplayed()
      } else if (this.urlService.pathContainsEventId()) {
        const socialEventId = this.urlService.lastPathSegment();
        this.logger.info("finding socialEvent from socialEventId:", socialEventId);
        this.walksAndEventsService.getByIdIfPossible(socialEventId).then(data => {
          this.socialEvent = data;
          this.image = this.mediaQueryService.imageSourceWithFallback(this.socialEvent);
          this.logger.info("found social event:", data);
          this.notifySocialEventDisplayed()
        });
      } else if (this.display.inNewEventMode()) {
        this.editSocialEvent();
      }
    });
    this.links = this.linksService.linksFrom(this.socialEvent?.fields?.links);
  }

  notifySocialEventDisplayed(){
    this.notify.success({
      title: "Single social event showing",
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

  editSocialEvent() {
    if (this.display.inNewEventMode()) {
      this.logger.info("creating new social event");
    } else {
      this.logger.info("editing existing social event:", this.socialEvent.id);
    }
    this.display.confirm.clear();
    const existingRecordEditEnabled = this.display.allow.edits;
    this.display.allow.copy = existingRecordEditEnabled;
    this.display.allow.delete = existingRecordEditEnabled;
    if (this?.socialEvent?.id) {
      this.urlService.navigateTo([this.pageService.socialPage()?.href, this.socialEvent.id, "edit"]);
    } else {
      this.urlService.navigateTo([this.pageService.socialPage()?.href, "new"]);
    }
  }

  showSensitiveDetailsAlert() {
    return !this.display.loggedIn() && !this.systemConfigService?.systemConfig()?.group?.socialDetailsPublic;
  }


}
