import { Component, ElementRef, HostListener, inject, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { values } from "es-toolkit/compat";
import { ActivatedRoute, ParamMap, RouterLink } from "@angular/router";
import { SafeResourceUrl } from "@angular/platform-browser";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { ALERT_WARNING, AlertTarget } from "../../../models/alert-target.model";
import { LoginResponse } from "../../../models/member.model";
import { StoredValue } from "../../../models/ui-actions";
import { DisplayedWalk, EventType, MapDisplay, WalkExportTab } from "../../../models/walk.model";
import { WalkStatus } from "../../../models/ramblers-walks-manager";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MeetupService } from "../../../services/meetup.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { UrlService } from "../../../services/url.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { SystemConfig } from "../../../models/system.model";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MarkdownComponent } from "ngx-markdown";
import { EventLeaderComponent } from "./event-leader";
import { WalkFeaturesComponent } from "./walk-features";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCloudArrowUp,
  faCompress,
  faExpand,
  faEye,
  faImages,
  faMaximize,
  faPencil,
  faPersonWalking
} from "@fortawesome/free-solid-svg-icons";
import { CreateWalkAlbumService } from "../../../services/walks/create-walk-album.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { GroupEventImages } from "./group-event-images";
import { MapEditComponent } from "../walk-edit/map-edit";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { WalkDetailsMapProvider } from "../../../models/walks-config.model";
import { FormsModule } from "@angular/forms";
import { WalkDetailsComponent } from "./walk-details";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";
import { RelatedLinksPanelComponent } from "../../../modules/common/related-links/related-links-panel";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { DisplayTimePipe } from "../../../pipes/display-time.pipe";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { PageService } from "../../../services/page.service";
import { BookingFormComponent } from "../../admin/bookings/booking-form.component";
import { NormaliseMarkdownPipe } from "../../../pipes/normalise-markdown.pipe";
import { WalkAlbumPanelComponent } from "./walk-album-panel";

