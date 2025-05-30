import { Component, inject, Input, OnInit } from "@angular/core";
import { faEnvelope, faFile, faHouse, faMapMarkerAlt, faPhone } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { SocialEvent } from "../../../models/social-events.model";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SocialEventsService } from "../../../services/social-events/social-events.service";
import { UrlService } from "../../../services/url.service";
import { SocialDisplayService } from "../social-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { PageService } from "../../../services/page.service";
import { NgClass } from "@angular/common";
import { MarkdownComponent } from "ngx-markdown";
import { RelatedLinkComponent } from "../../../modules/common/related-link/related-link.component";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { RouterLink } from "@angular/router";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";
import { EventTimesPipe } from "../../../pipes/event-times.pipe";

@Component({
    selector: "app-social-view",
    template: `
    <div class="card mb-3">
      <div class="wrapper w-100 position-relative">
        @if (socialEvent?.thumbnail) {
          <img class="h-100 w-100 position-absolute"
               role="presentation"
               [src]="urlService.imageSource(socialEvent?.thumbnail)">
        }
      </div>
      <div class="card-body">
        <div class="position-relative">
          @if (display.allow.edits) {
            <input type="submit" value="edit"
                   (click)="editSocialEvent()" [disabled]="notifyTarget.busy"
                   [ngClass]="notifyTarget.busy ? 'disabled-button-form': 'button-form'"
                   title="Edit social event" class="button-form button-form-right">
          }
        </div>
        <div class="card-title mb-4"><h2>{{ socialEvent?.briefDescription }}</h2></div>
        @if (display.allow.detailView) {
          <div class="row">
            <div class="col-sm-12">
              <h3>{{ socialEvent?.eventDate | displayDay }} @if (socialEvent?.eventTimeStart) {
                <small>
                  – {{ socialEvent | eventTimes }}</small>
              }</h3>
            </div>
          </div>
        }
        @if (display.allow.detailView) {
          <div class="row">
            <div class="col-sm-12">
              <p class="list-arrow" markdown [data]="socialEvent?.longerDescription"></p>
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
                                 [value]="googleMapsService.urlForPostcode(socialEvent?.postcode)"
                                 elementName="Google Maps link for {{socialEvent?.postcode}}"/>
                  <div content>
                    <div class="mr-2">{{ socialEvent?.location }}</div>
                  </div>
                </div>
                <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                  <app-copy-icon [icon]="faMapMarkerAlt" title [value]="socialEvent?.postcode"
                                 elementName="Postcode {{socialEvent?.postcode}}"/>
                  <div content>
                    <a tooltip="Click to locate postcode {{socialEvent?.postcode}} on Google Maps"
                       [href]="googleMapsService.urlForPostcode(socialEvent?.postcode)"
                       target="_blank">{{ socialEvent?.postcode }}</a>
                  </div>
                </div>
                @if (urlService.isMeetupUrl(socialEvent?.link)) {
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12"
                       [mediaWidth]="display.relatedLinksMediaWidth">
                    <img title class="related-links-image"
                         src="/assets/images/local/meetup.ico"
                         alt="View event on Meetup"/>
                    <a content target="_blank" tooltip="Click to view this event on Meetup"
                       [href]="socialEvent.link">View event on Meetup</a>
                  </div>
                }
                @if (socialEvent?.link && !urlService.isMeetupUrl(socialEvent?.link)) {
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12"
                  >
                    <app-copy-icon [icon]="faHouse" title [value]="socialEvent.link"
                                   [elementName]="socialEvent.link"/>
                    <div content>
                      <a tooltip="Click to visit {{socialEvent.link}}" [href]="socialEvent.link"
                         target="_blank">{{ socialEvent.linkTitle || 'Social Event Venue' }}</a>
                    </div>
                  </div>
                }
                @if (socialEvent?.attachment) {
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12"
                  >
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
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12"
                    >
                      <fa-icon title tooltip="contact organiser {{socialEvent?.displayName}}"
                               [icon]="faEnvelope"
                               class="fa-icon pointer"></fa-icon>
                      <a content
                         [href]="socialEvent?.contactEmail">{{ socialEvent?.displayName || "Contact Via Ramblers" }}</a>
                    </div>
                  }
                  @if (display.socialPopulationLocal()) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                      <app-copy-icon [icon]="faEnvelope" title [value]="socialEvent?.contactEmail"
                                     [elementName]="'email address for '+ socialEvent?.displayName "/>
                      <div content>
                        <a [href]="'mailto' + socialEvent?.contactEmail"
                           tooltip="Click to email {{socialEvent?.displayName}} at {{socialEvent?.contactEmail}}">
                          {{ socialEvent?.displayName }}
                        </a>
                      </div>
                    </div>
                  }
                  @if (socialEvent?.contactPhone) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12"
                    >
                      <app-copy-icon [icon]="faPhone" title [value]="socialEvent?.contactPhone"
                                     [elementName]="'phone number for '+ socialEvent?.displayName "/>
                      <div content>
                        <a [href]="'tel:' + socialEvent?.contactPhone"
                           tooltip="Click to ring {{socialEvent?.displayName}} on {{socialEvent?.contactPhone}}">
                          {{ socialEvent?.contactPhone }}
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
    imports: [NgClass, MarkdownComponent, RelatedLinkComponent, CopyIconComponent, TooltipDirective, FontAwesomeModule, RouterLink, DisplayDayPipe, EventTimesPipe]
})
export class SocialViewComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialViewComponent", NgxLoggerLevel.ERROR);
  protected pageService = inject(PageService);
  googleMapsService = inject(GoogleMapsService);
  private notifierService = inject(NotifierService);
  display = inject(SocialDisplayService);
  urlService = inject(UrlService);
  private systemConfigService = inject(SystemConfigService);
  private socialEventsService = inject(SocialEventsService);
  @Input()
  public socialEvent: SocialEvent;
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  faEnvelope = faEnvelope;
  faPhone = faPhone;
  faMapMarkerAlt = faMapMarkerAlt;
  faHouse = faHouse;
  faFile = faFile;

  ngOnInit() {
    this.logger.info("ngOnInit:socialEvent:", this.socialEvent);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.systemConfigService.events().subscribe(item => {
      if (this.socialEvent) {
        this.logger.info("socialEvent from input:", this.socialEvent);
        this.notifySocialEventDisplayed()
      } else if (this.urlService.pathContainsEventId()) {
        const socialEventId = this.urlService.lastPathSegment();
        this.logger.info("finding socialEvent from socialEventId:", socialEventId);
        this.socialEventsService.queryForId(socialEventId).then(data => {
          this.socialEvent = data;
          this.logger.info("found social event:", data);
          this.notifySocialEventDisplayed()
        });
      } else if (this.display.inNewEventMode()) {
        this.editSocialEvent();
      }
    });
  }

  notifySocialEventDisplayed(){
    this.notify.success({
      title: "Single social event showing",
      message: " - "
    });
  }

  editSocialEvent() {
    if (this.display.inNewEventMode()) {
      this.logger.info("creating new social event");
    } else {
      this.logger.info("editing existing social event");
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
