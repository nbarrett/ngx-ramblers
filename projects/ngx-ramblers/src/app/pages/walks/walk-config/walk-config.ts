import { Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faGear, faRoute, faShareNodes } from "@fortawesome/free-solid-svg-icons";
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
import { WalksConfig, WalkConfigTab } from "../../../models/walks-config.model";
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
import { MapEditComponent } from "../walk-edit/map-edit";
import { LocationDetails } from "../../../models/ramblers-walks-manager";
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
                      <label for="map-zoom-out-levels">Map zoom out levels — how much extra area walk maps show around the start pin (0 shows the closest view, each level roughly doubles the area)</label>
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
                    <div class="form-group mb-3 mt-3">
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
                      <label>Example walk map at the configured zoom level — zoom in or out here to set the level</label>
                      @if (mapPreviewVisible) {
                        <div app-map-edit readonly
                             class="map-walk-view"
                             [initialZoomOffset]="-(walksConfig.mapZoomOutLevels ?? 2)"
                             (zoomOutLevelsChange)="onPreviewZoomChange($event)"
                             [locationDetails]="exampleLocation"></div>
                      }
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
                    <div class="thumbnail-heading">Related Links box</div>
                    <div markdown class="list-arrow mb-3">
                      <ul>
                        <li>Choose which links appear inside the Related Links box on individual walk pages.</li>
                        <li>The Related Links box itself can be hidden per event type in <a [routerLink]="'/' + adminSettingsSystemSettingsPath" [queryParams]="areaGroupQueryParams"><strong>Admin &gt; Settings &gt; System Settings &gt; Group / Area Configuration</strong></a>.</li>
                      </ul>
                    </div>
                    <div class="row">
                    <div class="col-md-6">
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
                    <div class="col-md-6">
                      <div class="related-links-preview event-panel rounded event-panel-inner">
                        <h1>Related Links</h1>
                        <div class="row">
                          @if (walksConfig.relatedLinkShowOnRamblers !== false) {
                            <div class="col-sm-12 preview-row d-flex align-items-center gap-2">
                              <img class="related-links-ramblers-image" src="favicon.ico" alt="On Ramblers"/>
                              <span>On Ramblers</span>
                            </div>
                          }
                          @if (walksConfig.relatedLinkShowThisWalk !== false) {
                            <div class="col-sm-12 preview-row d-flex align-items-center gap-2">
                              <fa-icon [icon]="faShareNodes" class="fa-icon"></fa-icon>
                              <span>Share this walk</span>
                            </div>
                          }
                          @if (walksConfig.relatedLinkShowMeetup !== false) {
                            <div class="col-sm-12 preview-row d-flex align-items-center gap-2">
                              <img class="related-links-image" src="/assets/images/local/meetup.ico" alt="View event on Meetup"/>
                              <span>View event on Meetup</span>
                            </div>
                          }
                          @if (walksConfig.relatedLinkShowOsMaps !== false) {
                            <div class="col-sm-12 preview-row d-flex align-items-center gap-2">
                              <img class="related-links-image" src="/assets/images/local/ordnance-survey.png" alt="View map on OS Maps"/>
                              <span>View map on OS Maps</span>
                            </div>
                          }
                          @if (walksConfig.relatedLinkShowWhat3words !== false) {
                            <div class="col-sm-12 preview-row d-flex align-items-center gap-2">
                              <img class="w3w-image" src="/assets/images/local/w3w.png" alt="View start location in what3words"/>
                              <span>View start location in what3words</span>
                            </div>
                          }
                          @if (walksConfig.relatedLinkShowVenue !== false) {
                            <div class="col-sm-12 preview-row d-flex align-items-center gap-2">
                              <fa-icon [icon]="faGear" class="fa-icon"></fa-icon>
                              <span>Venue: Sample Venue</span>
                            </div>
                          }
                          @if (walksConfig.relatedLinkShowGpx !== false) {
                            <div class="col-sm-12 preview-row d-flex align-items-center gap-2">
                              <fa-icon [icon]="faRoute" class="fa-icon"></fa-icon>
                              <span>Download GPX route</span>
                            </div>
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
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, FontAwesomeModule, TabsetComponent, TabDirective, FormsModule, MarkdownEditorComponent, MarkdownComponent, WalkMeetupConfigParametersComponent, RouterLink, MapEditComponent]
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
  faShareNodes = faShareNodes;
  faRoute = faRoute;
  private tab: WalkConfigTab = WalkConfigTab.GENERAL;
  private subscriptions: Subscription[] = [];

  protected readonly areaGroupQueryParams = {[StoredValue.TAB]: "area-group"};
  protected readonly View = View;
  protected readonly WalkConfigTab = WalkConfigTab;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.weekdayOptions = this.dateUtils.daysOfWeek().map((label, index) => ({label, value: index + 1}));
    this.meetupService.queryConfig().then(config => this.meetupConfig = config);
    this.walksConfig = this.walksConfigService.default();
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

  tabActive(tab: WalkConfigTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  selectTab(tab: WalkConfigTab) {
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
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