@Component({
  selector: "app-walk-view",
  template: `
    @if (displayedWalk) {
      <div class="event-thumbnail card shadow tabset-container">
        @if (showPanelExpander) {
          <app-walk-panel-expander [walk]="displayedWalk.walk" [expandable]="allowWalkAdminEdits"
                                   (collapsed)="navigateToArea()"
                                   collapsable [collapseAction]="'collapse'"/>
        }
        <div class="walk-view-top" [class.map-expanded]="mapExpanded">
          <div class="walk-view-copy" [class.d-none]="mapExpanded">
            @if (displayedWalk?.walk?.groupEvent?.title) {
              <h1 id="{{displayedWalk?.walk?.id}}-title">
                {{ displayedWalk.walk?.groupEvent?.title }}</h1>
            }
            @if (displayedWalk?.walk?.groupEvent?.status === WalkStatus.CANCELLED) {
              <div class="alert alert-warning mb-3">
                <strong>This walk has been cancelled</strong>
                @if (displayedWalk?.walk?.groupEvent?.cancellation_reason) {
                  <p class="mb-0 mt-1">{{ displayedWalk.walk?.groupEvent?.cancellation_reason }}</p>
                }
              </div>
            }
            <h2
              id="{{displayedWalk?.walk?.id}}-walkDate">{{ displayedWalk.walk?.groupEvent?.start_date_time | displayDay }}
              @if (display.walkPopulationLocal() && displayedWalk?.status !== EventType.APPROVED) {
                <div id="{{displayedWalk?.walk?.id}}-status"
                     class="badge event-badge sunset-badge">{{ displayedWalk?.latestEventType?.description }}
                </div>
              }
              <div id="{{displayedWalk?.walk?.id}}-durationInFuture"
                   class="badge event-badge blue-badge">{{ durationInFutureFor(displayedWalk?.walk) }}
              </div>
              @if (display.isNextWalk(displayedWalk?.walk)) {
                <div
                  class="badge event-badge next-event-badge"> Our next walk
                </div>
              }
            </h2>
            @if (displayedWalk?.walk?.groupEvent?.start_date_time) {
              <h2>Start
                Time: {{ displayedWalk?.walk?.groupEvent?.start_date_time | displayTime }}{{ EM_DASH_WITH_SPACES }}
                Estimated Finish Time: {{ displayedWalk?.walk?.groupEvent?.end_date_time | displayTime }}</h2>
            }
            <div class="event-description">
              @if (displayedWalk?.walk?.groupEvent?.description) {
                <p class="list-arrow" markdown [data]="displayedWalk?.walk?.groupEvent?.description | normaliseMarkdown"></p>
              }
            </div>
          </div>
          <div class="walk-view-media">
            @if (!display.displayMap(displayedWalk?.walk) || displayedWalk?.walk?.groupEvent?.media?.length > 0) {
              <app-group-event-images [extendedGroupEvent]="displayedWalk?.walk"/>
            }
            @if (display.displayMap(displayedWalk?.walk)) {
              <div class="walk-view-map" [class.position-relative]="!mapFullScreen" [class.map-full-screen-container]="mapFullScreen">
                @if (mapFullScreen) {
                  <div class="map-full-screen-bar">
                    <div class="map-full-screen-bar-text">
                      <div class="map-full-screen-bar-title">{{ displayedWalk?.walk?.groupEvent?.title || "Walk" }} map</div>
                      <div class="map-full-screen-bar-hint">Press Escape to leave full screen</div>
                    </div>
                    <button type="button" class="btn btn-primary btn-sm map-full-screen-exit"
                            (click)="exitMapFullScreen()"
                            aria-label="Exit full screen map">
                      <fa-icon [icon]="faCompress" class="me-1"/>
                      Exit full screen
                    </button>
                  </div>
                } @else {
                  <div class="map-expand-controls">
                    @if (mapExpanded) {
                      <button type="button" class="btn btn-sm btn-light map-expand-btn"
                              (click)="restoreMapSize()"
                              tooltip="Restore map"
                              placement="left"
                              aria-label="Restore map">
                        <fa-icon [icon]="faCompress"></fa-icon>
                      </button>
                    }
                    <button type="button" class="btn btn-sm btn-light map-expand-btn"
                            (click)="cycleMapSize()"
                            [tooltip]="mapExpanded ? 'Full screen' : 'Expand map'"
                            placement="left"
                            [attr.aria-label]="mapExpanded ? 'Full screen map' : 'Expand map'">
                      <fa-icon [icon]="mapExpanded ? faMaximize : faExpand"></fa-icon>
                    </button>
                  </div>
                }
                @if (display.mapViewReady(googleMapsUrl) && showGoogleMapsView) {
                  <iframe allowfullscreen [class.map-walk-view-expanded]="mapExpanded && !mapFullScreen"
                          class="map-walk-view map-walk-view-google"
                          [style.height.px]="!mapExpanded && !mapFullScreen ? walkDetailsMapHeight : null"
                          style="border:0;"
                          [src]="googleMapsUrl"></iframe>
                }
                @if (!showGoogleMapsView) {
                  <div app-map-edit [class.map-walk-view-expanded]="mapExpanded && !mapFullScreen"
                       class="map-walk-view" readonly
                       [style.height.px]="!mapExpanded && !mapFullScreen ? walkDetailsMapHeight : null"
                       [locationDetails]="mapDisplay==MapDisplay.SHOW_END_POINT? displayedWalk?.walk?.groupEvent?.end_location:displayedWalk?.walk?.groupEvent?.start_location"
                       [showCombinedMap]="mapDisplay==MapDisplay.SHOW_START_AND_END_POINT"
                       [endLocationDetails]="displayedWalk?.walk?.groupEvent?.end_location"
                       [walkStatus]="displayedWalk?.walk?.groupEvent?.status"
                       [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
                       [notify]="notify"></div>
                }
                @if (mapFullScreen) {
                  <ng-container *ngTemplateOutlet="mapDisplayControls"/>
                }
              </div>
              @if (!mapFullScreen) {
                <ng-container *ngTemplateOutlet="mapDisplayControls"/>
              }
              <ng-template #mapDisplayControls>
                <form class="rounded img-thumbnail map-radio-frame d-flex flex-wrap align-items-center justify-content-start">
                  <div class="ms-2 me-2 d-flex align-items-center flex-wrap">
                    <span class="me-2 fw-bold">Show Map As</span>
                    <div class="form-check form-check-inline ms-2">
                      <input class="form-check-input" type="radio" [name]="'mapView-' + index"
                             [(ngModel)]="showGoogleMapsView" [ngModelOptions]="{standalone: true}"
                             id="{{index}}-pin-view-mode-start"
                             [value]="false" (ngModelChange)="mapProviderChanged()">
                      <label class="form-check-label" for="{{index}}-pin-view-mode-start">
                        {{ mapViewLabel }}</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="radio" [name]="'mapView-' + index"
                             [(ngModel)]="showGoogleMapsView" [ngModelOptions]="{standalone: true}"
                             id="{{index}}-google-maps-mode-start"
                             [value]="true" (ngModelChange)="mapProviderChanged()">
                      <label class="form-check-label" for="{{index}}-google-maps-mode-start">
                        Google Maps</label>
                    </div>
                  </div>
                  <div class="ms-2 me-2 d-flex align-items-center flex-wrap" [class.mt-2]="mapControlsStacked" [class.w-100]="mapControlsStacked">
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" id="{{index}}-show-start-point"
                             type="radio"
                             [ngModel]="mapDisplay" [ngModelOptions]="{standalone: true}" [name]="'mapDisplay-' + index"
                             (ngModelChange)="changeMapView($event)"
                             [value]="MapDisplay.SHOW_START_POINT"/>
                      <label class="form-check-label text-nowrap" for="{{index}}-show-start-point">
                        Start {{ displayedWalk?.walk?.groupEvent?.start_location?.postcode }}</label>
                    </div>
                    @if (displayedWalk?.walk?.groupEvent?.end_location?.postcode) {
                      <div class="form-check form-check-inline">
                        <input class="form-check-input" id="{{index}}-show-end-point"
                               type="radio"
                               [ngModel]="mapDisplay" [ngModelOptions]="{standalone: true}" [name]="'mapDisplay-' + index"
                               (ngModelChange)="changeMapView($event)"
                               [value]="MapDisplay.SHOW_END_POINT"/>
                        <label class="form-check-label text-nowrap" for="{{index}}-show-end-point">
                          Finish {{ displayedWalk?.walk?.groupEvent?.end_location?.postcode }}</label>
                      </div>
                      @if (!showGoogleMapsView) {
                        <div class="form-check form-check-inline">
                          <input class="form-check-input" id="{{index}}-show-start-and-end-point"
                                 type="radio"
                                 [ngModel]="mapDisplay" [ngModelOptions]="{standalone: true}" [name]="'mapDisplay-' + index"
                                 (ngModelChange)="changeMapView($event)"
                                 [value]="MapDisplay.SHOW_START_AND_END_POINT"/>
                          <label class="form-check-label text-nowrap" for="{{index}}-show-start-and-end-point">
                            Both</label>
                        </div>
                      }
                    }
                  </div>
                  @if (showGoogleMapsView) {
                    <div class="ms-2 me-2" [class.w-100]="mapControlsStacked" [class.mt-2]="mapControlsStacked">
                      <div class="form-check">
                        <div class="d-flex align-items-center flex-wrap">
                          <input id="{{index}}-show-driving-directions"
                                 type="radio"
                                 class="form-check-input align-middle"
                                 (ngModelChange)="changeMapView($event)"
                                 [ngModel]="mapDisplay" [ngModelOptions]="{standalone: true}" [name]="'mapDisplay-' + index"
                                 [value]="MapDisplay.SHOW_DRIVING_DIRECTIONS"/>
                          <label class="form-check-label text-nowrap align-middle ms-2"
                                 for="{{index}}-show-driving-directions">
                            Driving from</label>
                          <input class="form-control input-sm text-uppercase ms-2 postcode-input align-middle"
                                 [ngModel]="fromPostcode" name="fromPostcode"
                                 (ngModelChange)="changeFromPostcode($event)"
                                 type="text" #fromPostcodeInput>
                        </div>
                      </div>
                    </div>
                  }
                </form>
              </ng-template>
            }
          </div>
        </div>
        <div class="walk-meta-grid" [class.has-album]="!!walkAlbumPath" [class.d-none]="mapExpanded">
          @if (walkAlbumPath) {
            <div class="walk-meta-top-left">
              @if (display.hasWalkLeader(displayedWalk.walk)) {
                <app-event-leader [displayedWalk]="displayedWalk"/>
              }
              @if (displayedWalk?.hasFeatures) {
                <app-walk-features [extendedGroupEvent]="displayedWalk?.walk"/>
              }
            </div>
            <app-walk-details class="walk-meta-details" [displayedWalk]="displayedWalk"/>
            @if (displayLinks && display.showWalkRelatedLinks()) {
              <app-related-links-panel class="walk-meta-related" [displayedWalk]="displayedWalk"/>
            } @else {
              <div class="walk-meta-related"></div>
            }
            <app-walk-album-panel class="walk-meta-album"
                                 [albumPath]="walkAlbumPath"
                                 [albumName]="walkAlbumName"
                                 [coverImageUrl]="walkAlbumCoverUrl"/>
          } @else {
            <div class="walk-meta-left">
              @if (display.hasWalkLeader(displayedWalk.walk)) {
                <app-event-leader [displayedWalk]="displayedWalk"/>
              }
              @if (displayedWalk?.hasFeatures) {
                <app-walk-features [extendedGroupEvent]="displayedWalk?.walk"/>
              }
              @if (displayLinks && display.showWalkRelatedLinks()) {
                <app-related-links-panel [displayedWalk]="displayedWalk"/>
              }
            </div>
            <app-walk-details class="walk-meta-details" [displayedWalk]="displayedWalk"/>
          }
        </div>
        <div class="walk-meta-footer" [class.d-none]="mapExpanded">
          @if (showWalkViewActions() || showWalkViewStatusAlert() || showWalkStatusWarning()) {
            <div class="walk-view-footer">
              @if (showWalkViewActions()) {
                <div class="walk-view-actions-row" role="toolbar" aria-label="Walk actions">
                  @if (showAlbumAction()) {
                    <button type="button" (click)="createPhotoAlbum()" [disabled]="creatingAlbum"
                            [tooltip]="albumActionTooltip()"
                            class="btn btn-quiet btn-sm walk-view-action">
                      <fa-icon [icon]="faImages"/>
                      <span>{{ creatingAlbum ? "Creating…" : (walkAlbumPath ? "Edit album" : "Create album") }}</span>
                    </button>
                  }
                  @if (showPublishToRamblers) {
                    @if (publishBlockedUntilApproved()) {
                      <span class="walk-view-action-disabled-wrap" [tooltip]="publishBlockedTooltip" container="body">
                        <button type="button" disabled
                                class="btn btn-primary btn-sm walk-view-action">
                          <fa-icon [icon]="faCloudArrowUp"/>
                          <span>Publish</span>
                        </button>
                      </span>
                    } @else {
                      <a [routerLink]="publishExportLink"
                         [queryParams]="publishExportQueryParams"
                         [tooltip]="publishTooltip"
                         class="btn btn-primary btn-sm walk-view-action">
                        <fa-icon [icon]="faCloudArrowUp"/>
                        <span>Publish</span>
                      </a>
                    }
                  }
                  @if (displayedWalk?.walkAccessMode?.walkWritable) {
                    <button type="button"
                            (click)="display.edit(displayedWalk)"
                            [tooltip]="displayedWalk?.walkAccessMode?.caption + ' this walk'"
                            class="btn btn-primary btn-sm walk-view-action">
                      <fa-icon [icon]="walkActionIcon()"/>
                      <span>{{ displayedWalk?.walkAccessMode?.caption }}</span>
                    </button>
                  } @else if (allowWalkAdminEdits) {
                    <a [routerLink]="display.walkViewLink(displayedWalk?.walk)"
                       tooltip="View this walk"
                       class="btn btn-quiet btn-sm walk-view-action">
                      <fa-icon [icon]="faEye"/>
                      <span>View</span>
                    </a>
                  }
                  @if (showWalkViewStatusAlert()) {
                    <div class="alert {{notifyTarget.alertClass}} walk-view-status-alert walk-view-status-alert-inline">
                      <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                      @if (notifyTarget.alertTitle) {
                        <strong>{{ notifyTarget.alertTitle }}</strong>
                      }
                      <span>{{ notifyTarget.alertMessage }}{{ EM_DASH_WITH_SPACES }}</span>
                      <a [routerLink]="'/' + display.walksArea()" type="button"
                         class="rams-text-decoration-pink">Back to {{ pageService.areaTitle() }}</a>
                    </div>
                  } @else if (showWalkStatusWarning()) {
                    <ng-container [ngTemplateOutlet]="walkStatusWarning" [ngTemplateOutletContext]="{inline: true}"/>
                  }
                </div>
              }
              @if (showWalkStatusWarning() && (showWalkViewStatusAlert() || !showWalkViewActions())) {
                <ng-container [ngTemplateOutlet]="walkStatusWarning" [ngTemplateOutletContext]="{inline: false}"/>
              }
            </div>
          }
          <ng-template #walkStatusWarning let-inline="inline">
            <div class="alert {{ALERT_WARNING.class}} walk-view-status-alert" [class.walk-view-status-alert-inline]="inline">
              <fa-icon [icon]="ALERT_WARNING.icon"></fa-icon>
              <strong>Walk Status</strong>
              <span>This walk is not approved by {{ display.walksCoordinatorName() }}</span>
            </div>
          </ng-template>
          <div class="walk-booking-form">
            <app-booking-form [extendedGroupEvent]="displayedWalk?.walk" [eventLink]="displayedWalk?.walkLink"></app-booking-form>
          </div>
        </div>
      </div>
    } @else if (notifyTarget.showAlert) {
      <div class="alert {{notifyTarget.alertClass}} table-pointer mt-3">
        <fa-icon [icon]="notifyTarget.alert.icon"/>
        <strong class="ms-1">{{ notifyTarget.alertTitle }}</strong>
        <span class="p-2">{{ notify.alertTarget.alertMessage }}. <a [href]="area"
                                                                    class="rams-text-decoration-pink"
                                                                    type="button"> Go Back to {{ area }}
          page</a></span>
      </div>
    }`,
  styleUrls: ["./walk-view.sass"],
  imports: [WalkPanelExpanderComponent, TooltipDirective, MarkdownComponent, EventLeaderComponent, WalkFeaturesComponent, FontAwesomeModule, RouterLink, GroupEventImages, MapEditComponent, FormsModule, WalkDetailsComponent, DisplayDayPipe, RelatedLinksPanelComponent, DisplayTimePipe, BookingFormComponent, NormaliseMarkdownPipe, WalkAlbumPanelComponent, NgTemplateOutlet]
})

