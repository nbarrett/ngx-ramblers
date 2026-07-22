import { Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { first, kebabCase } from "es-toolkit/compat";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AdminSettingsPath } from "../../../models/admin-route-paths.model";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { ContentText, ContentTextCategory, View } from "../../../models/content-text.model";
import { MeetupConfig } from "../../../models/meetup-config.model";
import { StoredValue } from "../../../models/ui-actions";
import { WalksConfig, WalkConfigTab, WalkDetailsImageStyle, WalkDetailsMapProvider, WalkViewPreviewGhost } from "../../../models/walks-config.model";
import { AccessLevel } from "../../../models/member-resource.model";
import { enumValues } from "../../../functions/enums";
import { BroadcastService } from "../../../services/broadcast-service";
import { ContentTextService } from "../../../services/content-text.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { MeetupService } from "../../../services/meetup.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MapEditComponent } from "../walk-edit/map-edit";
import { LocationDetails } from "../../../models/ramblers-walks-manager";
import { CardImageComponent } from "../../../modules/common/card/image/card-image";
import { ResizerComponent } from "../../../modules/common/resizer/resizer";
import { RelatedLinksPanelComponent } from "../../../modules/common/related-links/related-links-panel";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { DisplayedWalk, EventStartDateDescending, EventType, FALLBACK_MEDIA, GroupEventField, LinkSource } from "../../../models/walk.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { MarkdownComponent } from "ngx-markdown";
import {
  WalkMeetupConfigParametersComponent
} from "../walk-meetup-config-parameters/walk-meetup-config-parameters.component";

