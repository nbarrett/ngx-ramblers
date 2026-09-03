import { Component, HostListener, inject, NgZone, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCircle,
  faCircleExclamation,
  faCircleHalfStroke,
  faCompress,
  faEraser,
  faFlagCheckered,
  faFloppyDisk,
  faLayerGroup,
  faLocationArrow,
  faMoon,
  faPause,
  faPencil,
  faPersonWalking,
  faPlay,
  faRightLeft,
  faRotateLeft,
  faShoePrints,
  faStop,
  faSun,
  faUpLong,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import * as L from "leaflet";
import { isNumber } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import {
  AppAppearance,
  AppInstallPlatform,
  AppPath,
  ROUTE_FOLLOW_ARROW_SPACING_METRES,
  ROUTE_FOLLOW_EDIT_DETAIL_MAX,
  ROUTE_FOLLOW_EDIT_DETAIL_MIN,
  ROUTE_FOLLOW_EDIT_TARGET_POINTS,
  ROUTE_FOLLOW_EDIT_THIN_FROM,
  ROUTE_FOLLOW_PREVIEW_SPEED_DEFAULT,
  ROUTE_FOLLOW_PREVIEW_SPEED_MAX,
  ROUTE_FOLLOW_PREVIEW_SPEED_MIN,
  RouteFollowLocationError,
  RouteFollowEditTool,
  RouteFollowMode,
  RouteFollowSheetState,
  RouteFollowPayload,
  RouteFollowProgress,
  RouteFollowQueryParam,
  RouteFollowReturnDirection,
  RouteFollowSession,
  RouteFollowSource,
  RouteFollowWaypoint,
  editExtendAfterIndex,
  firstCompleted,
  followCacheKey,
  CompassTapeMark,
  FollowMapScaleBar,
  compassHeadingLabel,
  compassTapeMarks,
  followLineColours,
  followMapScaleBar,
  formatMapSaveProgress,
  formatOsGridReference,
  isLiveFollowMode,
  RouteFollowProgressPaint,
  routeFollowProgressPaintFrom,
  ROUTE_FOLLOW_HEADING_UP_MIN_DELTA,
  ROUTE_FOLLOW_LINE_WEIGHT_DEFAULT,
  ROUTE_FOLLOW_NETWORK_TIMEOUT_MS,
  RouteFollowOfflineStatus,
  sheetStateAfterDrag
} from "../../models/route-follow.model";
import { DEFAULT_OS_STYLE, MAP_BASEMAP_CHOICES, MapBasemapChoice, MapProvider } from "../../models/map.model";
import { OsMapsBrandingHref } from "../../models/os-maps-branding.model";
import { OsMapsBrandingService } from "../../services/maps/os-maps-branding.service";
import { MapControlsStateService } from "../../shared/services/map-controls-state.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { AppShellService } from "../../services/maps/app-shell.service";
import { MapTilesService } from "../../services/maps/map-tiles.service";
import { MapMarkerStyleService } from "../../services/maps/map-marker-style.service";
import { RouteFollowPayloadService } from "../../services/maps/route-follow-payload.service";
import { RamblersLibraryRouteService } from "../../services/maps/ramblers-library-route.service";
import { RouteFollowCacheService } from "../../services/maps/route-follow-cache.service";
import { RouteFollowService } from "../../services/maps/route-follow.service";
import { RouteFollowSaveService } from "../../services/maps/route-follow-save.service";
import { OsMapsExportService } from "../../services/maps/os-maps-export.service";
import { MapGestures, mapAngleDelta, mapGesturesFor } from "../../services/maps/map-gestures";
import { PageContentService } from "../../services/page-content.service";
import { WalksAndEventsService } from "../../services/walks-and-events/walks-and-events.service";
import { WalkDisplayService } from "../walks/walk-display.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { RangeSliderComponent } from "../../components/range-slider";
import { MapRoute, PaletteColor } from "../../models/content-text.model";
import { MapRouteStylePaletteComponent } from "../../modules/common/dynamic-content/map-route-style-palette.component";
import { DEFAULT_WALKS_AREA } from "../../models/walks-route-paths.model";
import { StoredValue } from "../../models/ui-actions";
import { UiActionsService } from "../../services/ui-actions.service";
import { EPSG_27700_PROJ4, MapProjectionCode } from "../../common/maps/map-projection.constants";
import proj4 from "proj4";

@Component({
  selector: "app-route-follow",
  template: `
    <div class="follow-app">
      @if (error) {
        <div class="follow-status">
          <button class="follow-icon-btn" type="button" (click)="closeFollow()"
                  tooltip="Close" [isDisabled]="!tooltipsEnabled" placement="bottom" container=".follow-app"
                  aria-label="Close follow">
            <fa-icon [icon]="faXmark"/>
          </button>
          <div class="follow-alert follow-alert-danger">
            <fa-icon [icon]="faCircleExclamation"/>
            <div>
              <strong>This route cannot be followed</strong>
              <p>{{ error }}</p>
            </div>
          </div>
        </div>
      } @else if (loading) {
        <div class="follow-status">
          <p class="follow-loading">Loading the route…</p>
        </div>
      } @else {
        @if (options) {
          <div class="follow-map"
               leaflet
               [leafletOptions]="options"
               [leafletLayers]="layers"
               (leafletMapReady)="onMapReady($event)">
          </div>
        }
        <h1 class="visually-hidden">{{ payload?.title }}</h1>
        <div class="follow-top" [class.has-banner]="showOffRoute || !!locationMessage">
          <div class="follow-top-bar">
            <button class="follow-icon-btn" type="button" (click)="closeFollow()"
                    tooltip="Close" [isDisabled]="!tooltipsEnabled" placement="bottom" container=".follow-app"
                    aria-label="Close follow">
              <fa-icon [icon]="faXmark"/>
            </button>
            @if (showOffRoute) {
              <div class="follow-off-route">
                <fa-icon [icon]="faCircleExclamation"/>
                {{ offRouteMessage }}
              </div>
            } @else if (locationMessage) {
              <div class="follow-off-route follow-location-error">
                <fa-icon [icon]="faCircleExclamation"/>
                {{ locationMessage }}
              </div>
            }
          </div>
          <div class="follow-hud">
            @if (compassHeadingText) {
              <div class="follow-tape-heading">{{ compassHeadingText }}</div>
            }
            <div class="follow-tape" aria-hidden="true">
              <div class="follow-tape-window">
                @for (mark of tapeMarks; track mark.degree + '-' + mark.offsetPx) {
                  <span class="follow-tape-mark" [style.left]="'calc(50% + ' + mark.offsetPx + 'px)'">
                    <span class="follow-tape-tick"
                          [class.is-major]="mark.major"
                          [class.is-medium]="mark.medium"></span>
                    @if (mark.label) {
                      <span class="follow-tape-label">{{ mark.label }}</span>
                    }
                  </span>
                }
                <span class="follow-tape-needle"></span>
              </div>
            </div>
            @if (gridReference) {
              <div class="follow-tape-grid">{{ gridReference }}</div>
            }
          </div>
        </div>
        @if (progress?.approachedWaypoint && instructionText) {
          <div class="follow-instruction" [class.has-banner-offset]="showOffRoute || !!locationMessage">
            <div class="follow-instruction-number">{{ waypointNumber(progress.approachedWaypoint) }}</div>
            <div>
              <h2>{{ instructionText }}</h2>
              <p>{{ nextDistanceLabel }}</p>
            </div>
          </div>
        }
        @if (showStylePicker) {
          <div class="follow-style-scrim" (click)="closeStylePicker()"></div>
          <div class="follow-style-picker" role="dialog" aria-label="Map style">
            <div class="follow-style-picker-head">
              <h2>Maps</h2>
              <div class="follow-style-picker-head-actions">
                <span tooltip="Undo" [isDisabled]="!tooltipsEnabled" placement="bottom" container=".follow-app">
                  <button type="button" class="follow-icon-btn" (click)="undoStylePicker()"
                          [disabled]="!stylePickerDirty"
                          aria-label="Undo">
                    <fa-icon [icon]="faRotateLeft"/>
                  </button>
                </span>
                @if (canEditRoute && styleDirty) {
                  <span tooltip="Save route style" [isDisabled]="!tooltipsEnabled" placement="bottom" container=".follow-app">
                    <button type="button" class="follow-icon-btn" (click)="saveStyle()"
                            [disabled]="savingRoute"
                            aria-label="Save route style">
                      <fa-icon [icon]="faFloppyDisk"/>
                    </button>
                  </span>
                }
                <button type="button" class="follow-icon-btn" (click)="closeStylePicker()"
                        tooltip="Close" [isDisabled]="!tooltipsEnabled"
                        placement="bottom" container=".follow-app"
                        aria-label="Close">
                  <fa-icon [icon]="faXmark"/>
                </button>
              </div>
            </div>
            <div class="follow-style-row">
              @if (styleRoute) {
                <div class="follow-style-section follow-style-route">
                  <p class="follow-style-heading">Route line</p>
                  <app-map-route-style-palette [route]="styleRoute" inline
                    (styleChange)="onRouteStyleChange()"/>
                </div>
              }
              <div class="follow-style-section follow-style-basemaps">
                <p class="follow-style-heading">Basemaps</p>
                <div class="follow-style-grid">
                  @for (choice of basemapChoices; track choice.preview) {
                    <button type="button" class="follow-style-card"
                            [class.is-selected]="isBasemapSelected(choice)"
                            (click)="selectBasemap(choice)">
                      <span class="follow-style-tile">
                        <img class="follow-style-preview" [src]="choice.preview" [alt]="" width="144" height="144">
                      </span>
                      <span class="follow-style-label">{{ choice.name }}</span>
                    </button>
                  }
                </div>
              </div>
            </div>
            @if (mapProvider === MapProvider.OS) {
              <p class="follow-os-credit">
                Contains OS data © Crown copyright and database rights {{ osCopyrightYear }}.
                <a [href]="osTermsHref" target="_blank" rel="noopener">Terms</a>
                ·
                <a [href]="osErrorHref" target="_blank" rel="noopener">Report an error</a>
              </p>
            }
            @if (styleRoute) {
              <p class="follow-style-heading">While following</p>
              <div class="follow-progress-paint">
                <button type="button" class="btn btn-sm follow-progress-paint-btn"
                        [class.btn-primary]="progressPaint === RouteFollowProgressPaint.COLOUR_WALKED"
                        [class.btn-quiet]="progressPaint !== RouteFollowProgressPaint.COLOUR_WALKED"
                        (click)="setProgressPaint(RouteFollowProgressPaint.COLOUR_WALKED)">
                  <fa-icon [icon]="faShoePrints"/>Colour walked
                </button>
                <button type="button" class="btn btn-sm follow-progress-paint-btn"
                        [class.btn-primary]="progressPaint === RouteFollowProgressPaint.COLOUR_AHEAD"
                        [class.btn-quiet]="progressPaint !== RouteFollowProgressPaint.COLOUR_AHEAD"
                        (click)="setProgressPaint(RouteFollowProgressPaint.COLOUR_AHEAD)">
                  <fa-icon [icon]="faFlagCheckered"/>Colour remaining
                </button>
              </div>
            }
          </div>
        }
        <div class="follow-bottom">
          <div class="follow-bottom-chrome">
            @if (mapScale.label) {
              <div class="follow-map-scale" [style.width.px]="mapScale.widthPx">
                <div class="follow-map-scale-labels">
                  <span>0</span>
                  <span>{{ mapScale.midLabel }}</span>
                  <span>{{ mapScale.label }}</span>
                </div>
                <div class="follow-map-scale-track">
                  <span class="follow-map-scale-fill"></span>
                </div>
              </div>
            } @else {
              <span class="follow-map-scale-spacer"></span>
            }
          <div class="follow-map-tools">
            <button class="follow-heading-tool" type="button" [class.is-active]="headingUp"
                    (click)="toggleMapHeading()"
                    [tooltip]="headingUp ? 'Keep the map north-up' : 'Turn the map with the route'"
                    [isDisabled]="!tooltipsEnabled"
                    placement="left" container=".follow-app"
                    [attr.aria-label]="headingUp ? 'Keep the map north-up' : 'Turn the map with the route'">
              @if (headingUp) {
                <fa-icon [icon]="faUpLong"/>
              } @else {
                <span class="follow-heading-n">N</span>
              }
            </button>
            @if (progress?.mode === RouteFollowMode.EDITING && !thinningPrompt) {
              <div class="follow-tool-stack">
                <button class="follow-tool" type="button"
                        [class.is-active]="editTool === RouteFollowEditTool.PENCIL"
                        (click)="setEditTool(RouteFollowEditTool.PENCIL)"
                        tooltip="Pencil: move and add points" [isDisabled]="!tooltipsEnabled"
                        placement="left" container=".follow-app"
                        aria-label="Pencil: move and add points">
                  <fa-icon [icon]="faPencil"/>
                </button>
                <button class="follow-tool" type="button"
                        [class.is-active]="editTool === RouteFollowEditTool.ERASER"
                        (click)="setEditTool(RouteFollowEditTool.ERASER)"
                        tooltip="Eraser: remove points" [isDisabled]="!tooltipsEnabled"
                        placement="left" container=".follow-app"
                        aria-label="Eraser: remove points">
                  <fa-icon [icon]="faEraser"/>
                </button>
              </div>
            }
            <div class="follow-tool-stack">
              <button class="follow-tool" type="button" (click)="cycleAppearance()"
                      [tooltip]="appearanceLabel()" [isDisabled]="!tooltipsEnabled"
                      placement="left" container=".follow-app"
                      [attr.aria-label]="appearanceLabel()">
                <fa-icon [icon]="appearanceIcon()"/>
              </button>
              <button class="follow-tool" type="button" [class.is-active]="showStylePicker"
                      (click)="toggleStylePicker()"
                      tooltip="Map style" [isDisabled]="!tooltipsEnabled"
                      placement="left" container=".follow-app"
                      aria-label="Map style">
                <fa-icon [icon]="faLayerGroup"/>
              </button>
              <button class="follow-tool" type="button" [class.is-active]="!followUser" (click)="recenter()"
                      tooltip="Recentre on me" [isDisabled]="!tooltipsEnabled"
                      placement="left" container=".follow-app"
                      aria-label="Recentre on me">
                <fa-icon [icon]="faLocationArrow"/>
              </button>
            </div>
          </div>
          </div>
          <section class="follow-sheet" [class.is-minimised]="sheetMinimised">
          <button class="follow-sheet-handle" type="button"
                  (pointerdown)="onSheetHandlePointerDown($event)"
                  (click)="onSheetHandleClick()"
                  [attr.aria-expanded]="!sheetMinimised"
                  [attr.aria-label]="sheetMinimised ? 'Show route details' : 'Hide route details'">
            <span class="follow-sheet-grab" aria-hidden="true"></span>
          </button>
          @if (!creatingLine && (hasElevation || (sheetMinimised && progress?.mode !== RouteFollowMode.EDITING && progress?.mode !== RouteFollowMode.RECORDING))) {
          <div class="follow-sheet-peek"
               (pointerdown)="onSheetHandlePointerDown($event)"
               (click)="onSheetHandleClick()">
            @if (hasElevation) {
              <div class="follow-peek-stat">
                <span>Elevation</span>
                <strong>{{ currentElevation }}</strong>
              </div>
            }
            @if (sheetMinimised && progress?.mode !== RouteFollowMode.EDITING && progress?.mode !== RouteFollowMode.RECORDING) {
              @if (progress?.mode === RouteFollowMode.PAUSED) {
                <button class="follow-start-tool" type="button"
                        (pointerdown)="$event.stopPropagation()" (click)="onPeekAction($event)"
                        tooltip="Resume" [isDisabled]="!tooltipsEnabled" placement="top" container=".follow-app" aria-label="Resume">
                  <fa-icon [icon]="faPlay"/>
                </button>
              } @else if (progress?.mode === RouteFollowMode.FOLLOWING || progress?.mode === RouteFollowMode.PREVIEW) {
                <button class="follow-start-tool" type="button"
                        (pointerdown)="$event.stopPropagation()" (click)="onPeekAction($event)"
                        tooltip="Pause" [isDisabled]="!tooltipsEnabled" placement="top" container=".follow-app" aria-label="Pause">
                  <fa-icon [icon]="faPause"/>
                </button>
              } @else {
                <button class="follow-start-tool" type="button"
                        (pointerdown)="$event.stopPropagation()" (click)="onPeekAction($event)"
                        tooltip="Start" [isDisabled]="!tooltipsEnabled" placement="top" container=".follow-app" aria-label="Start">
                  <fa-icon [icon]="faPersonWalking"/>
                </button>
              }
            }
          </div>
          }
          <div class="follow-sheet-body-slot">
          <div class="follow-sheet-body">
          @if (hasLine && offlineStatus === RouteFollowOfflineStatus.AVAILABLE) {
            <p class="follow-offline-status">Available off-line</p>
          } @else if (offlineStatus === RouteFollowOfflineStatus.SAVING) {
            <p class="follow-offline-status">{{ saveProgress || "Saving the map for offline use…" }}</p>
          }
          @if (persistMessage) {
            <p class="follow-offline-status">{{ persistMessage }}</p>
          }
          @if (persistError) {
            <div class="follow-alert follow-alert-warning">
              <fa-icon [icon]="faCircleExclamation"/>
              <div>
                <strong>The route was not saved</strong>
                <p>{{ persistError }}</p>
              </div>
            </div>
          }
          @if (thinningPrompt) {
            <div class="follow-alert follow-alert-warning follow-alert-choice">
              <fa-icon [icon]="faCircleExclamation"/>
              <div class="follow-alert-body">
                <strong>Reduce data density?</strong>
                <div class="follow-alert-copy">
                  <p>This line has {{ thinningPromptCount }} points, which is a lot to edit. Reducing the density is recommended and would keep about {{ thinningPromptSuggested }} points. You can keep every point if you prefer.</p>
                  <div class="follow-alert-actions d-flex flex-wrap gap-2">
                    <button class="btn btn-primary" type="button" (click)="acceptThinning()">
                      Reduce data density
                    </button>
                    <button class="btn btn-quiet" type="button" (click)="declineThinning()">
                      Keep all points
                    </button>
                  </div>
                </div>
              </div>
            </div>
          } @else if (progress?.mode === RouteFollowMode.RECORDING) {
            <p class="follow-library-note">Walk the route. The line is drawn as you go. If there are a lot of points, Save asks whether to reduce the data density first.</p>
          } @else if (progress?.mode === RouteFollowMode.EDITING) {
            <div class="follow-edit-notes">
              <p class="follow-library-note">{{ editToolNote }}</p>
              @if (showEditThinning) {
                <p class="follow-library-note">This line has {{ originalEditCount }} points. Showing {{ editVertices.length }} so you can edit it.</p>
              }
            </div>
            @if (showEditThinning) {
              <div class="follow-speed">
                <app-range-slider label="Keep more points" unit=""
                                  [min]="editDetailMin" [max]="editDetailMax" [step]="1"
                                  [value]="editDetail" (valueChange)="onEditDetail($event)"/>
              </div>
            }
          } @else if (!hasLine && !canEditRoute) {
            <p class="follow-library-note">Ramblers publish the start of this route. The line and turn-by-turn stay on their site, so this screen will take you to the start.</p>
          }
          @if (loginPrompt) {
            <p class="follow-library-note">Editing and recording are for walk leaders and admins. <a [href]="loginUrl()">Log in</a> to see those options here.</p>
          }
          @if (hasLine && progress?.mode !== RouteFollowMode.EDITING) {
            <div class="follow-stats">
              <div class="follow-stat">
                <span>Remaining distance</span>
                <strong>{{ remainingDistance }}</strong>
              </div>
              <div class="follow-stat">
                <span>Remaining time</span>
                <strong>{{ remainingTime }}</strong>
              </div>
              <div class="follow-stat">
                <span>Current elevation</span>
                <strong>{{ currentElevation }}</strong>
              </div>
            </div>
          }
          @if (progress?.mode === RouteFollowMode.PREVIEW) {
            <div class="follow-speed">
              <app-range-slider label="Preview speed" unit="×"
                                [min]="previewSpeedMin" [max]="previewSpeedMax" [step]="1"
                                [value]="previewSpeed" (valueChange)="onPreviewSpeed($event)"/>
            </div>
          }
          <div class="follow-actions">
            <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="closeFollow()">
              <fa-icon [icon]="faXmark"/>Close
            </button>
            @if (!thinningPrompt && progress?.mode === RouteFollowMode.PREVIEW) {
              <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="stop()">
                <fa-icon [icon]="faStop"/>Stop preview
              </button>
              <button class="btn btn-primary follow-main-btn" type="button" (click)="start()">
                <fa-icon [icon]="faPersonWalking"/>{{ hasLine ? "Start" : "Head to the start" }}
              </button>
            } @else if (!thinningPrompt && progress?.mode === RouteFollowMode.EDITING) {
              <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="undoEdit()" [disabled]="editVertices.length === 0">
                <fa-icon [icon]="faRotateLeft"/>Undo
              </button>
              <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="reverseRoute()" [disabled]="editVertices.length < 2">
                <fa-icon [icon]="faRightLeft"/>Reverse
              </button>
              @if (!showEditThinning && originalEditCount > editThinFrom) {
                <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="enableThinning()">
                  <fa-icon [icon]="faCompress"/>Reduce data density
                </button>
              }
              <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="cancelEdit()">
                <fa-icon [icon]="faXmark"/>Cancel
              </button>
              <button class="btn btn-primary follow-main-btn" type="button" (click)="saveRoute()" [disabled]="savingRoute || !hasLine">
                <fa-icon [icon]="faFloppyDisk"/>{{ savingRoute ? "Saving…" : "Save route" }}
              </button>
            } @else if (!thinningPrompt && progress?.mode === RouteFollowMode.RECORDING) {
              <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="cancelEdit()">
                Discard
              </button>
              <button class="btn btn-primary follow-main-btn" type="button" (click)="saveRoute()" [disabled]="savingRoute || !hasLine">
                <fa-icon [icon]="faFloppyDisk"/>{{ savingRoute ? "Saving…" : "Save route" }}
              </button>
            } @else if (!thinningPrompt && progress?.mode === RouteFollowMode.IDLE) {
              @if (!creatingLine && offlineStatus !== RouteFollowOfflineStatus.AVAILABLE && offlineStatus !== RouteFollowOfflineStatus.SAVING) {
                <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="saveOffline()" [disabled]="!!saveProgress">
                  Save off-line
                </button>
              } @else if (showPreview && hasLine) {
                <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="preview()">Preview</button>
              }
              @if (!creatingLine) {
                <button class="btn btn-primary follow-main-btn" type="button" (click)="start()">
                  <fa-icon [icon]="faPersonWalking"/>{{ hasLine ? "Start" : "Head to the start" }}
                </button>
              }
              @if (canEditRoute) {
                <button class="btn" type="button" (click)="editRoute()"
                        [class.btn-primary]="creatingLine"
                        [class.follow-main-btn]="creatingLine"
                        [class.btn-quiet]="!creatingLine"
                        [class.follow-secondary-btn]="!creatingLine">
                  <fa-icon [icon]="faPencil"/>{{ hasLine ? "Edit points" : "Draw route" }}
                </button>
                <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="recordRoute()">
                  <fa-icon class="red-icon" [icon]="faCircle"/>Record
                </button>
              }
            } @else if (!thinningPrompt && progress?.mode === RouteFollowMode.PAUSED) {
              <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="stop()">
                <fa-icon [icon]="faStop"/>Stop
              </button>
              <button class="btn btn-primary follow-main-btn" type="button" (click)="resume()">
                <fa-icon [icon]="faPlay"/>Resume
              </button>
            } @else if (!thinningPrompt) {
              <button class="btn btn-quiet follow-secondary-btn" type="button" (click)="stop()">
                <fa-icon [icon]="faStop"/>Stop
              </button>
              <button class="btn btn-primary follow-main-btn" type="button" (click)="pause()">
                <fa-icon [icon]="faPause"/>Pause
              </button>
            }
          </div>
          </div>
          </div>
        </section>
        </div>
      }
    </div>
  `,
  styleUrls: ["./route-follow.sass"],
  imports: [LeafletModule, FontAwesomeModule, RangeSliderComponent, TooltipDirective, MapRouteStylePaletteComponent]
})
export class RouteFollowComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("RouteFollowComponent", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pageContentService = inject(PageContentService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private payloadService = inject(RouteFollowPayloadService);
  private routeSave = inject(RouteFollowSaveService);
  private osMapsExport = inject(OsMapsExportService);
  private ramblersLibrary = inject(RamblersLibraryRouteService);
  private followCache = inject(RouteFollowCacheService);
  private followService = inject(RouteFollowService);
  private walkDisplay = inject(WalkDisplayService);
  private memberLogin = inject(MemberLoginService);
  private uiActions = inject(UiActionsService);
  private mapTiles = inject(MapTilesService);
  private osBranding = inject(OsMapsBrandingService);
  private markerStyle = inject(MapMarkerStyleService);
  private mapControls = inject(MapControlsStateService);
  private appShell = inject(AppShellService);
  protected payload: RouteFollowPayload | null = null;
  protected progress: RouteFollowProgress | null = null;
  protected loading = true;
  protected loginPrompt = false;
  protected error: string | null = null;
  protected options: L.MapOptions | null = null;
  protected layers: L.Layer[] = [];
  protected followUser = true;
  protected showPreview = false;
  protected tooltipsEnabled = false;
  protected offlineStatus: RouteFollowOfflineStatus = RouteFollowOfflineStatus.NEEDS_NETWORK;
  protected saveProgress = "";
  protected persistMessage = "";
  protected persistError: string | null = null;
  protected savingRoute = false;
  protected canEditRoute = false;
  protected styleRoute: MapRoute | null = null;
  private savedStyle: {color: string; weight: number; opacity: number} | null = null;
  protected editVertices: {latitude: number; longitude: number}[] = [];
  protected originalEditCount = 0;
  protected showEditThinning = false;
  protected thinningPrompt = false;
  protected thinningPromptCount = 0;
  protected thinningPromptSuggested = 0;
  protected readonly editThinFrom = ROUTE_FOLLOW_EDIT_THIN_FROM;
  protected editDetail = 6;
  protected readonly editDetailMin = ROUTE_FOLLOW_EDIT_DETAIL_MIN;
  protected readonly editDetailMax = ROUTE_FOLLOW_EDIT_DETAIL_MAX;
  private draftPoints: {latitude: number; longitude: number}[] = [];
  private pendingEditSource: {latitude: number; longitude: number}[] = [];
  private pendingEditMessage = "";
  private loadedWalk: ExtendedGroupEvent | null = null;
  private editGroup = L.layerGroup();
  private draggingVertexIndex: number | null = null;
  private insertHover = false;
  private ignoreEditClick = false;
  private editTap = {active: false, pointerId: -1, x: 0, y: 0};
  private editHalo: L.Polyline | null = null;
  private editCore: L.Polyline | null = null;
  protected readonly RouteFollowOfflineStatus = RouteFollowOfflineStatus;
  protected readonly RouteFollowMode = RouteFollowMode;
  protected readonly RouteFollowEditTool = RouteFollowEditTool;
  protected readonly RouteFollowSheetState = RouteFollowSheetState;
  protected sheetState = RouteFollowSheetState.MINIMISED;
  private sheetDrag = {active: false, pointerId: -1, startY: 0, lastY: 0, moved: false};
  protected editTool = RouteFollowEditTool.PENCIL;
  protected readonly faCircle = faCircle;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faCircleHalfStroke = faCircleHalfStroke;
  protected readonly faLocationArrow = faLocationArrow;
  protected readonly faMoon = faMoon;
  protected readonly faSun = faSun;
  protected readonly faPause = faPause;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly faPlay = faPlay;
  protected readonly faStop = faStop;
  protected readonly faPencil = faPencil;
  protected readonly faEraser = faEraser;
  protected readonly faCompress = faCompress;
  protected readonly faFlagCheckered = faFlagCheckered;
  protected readonly faFloppyDisk = faFloppyDisk;
  protected readonly faUpLong = faUpLong;
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly faShoePrints = faShoePrints;
  protected readonly faRightLeft = faRightLeft;
  private mapRef: L.Map | null = null;
  private wakeLock: {release: () => Promise<void>} | null = null;
  private subscriptions: Subscription[] = [];
  private gestures: MapGestures | null = null;
  private zone = inject(NgZone);
  protected mapBearing = 0;
  protected headingUp = false;
  protected appearance: AppAppearance = AppAppearance.SYSTEM;
  protected previewSpeed = ROUTE_FOLLOW_PREVIEW_SPEED_DEFAULT;
  protected readonly previewSpeedMin = ROUTE_FOLLOW_PREVIEW_SPEED_MIN;
  protected readonly previewSpeedMax = ROUTE_FOLLOW_PREVIEW_SPEED_MAX;
  protected showStylePicker = false;
  private stylePickerFromProvider = MapProvider.OS;
  private stylePickerFromStyle = DEFAULT_OS_STYLE;
  protected mapProvider: MapProvider = MapProvider.OS;
  protected osStyle = DEFAULT_OS_STYLE;
  protected readonly basemapChoices = MAP_BASEMAP_CHOICES;
  protected readonly PaletteColor = PaletteColor;
  protected readonly RouteFollowProgressPaint = RouteFollowProgressPaint;
  protected progressPaint = RouteFollowProgressPaint.COLOUR_WALKED;
  protected readonly MapProvider = MapProvider;
  protected readonly osTermsHref = OsMapsBrandingHref.TERMS;
  protected readonly osErrorHref = OsMapsBrandingHref.ERROR_REPORTING;
  protected readonly faLayerGroup = faLayerGroup;
  protected readonly faXmark = faXmark;
  protected mapScale: FollowMapScaleBar = {label: "", midLabel: "", widthPx: 0};
  protected gridReference = "";
  protected compassHeadingText = "";
  protected tapeMarks: CompassTapeMark[] = [];
  private skipNextFit = false;
  private lastRecordedPointCount = -1;
  private arrowGroup = L.layerGroup();
  private pointerMarker: L.Marker | null = null;

  ngOnInit(): void {
    this.refreshTape();
    this.appearance = this.appShell.appearance();
    this.progressPaint = routeFollowProgressPaintFrom(this.uiActions.initialValueFor(StoredValue.FOLLOW_PROGRESS_PAINT, RouteFollowProgressPaint.COLOUR_WALKED));
    this.followService.setPreviewSpeed(this.previewSpeed);
    this.showPreview = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    this.tooltipsEnabled = this.appShell.platform() === AppInstallPlatform.OTHER
      && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    this.subscriptions.push(this.appShell.appearance$.subscribe(appearance => {
      this.appearance = appearance;
    }));
    this.subscriptions.push(this.followService.progress$.subscribe(progress => {
      const previous = this.progress;
      this.progress = progress;
      this.refreshHud();
      if (this.headingOnlyUpdate(previous, progress)) {
        this.refreshHeadingVisuals();
      } else {
        this.persistFollowSession();
        if (this.draggingVertexIndex === null) {
          this.redraw();
        }
      }
    }));
    this.rememberHowWeArrived();
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      void this.load(
        params.get(RouteFollowQueryParam.PATH),
        params.get(RouteFollowQueryParam.ROUTE_ID),
        params.get(RouteFollowQueryParam.WALK_ID),
        params.get(RouteFollowQueryParam.RAMBLERS_SLUG),
        params.get(RouteFollowQueryParam.OS_MAPS_ROUTE_ID)
      );
    }));
  }

  ngOnDestroy(): void {
    const container = this.mapRef?.getContainer();
    if (container) {
      container.removeEventListener("pointerdown", this.onEditPointerDown);
      container.removeEventListener("pointerup", this.onEditPointerUp);
      container.removeEventListener("pointercancel", this.onEditPointerCancel);
    }
    this.gestures?.setOnBearing(null);
    this.followService.stop();
    void this.releaseWakeLock();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  @HostListener("window:resize")
  onViewportChange(): void {
    this.mapRef?.invalidateSize();
  }

  @HostListener("document:visibilitychange")
  onVisibilityChange(): void {
    if (document.visibilityState === "hidden") {
      this.persistFollowSession(true);
    } else if (document.visibilityState === "visible" && this.progress && isLiveFollowMode(this.progress.mode)) {
      this.followService.resumeWatchIfLive();
      void this.requestWakeLock();
    }
  }

  @HostListener("window:pagehide")
  onPageHide(): void {
    this.persistFollowSession(true);
  }

  get remainingDistance(): string {
    if (!this.hasLine && !this.progress?.position) {
      return "—";
    } else {
      return this.followService.formatDistance(this.progress?.remainingMetres ?? this.payload?.totalMetres ?? 0);
    }
  }

  get remainingTime(): string {
    if (!this.hasLine && !this.progress?.position) {
      return "—";
    } else {
      return this.followService.formatDuration(this.progress?.remainingMinutes ?? 0);
    }
  }

  get currentElevation(): string {
    return this.followService.formatElevation(this.progress?.currentElevationMetres ?? this.payload?.points?.[0]?.elevation ?? null);
  }

  get hasElevation(): boolean {
    return isNumber(this.progress?.currentElevationMetres ?? this.payload?.points?.[0]?.elevation ?? null);
  }

  get osCopyrightYear(): string {
    return this.osBranding.copyrightYear();
  }

  get hasLine(): boolean {
    return this.followService.trackPoints().length >= 2;
  }

  get creatingLine(): boolean {
    return this.canEditRoute && !this.hasLine;
  }

  get styleDirty(): boolean {
    if (!this.payload || !this.savedStyle) {
      return false;
    } else {
      return this.payload.color !== this.savedStyle.color
        || this.payload.weight !== this.savedStyle.weight
        || this.payload.opacity !== this.savedStyle.opacity;
    }
  }

  get editToolNote(): string {
    if (this.editTool === RouteFollowEditTool.ERASER) {
      return "Tap a point to remove it. Switch back to the pencil to move or add points. Reverse swaps the start and finish.";
    } else {
      return "Drag a white point to move it. Tap the line, or just beside it, to add a point on the route. Tap away from the line to continue from the nearer end. Reverse swaps the start and finish.";
    }
  }

  get isLive(): boolean {
    return this.progress?.mode === RouteFollowMode.FOLLOWING || this.progress?.mode === RouteFollowMode.PREVIEW;
  }

  get showOffRoute(): boolean {
    return !!this.progress?.offRoute && isLiveFollowMode(this.progress.mode);
  }

  get offRouteMessage(): string {
    const direction = this.progress?.returnDirection;
    if (direction === RouteFollowReturnDirection.LEFT) {
      return "Off the route. Head left.";
    } else if (direction === RouteFollowReturnDirection.RIGHT) {
      return "Off the route. Head right.";
    } else if (direction === RouteFollowReturnDirection.FORWARD) {
      return "Off the route. Head forward.";
    } else if (direction === RouteFollowReturnDirection.BACK) {
      return "Off the route. Head back.";
    } else {
      return "Off the route. Head back to the line.";
    }
  }

  get instructionWaypoint(): RouteFollowWaypoint | null {
    if (this.progress?.approachedWaypoint || this.progress?.nextWaypoint) {
      return this.progress.approachedWaypoint || this.progress.nextWaypoint;
    } else {
      return this.payload?.waypoints?.[0] || null;
    }
  }

  get instructionText(): string {
    const waypoint = this.instructionWaypoint;
    if (!waypoint) {
      return "";
    } else if (this.progress?.approachedWaypoint) {
      return waypoint.instruction || waypoint.label || "You are here";
    } else if (!this.hasLine) {
      return waypoint.instruction || "Walk to the start of this Ramblers route";
    } else if (this.progress?.mode === RouteFollowMode.IDLE) {
      return waypoint.instruction || "Start here, then follow the line";
    } else {
      return waypoint.instruction || waypoint.label || "Continue along the path";
    }
  }

  get nextDistanceLabel(): string {
    if (this.progress?.approachedWaypoint) {
      return "Now";
    } else if (!this.hasLine && !this.progress?.position) {
      return "Tap Head to the start, then allow location";
    } else if (!this.hasLine) {
      return this.followService.formatDistance(this.progress?.nextWaypointMetres ?? null);
    } else if (this.progress?.mode === RouteFollowMode.IDLE) {
      return "Tap Start, then allow location";
    } else {
      return this.followService.formatDistance(this.progress?.nextWaypointMetres ?? null);
    }
  }

  get locationMessage(): string | null {
    const error = this.progress?.locationError;
    const platform = this.appShell.platform();
    if (error === RouteFollowLocationError.DENIED) {
      return platform === AppInstallPlatform.IOS
        ? "Location is off. On iPhone go to Settings, then Privacy & Security, then Location Services, and allow it for this browser."
        : "Location is off. On Android open Settings, then Apps, then this browser, then Permissions, then Location.";
    } else if (error === RouteFollowLocationError.UNSUPPORTED) {
      return "This phone cannot share its location in the browser.";
    } else if (error === RouteFollowLocationError.TIMEOUT || error === RouteFollowLocationError.UNAVAILABLE) {
      return "Waiting for a GPS fix. Step outside if you can, then tap Start again.";
    } else {
      return null;
    }
  }

  waypointNumber(waypoint: RouteFollowWaypoint | null, index = 0): string {
    const label = (waypoint?.label || "").trim();
    return label && label.length <= 3 ? label : String(index + 1);
  }

  onMapReady(map: L.Map): void {
    this.mapRef = map;
    this.pointerMarker = null;
    this.arrowGroup.addTo(map);
    this.editGroup.addTo(map);
    map.on("click", event => this.zone.run(() => this.onMapClick(event)));
    map.on("mousemove", event => this.zone.run(() => this.onEditHover(event)));
    map.on("mouseout", () => this.zone.run(() => this.clearInsertHover()));
    const container = map.getContainer();
    container.addEventListener("pointerdown", this.onEditPointerDown);
    container.addEventListener("pointerup", this.onEditPointerUp);
    container.addEventListener("pointercancel", this.onEditPointerCancel);
    this.gestures = mapGesturesFor(map);
    this.gestures?.setOnBearing(bearing => {
      this.zone.run(() => {
        this.mapBearing = bearing;
      });
    });
    this.gestures?.setOnUserRotate(() => {
      this.zone.run(() => {
        this.headingUp = false;
      });
    });
    map.on("dragstart", () => {
      this.followUser = false;
    });
    map.on("zoom move", () => this.zone.run(() => this.refreshHud()));
    this.refreshHud();
    this.redraw();
    if (this.progress?.mode === RouteFollowMode.EDITING) {
      this.refreshEditHandles();
    }
    if (this.skipNextFit) {
      this.skipNextFit = false;
    } else {
      this.fitRoute();
    }
    setTimeout(() => map.invalidateSize(), 200);
  }

  toggleStylePicker(): void {
    if (this.showStylePicker) {
      this.closeStylePicker();
    } else {
      this.stylePickerFromProvider = this.mapProvider;
      this.stylePickerFromStyle = this.osStyle;
      this.showStylePicker = true;
    }
  }

  closeStylePicker(): void {
    this.mapControls.saveProvider(this.mapProvider);
    if (this.mapProvider === MapProvider.OS) {
      this.mapControls.saveOsStyle(this.osStyle);
    }
    this.showStylePicker = false;
    if (this.canEditRoute && this.styleDirty) {
      void this.saveStyle();
    }
  }

  undoStylePicker(): void {
    if (this.stylePickerDirty) {
      this.applyMapStyle(this.stylePickerFromProvider, this.stylePickerFromStyle, false);
    }
  }

  get stylePickerDirty(): boolean {
    if (this.mapProvider !== this.stylePickerFromProvider) {
      return true;
    } else if (this.mapProvider === MapProvider.OS) {
      return this.osStyle !== this.stylePickerFromStyle;
    } else {
      return false;
    }
  }

  isBasemapSelected(choice: MapBasemapChoice): boolean {
    if (choice.provider === MapProvider.OSM) {
      return this.mapProvider === MapProvider.OSM;
    } else {
      return this.mapProvider === MapProvider.OS && this.osStyle === choice.style;
    }
  }

  selectRouteColor(color: string): void {
    if (this.styleRoute) {
      this.styleRoute.color = color;
      this.onRouteStyleChange();
    }
  }

  setProgressPaint(paint: RouteFollowProgressPaint): void {
    this.progressPaint = paint;
    this.uiActions.saveValueFor(StoredValue.FOLLOW_PROGRESS_PAINT, paint);
    this.redraw();
  }

  selectBasemap(choice: MapBasemapChoice): void {
    if (choice.provider === MapProvider.OSM) {
      this.applyMapStyle(choice.provider, this.osStyle, true);
    } else {
      this.applyMapStyle(choice.provider, choice.style, true);
    }
  }

  applyMapStyle(provider: MapProvider, style: string, keepOpen: boolean): void {
    if (provider === this.mapProvider && style === this.osStyle) {
      if (!keepOpen) {
        this.showStylePicker = false;
      }
    } else {
      const fromProvider = this.mapProvider;
      const fromStyle = this.osStyle;
      const center = this.mapRef?.getCenter() || null;
      const fromZoom = this.mapRef?.getZoom() ?? null;
      const zoom = center && fromZoom !== null
        ? this.mapTiles.matchingZoom(fromProvider, fromStyle, fromZoom, provider, style, center.lat)
        : null;
      this.mapProvider = provider;
      this.osStyle = style;
      if (this.payload) {
        this.payload = {...this.payload, provider, osStyle: style};
        this.skipNextFit = true;
        this.removeEditLine();
        this.mapRef = null;
        this.options = null;
        this.zone.run(() => {
          setTimeout(() => {
            if (this.payload) {
              this.buildMapOptions(this.payload, center && zoom !== null ? {center, zoom} : null);
              this.redraw();
            }
            if (!keepOpen) {
              this.showStylePicker = false;
            }
          }, 0);
        });
      } else if (!keepOpen) {
        this.showStylePicker = false;
      }
    }
  }

  toggleMapHeading(): void {
    const gestures = this.gestures || (this.mapRef ? mapGesturesFor(this.mapRef) : null);
    this.gestures = gestures;
    if (this.headingUp || Math.abs(this.mapBearing) > 1) {
      this.headingUp = false;
      if (gestures) {
        gestures.resetNorth();
      }
      this.mapBearing = 0;
    } else {
      this.headingUp = true;
      this.applyHeadingUp();
    }
    this.persistFollowSession();
  }

  private applyHeadingUp(): void {
    const gestures = this.gestures || (this.mapRef ? mapGesturesFor(this.mapRef) : null);
    this.gestures = gestures;
    const next = -this.currentHeading();
    if (Math.abs(mapAngleDelta(this.mapBearing, next)) >= ROUTE_FOLLOW_HEADING_UP_MIN_DELTA) {
      if (gestures) {
        gestures.setBearing(next);
      }
      this.mapBearing = next;
    }
  }

  private currentHeading(): number {
    const deviceHeading = this.progress?.heading;
    const routeHeading = this.progress?.routeHeading;
    if (isNumber(deviceHeading)) {
      return deviceHeading;
    } else if (isNumber(routeHeading)) {
      return routeHeading;
    } else if (this.payload && this.payload.points.length >= 2) {
      return this.followService.headingBetween(this.payload.points[0], this.payload.points[1]);
    } else {
      return 0;
    }
  }

  cycleAppearance(): void {
    this.appShell.cycleAppearance();
  }

  onPreviewSpeed(value: number | string): void {
    this.previewSpeed = Number(value);
    this.followService.setPreviewSpeed(this.previewSpeed);
  }

  appearanceIcon() {
    if (this.appearance === AppAppearance.LIGHT) {
      return this.faSun;
    } else if (this.appearance === AppAppearance.DARK) {
      return this.faMoon;
    } else {
      return this.faCircleHalfStroke;
    }
  }

  appearanceLabel(): string {
    if (this.appearance === AppAppearance.LIGHT) {
      return "Appearance: light. Tap for dark";
    } else if (this.appearance === AppAppearance.DARK) {
      return "Appearance: dark. Tap for light";
    } else {
      return "Appearance: match phone. Tap to switch";
    }
  }

  get sheetMinimised(): boolean {
    return this.sheetState === RouteFollowSheetState.MINIMISED;
  }

  onPeekAction(event: Event): void {
    event.stopPropagation();
    if (this.progress?.mode === RouteFollowMode.PAUSED) {
      this.resume();
    } else if (this.progress?.mode === RouteFollowMode.FOLLOWING || this.progress?.mode === RouteFollowMode.PREVIEW) {
      this.pause();
    } else {
      void this.start();
    }
  }

  onSheetHandlePointerDown(event: PointerEvent): void {
    this.sheetDrag.active = true;
    this.sheetDrag.pointerId = event.pointerId;
    this.sheetDrag.startY = event.clientY;
    this.sheetDrag.lastY = event.clientY;
    this.sheetDrag.moved = false;
  }

  @HostListener("document:pointermove", ["$event"])
  onSheetPointerMove(event: PointerEvent): void {
    if (this.sheetDrag.active && event.pointerId === this.sheetDrag.pointerId) {
      this.sheetDrag.lastY = event.clientY;
      if (Math.abs(event.clientY - this.sheetDrag.startY) > 8) {
        this.sheetDrag.moved = true;
      }
    }
  }

  @HostListener("document:pointerup", ["$event"])
  onSheetPointerUp(event: PointerEvent): void {
    if (this.sheetDrag.active && event.pointerId === this.sheetDrag.pointerId) {
      const nextState = sheetStateAfterDrag(this.sheetState, this.sheetDrag.lastY - this.sheetDrag.startY);
      this.sheetDrag.active = false;
      if (this.sheetDrag.moved && nextState !== this.sheetState) {
        this.sheetState = nextState;
        this.persistFollowSession();
        this.refreshMapSize();
      }
    }
  }

  onSheetHandleClick(): void {
    if (!this.sheetDrag.moved) {
      this.toggleSheet();
    }
    this.sheetDrag.moved = false;
  }

  toggleSheet(): void {
    if (this.sheetMinimised) {
      this.expandSheet();
    } else {
      this.minimiseSheet();
    }
  }

  minimiseSheet(): void {
    this.sheetState = RouteFollowSheetState.MINIMISED;
    this.persistFollowSession();
    this.refreshMapSize();
  }

  expandSheet(): void {
    this.sheetState = RouteFollowSheetState.EXPANDED;
    this.persistFollowSession();
    this.refreshMapSize();
  }

  private revealIdleSheet(): void {
    if (!isLiveFollowMode(this.progress?.mode) && this.sheetMinimised) {
      setTimeout(() => this.expandSheet(), 80);
    }
  }

  private refreshMapSize(): void {
    setTimeout(() => this.mapRef?.invalidateSize(), 400);
  }

  private refreshHud(): void {
    const map = this.mapRef;
    if (!map) {
      this.mapScale = {label: "", midLabel: "", widthPx: 0};
      this.gridReference = "";
    } else {
      const left = map.containerPointToLatLng(L.point(0, 0));
      const right = map.containerPointToLatLng(L.point(100, 0));
      this.mapScale = followMapScaleBar(map.distance(left, right) / 100);
      this.gridReference = this.hudGridReference();
    }
    this.refreshTape();
  }

  private refreshTape(): void {
    const heading = this.currentHeading();
    this.compassHeadingText = compassHeadingLabel(heading);
    this.tapeMarks = compassTapeMarks(heading);
  }

  private hudGridReference(): string {
    const position = this.progress?.position;
    const center = this.mapRef?.getCenter() || null;
    const latitude = position?.latitude ?? center?.lat ?? null;
    const longitude = position?.longitude ?? center?.lng ?? null;
    if (!isNumber(latitude) || !isNumber(longitude)) {
      return "";
    } else {
      this.ensureOsProjection();
      const projected = proj4(MapProjectionCode.WGS84, MapProjectionCode.BRITISH_NATIONAL_GRID, [longitude, latitude]);
      return formatOsGridReference(projected[0], projected[1]);
    }
  }

  private ensureOsProjection(): void {
    if ((proj4 as any).defs && !(proj4 as any).defs[MapProjectionCode.BRITISH_NATIONAL_GRID]) {
      (proj4 as any).defs(MapProjectionCode.BRITISH_NATIONAL_GRID, EPSG_27700_PROJ4);
    }
  }

  async start(): Promise<void> {
    this.followUser = true;
    try {
      await this.followService.requestCompassPermission();
    } catch (error) {
      this.logger.info("compass permission", error);
    }
    this.followService.startFollowing();
    this.minimiseSheet();
    void this.requestWakeLock();
  }

  async saveOffline(): Promise<void> {
    if (this.payload) {
      this.saveProgress = "Saving the route…";
      this.offlineStatus = RouteFollowOfflineStatus.SAVING;
      try {
        const key = await this.followCache.savePayload(this.payload);
        const urls = this.mapTiles.tileUrlsForPoints(
          (this.payload.provider as MapProvider) || MapProvider.OS,
          this.payload.osStyle || DEFAULT_OS_STYLE,
          this.payload.points.length > 0 ? this.payload.points : this.payload.waypoints
        );
        const result = await this.followCache.prefetchTiles(urls, (done, total, bytes) => {
          this.saveProgress = formatMapSaveProgress(done, total, bytes);
        });
        if (key) {
          await this.followCache.markTiles(key, result.saved, result.saved > 0);
        }
        this.offlineStatus = result.saved > 0 ? RouteFollowOfflineStatus.AVAILABLE : RouteFollowOfflineStatus.NEEDS_NETWORK;
        this.saveProgress = "";
      } catch (error) {
        this.logger.error("saveOffline failed", error);
        this.saveProgress = "";
        this.offlineStatus = RouteFollowOfflineStatus.NEEDS_NETWORK;
      }
    }
  }

  preview(): void {
    this.followUser = true;
    this.followService.startPreview();
    this.minimiseSheet();
  }

  pause(): void {
    this.followService.pause();
    void this.releaseWakeLock();
  }

  resume(): void {
    this.followUser = true;
    this.followService.resume();
    void this.requestWakeLock();
  }

  stop(): void {
    this.clearInsertHover();
    this.followService.stop();
    this.clearFollowSession();
    this.expandSheet();
    this.thinningPrompt = false;
    this.pendingEditSource = [];
    this.editTool = RouteFollowEditTool.PENCIL;
    this.clearEditHandles();
    void this.releaseWakeLock();
    this.fitRoute();
  }

  editRoute(): void {
    if (!this.payload) {
      return;
    } else {
      const source = this.followService.trackPoints().length >= 2
        ? this.followService.trackPoints()
        : this.payload.points;
      if (source.length > ROUTE_FOLLOW_EDIT_THIN_FROM) {
        this.offerThinning(source, "");
      } else {
        this.beginEditFromPoints(source, "", false);
      }
    }
  }

  recordRoute(): void {
    if (!this.payload) {
      return;
    } else {
      this.persistError = null;
      this.persistMessage = "";
      this.lastRecordedPointCount = -1;
      this.draftPoints = this.followService.trackPoints().map(point => ({...point}));
      this.followUser = true;
      this.clearEditHandles();
      this.followService.startRecording(true);
      this.expandSheet();
      this.refreshArrows();
      this.redraw();
      void this.requestWakeLock();
    }
  }

  undoEdit(): void {
    if (this.editVertices.length > 0) {
      this.editVertices = this.editVertices.slice(0, this.editVertices.length - 1);
      this.followService.replaceTrack(this.editVertices);
      this.refreshEditHandles();
      this.redraw();
    }
  }

  setEditTool(tool: RouteFollowEditTool): void {
    this.editTool = tool;
    this.draggingVertexIndex = null;
    this.clearInsertHover();
    this.mapRef?.dragging.enable();
    this.refreshEditHandles();
  }

  onEditDetail(value: number | string): void {
    this.editDetail = Number(value);
    this.applyEditThinning();
    this.followService.replaceTrack(this.editVertices);
    this.refreshEditHandles();
    this.refreshArrows();
    this.redraw();
  }

  private applyEditThinning(): void {
    const spacing = this.followService.thinningSpacingMetres(this.editDetail);
    this.editVertices = this.followService.thinnedPoints(this.draftPoints, spacing);
  }

  reverseRoute(): void {
    this.draftPoints = [...this.draftPoints].reverse();
    this.followService.reverseRoute();
    this.editVertices = this.followService.trackPoints().map(point => ({
      latitude: point.latitude,
      longitude: point.longitude
    }));
    if (this.payload) {
      this.payload = {
        ...this.payload,
        points: this.editVertices,
        waypoints: this.followService.routeWaypoints()
      };
    }
    this.refreshEditHandles();
    this.refreshArrows();
    this.redraw();
  }

  cancelEdit(): void {
    this.clearInsertHover();
    this.thinningPrompt = false;
    this.pendingEditSource = [];
    this.followService.replaceTrack(this.draftPoints);
    this.draftPoints = [];
    this.editVertices = [];
    this.editTool = RouteFollowEditTool.PENCIL;
    this.restoreStyle();
    this.clearEditHandles();
    this.followService.stop();
    this.expandSheet();
    void this.releaseWakeLock();
    this.refreshArrows();
    this.redraw();
    this.fitRoute();
  }

  onRouteStyleChange(): void {
    if (this.payload && this.styleRoute) {
      this.payload = {
        ...this.payload,
        color: this.styleRoute.color || PaletteColor.ROSE,
        weight: this.styleRoute.weight || ROUTE_FOLLOW_LINE_WEIGHT_DEFAULT,
        opacity: this.styleRoute.opacity ?? 1
      };
      this.redraw();
    }
  }

  async saveStyle(): Promise<void> {
    if (this.payload && !this.savingRoute && this.routeSave.canPersist(this.payload)) {
      this.savingRoute = true;
      this.persistError = null;
      this.persistMessage = "Saving the style…";
      try {
        await this.routeSave.saveStyle(this.payload);
        this.rememberSavedStyle(this.payload);
        this.persistMessage = "Style saved. The walk and map pages will use these colours.";
      } catch (error) {
        this.logger.error("saveStyle failed", error);
        this.persistError = "The route style could not be saved. Check you are signed in and try again.";
        this.persistMessage = "";
      }
      this.savingRoute = false;
    }
  }

  async saveRoute(): Promise<void> {
    const recorded = this.followService.trackPoints();
    if (this.progress?.mode === RouteFollowMode.RECORDING && recorded.length > ROUTE_FOLLOW_EDIT_THIN_FROM) {
      this.offerThinning(recorded, "");
    } else if (!this.payload || this.savingRoute) {
      return;
    } else if (recorded.length < 2) {
      this.persistError = "Walk or draw at least two points first.";
    } else {
      this.savingRoute = true;
      this.persistError = null;
      this.persistMessage = "Saving the route…";
      try {
        await this.routeSave.save(this.payload, this.followService.trackPoints());
        this.payload = {...this.payload, points: this.followService.trackPoints()};
        this.rememberSavedStyle(this.payload);
        this.draftPoints = [];
        this.editVertices = [];
        this.clearEditHandles();
        this.followService.stop();
        this.clearFollowSession();
        void this.releaseWakeLock();
        this.refreshArrows();
        this.redraw();
        this.persistMessage = "Route saved. The walk and map pages will use this line.";
        void this.saveOffline();
      } catch (error) {
        this.logger.error("saveRoute failed", error);
        this.persistError = "Check you are signed in and try again.";
        this.persistMessage = "";
      }
      this.savingRoute = false;
    }
  }

  acceptThinning(): void {
    this.beginEditFromPoints(this.pendingEditSource, this.pendingEditMessage, true);
  }

  declineThinning(): void {
    this.beginEditFromPoints(this.pendingEditSource, "", false);
  }

  enableThinning(): void {
    this.showEditThinning = true;
    this.editDetail = this.followService.suggestedThinningDetail(this.draftPoints, ROUTE_FOLLOW_EDIT_TARGET_POINTS);
    this.applyEditThinning();
    this.followService.replaceTrack(this.editVertices);
    this.refreshEditHandles();
    this.refreshArrows();
    this.redraw();
  }

  private offerThinning(source: {latitude: number; longitude: number}[], message: string): void {
    this.pendingEditSource = source.map(point => ({
      latitude: point.latitude,
      longitude: point.longitude
    }));
    this.pendingEditMessage = message;
    this.thinningPromptCount = source.length;
    const detail = this.followService.suggestedThinningDetail(source, ROUTE_FOLLOW_EDIT_TARGET_POINTS);
    this.thinningPromptSuggested = this.followService.thinnedPoints(source, this.followService.thinningSpacingMetres(detail)).length;
    this.thinningPrompt = true;
    this.expandSheet();
    this.persistError = null;
    this.persistMessage = "";
    this.followUser = false;
    void this.releaseWakeLock();
    this.followService.startEditing();
  }

  private beginEditFromPoints(source: {latitude: number; longitude: number}[], message: string, thin: boolean): void {
    this.thinningPrompt = false;
    this.expandSheet();
    this.pendingEditSource = [];
    this.persistError = null;
    this.persistMessage = message;
    this.editTool = RouteFollowEditTool.PENCIL;
    this.followUser = false;
    void this.releaseWakeLock();
    this.draftPoints = source.map(point => ({
      latitude: point.latitude,
      longitude: point.longitude
    }));
    this.originalEditCount = this.draftPoints.length;
    this.showEditThinning = thin;
    if (thin) {
      this.editDetail = this.followService.suggestedThinningDetail(this.draftPoints, ROUTE_FOLLOW_EDIT_TARGET_POINTS);
      this.applyEditThinning();
    } else {
      this.editVertices = this.draftPoints.map(point => ({...point}));
    }
    this.followService.replaceTrack(this.editVertices);
    this.followService.startEditing();
    this.refreshEditHandles();
    this.refreshArrows();
    this.redraw();
  }

  private onEditHover(event: L.LeafletMouseEvent): void {
    if (this.progress?.mode !== RouteFollowMode.EDITING || this.editTool !== RouteFollowEditTool.PENCIL || this.draggingVertexIndex !== null || !this.mapRef) {
      this.clearInsertHover();
    } else if (this.editVertices.length < 2) {
      this.setInsertHover(true);
    } else {
      const nearest = this.followService.nearestSegment({latitude: event.latlng.lat, longitude: event.latlng.lng});
      if (!nearest) {
        this.setInsertHover(false);
      } else {
        const linePoint = this.mapRef.latLngToContainerPoint([nearest.point.latitude, nearest.point.longitude]);
        const lineDistance = event.containerPoint.distanceTo(linePoint);
        const vertexDistance = this.nearestVertexDistance(event.containerPoint);
        this.setInsertHover(lineDistance <= 28 && vertexDistance > 8);
      }
    }
  }

  private setInsertHover(on: boolean): void {
    if (this.insertHover !== on) {
      this.insertHover = on;
      const element = this.mapRef?.getContainer();
      if (element) {
        element.classList.toggle("is-inserting-point", on);
      }
      if (on) {
        this.mapRef?.dragging.disable();
      } else if (this.draggingVertexIndex === null) {
        this.mapRef?.dragging.enable();
      }
    }
  }

  private clearInsertHover(): void {
    this.setInsertHover(false);
  }

  private onEditPointerDown = (event: PointerEvent): void => {
    this.zone.run(() => this.handleEditPointerDown(event));
  };

  private onEditPointerUp = (event: PointerEvent): void => {
    this.zone.run(() => this.handleEditPointerUp(event));
  };

  private onEditPointerCancel = (event: PointerEvent): void => {
    this.zone.run(() => this.handleEditPointerCancel(event));
  };

  private handleEditPointerDown(event: PointerEvent): void {
    if (this.progress?.mode === RouteFollowMode.EDITING && this.editTool === RouteFollowEditTool.PENCIL && this.draggingVertexIndex === null && event.isPrimary) {
      this.editTap = {active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY};
    }
  }

  private handleEditPointerUp(event: PointerEvent): void {
    if (this.editTap.active && event.pointerId === this.editTap.pointerId) {
      const moved = Math.hypot(event.clientX - this.editTap.x, event.clientY - this.editTap.y);
      this.editTap = {active: false, pointerId: -1, x: 0, y: 0};
      if (moved <= 24 && this.mapRef && this.draggingVertexIndex === null && this.progress?.mode === RouteFollowMode.EDITING && this.editTool === RouteFollowEditTool.PENCIL) {
        const containerPoint = this.mapRef.mouseEventToContainerPoint(event);
        const latLng = this.mapRef.containerPointToLatLng(containerPoint);
        this.ignoreEditClick = true;
        this.addEditPointAt(latLng, containerPoint);
      }
    }
  }

  private handleEditPointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.editTap.pointerId) {
      this.editTap = {active: false, pointerId: -1, x: 0, y: 0};
    }
  }

  private onMapClick(event: L.LeafletMouseEvent): void {
    if (this.ignoreEditClick) {
      this.ignoreEditClick = false;
    } else if (this.progress?.mode !== RouteFollowMode.EDITING) {
      return;
    } else if (this.editTool === RouteFollowEditTool.ERASER) {
      this.deleteVertexNear(event.containerPoint);
    } else {
      this.addEditPointAt(event.latlng, event.containerPoint);
    }
  }

  private addEditPointAt(latLng: L.LatLng, containerPoint: L.Point): void {
    if (this.editVertices.length < 2) {
      this.insertEditVertex({latitude: latLng.lat, longitude: latLng.lng}, this.editVertices.length - 1);
    } else {
      this.insertPointOnRoute(latLng, containerPoint);
    }
  }

  private onVertexDragStart(index: number, handle: L.Marker): void {
    this.draggingVertexIndex = index;
    this.ignoreEditClick = true;
    this.mapRef?.dragging.disable();
    this.markDragHandle(handle);
  }

  private onVertexDrag(index: number, handle: L.Marker): void {
    const latLng = handle.getLatLng();
    this.editVertices = this.editVertices.map((vertex, vertexIndex) => {
      return vertexIndex === index ? {latitude: latLng.lat, longitude: latLng.lng} : vertex;
    });
    this.syncEditLineFromVertices();
  }

  private onVertexDragEnd(index: number): void {
    const handle = this.editGroup.getLayers()[index] as L.Marker;
    const latLng = handle?.getLatLng();
    if (latLng) {
      this.editVertices = this.editVertices.map((vertex, vertexIndex) => {
        return vertexIndex === index ? {latitude: latLng.lat, longitude: latLng.lng} : vertex;
      });
    }
    this.draggingVertexIndex = null;
    this.mapRef?.dragging.enable();
    this.followService.replaceTrack(this.editVertices);
    this.refreshArrows();
    this.refreshEditHandles();
  }

  private onVertexClick(index: number, event: L.LeafletMouseEvent): void {
    L.DomEvent.stop(event);
    if (this.editTool === RouteFollowEditTool.ERASER) {
      this.deleteVertexAt(index);
    }
  }

  private syncEditLineFromVertices(): void {
    const latLngs = this.editVertices.map(point => [point.latitude, point.longitude] as [number, number]);
    this.editHalo?.setLatLngs(latLngs);
    this.editCore?.setLatLngs(latLngs);
  }

  private attachEditLine(latLngs: [number, number][], color: string, weight: number, opacity: number): void {
    const map = this.mapRef;
    if (map && this.editHalo) {
      this.editHalo.setLatLngs(latLngs);
      this.editHalo.setStyle({weight: weight + 4});
    } else if (map) {
      this.editHalo = L.polyline(latLngs, {
        color: "#ffffff",
        weight: weight + 4,
        opacity: 0.95,
        lineJoin: "round",
        lineCap: "round",
        interactive: false
      }).addTo(map);
    }
    if (map && this.editCore) {
      this.editCore.setLatLngs(latLngs);
      this.editCore.setStyle({color, weight, opacity});
    } else if (map) {
      this.editCore = L.polyline(latLngs, {
        color,
        weight,
        opacity,
        lineJoin: "round",
        lineCap: "round",
        interactive: false
      }).addTo(map);
    }
  }

  private removeEditLine(): void {
    this.editHalo?.remove();
    this.editCore?.remove();
    this.editHalo = null;
    this.editCore = null;
  }

  private insertPointOnRoute(latLng: L.LatLng, containerPoint: L.Point): void {
    const click = {latitude: latLng.lat, longitude: latLng.lng};
    const map = this.mapRef;
    if (map && this.editVertices.length === 0) {
      this.insertOffRouteVertex(click);
    } else if (map && this.nearestVertexDistance(containerPoint) > 20) {
      const nearestSegment = this.followService.nearestSegment(click);
      if (nearestSegment) {
        const linePoint = map.latLngToContainerPoint([nearestSegment.point.latitude, nearestSegment.point.longitude]);
        if (containerPoint.distanceTo(linePoint) <= 28) {
          this.insertEditVertex({
            latitude: nearestSegment.point.latitude,
            longitude: nearestSegment.point.longitude
          }, nearestSegment.index);
        } else {
          this.insertOffRouteVertex(click);
        }
      } else {
        this.insertOffRouteVertex(click);
      }
    }
  }

  private insertOffRouteVertex(click: {latitude: number; longitude: number}): void {
    this.insertEditVertex(click, editExtendAfterIndex(this.editVertices, click));
  }

  private deleteVertexNear(containerPoint: L.Point): void {
    this.deleteVertexAt(this.vertexIndexNear(containerPoint, 16));
  }

  private deleteVertexAt(index: number): void {
    if (index >= 0 && this.editVertices.length > 2) {
      this.editVertices = this.editVertices.filter((_, vertexIndex) => vertexIndex !== index);
      this.followService.replaceTrack(this.editVertices);
      this.refreshEditHandles();
      this.refreshArrows();
      this.redraw();
    }
  }

  private insertEditVertex(point: {latitude: number; longitude: number}, afterIndex: number): void {
    this.editVertices = [
      ...this.editVertices.slice(0, afterIndex + 1),
      point,
      ...this.editVertices.slice(afterIndex + 1)
    ];
    this.followService.replaceTrack(this.editVertices);
    this.refreshEditHandles();
    this.refreshArrows();
    this.redraw();
  }

  private vertexIndexNear(containerPoint: L.Point, pixels: number): number {
    const map = this.mapRef;
    if (!map) {
      return -1;
    } else {
      return this.editVertices.reduce((best, vertex, index) => {
        const projected = map.latLngToContainerPoint([vertex.latitude, vertex.longitude]);
        const distance = containerPoint.distanceTo(projected);
        return distance <= pixels && (best.index < 0 || distance < best.distance)
          ? {index, distance}
          : best;
      }, {index: -1, distance: Number.POSITIVE_INFINITY}).index;
    }
  }

  private nearestVertexDistance(containerPoint: L.Point): number {
    const map = this.mapRef;
    if (!map || this.editVertices.length === 0) {
      return Number.POSITIVE_INFINITY;
    } else {
      return this.editVertices.reduce((closest, vertex) => {
        const projected = map.latLngToContainerPoint([vertex.latitude, vertex.longitude]);
        const distance = containerPoint.distanceTo(projected);
        return distance < closest ? distance : closest;
      }, Number.POSITIVE_INFINITY);
    }
  }

  private refreshEditHandles(): void {
    this.editGroup.clearLayers();
    const pencil = this.editTool === RouteFollowEditTool.PENCIL;
    this.editVertices.forEach((point, index) => {
      const marker = L.marker([point.latitude, point.longitude], {
        interactive: true,
        keyboard: false,
        draggable: pencil,
        autoPan: false,
        bubblingMouseEvents: false,
        zIndexOffset: 800,
        icon: L.divIcon({
          className: "follow-leaflet-icon",
          html: pencil
            ? "<div class=\"follow-edit-handle-hit\"><div class=\"follow-edit-handle\"></div></div>"
            : "<div class=\"follow-edit-handle-hit\"><div class=\"follow-edit-handle follow-edit-handle-erase\"></div></div>",
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      });
      marker.on("dragstart", event => this.zone.run(() => this.onVertexDragStart(index, event.target as L.Marker)));
      marker.on("drag", event => this.zone.run(() => this.onVertexDrag(index, event.target as L.Marker)));
      marker.on("dragend", () => this.zone.run(() => this.onVertexDragEnd(index)));
      marker.on("click", event => this.zone.run(() => this.onVertexClick(index, event as L.LeafletMouseEvent)));
      this.editGroup.addLayer(marker);
    });
  }

  private markDragHandle(handle: L.Marker): void {
    const element = handle.getElement();
    const ring = element?.querySelector(".follow-edit-handle");
    if (ring) {
      ring.classList.add("follow-edit-handle-drag");
    }
  }

  private clearEditHandles(): void {
    this.editGroup.clearLayers();
  }

  recenter(): void {
    this.followUser = true;
    const position = this.progress?.position || this.payload?.points?.[0] || this.payload?.waypoints?.[0];
    if (this.mapRef && position) {
      this.mapRef.setView([position.latitude, position.longitude], this.mapRef.getZoom());
    }
  }

  closeFollow(): void {
    if (this.showStylePicker) {
      this.closeStylePicker();
    }
    this.followService.stop();
    this.clearFollowSession();
    void this.releaseWakeLock();
    const returnUrl = this.walkDisplay.takeFollowReturnUrl();
    if (returnUrl && !this.isFollowPath(returnUrl)) {
      void this.router.navigateByUrl(returnUrl, {replaceUrl: true});
    } else if (this.loadedWalk) {
      const area = (this.walkDisplay.groupEventArea() || DEFAULT_WALKS_AREA).replace(/^\/+/, "");
      void this.router.navigate(["/" + area, this.walkDisplay.walkSlug(this.loadedWalk)], {replaceUrl: true});
    } else if (this.payload?.path) {
      void this.router.navigateByUrl("/" + this.payload.path, {replaceUrl: true});
    } else {
      void this.router.navigate(["/" + AppPath.ROOT], {replaceUrl: true});
    }
  }

  private rememberHowWeArrived(): void {
    const previous = this.router.lastSuccessfulNavigation()?.previousNavigation?.finalUrl;
    const previousUrl = previous ? this.router.serializeUrl(previous) : null;
    if (previousUrl && !this.isFollowPath(previousUrl)) {
      this.walkDisplay.rememberFollowReturnUrlFrom(previousUrl);
    }
  }

  private isFollowPath(url: string): boolean {
    const path = (url || "").split("?")[0];
    const follow = "/" + AppPath.ROOT + "/" + AppPath.FOLLOW;
    return path === follow || path.startsWith(follow + "/");
  }

  private persistFollowSession(force = false): void {
    if (this.payload && this.progress && isLiveFollowMode(this.progress.mode)) {
      const recording = this.progress.mode === RouteFollowMode.RECORDING;
      const count = this.followService.trackPoints().length;
      const unchangedRecording = recording && !force && count === this.lastRecordedPointCount;
      if (!unchangedRecording) {
        if (recording) {
          this.lastRecordedPointCount = count;
        }
        this.uiActions.saveValueFor(StoredValue.FOLLOW_SESSION, this.followSessionSnapshot());
      }
    }
  }

  private clearFollowSession(): void {
    this.lastRecordedPointCount = -1;
    this.uiActions.removeItemFor(StoredValue.FOLLOW_SESSION);
  }

  private followSessionSnapshot(): RouteFollowSession {
    return {
      walkId: this.payload?.walkId || null,
      path: this.payload?.path || null,
      routeId: this.payload?.routeId || null,
      ramblersSlug: this.payload?.ramblersSlug || null,
      osMapsRouteId: this.payload?.osMapsRouteId || null,
      mode: this.progress?.mode || RouteFollowMode.FOLLOWING,
      headingUp: this.headingUp,
      sheetState: this.sheetState,
      previewSpeed: this.previewSpeed,
      previewMetres: this.followService.previewProgressMetres(),
      visitedWaypointIds: this.followService.visitedIds(),
      recordedPoints: this.progress?.mode === RouteFollowMode.RECORDING ? this.followService.trackPoints() : undefined
    };
  }

  private storedFollowSession(): RouteFollowSession | null {
    if (!this.uiActions.itemExistsFor(StoredValue.FOLLOW_SESSION)) {
      return null;
    } else {
      const stored = this.uiActions.initialObjectValueFor<RouteFollowSession>(StoredValue.FOLLOW_SESSION, null);
      return stored && isLiveFollowMode(stored.mode) ? stored : null;
    }
  }

  private restoreFollowSession(): void {
    const session = this.storedFollowSession();
    const currentKey = this.payload ? followCacheKey(this.payload) : null;
    if (session && currentKey && followCacheKey(session) === currentKey) {
      this.headingUp = !!session.headingUp;
      this.sheetState = RouteFollowSheetState.MINIMISED;
      this.previewSpeed = session.previewSpeed || ROUTE_FOLLOW_PREVIEW_SPEED_DEFAULT;
      this.followService.setPreviewSpeed(this.previewSpeed);
      const visited = session.visitedWaypointIds || [];
      if (session.mode === RouteFollowMode.RECORDING) {
        this.followUser = true;
        this.lastRecordedPointCount = (session.recordedPoints || []).length;
        this.followService.restoreRecording(session.recordedPoints || [], visited);
        void this.followService.requestCompassPermission();
        void this.requestWakeLock();
      } else if (session.mode === RouteFollowMode.FOLLOWING) {
        this.followUser = true;
        this.followService.restoreFollowing(visited);
        void this.followService.requestCompassPermission();
        void this.requestWakeLock();
      } else if (session.mode === RouteFollowMode.PAUSED) {
        this.followService.restorePaused(visited);
      } else {
        this.followUser = true;
        this.followService.restorePreview(session.previewMetres || 0, visited);
      }
    }
  }

  private async load(path: string | null, routeId: string | null, walkId: string | null, ramblersSlug: string | null, osMapsRouteId: string | null): Promise<void> {
    this.loading = true;
    this.error = null;
    this.loadedWalk = null;
    this.canEditRoute = false;
    this.styleRoute = null;
    this.followService.stop();
    const key = followCacheKey({path, routeId, walkId, ramblersSlug, osMapsRouteId});
    const cached = await this.cachedPayload(key);
    if (this.usablePayload(cached)) {
      await this.applyLoaded(cached);
      this.loading = false;
      this.revealIdleSheet();
      void this.refreshFromNetwork(path, routeId, walkId, ramblersSlug, osMapsRouteId);
    } else {
      try {
        const loaded = await this.networkPayload(path, routeId, walkId, ramblersSlug, osMapsRouteId);
        await this.applyLoaded(this.usablePayload(loaded) ? loaded : null);
      } catch (error) {
        this.logger.error("load failed", error);
        this.error = "The route could not be loaded. Check your connection and try again.";
        this.payload = null;
        this.clearRouteOverlays();
      }
      this.loading = false;
      this.revealIdleSheet();
    }
  }

  private networkPayload(path: string | null, routeId: string | null, walkId: string | null, ramblersSlug: string | null, osMapsRouteId: string | null): Promise<RouteFollowPayload | null> {
    const request = osMapsRouteId
      ? this.loadOsMapsRoute(osMapsRouteId)
      : (ramblersSlug
        ? this.loadRamblers(ramblersSlug)
        : (walkId ? this.loadWalk(walkId) : this.loadPage(path, routeId)));
    return firstCompleted(request, ROUTE_FOLLOW_NETWORK_TIMEOUT_MS, "Route follow network timed out");
  }

  private async refreshFromNetwork(path: string | null, routeId: string | null, walkId: string | null, ramblersSlug: string | null, osMapsRouteId: string | null): Promise<void> {
    try {
      const loaded = await this.networkPayload(path, routeId, walkId, ramblersSlug, osMapsRouteId);
      if (this.usablePayload(loaded) && !isLiveFollowMode(this.progress?.mode)) {
        await this.applyLoaded(loaded);
      }
    } catch (error) {
      this.logger.info("background route refresh skipped", error);
    }
  }

  private usablePayload(payload: RouteFollowPayload | null): boolean {
    return !!payload && ((payload.points?.length || 0) >= 2 || (payload.waypoints?.length || 0) > 0);
  }

  protected loginUrl(): string {
    return `/login?${StoredValue.REDIRECT}=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }

  private async cachedPayload(key: string | null): Promise<RouteFollowPayload | null> {
    try {
      return key ? await this.followCache.payload(key) : null;
    } catch (error) {
      this.logger.warn("cached route unavailable", error);
      return null;
    }
  }

  private async applyLoaded(loaded: RouteFollowPayload | null): Promise<void> {
    if (!this.usablePayload(loaded) || !loaded) {
      this.error = "This walk does not have a route that can be followed.";
      this.payload = null;
      this.canEditRoute = false;
      this.styleRoute = null;
      this.clearRouteOverlays();
    } else {
      this.payload = loaded;
      this.canEditRoute = this.routeIsEditable(loaded);
      this.loginPrompt = !this.canEditRoute && loaded.source !== RouteFollowSource.RAMBLERS_LIBRARY && !this.memberLogin.memberLoggedIn();
      this.styleRoute = this.styleFromPayload(loaded);
      this.rememberSavedStyle(loaded);
      const stored = this.mapControls.queryInitialState({osStyle: loaded.osStyle});
      this.mapProvider = stored.provider;
      this.osStyle = stored.osStyle;
      this.followService.loadRoute(loaded.points, loaded.waypoints);
      this.followService.listenForCompass();
      this.restoreFollowSession();
      this.refreshArrows();
      this.buildMapOptions(loaded);
      this.redraw();
      const key = this.followCache.keyForPayload(loaded);
      this.offlineStatus = await this.followCache.status(key);
      if (navigator.onLine && this.offlineStatus !== RouteFollowOfflineStatus.AVAILABLE) {
        void this.saveOffline();
      }
    }
  }

  private async loadPage(path: string | null, routeId: string | null): Promise<RouteFollowPayload | null> {
    if (!path) {
      return null;
    } else {
      const page = await this.pageContentService.findByPath(path);
      return page ? this.payloadService.payloadFromPage(page, routeId) : null;
    }
  }

  private async loadWalk(walkId: string): Promise<RouteFollowPayload | null> {
    const walk = await this.walksAndEventsService.queryById(walkId);
    this.loadedWalk = walk || null;
    return walk ? this.payloadService.payloadFromWalk(walk) : null;
  }

  private rememberSavedStyle(payload: RouteFollowPayload): void {
    this.savedStyle = {
      color: payload.color || PaletteColor.ROSE,
      weight: payload.weight || ROUTE_FOLLOW_LINE_WEIGHT_DEFAULT,
      opacity: payload.opacity ?? 1
    };
  }

  private restoreStyle(): void {
    if (this.payload && this.savedStyle && this.styleRoute) {
      this.styleRoute.color = this.savedStyle.color;
      this.styleRoute.weight = this.savedStyle.weight;
      this.styleRoute.opacity = this.savedStyle.opacity;
      this.payload = {...this.payload, ...this.savedStyle};
    }
  }

  private styleFromPayload(payload: RouteFollowPayload): MapRoute {
    return {
      id: payload.routeId || "follow-route",
      name: payload.title,
      color: payload.color || PaletteColor.ROSE,
      weight: payload.weight || ROUTE_FOLLOW_LINE_WEIGHT_DEFAULT,
      opacity: payload.opacity ?? 1
    };
  }

  private routeIsEditable(payload: RouteFollowPayload): boolean {
    if (payload.source === RouteFollowSource.WALK) {
      return !!(this.loadedWalk && this.walkDisplay.allowEdits(this.loadedWalk));
    } else if (payload.source === RouteFollowSource.PAGE) {
      return this.memberLogin.allowContentEdits();
    } else if (payload.source === RouteFollowSource.OS_MAPS) {
      return this.memberLogin.allowWalkAdminEdits();
    } else {
      return false;
    }
  }

  private async loadOsMapsRoute(routeId: string): Promise<RouteFollowPayload | null> {
    const route = await this.osMapsExport.importedRoute(routeId);
    return route ? this.payloadService.payloadFromOsMapsRoute(route) : null;
  }

  private async loadRamblers(slug: string): Promise<RouteFollowPayload | null> {
    const route = await this.ramblersLibrary.lookup(slug);
    return this.payloadService.payloadFromLibraryRoute(route);
  }

  private buildMapOptions(payload: RouteFollowPayload, view: {center: L.LatLng; zoom: number} | null = null): void {
    const provider = this.mapProvider;
    const style = this.osStyle;
    const first = payload.points[0] || payload.waypoints[0] || {latitude: 54.5, longitude: -3};
    const maxZoom = this.mapTiles.maxZoomForStyle(provider, style);
    const zoom = view ? Math.min(view.zoom, maxZoom) : maxZoom - 2;
    const center = view?.center || L.latLng(first.latitude, first.longitude);
    this.options = {
      layers: [this.mapTiles.createBaseLayer(provider, style)],
      zoom,
      center,
      crs: this.mapTiles.crsForStyle(provider, style),
      maxZoom,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      zoomSnap: 1,
      zoomDelta: 1,
      bounceAtZoomLimits: false,
      tapTolerance: 20
    };
  }

  private refreshArrows(): void {
    this.arrowGroup.clearLayers();
    const recording = this.progress?.mode === RouteFollowMode.RECORDING;
    if (this.payload && this.followService.trackPoints().length >= 2 && !recording) {
      this.followService.directionMarkers(0, ROUTE_FOLLOW_ARROW_SPACING_METRES).forEach(marker => {
        this.arrowGroup.addLayer(L.marker([marker.point.latitude, marker.point.longitude], {
          icon: this.markerStyle.osRouteArrowIcon(marker.heading, this.payload.weight || ROUTE_FOLLOW_LINE_WEIGHT_DEFAULT),
          keyboard: false,
          interactive: false,
          zIndexOffset: 400
        }));
      });
    }
  }

  private clearRouteOverlays(): void {
    this.arrowGroup.clearLayers();
    this.clearEditHandles();
    this.removeEditLine();
    this.clearPointer();
    this.layers = [];
  }

  private clearPointer(): void {
    if (this.pointerMarker) {
      this.pointerMarker.remove();
      this.pointerMarker = null;
    }
  }

  private syncPointer(latitude: number, longitude: number, heading: number): void {
    if (this.pointerMarker) {
      this.pointerMarker.setLatLng([latitude, longitude]);
      const chevron = this.pointerMarker.getElement()?.querySelector(".follow-location-chevron") as HTMLElement | null;
      if (chevron) {
        chevron.style.transform = `rotate(${heading || 0}deg)`;
      } else {
        this.pointerMarker.setIcon(this.markerStyle.followLocationIcon(heading));
      }
    } else if (this.mapRef) {
      this.pointerMarker = L.marker([latitude, longitude], {
        icon: this.markerStyle.followLocationIcon(heading),
        zIndexOffset: 1200,
        keyboard: false
      });
      this.pointerMarker.addTo(this.mapRef);
    }
  }

  private headingOnlyUpdate(previous: RouteFollowProgress | null, next: RouteFollowProgress): boolean {
    if (!previous || !next || !previous.position || !next.position) {
      return false;
    } else {
      return previous.mode === next.mode
        && previous.completedMetres === next.completedMetres
        && previous.offRoute === next.offRoute
        && previous.snap?.index === next.snap?.index
        && previous.position.latitude === next.position.latitude
        && previous.position.longitude === next.position.longitude;
    }
  }

  private refreshHeadingVisuals(): void {
    this.refreshTape();
    const point = this.progress?.position;
    if (point) {
      this.syncPointer(point.latitude, point.longitude, this.currentHeading());
    }
    if (this.headingUp) {
      this.applyHeadingUp();
    }
  }

  private redraw(): void {
    if (!this.payload) {
      this.clearRouteOverlays();
    } else {
      const points = this.followService.trackPoints().length > 0 ? this.followService.trackPoints() : this.payload.points;
      const latLngs = points.map(point => [point.latitude, point.longitude] as [number, number]);
      const completedIndex = this.progress?.snap?.index ?? 0;
      const completed = latLngs.slice(0, completedIndex + 1);
      const remaining = latLngs.slice(completedIndex);
      const lineColor = this.payload.color || PaletteColor.ROSE;
      const lineWeight = this.payload.weight || ROUTE_FOLLOW_LINE_WEIGHT_DEFAULT;
      const lineOpacity = this.payload.opacity ?? 1;
      const editing = this.progress?.mode === RouteFollowMode.EDITING;
      const live = isLiveFollowMode(this.progress?.mode);
      const paint = live
        ? followLineColours(this.progressPaint, lineColor)
        : {walked: lineColor, ahead: lineColor};
      if (editing && latLngs.length >= 2) {
        this.attachEditLine(latLngs, lineColor, lineWeight, lineOpacity);
        this.layers = [];
      } else {
        this.removeEditLine();
        this.layers = latLngs.length >= 2 ? [
          L.polyline(latLngs, {
            color: "#ffffff",
            weight: lineWeight + 2,
            opacity: 0.9,
            lineJoin: "round",
            lineCap: "round",
            interactive: false
          }),
          L.polyline(completed.length > 1 ? completed : [latLngs[0], latLngs[0]], {
            color: paint.walked,
            weight: lineWeight,
            opacity: 0.85,
            lineJoin: "round",
            lineCap: "round",
            interactive: false
          }),
          L.polyline(remaining.length > 1 ? remaining : latLngs, {
            color: paint.ahead,
            weight: lineWeight,
            opacity: lineOpacity,
            lineJoin: "round",
            lineCap: "round",
            interactive: false
          })
        ] : [];
      }
      const startPoint = this.payload.points[0];
      const routeHeading = this.payload.points.length >= 2
        ? this.followService.headingBetween(this.payload.points[0], this.payload.points[1])
        : 0;
      const point = this.progress?.position || startPoint;
      const heading = this.progress?.heading ?? this.progress?.routeHeading ?? routeHeading;
      if (editing) {
        this.clearPointer();
      } else if (point) {
        this.syncPointer(point.latitude, point.longitude, heading);
      } else {
        this.clearPointer();
      }
      if (this.headingUp) {
        this.applyHeadingUp();
      }
      if (this.followUser && this.mapRef && this.progress?.position) {
        this.mapRef.panTo([this.progress.position.latitude, this.progress.position.longitude]);
      }
    }
  }

  private fitRoute(): void {
    if (this.mapRef && this.payload?.points?.length >= 2) {
      const bounds = L.latLngBounds(this.payload.points.map(point => [point.latitude, point.longitude] as [number, number]));
      this.mapRef.fitBounds(bounds, {paddingTopLeft: [36, 72], paddingBottomRight: [36, 220]});
    } else if (this.mapRef && this.payload?.waypoints?.length) {
      const start = this.payload.waypoints[0];
      this.mapRef.setView([start.latitude, start.longitude], Math.max(this.mapRef.getZoom(), 7));
    }
  }

  private async requestWakeLock(): Promise<void> {
    const nav = navigator as Navigator & {wakeLock?: {request: (type: string) => Promise<{release: () => Promise<void>}>}};
    if (nav.wakeLock) {
      try {
        this.wakeLock = await nav.wakeLock.request("screen");
      } catch (error) {
        this.logger.info("requestWakeLock:", error);
      }
    }
  }

  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch (error) {
        this.logger.info("releaseWakeLock:", error);
      }
      this.wakeLock = null;
    }
  }
}