export class WalkViewComponent implements OnInit, OnDestroy {
  private logger = inject(LoggerFactory).createLogger("WalkViewComponent", NgxLoggerLevel.ERROR);
  public walkInjected = false;
  public walkIdOrPath: string;
  public displayedWalk: DisplayedWalk;
  public displayLinks: boolean;
  public fromPostcode = "";
  public mapDisplay: MapDisplay = MapDisplay.SHOW_START_POINT;
  public allowWalkAdminEdits: boolean;
  public googleMapsUrl: SafeResourceUrl;
  public loggedIn: boolean;
  private subscriptions: Subscription[] = [];
  public notifyTarget: AlertTarget = {};
  protected readonly ALERT_WARNING = ALERT_WARNING;
  protected pageService = inject(PageService);
  public extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private walksAndEventsService = inject(WalksAndEventsService);
  public googleMapsService = inject(GoogleMapsService);
  private authService = inject(AuthService);
  private memberLoginService = inject(MemberLoginService);
  public display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  public meetupService = inject(MeetupService);
  protected urlService = inject(UrlService);
  protected stringUtils = inject(StringUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private walksConfigService = inject(WalksConfigService);
  private notifierService = inject(NotifierService);
  private createWalkAlbumService = inject(CreateWalkAlbumService);
  private siteEditService = inject(SiteEditService);
  protected creatingAlbum = false;
  protected walkAlbumPath: string | null = null;
  protected walkAlbumName: string | null = null;
  protected walkAlbumCoverUrl: string | null = null;
  private mapTiles = inject(MapTilesService);
  private uiActions = inject(UiActionsService);
  private route = inject(ActivatedRoute);
  protected notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  public area = this.urlService.area();
  public showGoogleMapsView = false;
  public suppressMapToggle = false;
  protected walkDetailsMapHeight = 380;
  protected mapFullScreen = false;
  private readonly mapSizeCycle = [
    {expanded: false, fullScreen: false},
    {expanded: true, fullScreen: false},
    {expanded: false, fullScreen: true}
  ];
  private mapProviderTouched = false;
  protected readonly MapDisplay = MapDisplay;
  protected readonly EventType = EventType;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;
  protected readonly WalkStatus = WalkStatus;
  protected readonly faCompress = faCompress;
  protected readonly faExpand = faExpand;
  protected readonly faMaximize = faMaximize;
  protected readonly faEye = faEye;
  protected readonly faImages = faImages;
  protected readonly faCloudArrowUp = faCloudArrowUp;
  protected readonly faPencil = faPencil;
  protected readonly faPersonWalking = faPersonWalking;
  public showPublishToRamblers = false;
  public publishTooltip = "Open Walks export to publish changes to Ramblers";
  public publishExportLink: string[] = [];
  public publishExportQueryParams = {tab: WalkExportTab.WALK_UPLOAD_SELECTION};
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);