@Component({
  selector: "app-walk-config",
  template: `
    <app-page>
      <h3 class="card-title mb-4" style="margin-left: 1rem;">Walk Configuration
        <fa-icon [icon]="faGear" class="fa-2x ramblers ms-2"/>
      </h3>
      <div class="card-text">
        <div class="col-sm-12">
          <tabset class="custom-tabset">
            <tab [active]="tabActive(WalkConfigTab.GENERAL)"
                 (selectTab)="selectTab(WalkConfigTab.GENERAL)"
                 [heading]="WalkConfigTab.GENERAL">
              <div class="img-thumbnail thumbnail-admin-edit">
                @if (walksConfig) {
                  <div class="row">
                    <div class="col-md-6">
                      <div class="form-group mb-3">
                        <label for="miles-per-hour">Miles per hour (default walking pace)</label>
                        <input [(ngModel)]="walksConfig.milesPerHour"
                               type="number"
                               class="form-control input-sm"
                               id="miles-per-hour"
                               step="0.01"
                               min="0"
                               placeholder="Default miles per hour">
                      </div>
                      <div class="form-group mb-3">
                        <label for="regular-walk-day">Regular Walk Day (used by Add Walk Slots bulk mode)</label>
                        <select [(ngModel)]="walksConfig.regularWalkDay"
                                class="form-control input-sm"
                                id="regular-walk-day">
                          @for (day of weekdayOptions; track day.value) {
                            <option [ngValue]="day.value">{{ day.label }}</option>
                          }
                        </select>
                      </div>
                      <div class="form-group mb-3">
                        <label for="walk-creation-access-level">Walk leader self-service - who can create their own walk</label>
                        <select [(ngModel)]="walksConfig.walkCreationAccessLevel"
                                class="form-control input-sm"
                                id="walk-creation-access-level">
                          @for (level of accessLevels; track level) {
                            <option [ngValue]="level">{{ accessLevelDescriptions[level] }}</option>
                          }
                        </select>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.requireRiskAssessment"
                               type="checkbox"
                               class="form-check-input"
                               id="require-risk-assessment">
                        <label class="form-check-label" for="require-risk-assessment">Require risk assessment to be completed before approving walks</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.requireFinishTime"
                               type="checkbox"
                               class="form-check-input"
                               id="require-finish-time">
                        <label class="form-check-label" for="require-finish-time">Require estimated finish time to be entered</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.requireWalkLeaderDisplayName"
                               type="checkbox"
                               class="form-check-input"
                               id="require-walk-leader-display-name">
                        <label class="form-check-label" for="require-walk-leader-display-name">Require walk leader display name to be entered</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.matchWalkLeadersOnWalksManagerSync"
                               type="checkbox"
                               class="form-check-input"
                               id="match-walk-leaders-on-walks-manager-sync">
                        <label class="form-check-label" for="match-walk-leaders-on-walks-manager-sync">Automatically match unmatched walk leaders to members when Walks Manager Sync is run</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.rematchWalkLeadersOnMemberChange"
                               type="checkbox"
                               class="form-check-input"
                               id="rematch-walk-leaders-on-member-change">
                        <label class="form-check-label" for="rematch-walk-leaders-on-member-change">Automatically match unmatched walk leaders to members when Member Bulk Load is run</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.showRepeatedPagination"
                               type="checkbox"
                               class="form-check-input"
                               id="show-repeated-pagination">
                        <label class="form-check-label" for="show-repeated-pagination">Repeat the pagination row below the event list when the current page is full (helps mobile users after a long scroll)</label>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </tab>
            <tab [active]="tabActive(WalkConfigTab.MEETUP)"
                 (selectTab)="selectTab(WalkConfigTab.MEETUP)"
                 [heading]="WalkConfigTab.MEETUP">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div markdown class="list-arrow mb-2">
                  <ul>
                    <li>Here you can configure default settings that will be used when creating Meetup events.</li>
                  </ul>
                </div>
                @if (meetupConfig) {
                  <app-walk-meetup-config-parameters [config]="meetupConfig"
                                                     [contentTextItems]="contentTextItems"/>
                }
                <div class="mb-2 mt-4">
                  <ul class="list-arrow">
                    <li>Here you can configure content text that will automatically be added to the beginning of
                      the walk description on Meetup events we create.
                    </li>
                  </ul>
                  <div class="row mb-2">
                    <div class="col-sm-12">
                      <div class="d-inline-flex align-items-end flex-wrap gap-2">
                        <div class="form-group">
                          <label for="type" class="inline-label">Content item: </label>
                          <select [ngModel]="selectedContent"
                                  (ngModelChange)="onChange($event)"
                                  class="form-control"
                                  id="type">
                            @for (contentText of contentTextItems; track contentText.id) {
                              <option [ngValue]="contentText" [textContent]="contentText.name"></option>
                            }
                          </select>
                        </div>
                        <div class="form-group">
                          <input type="submit" value="Add new content" (click)="addNewContent()"
                                 title="Add new content"
                                 class="btn btn-primary">
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-sm-12">
                      <div class="mt-2 mb-2 font-weight-bold">{{ selectedContent?.name }} content:</div>
                      @for (content of contentTextItems; track content.id) {
                        @if (matching(content, selectedContent)) {
                          <div>
                            <app-markdown-editor [data]="content"
                                                 [editNameEnabled]="true"
                                                 [deleteEnabled]="true"
                                                 [id]="content.name"
                                                 [initialView]="View.EDIT"
                                                 [rows]="8"/>
                          </div>
                        }
                      }
                    </div>
                  </div>
                </div>
              </div>
            </tab>
            <tab [active]="tabActive(WalkConfigTab.WALK_VIEW)"
                 (selectTab)="selectTab(WalkConfigTab.WALK_VIEW)"
                 [heading]="WalkConfigTab.WALK_VIEW">
              <div class="img-thumbnail thumbnail-admin-edit">
                @if (walksConfig) {
                  <div class="thumbnail-heading-frame">
                    <div class="thumbnail-heading">Walk details page display</div>
                    <div markdown class="list-arrow mb-3">
                      <ul>
                        <li>Everything that affects how individual walk pages look is configured here, with a live preview alongside.</li>
                        <li>Drag the bars below the preview image and preview map to set their heights, or choose natural height to show whole images uncropped.</li>
                        <li>Zoom the preview map in or out to set how much area walk maps show around the start pin.</li>
                        <li>The Related Links box itself can be hidden per event type in <a [routerLink]="'/' + adminSettingsSystemSettingsPath" [queryParams]="areaGroupQueryParams"><strong>Admin &gt; Settings &gt; System Settings &gt; Group / Area Configuration</strong></a>.</li>
                      </ul>
                    </div>
                    <div class="row">
                    <div class="col-lg-5">
                      <div class="fw-bold mb-2">Image</div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.walkDetailsImageStyle"
                               type="radio" class="form-check-input"
                               name="walk-details-image-style"
                               [value]="WalkDetailsImageStyle.CROPPED"
                               id="walk-details-image-style-cropped">
                        <label class="form-check-label" for="walk-details-image-style-cropped">Cropped to a fixed height — drag the bar under the preview image to set the height</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.walkDetailsImageStyle"
                               type="radio" class="form-check-input"
                               name="walk-details-image-style"
                               [value]="WalkDetailsImageStyle.NATURAL"
                               id="walk-details-image-style-natural">
                        <label class="form-check-label" for="walk-details-image-style-natural">Natural height (show the whole image)</label>
                      </div>
                      <div class="fw-bold mb-2 mt-3">Map</div>
                      <div class="form-group mb-3">
                        <label for="map-zoom-out-levels">Zoom out levels — how much extra area walk maps show around the start pin (0 shows the closest view, each level roughly doubles the area)</label>
                        <input [(ngModel)]="walksConfig.mapZoomOutLevels"
                               (ngModelChange)="refreshMapPreview()"
                               type="number"
                               class="form-control input-sm"
                               id="map-zoom-out-levels"
                               step="1"
                               min="0"
                               max="6"
                               placeholder="Levels to zoom out walk maps">
                      </div>
                      <label class="d-block mb-1">Show map as — the map visitors see first (they can still switch on the page)</label>
                      <div class="form-check mb-1">
                        <input [(ngModel)]="walksConfig.walkDetailsMapProvider"
                               type="radio" class="form-check-input"
                               name="walk-details-map-provider"
                               [value]="WalkDetailsMapProvider.OS_MAPS"
                               id="walk-details-map-provider-os">
                        <label class="form-check-label" for="walk-details-map-provider-os">OS Maps</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.walkDetailsMapProvider"
                               type="radio" class="form-check-input"
                               name="walk-details-map-provider"
                               [value]="WalkDetailsMapProvider.GOOGLE_MAPS"
                               id="walk-details-map-provider-google">
                        <label class="form-check-label" for="walk-details-map-provider-google">Google Maps (needs a Google Maps API key in system settings)</label>
                      </div>
                      <div class="fw-bold mb-2 mt-3">Related Links box</div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.relatedLinkShowOnRamblers"
                               type="checkbox" class="form-check-input"
                               id="related-link-show-on-ramblers">
                        <label class="form-check-label" for="related-link-show-on-ramblers">On Ramblers</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.relatedLinkShowThisWalk"
                               type="checkbox" class="form-check-input"
                               id="related-link-show-this-walk">
                        <label class="form-check-label" for="related-link-show-this-walk">Share this walk</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.relatedLinkShowMeetup"
                               type="checkbox" class="form-check-input"
                               id="related-link-show-meetup">
                        <label class="form-check-label" for="related-link-show-meetup">Meetup</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.relatedLinkShowOsMaps"
                               type="checkbox" class="form-check-input"
                               id="related-link-show-os-maps">
                        <label class="form-check-label" for="related-link-show-os-maps">OS Maps</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.relatedLinkShowWhat3words"
                               type="checkbox" class="form-check-input"
                               id="related-link-show-what3words">
                        <label class="form-check-label" for="related-link-show-what3words">what3words</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.relatedLinkShowVenue"
                               type="checkbox" class="form-check-input"
                               id="related-link-show-venue">
                        <label class="form-check-label" for="related-link-show-venue">Venue</label>
                      </div>
                      <div class="form-check mb-2">
                        <input [(ngModel)]="walksConfig.relatedLinkShowGpx"
                               type="checkbox" class="form-check-input"
                               id="related-link-show-gpx">
                        <label class="form-check-label" for="related-link-show-gpx">Download GPX route</label>
                      </div>
                    </div>
                    <div class="col-lg-7">
                      <div class="fw-bold mb-2">Preview — walk details page</div>
                      <div class="row">
                        <div class="col-lg-6 preview-column">
                          @for (ghost of leadingLeftGhosts; track ghost.label) {
                            <div class="ghost-panel mb-3" [style.min-height.px]="ghost.height">{{ ghost.label }}</div>
                          }
                          @if (walkRelatedLinksShown) {
                            <app-related-links-panel [displayedWalk]="previewWalk" [walksConfigOverride]="walksConfig"/>
                          } @else {
                            <div class="ghost-panel" [style.min-height.px]="90">
                              <div class="text-center">Related Links — hidden for walks in
                                <a [routerLink]="'/' + adminSettingsSystemSettingsPath" [queryParams]="areaGroupQueryParams">Group / Area Configuration</a>
                              </div>
                            </div>
                          }
                          @for (ghost of trailingLeftGhosts; track ghost.label) {
                            <div class="ghost-panel mt-3" [style.min-height.px]="ghost.height">{{ ghost.label }}</div>
                          }
                        </div>
                        <div class="col-lg-6 preview-column">
                          <div class="preview-image-frame"
                               [style.height.px]="naturalImagePreview() ? null : (walksConfig.walkDetailsImageHeight || 200)">
                            <app-card-image [unconstrainedHeight]="naturalImagePreview()"
                                            [height]="naturalImagePreview() ? null : (walksConfig.walkDetailsImageHeight || 200)"
                                            [imageSource]="previewImageSource()"/>
                          </div>
                          @if (!naturalImagePreview()) {
                            <app-resizer class="preview-resizer" orientation="vertical" variant="tab" compact
                                         [size]="walksConfig.walkDetailsImageHeight || 200"
                                         [minSize]="100"
                                         [maxSize]="800"
                                         (sizeChange)="onImageHeightChange($event)"/>
                          }
                          <div class="mt-3 clearfix">
                            @if (mapPreviewVisible) {
                              <div app-map-edit readonly
                                   class="map-walk-view preview-map"
                                   [style.height.px]="walksConfig.walkDetailsMapHeight || 380"
                                   [initialZoomOffset]="-(walksConfig.mapZoomOutLevels ?? 2)"
                                   (zoomOutLevelsChange)="onPreviewZoomChange($event)"
                                   [locationDetails]="exampleLocation"></div>
                            }
                            <app-resizer class="preview-resizer" orientation="vertical" variant="tab" compact
                                         [size]="walksConfig.walkDetailsMapHeight || 380"
                                         [minSize]="200"
                                         [maxSize]="800"
                                         (sizeChange)="onMapHeightChange($event)"
                                         (resizeEnd)="onMapHeightResizeEnd()"/>
                          </div>
                          @for (ghost of rightGhosts; track ghost.label) {
                            <div class="ghost-panel mt-3" [style.min-height.px]="ghost.height">{{ ghost.label }}</div>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                }
              </div>
              <div class="img-thumbnail thumbnail-admin-edit mt-3">
                @if (walksConfig) {
                  <div class="thumbnail-heading-frame">
                    <div class="thumbnail-heading">Public visibility</div>
                    <div markdown class="list-arrow mb-3">
                      <ul>
                        <li>Choose whether non-approved walks are shown to visitors who are not logged in.</li>
                        <li>Logged-in members and walk admins will continue to see all walks.</li>
                      </ul>
                    </div>
                    <div class="row">
                      <div class="col-md-6">
                        <div class="form-check mb-2">
                          <input [(ngModel)]="walksConfig.hideAwaitingLeaderFromPublic"
                                 type="checkbox" class="form-check-input"
                                 id="hide-awaiting-leader-from-public">
                          <label class="form-check-label" for="hide-awaiting-leader-from-public">Hide empty walk slots (no leader assigned)</label>
                        </div>
                        <div class="form-check mb-2">
                          <input [(ngModel)]="walksConfig.hideNonApprovedWalksFromPublic"
                                 type="checkbox" class="form-check-input"
                                 id="hide-non-approved-walks-from-public">
                          <label class="form-check-label" for="hide-non-approved-walks-from-public">Hide walks awaiting details or approval</label>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </tab>
          </tabset>
          <div class="form-group">
            @if (notifyTarget.showAlert) {
              <div class="alert {{notifyTarget.alertClass}}">
                <fa-icon [icon]="notifyTarget.alert.icon"/>
                <strong> {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
              </div>
            }
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <input type="submit" value="Save" (click)="save()"
                   title="Save"
                   class="btn btn-success">
            <input type="submit" value="Back To Walks Admin" (click)="backToWalksAdmin()"
                   title="Back to walks"
                   class="btn btn-secondary">
          </div>
        </div>
      </div>
    </app-page>
  `,
  styles: [`
    .ghost-panel
      display: flex
      align-items: center
      justify-content: center
      padding: 12px 16px
      border: 2px dashed #ced4da
      border-radius: 6px
      background-color: #f8f9fa
      color: #6c757d
      font-weight: 600

    .preview-column
      display: flex
      flex-direction: column

      .ghost-panel:last-child
        flex-grow: 1

    .preview-image-frame
      overflow: hidden
      line-height: 0
      border-radius: 6px

    .preview-column app-related-links-panel
      display: block
      margin-bottom: -21px

    .preview-map
      margin-top: 0
      margin-bottom: 0

    .preview-resizer
      clear: both
      display: block
      margin-top: 0
  `],
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, FontAwesomeModule, TabsetComponent, TabDirective, FormsModule, MarkdownEditorComponent, MarkdownComponent, WalkMeetupConfigParametersComponent, RouterLink, MapEditComponent, CardImageComponent, ResizerComponent, RelatedLinksPanelComponent]
})
export class WalkConfigComponent implements OnInit, OnDestroy {
  adminSettingsSystemSettingsPath = AdminSettingsPath.SYSTEM_SETTINGS;

