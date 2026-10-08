import { WalkDisplayService } from "../../walks/walk-display.service";
import { Component, inject, Input, OnInit, ViewChild } from "@angular/core";
import { NgStyle } from "@angular/common";
import { faFile, faHouse, faImages, faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { PathSegment } from "../../../models/content-text.model";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { GroupEventDisplayService } from "../group-event-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { eventAccessPermitted } from "../../../functions/event-access-level";
import { focalPointImageStyles } from "../../../functions/image-cropper-styles";
import { memberLeadsWalk } from "../../../functions/walks/walk-leader-fields";
import { PageService } from "../../../services/page.service";
import { MarkdownComponent } from "ngx-markdown";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { AddToCalendarLinkComponent } from "../../../modules/common/related-links/add-to-calendar-link";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { faCloudArrowUp, faEnvelope, faShareNodes } from "@fortawesome/free-solid-svg-icons";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import {
  EventSocialPublishModalComponent
} from "../../../modules/common/social-publish/event-social-publish-modal";
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
import { EventLeaderComponent } from "../../walks/walk-view/event-leader";
import { WalkAlbumPanelComponent } from "../../walks/walk-view/walk-album-panel";
import { CreateWalkAlbumService } from "../../../services/walks/create-walk-album.service";
import { eventSlug } from "../../../functions/walks/event-slug";

import { AlbumEditRole, AlbumPanelPresentation } from "../../../models/content-metadata.model";
import { StoredValue } from "../../../models/ui-actions";

@Component({
  selector: "app-group-event-view",
  template: `
    <app-event-social-publish-modal #socialPublish/>
    <div class="card mb-3">
      <div class="wrapper w-100 position-relative overflow-hidden">
        @if (eventAlbumPath) {
          <app-walk-album-panel class="event-album-hero"
                                [presentation]="AlbumPanelPresentation.HERO"
                                eventNoun="event"
                                [albumPath]="eventAlbumPath"
                                [albumName]="eventAlbumName"
                                [coverImageUrl]="eventAlbumCoverUrl || image?.url"/>
        } @else {
          <img class="h-100 w-100 position-absolute" (error)="imageError($event)" (load)="imageLoad($event)"
               role="presentation" src="{{image.url}}"
               [ngStyle]="heroImageStyles()"
               alt="{{image.alt}}"/>
        }
      </div>
      <div class="card-body">
        <div class="position-relative">
          @if (display.allow.edits || showSocialPublishing() || showEmailNotification()) {
            <div class="float-end d-flex gap-2">
              @if (showAlbumAction()) {
                <button type="button" (click)="createPhotoAlbum()" [disabled]="creatingAlbum"
                        [tooltip]="albumActionTooltip()"
                        class="btn btn-quiet">
                  <fa-icon [icon]="faImages" class="me-2"/>{{ albumActionCaption() }}
                </button>
              }
              @if (showSocialPublishing() || showEmailNotification()) {
                <div class="btn-group" dropdown container="body">
                  <button type="button" dropdownToggle class="btn btn-primary dropdown-toggle"
                          [disabled]="notifyTarget.busy" aria-label="Publish this event">
                    <fa-icon [icon]="faCloudArrowUp" class="me-2"/>Publish
                  </button>
                  <ul *dropdownMenu class="dropdown-menu">
                    @if (showSocialPublishing()) {
                      <li>
                        <a class="dropdown-item" role="button" (click)="openSocialPublish()"
                           tooltip="Preview and post this event to Facebook or Instagram"
                           placement="left" container="body">
                          <fa-icon [icon]="faShareNodes" class="me-2"/>Share on social media
                        </a>
                      </li>
                    }
                    @if (showEmailNotification()) {
                      <li>
                        <a class="dropdown-item" role="button" (click)="display.sendNotification(groupEvent)"
                           tooltip="Email members about this event"
                           placement="left" container="body">
                          <fa-icon [icon]="faEnvelope" class="me-2"/>Email members about this event
                        </a>
                      </li>
                    }
                  </ul>
                </div>
              }
              @if (display.allow.edits) {
                <input type="submit" value="edit"
                       (click)="editGroupEvent()" [disabled]="notifyTarget.busy"
                       tooltip="Edit event" class="btn btn-primary">
              }
            </div>
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
              @if (display.showSocialRelatedLinks()) {
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
                      [href]="walkDisplay.postcodeLink(groupEvent?.groupEvent?.location?.postcode)">{{ groupEvent?.groupEvent?.location?.postcode }}</a>
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
                <app-add-to-calendar-link [event]="groupEvent"
                                          [eventUrl]="display.groupEventLink(groupEvent, false)"
                                          [mediaWidth]="display.relatedLinksMediaWidth"/>
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
              }
            </div>
            <div class="col-sm-6">
              <app-event-leader [groupEvent]="groupEvent"/>
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
                <a [href]="backToListHref()" type="button"
                   class="rams-text-decoration-pink"
                   (click)="backToList($event)">Back to {{ display.groupEventListTitle(groupEvent) }}</a>
              </div>
            }
          </div>
        }
      </div>
    </div>`,
  styleUrls: ["group-event-view.sass"],
  imports: [MarkdownComponent, RelatedLinkComponent, CopyIconComponent, TooltipDirective, FontAwesomeModule, RouterLink, EventDatesAndTimesPipe, BookingFormComponent, EventLeaderComponent, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, EventSocialPublishModalComponent, AddToCalendarLinkComponent, WalkAlbumPanelComponent, NgStyle]
})
export class GroupEventView implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventView", NgxLoggerLevel.ERROR);
  protected pageService = inject(PageService);
  googleMapsService = inject(GoogleMapsService);
  private notifierService = inject(NotifierService);
  display = inject(GroupEventDisplayService);
  walkDisplay = inject(WalkDisplayService);
  linksService = inject(LinksService);
  urlService = inject(UrlService);
  private systemConfigService = inject(SystemConfigService);
  private memberLoginService = inject(MemberLoginService);
  @ViewChild("socialPublish") private socialPublish: EventSocialPublishModalComponent;
  protected readonly faShareNodes = faShareNodes;
  protected readonly faCloudArrowUp = faCloudArrowUp;
  protected readonly faEnvelope = faEnvelope;
  private walksAndEventsService = inject(WalksAndEventsService);
  private createWalkAlbumService = inject(CreateWalkAlbumService);

  protected mediaQueryService = inject(MediaQueryService);
  protected readonly faImages = faImages;
  protected readonly AlbumPanelPresentation = AlbumPanelPresentation;
  protected eventAlbumPath: string | null = null;
  protected eventAlbumName: string | null = null;
  protected eventAlbumCoverUrl: string | null = null;
  protected eventAlbumDraftCount = 0;
  protected albumRole: AlbumEditRole | null = null;
  protected creatingAlbum = false;
  @Input()
  public groupEvent: ExtendedGroupEvent;
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  faMapMarkerAlt = faMapMarkerAlt;
  faHouse = faHouse;
  faFile = faFile;
  public links: Links = null;
  public image: BasicMedia;

  backToListHref(): string {
    return this.urlService.pageUrl(this.urlService.listPath(eventSlug(this.groupEvent)));
  }

  backToList($event: Event): void {
    $event.preventDefault();
    this.urlService.backToRememberedList(this.urlService.listPath(eventSlug(this.groupEvent)));
  }

  ngOnInit() {
    this.logger.info("ngOnInit:groupEvent:", this.groupEvent);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.image = this.mediaQueryService.imageSourceWithFallback(this.groupEvent);
    this.systemConfigService.events().subscribe(async item => {
      if (this.groupEvent) {
        this.logger.info("groupEvent from input:", this.groupEvent);
        this.notifyGroupEventDisplayed();
        this.resolveEventAlbum(this.groupEvent);
      } else if (this.urlService.pathContainsEventIdOrSlug()) {
        const groupEventId = this.urlService.lastPathSegment();
        this.logger.info("finding groupEvent from groupEventId:", groupEventId);
        const data: ExtendedGroupEvent = await this.walksAndEventsService.queryById(groupEventId);
        this.groupEvent = data;
        this.image = this.mediaQueryService.imageSourceWithFallback(this.groupEvent);
        this.logger.info("found group event:", data);
        this.notifyGroupEventDisplayed();
        this.resolveEventAlbum(this.groupEvent);
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

  heroImageStyles(): Record<string, string> {
    return focalPointImageStyles(this.groupEvent?.groupEvent?.media?.[0]?.focalPoint);
  }

  imageError(event: ErrorEvent) {
    this.logger.error("imageError:", event);
    this.image = FALLBACK_MEDIA;
  }

  imageLoad($event: Event) {
    this.logger.info("imageLoad:", $event);
  }

  showEmailNotification(): boolean {
    return !!this.groupEvent?.id && this.memberLoginService.allowSocialAdminEdits();
  }

  showSocialPublishing(): boolean {
    const systemConfig = this.systemConfigService.systemConfig();
    const externalSystems = systemConfig?.externalSystems;
    const publishingEnabled = !!externalSystems?.facebook?.eventPublishingEnabled || !!externalSystems?.instagram?.eventPublishingEnabled;
    const loggedIn = this.memberLoginService.memberLoggedIn();
    return publishingEnabled && eventAccessPermitted(systemConfig?.group?.socialPromotionAccessLevel, {
      loggedIn,
      committee: loggedIn && this.memberLoginService.allowCommittee(),
      memberAdmin: loggedIn && this.memberLoginService.allowMemberAdminEdits(),
      eventAdmin: loggedIn && this.memberLoginService.allowSocialAdminEdits(),
      eventLeader: loggedIn && memberLeadsWalk(this.memberLoginService.loggedInMember()?.memberId, this.groupEvent)
    });
  }

  openSocialPublish(): void {
    void this.socialPublish.openFor(this.groupEvent?.id, "event");
  }

  editGroupEvent() {
    this.display.confirm.clear();
    const existingRecordEditEnabled = this.display.allow.edits;
    this.display.allow.copy = existingRecordEditEnabled;
    this.display.allow.delete = existingRecordEditEnabled;
    if (this?.groupEvent?.id) {
      const eventPath = this.display.groupEventLink(this.groupEvent, true);
      this.logger.info("editing existing event:", this.groupEvent.id, "eventPath:", eventPath);
      this.urlService.navigateUnconditionallyTo([eventPath, PathSegment.EDIT]);
    } else {
      this.logger.info("creating new event");
      this.urlService.navigateUnconditionallyTo([this.urlService.area(), PathSegment.NEW]);
    }
  }

  showSensitiveDetailsAlert() {
    return false;
  }

  showAlbumAction(): boolean {
    return this.createWalkAlbumService.showAlbumAction(this.groupEvent, this.eventAlbumPath, this.walkDisplay.eventHasStarted(this.groupEvent));
  }

  albumActionCaption(): string {
    return this.createWalkAlbumService.albumActionCaption(this.creatingAlbum, this.albumRole, this.eventAlbumPath, this.eventAlbumDraftCount);
  }

  albumActionTooltip(): string {
    return this.createWalkAlbumService.albumActionTooltip(this.albumRole, this.eventAlbumPath, this.eventAlbumDraftCount, this.groupEvent);
  }

  async createPhotoAlbum() {
    if (!this.showAlbumAction()) {
      this.logger.info("createPhotoAlbum: not available for this member or event");
    } else if (this.eventAlbumPath) {
      await this.openAlbumWorkflow(this.eventAlbumPath);
    } else {
      this.creatingAlbum = true;
      this.notify.progress({title: "Photo album", message: "Creating the album page and writing the event report"});
      try {
        const albumPath = await this.createWalkAlbumService.createFromWalk(this.groupEvent);
        this.eventAlbumPath = albumPath;
        this.resolveEventAlbum(this.groupEvent);
        await this.openAlbumWorkflow(albumPath);
        this.creatingAlbum = false;
      } catch (error) {
        this.notify.error({title: "Could not create the photo album", message: error});
        this.creatingAlbum = false;
      }
    }
  }

  private async openAlbumWorkflow(albumPath: string): Promise<void> {
    if (albumPath) {
      const currentSegments = this.urlService.pathSegments().filter(Boolean);
      if (currentSegments.length > 0) {
        this.createWalkAlbumService.rememberReturnToWalk(currentSegments);
      }
      if (this.albumRole === AlbumEditRole.CURATOR) {
        this.createWalkAlbumService.markAlbumForAutoCover(this.eventAlbumName || albumPath);
      }
      await this.urlService.navigateUnconditionallyTo(
        albumPath.split("/").filter(Boolean),
        {[StoredValue.ALBUM_WORKFLOW]: "1"},
        ""
      );
    } else {
      this.logger.info("openAlbumWorkflow: no album path");
    }
  }

  private resolveEventAlbum(event: ExtendedGroupEvent) {
    this.eventAlbumPath = null;
    this.eventAlbumName = null;
    this.eventAlbumCoverUrl = null;
    this.eventAlbumDraftCount = 0;
    this.albumRole = this.createWalkAlbumService.albumEditRoleForWalk(event);
    if (event) {
      this.createWalkAlbumService.existingAlbumLinkFor(event)
        .then(link => {
          if (this.groupEvent?.id === event.id || this.groupEvent === event) {
            this.eventAlbumPath = link?.path || null;
            this.eventAlbumName = link?.albumName || link?.path || null;
            this.eventAlbumCoverUrl = link?.coverImageUrl || null;
            this.eventAlbumDraftCount = link?.draftCount || 0;
          }
        })
        .catch(error => this.logger.warn("resolveEventAlbum failed", error));
    }
  }

}