  walkActionIcon() {
    return this.displayedWalk?.walkAccessMode?.caption === "lead" ? this.faPersonWalking : this.faPencil;
  }

  showWalkViewActions(): boolean {
    return !!(this.allowWalkAdminEdits || this.displayedWalk?.walkAccessMode?.walkWritable || this.showPublishToRamblers);
  }

  showWalkViewStatusAlert(): boolean {
    return this.urlService.pathContainsEventIdOrSlug() && !!this.notifyTarget.showAlert;
  }

  showWalkStatusWarning(): boolean {
    return this.display.walkLeaderOrAdmin(this.displayedWalk?.walk)
      && this.display.walkPopulationLocal()
      && !this.extendedGroupEventQueryService.approvedWalk(this.displayedWalk?.walk)
      && !!this.notifyTarget.showAlert;
  }

  public readonly publishBlockedTooltip = "Cannot be published until it's approved.";

  publishBlockedUntilApproved(): boolean {
    return this.display.walkPopulationLocal()
      && !this.extendedGroupEventQueryService.approvedWalk(this.displayedWalk?.walk);
  }

  private refreshPublishAction(walk: ExtendedGroupEvent) {
    this.publishExportLink = ["/" + this.display.walksArea(), "admin", "export"];
    this.showPublishToRamblers = !!this.allowWalkAdminEdits
      && !!walk
      && !this.eventHasStarted(walk)
      && this.ramblersWalksAndEventsService.needsRamblersPublish(walk);
    this.publishTooltip = this.showPublishToRamblers
      ? this.ramblersWalksAndEventsService.ramblersPublishTooltip(walk)
      : "Open Walks export to publish changes to Ramblers";
  }