  private logger: Logger = inject(LoggerFactory).createLogger("WalkConfigComponent", NgxLoggerLevel.ERROR);
  private location = inject(Location);
  private urlService = inject(UrlService);
  private dateUtils = inject(DateUtilsService);
  private contentTextService = inject(ContentTextService);
  private meetupService = inject(MeetupService);
  private walksConfigService = inject(WalksConfigService);
  private systemConfigService = inject(SystemConfigService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private mediaQueryService = inject(MediaQueryService);
  protected previewImageUrl: string;
  protected readonly leadingLeftGhosts: WalkViewPreviewGhost[] = [
    {label: "Walk title & date", height: 70},
    {label: "Description", height: 150},
    {label: "Walk leader", height: 90},
    {label: "Features", height: 70}
  ];
  protected readonly trailingLeftGhosts: WalkViewPreviewGhost[] = [
    {label: "Booking form", height: 90}
  ];
  protected readonly rightGhosts: WalkViewPreviewGhost[] = [
    {label: "Walk details", height: 130}
  ];
  protected readonly previewWalk: DisplayedWalk = {
    walk: {
      id: "sample-walk",
      groupEvent: {
        id: "sample-walk",
        title: "Sample walk",
        start_location: {w3w: "sample.walk.preview"}
      },
      fields: {
        venue: {venuePublish: true, name: "Sample Venue", type: "Pub", url: "https://example.com/sample-venue"},
        links: [
          {source: LinkSource.MEETUP, href: "https://www.meetup.com/sample-walk"},
          {source: LinkSource.OS_MAPS, href: "https://explore.osmaps.com/route/sample-walk"}
        ],
        gpxFile: {awsFileName: "sample-route.gpx", originalFileName: "sample-route.gpx"}
      },
      events: []
    } as ExtendedGroupEvent,
    walkAccessMode: {caption: "view", title: "View"},
    status: EventType.APPROVED,
    walkLink: "https://example.com/walks/sample-walk",
    ramblersLink: "https://www.ramblers.org.uk",
    showEndpoint: false,
    hasFeatures: false
  };
  private broadcastService = inject<BroadcastService<ContentText>>(BroadcastService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  protected notifierService = inject(NotifierService);
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public contentTextItems: ContentText[] = [];
  public selectedContent: ContentText;
  addNew: boolean;
  public meetupConfig: MeetupConfig;
  public walksConfig: WalksConfig;
  protected mapPreviewVisible = true;
  private mapPreviewRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly exampleLocation: LocationDetails = {
    latitude: 51.48158,
    longitude: -1.10079,
    description: "Example start point",
    postcode: "RG8 7AR",
    grid_reference_6: null,
    grid_reference_8: null,
    grid_reference_10: null,
    w3w: null
  };
  public weekdayOptions: { label: string; value: number }[] = [];
  public accessLevels: AccessLevel[] = enumValues(AccessLevel);
  public accessLevelDescriptions: Record<AccessLevel, string> = {
    [AccessLevel.HIDDEN]: "No access",
    [AccessLevel.ENVIRONMENT_ADMIN]: "Environment admin",
    [AccessLevel.COMMITTEE]: "Committee",
    [AccessLevel.LOGGED_IN_MEMBER]: "Logged-in member",
    [AccessLevel.PUBLIC]: "Public"
  };
  faGear = faGear;
  private tab: WalkConfigTab = WalkConfigTab.GENERAL;
  private subscriptions: Subscription[] = [];

  protected readonly areaGroupQueryParams = {[StoredValue.TAB]: "area-group"};
  protected readonly View = View;
  protected readonly WalkConfigTab = WalkConfigTab;
  protected readonly WalkDetailsImageStyle = WalkDetailsImageStyle;
  protected readonly WalkDetailsMapProvider = WalkDetailsMapProvider;
  protected walkRelatedLinksShown = true;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.loadPreviewImage();
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.weekdayOptions = this.dateUtils.daysOfWeek().map((label, index) => ({label, value: index + 1}));
    this.meetupService.queryConfig().then(config => this.meetupConfig = config);
    this.walksConfig = this.walksConfigService.default();
    this.subscriptions.push(this.systemConfigService.events().subscribe(config => {
      this.walkRelatedLinksShown = config?.group?.showWalkRelatedLinks !== false;
    }));
    this.subscriptions.push(this.walksConfigService.events().subscribe(config => {
      this.walksConfig = config;
      if (!this.walksConfig.walkCreationAccessLevel) {
        this.walksConfig.walkCreationAccessLevel = AccessLevel.HIDDEN;
      }
    }));
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      this.tab = params[StoredValue.TAB] || kebabCase(WalkConfigTab.GENERAL);
    }));
    this.contentTextService.filterByCategory(ContentTextCategory.MEETUP_DESCRIPTION_PREFIX).then(contentTextItems => {
      this.logger.debug("forCategory", ContentTextCategory.MEETUP_DESCRIPTION_PREFIX + ":", contentTextItems);
      this.contentTextItems = contentTextItems;
      this.onChange(first(this.contentTextItems));
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_SYNCED, (event: NamedEvent<ContentText>) => this.replaceContent(event.data));
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_DELETED, (event: NamedEvent<ContentText>) => this.removeContent(event.data));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    if (this.mapPreviewRefreshTimer) {
      clearTimeout(this.mapPreviewRefreshTimer);
    }
  }

  refreshMapPreview(): void {
    this.mapPreviewVisible = false;
    if (this.mapPreviewRefreshTimer) {
      clearTimeout(this.mapPreviewRefreshTimer);
    }
    this.mapPreviewRefreshTimer = setTimeout(() => this.mapPreviewVisible = true, 150);
  }

  onPreviewZoomChange(levels: number): void {
    const clamped = Math.max(0, Math.min(6, Math.round(levels)));
    if (clamped !== this.walksConfig.mapZoomOutLevels) {
      this.walksConfig.mapZoomOutLevels = clamped;
    }
  }

  naturalImagePreview(): boolean {
    return this.walksConfig?.walkDetailsImageStyle === WalkDetailsImageStyle.NATURAL;
  }

  onImageHeightChange(height: number): void {
    this.walksConfig.walkDetailsImageHeight = Math.round(height);
  }

  onMapHeightChange(height: number): void {
    this.walksConfig.walkDetailsMapHeight = Math.round(height);
  }

  onMapHeightResizeEnd(): void {
    this.refreshMapPreview();
  }

  previewImageSource(): string {
    return this.previewImageUrl || FALLBACK_MEDIA.url;
  }

  private async loadPreviewImage(): Promise<void> {
    try {
      const events = await this.walksAndEventsService.all({
        inputSource: null,
        suppressEventLinking: false,
        dataQueryOptions: {
          criteria: {[`${GroupEventField.MEDIA}.0`]: {$exists: true}},
          select: {[GroupEventField.MEDIA]: 1},
          sort: EventStartDateDescending,
          limit: 1
        }
      });
      this.previewImageUrl = this.mediaQueryService.basicMediaFrom(events?.[0]?.groupEvent)?.[0]?.url;
      this.logger.info("loadPreviewImage: previewImageUrl:", this.previewImageUrl);
    } catch (error) {
      this.logger.warn("loadPreviewImage failed - falling back to placeholder:", error);
    }
  }

  tabActive(tab: WalkConfigTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  selectTab(tab: WalkConfigTab) {
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
    if (tab === WalkConfigTab.WALK_VIEW) {
      this.refreshMapPreview();
    }
  }

  backToWalksAdmin() {
    this.location.back();
  }

  private replaceContent(contentText: ContentText) {
    if (contentText.category === ContentTextCategory.MEETUP_DESCRIPTION_PREFIX) {
      this.logger.debug("Received updated content", contentText);
      const existingContent: ContentText = this.contentTextItems.find(item => !item.name || (item.name === contentText.name));
      if (existingContent) {
        this.contentTextItems[(this.contentTextItems.indexOf(existingContent))] = contentText;
        this.onChange(contentText);
      } else {
        this.contentTextItems.push(contentText);
        this.onChange(contentText);
      }
    }
  }

  private removeContent(contentText: ContentText) {
    if (contentText.category === ContentTextCategory.MEETUP_DESCRIPTION_PREFIX) {
      this.logger.debug("Received deleted content", contentText);
      this.contentTextItems = this.contentTextItems.filter(item => item.id !== contentText.id);
    }
  }

  addNewContent() {
    this.addNew = true;
    const newContent = {category: ContentTextCategory.MEETUP_DESCRIPTION_PREFIX, text: "Replace with text that will be used as a prefix for the walk description", name: "Enter name of Content"};
    this.logger.debug("adding new content", newContent);
    this.selectedContent = newContent;
    this.contentTextItems.push(newContent);
  }

  onChange(content: ContentText) {
    this.logger.debug("selected content text:", content);
    this.selectedContent = content;
  }

  matching(content: ContentText, selectedContent: ContentText) {
    return content && selectedContent && content.name === selectedContent.name;
  }

  save() {
    this.walksConfigService.saveConfig(this.walksConfig)
      .then(() => this.meetupService.saveConfig(this.notify, this.meetupConfig))
      .then(() => this.notify.success({title: "Walk configuration", message: "Saved successfully"}))
      .catch((error) => this.notify.error({title: "Walk configuration", message: error}));
  }
}