  showAlbumAction(): boolean {
    return this.allowWalkAdminEdits
      && this.memberLoginService.allowContentEdits()
      && this.eventHasStarted();
  }

  eventHasStarted(walk: ExtendedGroupEvent = this.displayedWalk?.walk): boolean {
    const startDate = walk?.groupEvent?.start_date_time;
    return !!startDate && this.dateUtils.asValue(startDate) < this.dateUtils.nowAsValue();
  }

  albumActionTooltip(): string {
    if (this.walkAlbumPath) {
      return "Open the walk report and photo upload for this album";
    }
    return "Create a photo album for this walk, then edit the walk report and upload photos";
  }

  async createPhotoAlbum() {
    if (!this.showAlbumAction() || !this.eventHasStarted()) {
      return;
    }
    if (this.walkAlbumPath) {
      await this.openAlbumPageInSiteEdit(this.walkAlbumPath);
      return;
    }
    this.creatingAlbum = true;
    this.notify.progress({title: "Photo album", message: "Creating the album page and writing the walk report"});
    try {
      const albumPath = await this.createWalkAlbumService.createFromWalk(this.displayedWalk.walk);
      this.walkAlbumPath = albumPath;
      this.resolveWalkAlbumPath(this.displayedWalk.walk);
      await this.openAlbumPageInSiteEdit(albumPath, true);
      this.creatingAlbum = false;
    } catch (error) {
      this.notify.error({title: "Could not create the photo album", message: error});
      this.creatingAlbum = false;
    }
  }

  private async openAlbumPageInSiteEdit(albumPath: string, _openPreAlbumText = false): Promise<void> {
    if (!albumPath) {
      return;
    }
    const currentSegments = this.urlService.pathSegments().filter(Boolean);
    if (currentSegments.length > 0) {
      this.createWalkAlbumService.rememberReturnToWalk(currentSegments);
    }
    this.createWalkAlbumService.markAlbumForAutoCover(this.walkAlbumName || albumPath);
    if (!this.siteEditService.active()) {
      this.siteEditService.toggle(true);
    }
    await this.urlService.navigateUnconditionallyTo(
      albumPath.split("/").filter(Boolean),
      {[StoredValue.ALBUM_WORKFLOW]: "1"},
      ""
    );
  }

  private resolveWalkAlbumPath(walk: ExtendedGroupEvent) {
    this.walkAlbumPath = null;
    this.walkAlbumName = null;
    this.walkAlbumCoverUrl = null;
    if (!walk) {
      return;
    }
    this.createWalkAlbumService.existingAlbumLinkFor(walk)
      .then(link => {
        if (this.displayedWalk?.walk?.id === walk.id || this.displayedWalk?.walk === walk) {
          this.walkAlbumPath = link?.path || null;
          this.walkAlbumName = link?.albumName || link?.path || null;
          this.walkAlbumCoverUrl = link?.coverImageUrl || null;
        }
      })
      .catch(error => this.logger.warn("resolveWalkAlbumPath failed", error));
  }
  public mapExpanded = false;
  @Input() showPanelExpander = true;

  get hasOsApiKey(): boolean {
    return this.mapTiles.hasOsApiKey();
  }

  get mapViewLabel(): string {
    return this.hasOsApiKey ? "OS Maps" : "Pin Location View";
  }
  @ViewChild("fromPostcodeInput") fromPostcodeInput: ElementRef<HTMLInputElement>;
  @ViewChild(MapEditComponent) mapEditComponent: MapEditComponent;
  @Input() index: number;

  @Input("displayedWalk") set init(displayedWalk: DisplayedWalk) {
    this.applyWalk(displayedWalk);
  }

  ngOnInit() {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.allowWalkAdminEdits = this.memberLoginService.allowWalkAdminEdits();
    this.refreshHomePostcode();
    this.display.refreshNextWalkStartDate();
    this.walkIdOrPath = this.urlService.lastPathSegment();
    this.logger.info("initialised with walk", this.displayedWalk, "pathContainsWalkId:", this.urlService.pathContainsEventIdOrSlug(), "walkIdOrPath:", this.walkIdOrPath);
    if (this.systemConfigService.systemConfig()) {
      this.queryIfRequired();
    } else {
      this.logger.info("not querying as systemConfig not yet cached");
    }
    this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
      this.logger.info("systemConfigService returned systemConfig:", systemConfig);
      this.queryIfRequired();
      this.refreshPublishAction(this.displayedWalk?.walk);
    });
    this.subscriptions.push(this.route.queryParamMap.subscribe((paramMap: ParamMap) => {
      this.applyMapSizeFromQuery(paramMap);
      this.applyMapOptionsFromQuery(paramMap);
    }));
    this.subscriptions.push(this.walksConfigService.events().subscribe(walksConfig => {
      this.walkDetailsMapHeight = walksConfig?.walkDetailsMapHeight || 380;
      if (!this.mapProviderTouched) {
        const defaultToGoogleMaps = walksConfig?.walkDetailsMapProvider === WalkDetailsMapProvider.GOOGLE_MAPS;
        if (defaultToGoogleMaps !== this.showGoogleMapsView) {
          this.showGoogleMapsView = defaultToGoogleMaps;
          this.configureMapDisplay();
        }
      }
    }));
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      this.logger.info("loginResponseObservable:", loginResponse);
      this.display.refreshCachedData();
      this.loggedIn = loginResponse?.memberLoggedIn;
      this.allowWalkAdminEdits = this.memberLoginService.allowWalkAdminEdits();
      this.refreshPublishAction(this.displayedWalk?.walk);
      this.refreshHomePostcode();
      this.updateGoogleMapIfApplicable();
    }));
    this.googleMapsService.events().subscribe(config => {
      this.logger.info("event received:", config);
      this.updateGoogleMapIfApplicable();
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  toggleGoogleOrLeafletMapViewAndBack() {
    this.showGoogleMapsView = !this.showGoogleMapsView;
    setTimeout(() => {
      this.showGoogleMapsView = !this.showGoogleMapsView;
    }, 0);
  }

  configureMapDisplay() {
    this.logger.info("configureMapDisplay:showGoogleMapsView:", this.showGoogleMapsView, "mapDisplay initial value:", this.mapDisplay);
    if (!this.showGoogleMapsView && this.mapDisplay === MapDisplay.SHOW_DRIVING_DIRECTIONS) {
      this.mapDisplay = MapDisplay.SHOW_START_POINT;
      this.logger.info("configureMapDisplay:mapDisplay changed to:", this.mapDisplay);
    }
    if (this.showGoogleMapsView && this.validFromPostcodeEntered() && !this.showDrivingDirections()) {
      this.changeMapView(MapDisplay.SHOW_DRIVING_DIRECTIONS);
    } else {
      this.suppressMapToggle = true;
      this.updateGoogleMapIfApplicable();
      if (this.showGoogleMapsView) {
        this.focusFromPostcodeInput();
      }
    }
  }

  async queryIfRequired(): Promise<void> {
    if (this.queryIsRequired()) {
      this.logger.info("Querying Walk:", this.walkIdOrPath);
      const walk: ExtendedGroupEvent = await this.walksAndEventsService.queryById(this.walkIdOrPath);
      if (walk) {
        this.logger.info("Walk found:", walk);
        this.applyWalk(this.display.toDisplayedWalk(walk));
      } else {
        this.logger.warn("Walk not found:", this.walkIdOrPath);
        this.notify.warning({
          title: "Walk not found",
          message: "Content for this walk doesnt exist"
        });
      }
    } else {
      this.logger.info("queryIfRequired:No query required for walkIdOrPath:", this.walkIdOrPath, "displayedWalk:", this.displayedWalk);
    }
  }

  private fullWalkQueriedIds: string[] = [];

  private queryFullWalkIfRequired(displayedWalk: DisplayedWalk) {
    const walkId = displayedWalk?.walk?.id;
    if (walkId && !this.urlService.pathContainsEventIdOrSlug() && !this.fullWalkQueriedIds.includes(walkId)) {
      this.fullWalkQueriedIds = this.fullWalkQueriedIds.concat(walkId);
      this.walksAndEventsService.queryById(walkId)
        .then(fullWalk => {
          if (fullWalk) {
            this.logger.info("queryFullWalkIfRequired: applying full walk for", walkId);
            this.applyWalk(this.display.toDisplayedWalk(fullWalk));
          }
        })
        .catch(error => this.logger.error("queryFullWalkIfRequired failed for", walkId, error));
    }
  }

  private applyWalk(displayedWalk: DisplayedWalk) {
    if (displayedWalk) {
      this.walkInjected = true;
      this.logger.info("applyWalk:", displayedWalk);
      this.displayedWalk = displayedWalk;
      this.pageService.setTitle();
      this.displayLinks = displayedWalk?.walk?.fields?.links?.length > 0;
      this.resolveWalkAlbumPath(displayedWalk.walk);
      this.refreshPublishAction(displayedWalk.walk);
      this.queryFullWalkIfRequired(displayedWalk);
      this.configureMapDisplay();
    }
    this.notify.success({
      title: `Single ${this.display.eventTypeTitle(this.displayedWalk?.walk)} showing`,
      message: " "
    });
  }

  updateGoogleMapIfApplicable() {
    if (this.showGoogleMapsView) {
      this.googleMapsUrl = this.display.googleMapsUrl(!this.drivingDirectionsDisabled() && this.showDrivingDirections(), this.fromPostcode, this.showEndPoint() ? this.displayedWalk?.walk?.groupEvent?.end_location?.postcode : this.displayedWalk?.walk?.groupEvent?.start_location?.postcode);
      this.logger.info("updateGoogleMap:Should show details - rendering googleMapsUrl:", this.googleMapsUrl);
      if (!this.suppressMapToggle) {
        this.toggleGoogleOrLeafletMapViewAndBack();
      } else {
        this.suppressMapToggle = false;
      }
    } else {
      this.logger.info("updateGoogleMap:not performed as:this.showGoogleMapsView", this.showGoogleMapsView);
    }
  }

  refreshHomePostcode() {
    this.changeFromPostcode(this.memberLoginService.memberLoggedIn() ? this.memberLoginService.loggedInMember().postcode : "");
  }

  autoSelectMapDisplay() {
    const switchToShowStartPoint = this.drivingDirectionsDisabled() && this.showDrivingDirections();
    const switchToShowDrivingDirections = this.validFromPostcodeEntered() && !this.showDrivingDirections() && this.showGoogleMapsView;
    this.logger.info("autoSelectMapDisplay on entering: drivingDirectionsDisabled:", this.drivingDirectionsDisabled(), "switchToShowStartPoint:", switchToShowStartPoint, "switchToShowDrivingDirections:", switchToShowDrivingDirections, "mapDisplay:", this.mapDisplay, "fromPostcode:", this.fromPostcode);
    if (switchToShowStartPoint || (this.showGoogleMapsView && this.mapDisplay === MapDisplay.SHOW_START_AND_END_POINT)) {
      this.mapDisplay = MapDisplay.SHOW_START_POINT;
    } else if (switchToShowDrivingDirections) {
      this.mapDisplay = MapDisplay.SHOW_DRIVING_DIRECTIONS;
    }
    this.logger.info("autoSelectMapDisplay:mapDisplay:", this.mapDisplay, "showGoogleMapsView:", this.showGoogleMapsView);
  }

  showDrivingDirections(): boolean {
    return this.mapDisplay === MapDisplay.SHOW_DRIVING_DIRECTIONS;
  }

  showEndPoint(): boolean {
    return this.mapDisplay === MapDisplay.SHOW_END_POINT;
  }

  drivingDirectionsDisabled() {
    return !this.validFromPostcodeEntered() || !this.showGoogleMapsView;
  }

  validFromPostcodeEntered() {
    return this.fromPostcode?.length >= 3;
  }

  durationInFutureFor(walk: ExtendedGroupEvent) {
    return this.dateUtils.asValueNoTime(walk?.groupEvent?.start_date_time) === this.dateUtils.dateTimeNowNoTime().toMillis() ? "today"
      : (this.dateUtils.asDateTime(this.dateUtils.startTimeAsValue(walk)).toRelative());
  }

  changeMapView(newValue: MapDisplay) {
    this.logger.info("changeShowDrivingDirections:", newValue);
    this.mapDisplay = newValue;
    this.syncMapOptionsToUrl();
    if (this.showGoogleMapsView && newValue === MapDisplay.SHOW_DRIVING_DIRECTIONS) {
      this.suppressMapToggle = true;
      this.updateGoogleMapIfApplicable();
      this.focusFromPostcodeInput();
    } else {
      this.updateGoogleMapIfApplicable();
    }
  }

  changeFromPostcode(fromPostcode: string) {
    this.logger.info("changeFromPostcode:", fromPostcode);
    this.fromPostcode = fromPostcode;
    this.syncMapOptionsToUrl();
    this.autoSelectMapDisplay();
    this.suppressMapToggle = true;
    this.updateGoogleMapIfApplicable();
  }

  private queryIsRequired(): boolean {
    if (this.walkInjected) {
      this.logger.info("queryIsRequired:walkInjected:", this.walkInjected, " queryIsRequired:", false);
      return false;
    } else {
      const walkId: string = this.urlService.lastPathSegment();
      const extendedGroupEvent = this.displayedWalk?.walk;
      const matchableIds: string[] = [extendedGroupEvent?.id, extendedGroupEvent?.groupEvent?.id];
      const matchesUrl = extendedGroupEvent?.groupEvent?.url?.includes(walkId);
      const queryIsRequired = this?.systemConfigService.systemConfig()?.group && (matchableIds.includes(walkId) ? false : !matchesUrl);
      this.logger.info("queryIsRequired:walkId:", walkId, "matchableIds:", matchableIds, "matchesUrl:", matchesUrl, "displayedWalk:", this.displayedWalk, "queryIsRequired:", queryIsRequired);
      return queryIsRequired;
    }
  }

  navigateToArea() {
    this.urlService.navigateUnconditionallyTo([this.area]);
  }

  private focusFromPostcodeInput() {
    setTimeout(() => this.fromPostcodeInput?.nativeElement?.focus(), 0);
  }

  cycleMapSize() {
    const currentIndex = this.mapSizeCycle.findIndex(state => state.expanded === this.mapExpanded && state.fullScreen === this.mapFullScreen);
    const next = this.mapSizeCycle[(currentIndex + 1) % this.mapSizeCycle.length];
    this.applyMapSize(next.expanded, next.fullScreen);
    this.syncMapSizeToUrl();
  }

  private applyMapSizeFromQuery(paramMap: ParamMap) {
    const maximised = paramMap.get(StoredValue.MAXIMISE) === "true";
    const expanded = !maximised && paramMap.get(StoredValue.EXPANDED) === "true";
    this.applyMapSize(expanded, maximised);
  }

  private applyMapOptionsFromQuery(paramMap: ParamMap) {
    if (this.mapOptionsFollowUrl) {
      const requestedDisplay = values(MapDisplay).find(mapDisplay => mapDisplay === paramMap.get(StoredValue.MAP_DISPLAY));
      if (requestedDisplay) {
        this.mapDisplay = requestedDisplay;
      }
      const requestedPostcode = paramMap.get(StoredValue.FROM_POSTCODE);
      if (requestedPostcode && requestedPostcode !== this.fromPostcode) {
        this.fromPostcode = requestedPostcode;
      }
      this.showGoogleMapsView = paramMap.get(StoredValue.MAP_PROVIDER) === WalkDetailsMapProvider.GOOGLE_MAPS;
    }
  }

  private syncMapOptionsToUrl() {
    if (this.mapOptionsFollowUrl) {
      this.uiActions.updateQueryParameters({
        [StoredValue.MAP_DISPLAY]: this.mapDisplay === MapDisplay.SHOW_START_POINT ? null : this.mapDisplay,
        [StoredValue.FROM_POSTCODE]: this.validFromPostcodeEntered() ? this.fromPostcode : null,
        [StoredValue.MAP_PROVIDER]: this.showGoogleMapsView ? WalkDetailsMapProvider.GOOGLE_MAPS : WalkDetailsMapProvider.OS_MAPS
      });
    }
  }

  private get mapOptionsFollowUrl(): boolean {
    return !this.walkInjected;
  }

  private applyMapSize(expanded: boolean, fullScreen: boolean) {
    if (this.mapExpanded === expanded && this.mapFullScreen === fullScreen) {
      return;
    }
    this.mapExpanded = expanded;
    this.mapFullScreen = fullScreen;
    this.refreshMapSize();
  }

  private syncMapSizeToUrl() {
    this.uiActions.updateQueryParameters({
      [StoredValue.EXPANDED]: this.mapExpanded ? "true" : null,
      [StoredValue.MAXIMISE]: this.mapFullScreen ? "true" : null
    });
  }

  private refreshMapSize() {
    [50, 300].forEach(delay => setTimeout(() => {
      this.mapEditComponent?.invalidateSize();
      window.dispatchEvent(new Event("resize"));
    }, delay));
    if (this.showGoogleMapsView) {
      setTimeout(() => {
        this.suppressMapToggle = false;
        this.updateGoogleMapIfApplicable();
      }, 320);
    }
  }

  protected get mapControlsStacked(): boolean {
    return !this.mapExpanded && !this.mapFullScreen;
  }

  restoreMapSize() {
    this.applyMapSize(false, false);
    this.syncMapSizeToUrl();
  }

  @HostListener("document:keydown.escape")
  exitMapFullScreen() {
    if (this.mapFullScreen) {
      this.applyMapSize(false, false);
      this.syncMapSizeToUrl();
    }
  }

  mapProviderChanged() {
    this.mapProviderTouched = true;
    this.syncMapOptionsToUrl();
    this.configureMapDisplay();
  }
}
