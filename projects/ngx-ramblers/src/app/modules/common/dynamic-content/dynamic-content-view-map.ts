import { Component, HostListener, ViewChild, DoCheck, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, NgZone } from "@angular/core";
import * as L from "leaflet";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import {
  MapData,
  MapMarker,
  MapRoute,
  PageContent,
  PageContentRow,
  PaletteColor
, RouteGuideEntry } from "../../../models/content-text.model";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { RouteStepControls } from "../../../shared/components/route-step-controls";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { GpxParserService, GpxTrack, GpxWaypoint } from "../../../services/maps/gpx-parser.service";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, from, Observable, of, Subject } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from "rxjs/operators";
import { UrlService } from "../../../services/url.service";
import { FileNameData, ServerFileNameData } from "../../../models/aws-object.model";
import { MapControls, MapControlsConfig, MapControlsState } from "../../../shared/components/map-controls";
import { MapOverlay } from "../../../shared/components/map-overlay";
import { MapLoadingOverlay } from "../../../shared/components/map-loading-overlay";
import {
  DEFAULT_OS_STYLE,
  GeocodeResult,
  MapProvider,
  MapRouteViewModel,
  RouteGpxData,
  TrackWithBounds
} from "../../../models/map.model";
import { MapDefaultsService } from "../../../services/maps/map-defaults.service";
import { cloneDeep, isArray, isString, isUndefined, keys } from "es-toolkit/compat";
import { isAuthoredMarker } from "../../../functions/map-location-markers";
import { MarkdownComponent } from "ngx-markdown";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { AsyncPipe, NgClass, NgTemplateOutlet } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { faArrowUp, faDownload, faExclamationTriangle, faPlus, faSearch, faTimes, faTrash } from "@fortawesome/free-solid-svg-icons";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { mapGesturesFor } from "../../../services/maps/map-gestures";
import { MaximisableMapComponent, MaximisableMapState } from "../maximisable-map/maximisable-map";
import { UiActionsService } from "../../../services/ui-actions.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { PageContentService } from "../../../services/page-content.service";
import { ResizerComponent, ResizerOrientation, ResizerVariant } from "../resizer/resizer";
import { StoredValue } from "../../../models/ui-actions";
import { travelBearingAt, turnRotationDegrees } from "../../../functions/route-turns";
import { travelAlongRoute } from "../../../services/maps/route-travel";
import { distanceAlongRouteMetres } from "../../../functions/route-directions";
import { cumulativeDistances, nearestPointIndex, pointAlongRoute, snapToRoute } from "../../../functions/route-geometry";
import { ROUTE_FULLSCREEN_FIT_PADDING, ROUTE_FULLSCREEN_SETTLE_MS, ROUTE_FIT_PADDING, ROUTE_RESIZE_SETTLE_MS, ROUTE_AUTOSAVE_DELAY_MS, ROUTE_UNDO_LIMIT, RouteWaypointKind, ROUTE_GUIDE_DEFAULT_HEIGHT, ROUTE_GUIDE_MAX_HEIGHT, ROUTE_GUIDE_MIN_HEIGHT, ROUTE_GUIDE_DEFAULT_WIDTH, ROUTE_GUIDE_MAP_MIN_WIDTH, ROUTE_GUIDE_MIN_WIDTH, RouteSaveState, RouteDownload, ROUTE_STEP_POPUP_MAX_WIDTH, ROUTE_STEP_POPUP_MIN_WIDTH, ROUTE_STEP_SPEED_DEFAULT, ROUTE_STEP_POPUP_CLASS, RouteFollowPoint, RouteGuidePanelPosition } from "../../../models/route-follow.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { AlertModule } from "ngx-bootstrap/alert";
import { FormsModule } from "@angular/forms";
import { AutocompleteSuggestion } from "../../../models/spatial-features.model";
import { SpatialFeaturesService } from "../../../services/spatial-features.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";

@Component({
  selector: "app-dynamic-content-view-map",
  styles: [`
    .route-shell.route-side-right,
    .route-shell.route-side-left
      display: flex
      flex-wrap: wrap
      gap: 1rem
      align-items: flex-start
    .route-shell.route-side-right > .map-text,
    .route-shell.route-side-left > .map-text,
    .route-shell.route-side-right > .route-follow-cta,
    .route-shell.route-side-left > .route-follow-cta,
    .route-shell.route-side-right > .alert,
    .route-shell.route-side-left > .alert
      flex: 0 0 100%
    .route-shell.route-side-right > .route-guide-panel,
    .route-shell.route-side-left > .route-guide-panel
      flex: 1 1 320px
      max-width: 420px
      margin-bottom: 0
    .route-shell.route-side-right > .route-guide-panel
      order: 2
    .route-shell.route-side-left > .route-guide-panel
      order: 0
    .route-shell.route-side-right > app-maximisable-map,
    .route-shell.route-side-left > app-maximisable-map
      order: 1
      flex: 1 1 480px
      min-width: 0
      width: auto
    .route-fullscreen-shell.is-fullscreen
      display: flex
      flex-wrap: wrap
      align-content: stretch
      gap: 0
      height: 100%
      min-height: 0
    .route-fullscreen-shell.is-fullscreen > .route-guide-panel
      flex: 0 0 380px
      max-width: 380px
      height: 100%
      overflow: auto
      margin: 0
      padding: 0.75rem
      border-left: 1px solid var(--rsm-border, #d9dee3)
      order: 2
    .route-fullscreen-shell.is-fullscreen.route-side-left > .route-guide-panel
      order: 0
      border-left: none
      border-right: 1px solid var(--rsm-border, #d9dee3)
    .route-fullscreen-shell.is-fullscreen > .route-guide-panel .route-guide-list
      max-height: none
    .route-fullscreen-shell.is-fullscreen > .route-guide-panel
      padding-top: 0
    .route-guide-controls
      position: sticky
      top: 0
      z-index: 2
      background: #fff
      padding: 0.75rem 0 0.5rem
    .route-fullscreen-shell.is-fullscreen > .map-section
      order: 0
      flex: 1 1 0
      min-width: 0
      height: 100%
      display: flex
      flex-direction: column
    .route-fullscreen-shell.is-fullscreen.route-side-left > .map-section
      order: 2
    .route-fullscreen-shell.is-fullscreen > .route-guide-resizer
      order: 1
      flex: 0 0 8px
      width: 8px
      height: 100%
    .route-fullscreen-shell.is-fullscreen > .map-section > div,
    .route-fullscreen-shell.is-fullscreen .map-stack,
    .route-fullscreen-shell.is-fullscreen .map-wrapper
      flex: 1 1 auto
      min-height: 0
      height: 100%
      display: flex
      flex-direction: column
    .route-fullscreen-shell.is-fullscreen .map-card
      height: 100%
      flex: 1 1 auto
      border-radius: 0
    .route-fullscreen-shell.is-fullscreen .route-panel
      display: none
    @media (max-width: 767.98px)
      .route-fullscreen-shell.is-fullscreen > .route-guide-panel
        flex: 0 0 100%
        max-width: none
        height: 40%
        border-left: none
        border-top: 1px solid var(--rsm-border, #d9dee3)
        order: 2
      .route-fullscreen-shell.is-fullscreen > .map-section
        flex: 0 0 100%
        height: 60%
      .route-fullscreen-shell.is-fullscreen > .route-guide-resizer
        display: none
    .route-guide-list
      list-style: none
      padding: 0 4px 0 0
      max-height: 320px
      overflow-y: auto
      scroll-snap-type: y proximity
      display: flex
      flex-direction: column
      gap: 6px
    .route-guide-item
      display: flex
      gap: 10px
      scroll-snap-align: center
      padding: 10px 12px
      background: #fff
      border: 1px solid var(--rsm-border, #d9dee3)
      border-left: 5px solid #453C90
      border-radius: 8px
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)
      cursor: pointer
      &:hover
        border-color: var(--ramblers-colour-sunrise)
      &.active
        border-color: var(--ramblers-colour-sunrise)
        background: rgba(249, 177, 4, 0.12)
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14)
    .route-guide-link
      font-weight: 600
      text-decoration: underline
      color: inherit
    .route-guide-body
      display: flex
      flex-direction: column
      gap: 2px
      min-width: 0
      flex: 1 1 auto
    .route-guide-edit
      font-size: 0.9rem
      resize: vertical
    ::ng-deep .route-guide-number
      flex: 0 0 28px
      height: 28px
      border-radius: 50%
      background: #453C90
      color: #ffffff
      font-weight: 700
      display: flex
      align-items: center
      justify-content: center
    ::ng-deep .route-guide-distance
      display: flex
      align-items: center
      gap: 6px
      font-size: 0.8rem
      font-weight: 600
      color: var(--rsm-muted, #5b6560)
    ::ng-deep .route-guide-turn
      display: inline-block
      color: var(--rsm-text, #1b1b1b)
    ::ng-deep .route-guide-note
      display: block
      margin-top: 4px
      font-size: 0.9rem
      color: var(--rsm-muted, #5b6560)
    ::ng-deep .route-step-card
      display: flex
      gap: 10px
      align-items: flex-start
      min-width: 220px
      max-width: 540px
      font-family: inherit
    ::ng-deep .route-step-card .route-guide-note
      max-height: 40vh
      overflow-y: auto
      padding-right: 4px
    ::ng-deep .route-step-instruction
      display: block
      font-weight: 600
      font-size: 0.95rem
      line-height: 1.3
      color: var(--rsm-text, #1b1b1b)
    ::ng-deep .leaflet-popup.route-step-popup .leaflet-popup-content-wrapper
      border-left: 5px solid var(--route-pin-colour, #453C90)
      border-radius: 10px
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28)
    ::ng-deep .leaflet-popup.route-step-popup .leaflet-popup-content
      margin: 12px 16px 12px 12px
    .map-wrapper
      position: relative

    .map-controls-docked
      border-bottom: 1px solid #dee2e6
      margin-bottom: 0 !important
      position: relative
      z-index: 1000

    .map-controls-overlap
      margin-top: -15px
      border-top-left-radius: 0 !important
      border-top-right-radius: 0 !important

    .map-text
      margin-bottom: 1rem

    .map-stack
      overflow: hidden
      border-radius: 0.5rem
      background: #fff

    .map-card
      border: none

    .map-stack.has-route-panel .map-card
      border-bottom-left-radius: 0 !important
      border-bottom-right-radius: 0 !important

    .route-panel
      background: #fff
      padding: 1rem

    .route-panel.has-header
      border-top: 1px solid #f1f1f1
      border-top-left-radius: 0
      border-top-right-radius: 0

    .route-panel.attached
      border-bottom-left-radius: 0.5rem
      border-bottom-right-radius: 0.5rem

    .route-panel-row + .route-panel-row
      border-top: 1px solid #f1f1f1
      margin-top: 0.75rem
      padding-top: 0.75rem

    .route-panel-header
      border-bottom: 1px solid #f1f1f1
      padding-bottom: 0.5rem
      margin-bottom: 0.75rem

    .route-color-box
      width: 30px
      height: 6px
      border-radius: 4px

    .route-count-badge
      background-color: var(--ramblers-colour-sunrise)
      color: #3c2a00
      font-weight: 600
      border-radius: 999px
      padding: 0.35rem 0.75rem

    .route-download-btn
      display: inline-flex
      align-items: center
      justify-content: center
      padding: 0.4rem 0.85rem
      min-width: 0
      background-color: var(--ramblers-colour-sunrise)
      border-color: var(--ramblers-colour-sunrise)
      color: #3c2a00
      font-weight: 600
      line-height: 1

    .route-download-btn:hover,
    .route-download-btn:focus
      background-color: var(--ramblers-colour-sunrise)
      border-color: var(--ramblers-colour-sunrise)
      color: #3c2a00
      filter: brightness(0.92)

    .route-name
      font-size: 0.875rem

    :host ::ng-deep .leaflet-control-attribution
      font-size: 0.75rem

    :host ::ng-deep .leaflet-control-zoom a,
    :host ::ng-deep .leaflet-control-zoom a:hover,
    :host ::ng-deep .leaflet-control-zoom a:focus,
    :host ::ng-deep .leaflet-control-zoom a:active
      text-decoration: none !important
      outline: none

    :host ::ng-deep .leaflet-popup-content-wrapper
      border-radius: 8px

    :host ::ng-deep .leaflet-popup-content
      margin: 13px 19px

    :host ::ng-deep .route-arrow-icon
      pointer-events: none
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35))

    :host ::ng-deep .route-arrow
      display: inline-flex
      align-items: center
      justify-content: center
      transform-origin: center center

    :host ::ng-deep .route-arrow svg
      display: block

    :host ::ng-deep .route-arrow path,
    :host ::ng-deep .route-arrow polygon
      fill: #fff
      stroke: #fff

    :host ::ng-deep .waypoint-marker
      background: transparent
      border: none

    :host ::ng-deep .waypoint-marker .marker-pin
      width: 26px
      height: 26px
      border-radius: 50% 50% 50% 0
      background: #204f3d
      border: 3px solid #fff
      transform: rotate(-45deg)
      display: flex
      align-items: center
      justify-content: center
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.35)

    :host ::ng-deep .waypoint-marker .marker-dot
      width: 8px
      height: 8px
      border-radius: 50%
      background: #fff

  `],
  template: `
    @if (row?.map) {
      <div [class]="actions.rowClasses(row)" class="route-shell" [class.route-side-right]="guideOnRight && !fullscreen"
           [class.route-side-left]="guideOnLeft && !fullscreen">
        @if (row.map.text) {
          <div class="map-text" markdown [data]="row.map.text"></div>
        }
        @if ((canFollowRoute || guideEntries.length) && !fullscreen) {
          <div class="mb-3 route-follow-cta d-flex flex-wrap align-items-center gap-2">
            <ng-container *ngTemplateOutlet="stepControls"/>
          </div>
        }
        @if (guidePanelVisible && !fullscreen && !guideBelow) {
          <div class="col-12">
            <ng-container *ngTemplateOutlet="guidePanel"/>
          </div>
        }
        <app-maximisable-map #routeMap="maximisableMap" [title]="row.map.title || 'Route map'" [allowExpanded]="false"
                             [enabled]="true" [syncToUrl]="true" [offsetTop]="'64px'" (sizeChange)="onMapSizeChange($event)">
          <div slot="bar-actions">
            @if (fullscreen && !guidePanelVisible) {
              <ng-container *ngTemplateOutlet="stepControls"/>
            }
          </div>
          <div class="route-fullscreen-shell maximisable-map-fill" [class.is-fullscreen]="fullscreen" [class.route-side-left]="guideOnLeft" [style.--route-pin-colour]="markerColour">
        @if (guidePanelVisible && fullscreen) {
          <ng-container *ngTemplateOutlet="guidePanel"/>
          <app-resizer class="route-guide-resizer" [variant]="ResizerVariant.BAR" [orientation]="ResizerOrientation.HORIZONTAL"
                       [size]="guideWidth" [minSize]="minGuideWidth" [maxSize]="maxGuideWidth" [growsTowardsStart]="!guideOnLeft"
                       resizeHint="Drag to change the width of the directions"
                       (sizeChange)="onGuideWidthChange($event)" (resizeEnd)="saveGuideWidth()"/>
        }
        <ng-template #stepControls>
          <app-route-step-controls [activeIndex]="activeIndex" [count]="guideEntries.length" [fullscreen]="fullscreen" [headingUp]="headingUp" [canFollow]="canFollowRoute"
                                   [speed]="stepSpeed" [id]="guideListId" (speedChange)="setStepSpeed($event)" [guideOpen]="guideOpen" (toggleGuide)="toggleGuide()"
                                   [canEdit]="canLiveEdit" [editing]="liveEditing" [saveState]="saveState" (toggleEdit)="toggleLiveEdit()" [canUndo]="canUndo" (undo)="undo()" (discard)="discardLiveEdit()"
                                   (previous)="previousStep()" (next)="nextStep()" (first)="firstStep()" (toggleHeading)="toggleMapHeading()"
                                   (fullScreen)="openStepThrough()" (follow)="openFollow()"/>
        </ng-template>
        <ng-template #guidePanel>
          <div class="thumbnail-heading-frame mb-3 route-guide-panel" [style.flex-basis.px]="fullscreen ? guideWidth : null" [style.max-width.px]="fullscreen ? guideWidth : null">
            @if (fullscreen) {
              <div class="route-guide-controls">
                <ng-container *ngTemplateOutlet="stepControls"/>
              </div>
            }
            <div class="thumbnail-heading">{{ editingNow ? "Steps" : "How to follow this route" }}</div>
            @if (editing && !fullscreen) {
              <p class="text-muted small mb-2">
                <a href="#" class="route-guide-link" (click)="openStepThrough(); $event.preventDefault()">Full screen</a> is the best place to edit these steps: a bigger map with each step beside it, where you can reword them, drag the pins along the route, and add or remove steps. You can reword, add and remove steps here too, but it is cramped and the pins cannot be moved.
              </p>
            } @else {
              <p class="text-muted small mb-2">
                Tap a step to see where it is on the map, or step through with
                <a href="#" class="route-guide-link" (click)="previousStep(); $event.preventDefault()">Previous</a> and
                <a href="#" class="route-guide-link" (click)="nextStep(); $event.preventDefault()">Next</a>.
                @if (!fullscreen) {
                  <a href="#" class="route-guide-link" (click)="openStepThrough(); $event.preventDefault()">Full screen</a> gives you a bigger map with the directions beside it.
                }
                Distances are measured along the route from the start.
              </p>
            }
            <ol class="route-guide-list mb-0" [id]="guideListId" [style.max-height.px]="fullscreen ? null : guideHeight">
              @for (entry of guideEntries; track entry.index) {
                <li class="route-guide-item" [class.active]="activeMarker === entry.marker" [attr.data-guide-index]="entry.index"
                    [style.border-left-color]="activeMarker === entry.marker ? null : markerColour"
                    role="button" tabindex="0" (click)="focusWaypoint(entry)" (keydown.enter)="focusWaypoint(entry)">
                  <span class="route-guide-number" [style.background]="markerColour">{{ entry.marker.label || entry.index + 1 }}</span>
                  <span class="route-guide-body">
                    <span class="route-guide-distance">
                      @if (entry.marker.turn) {
                        <fa-icon [icon]="faArrowUp" class="route-guide-turn" [style.transform]="'rotate(' + turnDegrees(entry.marker) + 'deg)'"/>
                      }
                      @if (entry.distanceMetres !== null) {
                        {{ milesAlong(entry.distanceMetres) }}
                      }
                    </span>
                    @if (editingNow) {
                      <textarea class="form-control form-control-sm route-guide-edit" rows="2" [(ngModel)]="entry.marker.instruction"
                                (focus)="beginGuideEdit()" (change)="onGuideTextChange()" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()"
                                placeholder="Direction, such as: Turn left through the churchyard"></textarea>
                      <textarea class="form-control form-control-sm route-guide-edit mt-1" rows="2" [(ngModel)]="entry.marker.note"
                                (focus)="beginGuideEdit()" (change)="onGuideTextChange()" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()"
                                placeholder="Note shown under the direction"></textarea>
                      <div class="d-flex flex-wrap gap-2 mt-1 route-guide-actions" (click)="$event.stopPropagation()">
                        <button type="button" class="btn btn-sm btn-primary" (click)="addStepAfter(entry)" title="Add a step between this one and the next">
                          <fa-icon [icon]="faPlus" class="me-1"/>Add step after
                        </button>
                        <button type="button" class="btn btn-sm btn-quiet" (click)="removeStep(entry)" title="Remove this step">
                          <fa-icon [icon]="faTrash" class="me-1"/>Remove
                        </button>
                      </div>
                    } @else {
                      <span class="route-step-instruction">{{ entry.marker.instruction }}</span>
                      @if (entry.marker.note) {
                        <span class="route-guide-note">{{ entry.marker.note }}</span>
                      }
                    }
                  </span>
                </li>
              }
            </ol>
            @if (!fullscreen) {
              <app-resizer orientation="vertical" variant="tab" compact
                           [size]="guideHeight" [minSize]="minGuideHeight" [maxSize]="maxGuideHeight"
                           resizeHint="Drag to change the height of the directions"
                           (sizeChange)="onGuideHeightChange($event)" (resizeEnd)="saveGuideHeight()"/>
            }
          </div>
        </ng-template>

        @if (!hasVisibleRoutes && !loadingRoutes) {
          <div class="alert alert-warning">
            No visible routes to display
          </div>
        } @else {
          <div class="map-section">
            @if (showControls) {
              <div class="rounded-top img-thumbnail p-2 map-controls-docked">
                <app-map-controls
                  [config]="mapControlsConfig"
                  [state]="mapControlsState"
                  (providerChange)="onProviderChange($event)"
                  (styleChange)="onStyleChange($event)"
                  (heightChange)="onHeightChange($event)">
                </app-map-controls>
              </div>
            }
            <div [class]="showControls ? 'map-controls-overlap' : 'rounded'">
              <div class="map-stack shadow" [class.has-route-panel]="hasRoutePanel">
                <div class="map-wrapper">
                  @if (loadingRoutes || !options) {
                    <div class="card d-flex align-items-center justify-content-center map-card"
                         [ngClass]="hasRoutePanel ? 'rounded-top' : 'rounded'"
                         [style.height.px]="fullscreen ? null : mapHeight">
                      <div class="spinner-border text-secondary" role="status">
                        <span class="visually-hidden">Loading…</span>
                      </div>
                    </div>
                  } @else if (showMap) {
                    <div class="card position-relative map-card"
                         [ngClass]="hasRoutePanel ? 'rounded-top' : 'rounded'"
                         [style.height.px]="fullscreen ? null : mapHeight"
                         leaflet
                         [leafletOptions]="options"
                         [leafletLayers]="leafletLayers"
                         [leafletFitBounds]="fitBounds"
                         (leafletMapReady)="onMapReady($event)">
                      @if (loadingRoutes) {
                        <app-map-loading-overlay/>
                      }
                    </div>
                    <app-map-overlay
                      [showControls]="showControls"
                      [allowToggle]="allowControlsToggle"
                      [showWaypoints]="showWaypoints"
                      [allowWaypointsToggle]="allowWaypointsToggle"
                      (toggleControls)="toggleControls()"
                      (toggleWaypoints)="toggleWaypoints()">
                      <div slot="bottom-overlay" class="map-overlay bottom-right">
                        <div class="overlay-content d-flex align-items-center gap-2">
                        <span class="badge bg-primary text-white border rounded-pill small fw-bold">
                          {{ routeCountText }}
                        </span>
                        </div>
                      </div>
                    </app-map-overlay>
                  }
                </div>
                @if (hasRoutePanel) {
                  <div class="route-panel attached has-header">
                    @if (hasLargeDatasetWarning()) {
                      <alert type="warning" class="m-3">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"/>
                        <strong>Large Dataset Warning:</strong>
                        <span class="ms-1">Some routes contain thousands of individual paths. Consider using the search box below to find specific paths.</span>
                      </alert>
                    }
                    @if (hasLargeDatasetWarning()) {
                      <div class="m-3">
                        <div class="mt-3">
                          <label [for]="stringUtils.kebabCase('location-search', uniqueId)">
                            <small class="text-muted mt-1 d-block">
                              <fa-icon [icon]="faSearch" class="me-1"></fa-icon>
                              UK postcode (e.g. CT1 1AA) or address (e.g. Canterbury)
                            </small></label>
                          <div class="input-group">
                            <ng-select [id]="stringUtils.kebabCase('location-search', uniqueId)"
                                       [items]="locationSuggestions$ | async"
                                       [typeahead]="locationInput$"
                                       [loading]="locationLoading"
                                       [multiple]="false"
                                       [searchable]="true"
                                       [clearable]="true"
                                       [minTermLength]="3"
                                       bindLabel="label"
                                       placeholder="Enter postcode or address..."
                                       class="flex-grow-1"
                                       [(ngModel)]="selectedLocation"
                                       (ngModelChange)="onLocationSelected($event)">
                              <ng-template ng-option-tmp let-item="item">
                                <div>
                                  <strong>{{ item.label }}</strong>
                                  @if (item.type) {
                                    <small class="text-muted ms-2">({{ item.type }})</small>
                                  }
                                </div>
                              </ng-template>
                            </ng-select>
                          </div>
                        </div>
                        <div class="mt-3">
                          <label [for]="stringUtils.kebabCase('search-term', uniqueId)">
                            Path Match</label>
                          <ng-select [id]="stringUtils.kebabCase('search-term', uniqueId)"
                                     [items]="autocompleteSuggestions$ | async"
                                     [typeahead]="autocompleteInput$"
                                     [loading]="autocompleteLoading"
                                     [multiple]="false"
                                     [searchable]="true"
                                     [clearable]="true"
                                     [minTermLength]="1"
                                     [hideSelected]="true"
                                     bindLabel="label"
                                     placeholder="Search paths by name or number..."
                                     [(ngModel)]="selectedPath"
                                     (ngModelChange)="onPathSelected($event)">
                            <ng-template ng-option-tmp let-item="item">
                              <div class="d-flex justify-content-between align-items-center">
                                <div>
                                  <strong>{{ item.label }}</strong>
                                  @if (item.description) {
                                    <small class="text-muted d-block">{{ item.description }}</small>
                                  }
                                </div>
                                @if (item.type) {
                                  <span class="badge badge-secondary">{{ item.type }}</span>
                                }
                              </div>
                            </ng-template>
                          </ng-select>
                        </div>
                        @if (searchTerm && searchMatchCount >= 0) {
                          <small class="text-muted mt-1 d-block">
                            {{ searchMatchCount }} paths match "{{ searchTerm }}"</small>
                        }
                      </div>
                    }
                    <div class="route-panel-header row align-items-center text-muted small fw-semibold">
                      <div class="col-md-6 d-flex align-items-center gap-2 text-dark">
                        <h6 class="mb-0">Routes</h6>
                      </div>
                      <div class="col-md-3 text-md-center">Visibility</div>
                      <div class="col-md-3 text-md-end">Downloads</div>
                    </div>
                    @for (route of allRoutes; track route.id) {
                      <div class="route-panel-row row align-items-center gy-2">
                        <div class="col-md-6 d-flex align-items-center gap-2">
                          <div class="route-color-box flex-shrink-0"
                               [style.backgroundColor]="route.color || roseColor"></div>
                          <div class="fw-semibold flex-grow-1">
                            {{ route.name }}
                            @if (route.featureCount && route.featureCount > 100) {
                              <span class="badge badge-mintcake ms-2">
                                @if (useViewportFiltering && routeVisibleCounts.has(route.id)) {
                                  {{ routeVisibleCounts.get(route.id)!.toLocaleString() }} of {{ route.featureCount.toLocaleString() }} in view
                                } @else if (route.featureCount > 500) {
                                  500 of {{ route.featureCount.toLocaleString() }} paths
                                } @else {
                                  {{ route.featureCount.toLocaleString() }} paths
                                }
                              </span>
                            }
                          </div>
                        </div>
                        <div class="col-md-3 d-flex justify-content-md-center">
                          <div class="form-check m-0">
                            <input class="form-check-input"
                                   type="checkbox"
                                   [id]="routeVisibilityId(route.id)"
                                   [checked]="isRouteVisible(route.id)"
                                   (change)="onRouteVisibilityToggle(route, $event)">
                            <label class="form-check-label" [for]="routeVisibilityId(route.id)">
                              Show
                            </label>
                          </div>
                        </div>
                        <div class="col-md-3 text-md-end">
                          @if (downloadsFor(route).length > 0) {
                            <div class="btn-group" dropdown container="body" placement="bottom right">
                              <a class="btn btn-sm route-download-btn"
                                 [href]="downloadsFor(route)[0].url"
                                 [download]="downloadsFor(route)[0].fileName">
                                <fa-icon [icon]="faDownload" class="me-2"/>{{ downloadsFor(route)[0].label }}
                              </a>
                              @if (downloadsFor(route).length > 1) {
                                <button type="button" class="btn btn-sm route-download-btn dropdown-toggle dropdown-toggle-split" dropdownToggle aria-label="Other download formats"></button>
                                <ul *dropdownMenu class="dropdown-menu dropdown-menu-end" role="menu">
                                  @for (download of downloadsFor(route); track download.label) {
                                    <li role="menuitem">
                                      <a class="dropdown-item" [href]="download.url" [download]="download.fileName">{{ download.label }}</a>
                                    </li>
                                  }
                                </ul>
                              }
                            </div>
                          } @else {
                            <span class="text-muted small">No download available</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        }
          </div>
        </app-maximisable-map>
        @if (guidePanelVisible && !fullscreen && guideBelow) {
          <div class="col-12">
            <ng-container *ngTemplateOutlet="guidePanel"/>
          </div>
        }
      </div>
    }
  `,
  imports: [LeafletModule, MaximisableMapComponent, NgTemplateOutlet, MapControls, MapOverlay, MapLoadingOverlay, MarkdownComponent, NgClass, FontAwesomeModule, AlertModule, FormsModule, NgSelectComponent, AsyncPipe, NgOptionTemplateDirective, RouteStepControls, ResizerComponent, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective]
})
export class DynamicContentViewMap implements OnInit, OnChanges, OnDestroy, DoCheck {
  @Input() row!: PageContentRow;
  @Input() refreshKey?: number;
  @Input() editing = false;
  @Input() clickToPlace = false;
  @Input() pageContent?: PageContent;
  @Input() showSteps = true;
  @Output() mapConfigChange = new EventEmitter<Partial<MapData>>();
  @Output() mapClick = new EventEmitter<{latitude: number; longitude: number}>();
  protected faExclamationTriangle = faExclamationTriangle;
  protected faSearch = faSearch;
  protected faTimes = faTimes;
  public searchTerm = "";
  public searchMatchCount = -1;
  private lastAutoFitSearchTerm = "";
  public autocompleteInput$ = new Subject<string>();
  public autocompleteSuggestions$!: Observable<AutocompleteSuggestion[]>;
  public autocompleteLoading = false;
  public locationInput$ = new Subject<string>();
  public locationSuggestions$!: Observable<GeocodeResult[]>;
  public locationLoading = false;
  public selectedLocation: GeocodeResult | null = null;
  public selectedPath: AutocompleteSuggestion | null = null;
  public numberUtils = inject(NumberUtilsService);
  private mapDefaults = inject(MapDefaultsService);
  private dateUtils = inject(DateUtilsService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private activatedRoute = inject(ActivatedRoute);
  private uiActions = inject(UiActionsService);
  private pendingStep: number | null = Number(this.activatedRoute.snapshot.queryParamMap.get(StoredValue.STEP)) || null;
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentViewMap", NgxLoggerLevel.ERROR);
  private mapTiles = inject(MapTilesService);
  private mapMarkerStyle = inject(MapMarkerStyleService);
  private gpxParser = inject(GpxParserService);
  private http = inject(HttpClient);
  private urlService = inject(UrlService);
  private mapTilesService = inject(MapTilesService);
  public stringUtils = inject(StringUtilsService);
  private spatialFeaturesService = inject(SpatialFeaturesService);
  private addressQueryService = inject(AddressQueryService);
  public actions = inject(PageContentActionsService);
  public options: L.MapOptions | undefined;
  public leafletLayers: L.Layer[] = [];
  public fitBounds: L.LatLngBounds | undefined;
  private mapRef: L.Map | undefined;
  private routePoints: RouteFollowPoint[] = [];
  private markerLayers = new Map<MapMarker, L.Marker>();
  private guideCache: {markers: MapMarker[]; points: RouteFollowPoint[]; entries: RouteGuideEntry[]} | null = null;
  protected activeMarker: MapMarker | null = null;
  private highlightLayer: L.Polyline | null = null;
  protected fullscreen = false;
  @ViewChild("routeMap") private routeMap?: MaximisableMapComponent;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faDownload = faDownload;
  protected readonly faPlus = faPlus;
  protected readonly faTrash = faTrash;
  protected headingUp = this.uiActions.initialBooleanValueFor(StoredValue.MAP_HEADING_UP, false);
  protected guideWidth = Number(this.uiActions.initialValueFor(StoredValue.ROUTE_GUIDE_WIDTH)) || ROUTE_GUIDE_DEFAULT_WIDTH;
  protected guideHeight = Number(this.uiActions.initialValueFor(StoredValue.ROUTE_GUIDE_HEIGHT)) || ROUTE_GUIDE_DEFAULT_HEIGHT;
  protected readonly minGuideHeight = ROUTE_GUIDE_MIN_HEIGHT;
  protected readonly maxGuideHeight = ROUTE_GUIDE_MAX_HEIGHT;
  protected stepSpeed = Number(this.uiActions.initialValueFor(StoredValue.ROUTE_STEP_SPEED)) || ROUTE_STEP_SPEED_DEFAULT;
  public guideOpen = false;
  protected liveEditing = false;
  private undoStack: MapMarker[][] = [];
  private editSnapshot: MapMarker[] | null = null;
  protected saveState: RouteSaveState | null = null;
  private autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  private memberLoginService = inject(MemberLoginService);
  private pageContentService = inject(PageContentService);
  protected readonly minGuideWidth = ROUTE_GUIDE_MIN_WIDTH;
  protected get maxGuideWidth(): number {
    return Math.max(ROUTE_GUIDE_MIN_WIDTH, window.innerWidth - ROUTE_GUIDE_MAP_MIN_WIDTH);
  }
  protected readonly ResizerVariant = ResizerVariant;
  protected readonly ResizerOrientation = ResizerOrientation;
  private mapLoadHandler = () => this.handleMapLoadComplete();
  private sessionMapCenter: [number, number] | undefined;
  private sessionMapZoom: number | undefined;
  public showMap = false;
  public visibleRoutes: MapRouteViewModel[] = [];
  public allRoutes: MapRouteViewModel[] = [];
  public hasRoutePanel = false;
  public hasVisibleRoutes = false;
  public loadingRoutes = false;
  public showControls = true;
  public allowControlsToggle = true;
  public showWaypoints = true;
  public allowWaypointsToggle = true;
  public useViewportFiltering = true;
  public mapHeight = 500;
  public routeCountText = "";
  private routeData: Map<string, RouteGpxData> = new Map();
  private lastRoutesSignature: string | undefined;
  private routeVisibility: Map<string, boolean> = new Map();
  protected routeVisibleCounts: Map<string, number> = new Map();
  protected uniqueId = this.numberUtils.generateUid();

  public mapControlsConfig: MapControlsConfig = {
    showProvider: true,
    showStyle: true,
    showHeight: true,
    showSmoothScroll: false,
    showAutoShowAll: false
  };

  public mapControlsState: MapControlsState = {
    provider: MapProvider.OSM,
    osStyle: DEFAULT_OS_STYLE,
    mapHeight: 500
  };

  private componentReady = false;
  private mapViewChangeHandler = () => this.captureMapView();
  private mapClickHandler = (event: L.LeafletMouseEvent) => {
    if (this.clickToPlace) {
      this.mapClick.emit({latitude: event.latlng.lat, longitude: event.latlng.lng});
    }
  };
  public roseColor = PaletteColor.ROSE;
  private viewportFilterTimer: ReturnType<typeof setTimeout> | null = null;
  private loadRoutesInProgress = false;
  private suppressViewportHandler = false;

  async ngOnInit() {
    this.mapTiles.initializeProjections();
    this.setupAutocomplete();
    this.setupLocationSearch();
    this.componentReady = true;
    await this.refreshFromInput();
  }

  private setupAutocomplete() {
    this.autocompleteSuggestions$ = this.autocompleteInput$.pipe(
      tap(term => this.logger.info(`Autocomplete input: "${term}"`)),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.autocompleteLoading = true),
      switchMap(term => {
        if (!term || term.length < 1) {
          this.logger.info("Autocomplete skipped: query too short");
          this.autocompleteLoading = false;
          return of([]);
        }

        const routesWithSpatialData = this.visibleRoutes.filter(route => route.spatialRouteId);
        if (routesWithSpatialData.length === 0) {
          this.logger.info("Autocomplete skipped: no routes with spatial data");
          this.autocompleteLoading = false;
          return of([]);
        }

        const firstRoute = routesWithSpatialData[0];
        this.logger.info(`Querying autocomplete for "${term}" on route: ${firstRoute.name}`);

        return this.spatialFeaturesService.autocomplete(firstRoute.spatialRouteId!, term).pipe(
          map(suggestions => {
            this.logger.info(`Autocomplete returned ${suggestions.length} suggestions:`, suggestions.map(s => s.label));
            this.autocompleteLoading = false;
            return suggestions;
          }),
          catchError(error => {
            this.logger.error("Autocomplete error:", error);
            this.autocompleteLoading = false;
            return of([]);
          })
        );
      })
    );
  }

  private setupLocationSearch() {
    this.locationSuggestions$ = this.locationInput$.pipe(
      tap(term => this.logger.info(`Location search input: "${term}"`)),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.locationLoading = true),
      switchMap(term => {
        if (!term || term.length < 3) {
          this.locationLoading = false;
          return of([]);
        }

        const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i;
        if (ukPostcodeRegex.test(term.trim())) {
          this.logger.info(`Searching postcode: ${term}`);
          return from(this.addressQueryService.gridReferenceLookup(term)).pipe(
            map(response => [{
              label: response.description || response.postcode || term,
              lat: response.latlng?.lat || 0,
              lng: response.latlng?.lng || 0
            }]),
            tap(results => this.logger.info(`Postcode found:`, results)),
            catchError(error => {
              this.logger.warn("Postcode not found, trying place name search:", error);
              return from(this.addressQueryService.placeNameLookup(term)).pipe(
                map(response => [{
                  label: response.description || term,
                  lat: response.latlng?.lat || 0,
                  lng: response.latlng?.lng || 0
                }])
              );
            }),
            tap(() => this.locationLoading = false)
          );
        }

        this.logger.info(`Searching address: ${term}`);
        return from(this.addressQueryService.placeNameLookup(term)).pipe(
          map(response => [{
            label: response.description || term,
            lat: response.latlng?.lat || 0,
            lng: response.latlng?.lng || 0
          }]),
          tap(results => this.logger.info(`Address search returned ${results.length} results`)),
          tap(() => this.locationLoading = false),
          catchError(error => {
            this.logger.error("Location search error:", error);
            this.locationLoading = false;
            return of([]);
          })
        );
      })
    );
  }

  onPathSelected(suggestion: AutocompleteSuggestion | null) {
    if (!suggestion) {
      this.searchTerm = "";
      this.lastAutoFitSearchTerm = "";
      this.onSearchChange();
      return;
    }

    this.logger.info(`Path selected:`, suggestion);
    this.searchTerm = suggestion.value.trim();
    this.onSearchChange();
  }

  onLocationSelected(location: GeocodeResult | null) {
    if (!location || !this.mapRef) {
      return;
    }

    this.logger.info(`Jumping to location:`, location);
    this.sessionMapCenter = [location.lat, location.lng];
    this.sessionMapZoom = 15;
    this.mapRef.setView(this.sessionMapCenter, this.sessionMapZoom);
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (this.componentReady) {
      if ((changes["row"] && !changes["row"].firstChange)
        || (changes["refreshKey"] && !changes["refreshKey"].firstChange)) {
        this.logger.info(changes, "refreshFromInput called");
        await this.refreshFromInput();
      } else {
        this.logger.info("componentReady:true:changes:", changes, "changes not of right type - refreshFromInput not called");
      }
    } else {
      this.logger.info("componentReady:false:changes:", changes, "refreshFromInput not called");
    }
  }

  ngDoCheck() {
    if (!this.row?.map) {
      return;
    }
    if (this.pendingGuideScroll !== null) {
      this.scrollGuideList();
    }
    const signature = this.routesSignature();
    if (this.componentReady && signature !== this.lastRoutesSignature) {
      this.logger.info("ngDoCheck: route signature changed");
      this.syncAllRoutes(false, signature);
      this.recalculateRouteVisibility();
      if (this.options) {
        this.loadingRoutes = true;
        void this.loadRoutes();
      }
    }
  }

  ngOnDestroy() {
    this.cancelTravel();
    this.detachMapListeners();
    if (this.viewportFilterTimer) {
      clearTimeout(this.viewportFilterTimer);
    }
  }

  private async refreshFromInput() {
    this.resetState();
    this.initializeRoutes();
    await this.initialiseMap();
  }

  private resetState() {
    this.detachMapListeners();
    this.options = undefined;
    this.leafletLayers = [];
    this.fitBounds = undefined;
    this.mapRef = undefined;
    this.showMap = false;
    this.visibleRoutes = [];
    this.hasVisibleRoutes = false;
    this.loadingRoutes = true;
    this.mapHeight = 500;
    this.routeCountText = "";
    this.showControls = true;
    this.allowControlsToggle = true;
    this.routeData.clear();
    this.routeVisibility.clear();
    this.allRoutes = [];
    this.hasRoutePanel = false;
    this.logger.info("resetState: Complete - loadingRoutes:", this.loadingRoutes, "options:", this.options);
  }

  private initializeRoutes() {
    this.mapTilesService.syncMarkersFromLocation(this.pageContent, this.row);
    this.refreshRouteCollections(true);
    this.mapHeight = this.row.map?.mapHeight || 500;
    const provider = (this.row.map?.provider as MapProvider) || MapProvider.OSM;
    const osStyle = this.row.map?.osStyle || DEFAULT_OS_STYLE;
    this.allowControlsToggle = this.row.map?.allowControlsToggle !== false;
    const showDefault = this.row.map?.showControlsDefault;
    this.showControls = isUndefined(showDefault) ? true : showDefault;
    this.allowWaypointsToggle = this.row.map?.allowWaypointsToggle !== false;
    const showWaypointsDefault = this.row.map?.showWaypointsDefault;
    this.showWaypoints = isUndefined(showWaypointsDefault) ? true : showWaypointsDefault;
    this.mapControlsState = {
      provider,
      osStyle,
      mapHeight: this.mapHeight
    };
  }

  private refreshRouteCollections(resetVisibility: boolean) {
    const signature = this.routesSignature();
    this.syncAllRoutes(resetVisibility, signature);
    this.recalculateRouteVisibility();
  }

  private syncAllRoutes(resetVisibility: boolean, signature?: string) {
    const routes = this.row.map?.routes || [];
    if (resetVisibility) {
      this.routeVisibility.clear();
    }
    const ids = new Set(routes.map(route => route.id));
    for (const key of Array.from(this.routeVisibility.keys())) {
      if (!ids.has(key)) {
        this.routeVisibility.delete(key);
      }
    }
    this.allRoutes = routes.map(route => {
      if (!this.routeVisibility.has(route.id)) {
        this.routeVisibility.set(route.id, route.visible !== false);
      }
      return {...route, gpxFileUrl: this.routeUrl(route)};
    });
    this.hasRoutePanel = this.allRoutes.length > 0;
    this.lastRoutesSignature = signature ?? this.routesSignature();
  }

  private recalculateRouteVisibility() {
    const markers = (this.row.map?.markers || []).filter(m => m.latitude != null && m.longitude != null);
    this.visibleRoutes = this.allRoutes.filter(route => this.routeVisibility.get(route.id) !== false);
    this.hasVisibleRoutes = this.visibleRoutes.length > 0 || markers.length > 0;
    this.routeCountText = this.stringUtils.pluraliseWithCount(this.visibleRoutes.length, "route");
  }

  private async initialiseMap() {
    if (!this.row.map) {
      this.logger.info("initialiseMap: No map data");
    } else if (!this.hasVisibleRoutes) {
      this.logger.info("initialiseMap: No visible routes or markers");
      this.showMap = false;
    } else {
      this.logger.info("initialiseMap: Start - loadingRoutes=true, options=undefined");
      this.loadingRoutes = true;
      this.options = undefined;
      this.logger.info("initialiseMap: About to load routes (spinner should show)");
      await this.loadRoutes();
      this.logger.info("initialiseMap: Routes loaded, creating map options");
      const provider = this.mapControlsState.provider;
      const style = this.mapControlsState.osStyle;
      const base = this.mapTiles.createBaseLayer(provider, style);
      const crs = this.mapTiles.crsForStyle(provider, style);
      const maxZoom = this.mapTiles.maxZoomForStyle(provider, style);
      const hasSavedPosition = this.row.map.mapCenter && this.row.map.mapZoom;
      const hasSessionPosition = this.sessionMapCenter && this.sessionMapZoom;
      const willAutoFit = !isUndefined(this.fitBounds);
      const useDefaultPosition = !hasSavedPosition || willAutoFit;

      const zoom = hasSessionPosition ? this.sessionMapZoom : (useDefaultPosition ? this.mapDefaults.zoom() : this.row.map.mapZoom);
      const center = hasSessionPosition
        ? L.latLng(this.sessionMapCenter[0], this.sessionMapCenter[1])
        : (useDefaultPosition ? L.latLng(this.mapDefaults.center()[0], this.mapDefaults.center()[1]) : L.latLng(this.row.map.mapCenter[0], this.row.map.mapCenter[1]));

      this.logger.info(`initialiseMap: Position decision - hasSessionPosition=${hasSessionPosition}, hasSavedPosition=${hasSavedPosition}, sessionCenter=${this.sessionMapCenter}, sessionZoom=${this.sessionMapZoom}, using center=${center}, zoom=${zoom}`);

      this.options = {
        layers: [base],
        zoom,
        center,
        crs,
        maxZoom,
        zoomSnap: 0.1,
        zoomDelta: 0.5
      };
      this.logger.info("initialiseMap: Complete - useDefaultPosition:", useDefaultPosition, "willAutoFit:", willAutoFit, "options set, map should appear");
    }
  }

  private async loadRoutes(skipFitBounds = false) {
    if (this.loadRoutesInProgress) {
      this.logger.info("loadRoutes: Skipping — already in progress");
      return;
    }
    this.loadRoutesInProgress = true;
    this.logger.info("loadRoutes: Start - hasVisibleRoutes:", this.hasVisibleRoutes);
    if (!this.hasVisibleRoutes) {
      this.showMap = false;
      this.leafletLayers = [];
      this.loadingRoutes = false;
      this.loadRoutesInProgress = false;
      this.logger.info("loadRoutes: No visible routes, setting loadingRoutes=false");
      return;
    }

    const desiredRouteIds = new Set(this.visibleRoutes.map(route => route.id));
    for (const routeId of Array.from(this.routeData.keys())) {
      if (!desiredRouteIds.has(routeId)) {
        this.routeData.delete(routeId);
      }
    }

    const routeLayers: L.Layer[] = [];

    this.logger.info("loadRoutes: Loading", this.visibleRoutes.length, "routes (spinner should still be showing)");

    const currentBounds = this.mapRef?.getBounds();
    const maxTracksWithoutFiltering = 500;

    const allRouteLayers = await Promise.all(
      this.visibleRoutes.map(async route => {
        const gpxData = await this.routeDataForRoute(route);
        if (!gpxData?.tracksWithBounds || gpxData.tracksWithBounds.length === 0) {
          this.routeVisibleCounts.set(route.id, 0);
          return [];
        }

        let tracksToRender = gpxData.tracksWithBounds;

        if (this.searchTerm && this.searchTerm.trim().length > 0) {
          tracksToRender = tracksToRender.filter(twb => this.matchesSearch(twb.track));
        }

        if (this.useViewportFiltering && currentBounds) {
          tracksToRender = tracksToRender.filter(twb => currentBounds.intersects(twb.bounds));
        } else {
          tracksToRender = tracksToRender.slice(0, maxTracksWithoutFiltering);
        }

        this.routeVisibleCounts.set(route.id, tracksToRender.length);
        this.searchMatchCount = this.searchTerm ? tracksToRender.length : -1;

        this.logger.info(`loadRoutes: Rendering ${tracksToRender.length} of ${gpxData.totalFeatures} tracks for ${route.name} (viewport filtering: ${this.useViewportFiltering})`);

        return tracksToRender
          .map(twb => this.createRouteLayer(twb.track, gpxData.waypoints, route))
          .filter((layer): layer is L.Layer => layer !== null);
      })
    );

    routeLayers.push(...allRouteLayers.flat());

    const firstRouteData = this.visibleRoutes.length > 0 ? await this.routeDataForRoute(this.visibleRoutes[0]) : null;
    this.routePoints = firstRouteData?.tracksWithBounds?.[0]?.track?.points || [];
    const markers = this.row.map?.markers || [];
    const markerLayers = this.createStandaloneMarkers(markers);
    const allLayers = [...routeLayers, ...markerLayers];
    const hasContent = allLayers.length > 0;

    if (hasContent) {
      this.suppressViewportHandler = true;
      this.leafletLayers = allLayers;
      setTimeout(() => this.applyPendingStep(), 200);
      if (!skipFitBounds) {
        const hasSavedPosition = this.row.map?.mapCenter && this.row.map?.mapZoom;
        const shouldAutoFit = this.row.map?.autoFitBounds !== false;
        const hasActiveSearch = this.searchTerm && this.searchTerm.trim().length > 0;
        this.logger.info("loadRoutes: Auto-fit check - shouldAutoFit:", shouldAutoFit, "hasSavedPosition:", hasSavedPosition, "hasActiveSearch:", hasActiveSearch, "autoFitBounds setting:", this.row.map?.autoFitBounds);
        if (!hasActiveSearch && (shouldAutoFit || !hasSavedPosition)) {
          this.calculateFitBounds();
          this.logger.info("loadRoutes: Calculated fitBounds:", this.fitBounds ? `${this.fitBounds.getSouthWest()} to ${this.fitBounds.getNorthEast()}` : "none");
        }
      } else {
        this.logger.info("loadRoutes: Skipping fitBounds (viewport-triggered reload)");
      }
      this.showMap = true;
      this.logger.info("loadRoutes: Map ready to display (routes:", routeLayers.length, "markers:", markerLayers.length, ") - showMap=true");
      this.updateMapSize();
      this.loadingRoutes = false;
      this.loadRoutesInProgress = false;
      setTimeout(() => this.suppressViewportHandler = false, 600);
    } else {
      this.showMap = false;
      this.logger.info("loadRoutes: No layers or markers, hiding map");
      this.loadingRoutes = false;
      this.loadRoutesInProgress = false;
    }
  }

  routeVisibilityId(routeId: string): string {
    return `route-visible-${routeId}`;
  }

  isRouteVisible(routeId: string): boolean {
    return this.routeVisibility.get(routeId) !== false;
  }

  hasLargeDatasetWarning(): boolean {
    return this.allRoutes.some(route => route.featureCount && route.featureCount > 1000);
  }

  onSearchChange() {
    this.logger.info("Search term changed:", this.searchTerm);
    this.visibleRoutes.forEach(route => {
      if (route.spatialRouteId) {
        this.routeData.delete(route.id);
      }
    });
    void this.loadRoutes();
  }

  clearSearch() {
    this.searchTerm = "";
    this.searchMatchCount = -1;
    this.lastAutoFitSearchTerm = "";
    this.visibleRoutes.forEach(route => {
      if (route.spatialRouteId) {
        this.routeData.delete(route.id);
      }
    });
    void this.loadRoutes();
  }

  private matchesSearch(track: any): boolean {
    if (!this.searchTerm || this.searchTerm.trim().length === 0) {
      return true;
    }
    const searchLower = this.searchTerm.toLowerCase().trim();
    const trackName = (track.name || "").toLowerCase();
    const trackDescription = (track.description || "").toLowerCase();
    return trackName.includes(searchLower) || trackDescription.includes(searchLower);
  }

  onRouteVisibilityToggle(route: MapRouteViewModel, event: Event) {
    const target = event.target as HTMLInputElement;
    this.routeVisibility.set(route.id, target.checked);
    this.recalculateRouteVisibility();
    this.loadingRoutes = true;
    void this.loadRoutes();
    const targetRoute = this.row.map?.routes.find(route => route.id === route.id);
    if (targetRoute) {
      targetRoute.visible = target.checked;
      this.logger.info("routeVisibility for:", route.id, "is:", targetRoute.visible);
      if (this.editing) {
        this.mapConfigChange.emit({routes: this.row.map.routes});
      }
    } else {
      this.logger.info("could not find route for:", route.id);
    }
    this.lastRoutesSignature = this.routesSignature();
  }

  private async routeDataForRoute(route: MapRouteViewModel): Promise<RouteGpxData | undefined> {
    if (this.routeData.has(route.id)) {
      return this.routeData.get(route.id);
    }

    if (route.spatialRouteId) {
      return this.loadSpatialFeaturesFromMongoDB(route);
    }

    if (!route.gpxFileUrl) {
      this.logger.warn("Route has no GPX file URL:", route);
      return undefined;
    }

    try {
      const gpxContent = await firstValueFrom(
        this.http.get(route.gpxFileUrl, {responseType: "text"})
      );
      const parsedGpx = this.gpxParser.parseGpxFile(gpxContent);

      if (parsedGpx.tracks.length > 0) {
        let currentBounds: L.LatLngBounds | undefined;
        try {
          currentBounds = this.mapRef?.getBounds();
        } catch (error) {
          this.logger.warn("Map not fully initialized, skipping bounds check:", error);
        }
        const startTime = this.dateUtils.dateTimeNowAsValue();

        const tracksWithBounds: TrackWithBounds[] = parsedGpx.tracks.map(track => {
          const latLngs = this.gpxParser.toLeafletLatLngs(track);
          const bounds = L.latLngBounds(latLngs);
          return { track, bounds };
        });

        const processingTime = this.dateUtils.dateTimeNowAsValue() - startTime;
        this.logger.info(`Processed ${parsedGpx.tracks.length} tracks in ${processingTime}ms for ${route.name}`);

        if (currentBounds && this.useViewportFiltering) {
          const inViewCount = tracksWithBounds.filter(twb => currentBounds.intersects(twb.bounds)).length;
          this.logger.info(`${inViewCount} of ${parsedGpx.tracks.length} tracks in viewport`);
        }

        const gpxData: RouteGpxData = {
          tracks: parsedGpx.tracks,
          tracksWithBounds,
          waypoints: parsedGpx.waypoints || [],
          totalFeatures: parsedGpx.tracks.length
        };
        this.routeData.set(route.id, gpxData);
        return gpxData;
      }
    } catch (error) {
      this.logger.error("Failed to load GPX file:", route.gpxFileUrl, error);
    }

    return undefined;
  }

  private async loadSpatialFeaturesFromMongoDB(route: MapRouteViewModel): Promise<RouteGpxData | undefined> {
    if (!route.spatialRouteId || !this.mapRef) {
      return undefined;
    }

    try {
      const currentBounds = this.mapRef.getBounds();
      const bounds = {
        southwest: {lat: currentBounds.getSouth(), lng: currentBounds.getWest()},
        northeast: {lat: currentBounds.getNorth(), lng: currentBounds.getEast()}
      };

      const startTime = this.dateUtils.dateTimeNowAsValue();
      const response = await firstValueFrom(
        this.spatialFeaturesService.queryViewport(route.spatialRouteId, bounds, this.searchTerm)
      );
      const queryTime = this.dateUtils.dateTimeNowAsValue() - startTime;

      this.logger.info(`MongoDB query returned ${response.features.length} features in ${queryTime}ms for ${route.name}`);

      const tracksWithBounds: TrackWithBounds[] = response.features.map(feature => {
        let coordinates: number[][];

        if (feature.geometry.type === "Point") {
          coordinates = [feature.geometry.coordinates as number[]];
        } else if (feature.geometry.type === "LineString") {
          coordinates = feature.geometry.coordinates as number[][];
        } else if (feature.geometry.type === "MultiLineString") {
          coordinates = (feature.geometry.coordinates as number[][][])[0] || [];
        } else {
          coordinates = [];
        }

        const points = coordinates.map(([lng, lat]) => ({latitude: lat, longitude: lng}));
        const latLngs = points.map(p => L.latLng(p.latitude, p.longitude));
        const bounds = L.latLngBounds(latLngs);

        const track: GpxTrack = {
          name: feature.name || route.name,
          description: feature.description,
          points
        };

        return {track, bounds};
      });

      const gpxData: RouteGpxData = {
        tracks: tracksWithBounds.map(twb => twb.track),
        tracksWithBounds,
        waypoints: [],
        totalFeatures: route.featureCount || response.totalCount
      };

      this.routeData.set(route.id, gpxData);
      return gpxData;
    } catch (error) {
      this.logger.error("Failed to load spatial features from MongoDB:", error);
      return undefined;
    }
  }

  private mergeGpxTracks(tracks: GpxTrack[]): GpxTrack {
    if (tracks.length === 1) {
      return tracks[0];
    }

    const allPoints = tracks.flatMap(t => t.points);
    const descriptions = tracks.map(t => t.description).filter(Boolean);
    const elevations = tracks
      .flatMap(t => [t.minElevation, t.maxElevation])
      .filter((e): e is number => !isUndefined(e));

    return {
      name: tracks[0].name,
      description: descriptions.length > 0 ? descriptions.join(" | ") : undefined,
      points: allPoints,
      totalDistance: tracks.reduce((sum, t) => sum + (t.totalDistance || 0), 0),
      minElevation: elevations.length > 0 ? Math.min(...elevations) : undefined,
      maxElevation: elevations.length > 0 ? Math.max(...elevations) : undefined,
      totalAscent: tracks.reduce((sum, t) => sum + (t.totalAscent || 0), 0),
      totalDescent: tracks.reduce((sum, t) => sum + (t.totalDescent || 0), 0)
    };
  }

  private createRouteLayer(track: GpxTrack, waypoints: GpxWaypoint[], route: MapRouteViewModel): L.Layer | null {
    const latLngs = this.gpxParser.toLeafletLatLngs(track);
    if (latLngs.length < 2) {
      return null;
    }

    const color = route.color || PaletteColor.ROSE;
    const weight = route.weight || 8;
    const opacity = route.opacity ?? 1.0;
    const haloWeight = weight + 4;
    const haloOpacity = 0.6;

    const halo = L.polyline(latLngs, {
      color: "#ffffff",
      weight: haloWeight,
      opacity: haloOpacity,
      lineCap: "round",
      lineJoin: "round"
    });

    const core = L.polyline(latLngs, {
      color,
      weight,
      opacity,
      lineCap: "round",
      lineJoin: "round",
      smoothFactor: 1
    });

    if (!this.editingNow) {
      core.bindPopup(this.createPopupContent(track, route));
    }

    const routeGroup = L.layerGroup([halo, core]);

    if (!route.spatialRouteId) {
      this.createEndpointMarkers(latLngs, color, weight).forEach(marker => routeGroup.addLayer(marker));
      this.createArrowMarkers(latLngs, track, weight).forEach(marker => routeGroup.addLayer(marker));
    }

    this.createWaypointMarkers(track, waypoints, route).forEach(marker => routeGroup.addLayer(marker));

    return routeGroup;
  }


  private createPopupContent(track: GpxTrack, route: MapRouteViewModel): string {
    const pathName = this.row?.routeGuide?.title || track.name || route.name || "Route";
    const pathType = track.description;

    let content = `<div><strong>${this.escapeHtml(pathName)}</strong></div>`;

    if (pathType && pathType !== pathName) {
      content += `<div class="mt-1"><small class="text-muted">${this.escapeHtml(pathType)}</small></div>`;
    }

    if (track.totalDistance) {
      const distanceKm = (track.totalDistance / 1000).toFixed(2);
      content += `<div class="mt-1"><small>Distance: ${(track.totalDistance / 1609.344).toFixed(1)} miles (${distanceKm} km)</small></div>`;
    }

    if (track.totalAscent || track.totalDescent) {
      content += `<div><small>Ascent: ${track.totalAscent.toFixed(0)}m | Descent: ${track.totalDescent.toFixed(0)}m</small></div>`;
    }

    if (!isUndefined(track.minElevation) && !isUndefined(track.maxElevation)) {
      content += `<div><small>Elevation: ${track.minElevation.toFixed(0)}m - ${track.maxElevation.toFixed(0)}m</small></div>`;
    }

    return content;
  }

  private calculateFitBounds() {
    const routeLatLngs: L.LatLng[] = [];
    const markerLatLngs: L.LatLng[] = [];
    this.logger.info("calculateFitBounds: Processing", this.leafletLayers.length, "layers");
    this.leafletLayers.forEach((layer, index) => {
      if (!layer) {
        this.logger.warn(`calculateFitBounds: Layer ${index} is undefined, skipping`);
        return;
      }
      const layerLatLngs = this.latLngsFromLayer(layer);
      const target = (layer instanceof L.Marker || layer instanceof L.CircleMarker) ? markerLatLngs : routeLatLngs;
      target.push(...layerLatLngs);
    });

    const allLatLngs = routeLatLngs.length > 0 ? routeLatLngs : markerLatLngs;
    this.logger.info("calculateFitBounds: Fitting to", routeLatLngs.length > 0 ? "route" : "markers", "-", allLatLngs.length, "points");
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      this.fitBounds = bounds.pad(0.15);
      this.logger.info("calculateFitBounds: Bounds set to:", this.fitBounds.getSouthWest(), "to", this.fitBounds.getNorthEast(), "(with 15% padding)");
    }
  }

  onMapReady(map: L.Map) {
    this.mapRef = map;
    map.on("click", () => {
      if (!this.editing && !this.clickToPlace && !this.fullscreen && this.guideEntries.length > 0) {
        this.routeMap?.cycle();
      }
    });
    mapGesturesFor(map)?.setOnUserRotate(() => {
      this.zone.run(() => {
        this.headingUp = false;
        this.uiActions.saveValueFor(StoredValue.MAP_HEADING_UP, this.headingUp);
      });
    });
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    map.whenReady(() => {
      this.loadingRoutes = false;
      map.invalidateSize();
    });

    map.on("moveend zoomend", () => {
      if (this.suppressViewportHandler) {
        this.logger.info("Map viewport changed — suppressed (programmatic change)");
        return;
      }
      if (this.useViewportFiltering) {
        this.logger.info("Map viewport changed — scheduling debounced viewport filter");
        if (this.viewportFilterTimer) {
          clearTimeout(this.viewportFilterTimer);
        }
        this.viewportFilterTimer = setTimeout(() => {
          this.logger.info("Debounced viewport filter firing");
          void this.loadRoutes(true);
        }, 300);
      }
    });

      this.attachMapListeners();
      this.captureMapView();
  }

  downloadsFor(route: MapRoute): RouteDownload[] {
    const base = this.stringUtils.kebabCase(route.name);
    return [
      {label: "GPX", url: this.fileDownloadUrl(route.gpxFile), fileName: `${base}.gpx`},
      {label: "ESRI", url: this.fileDownloadUrl(route.esriFile), fileName: `${base}.zip`}
    ].filter(download => !!download.url);
  }

  get canFollowRoute(): boolean {
    return (this.row?.map?.routes || []).some(route => route.visible !== false && !!route.gpxFile?.awsFileName);
  }

  get guideEntries(): RouteGuideEntry[] {
    const markers = this.row?.map?.markers || [];
    if (!this.guideCache || this.guideCache.markers !== markers || this.guideCache.points !== this.routePoints) {
      const entries = markers
        .map((marker, index) => ({marker, index}))
        .filter(entry => this.stepsEditing ? isAuthoredMarker(entry.marker) : !!entry.marker.instruction?.trim())
        .map(entry => ({...entry, distanceMetres: distanceAlongRouteMetres(this.routePoints, entry.marker)}));
      this.guideCache = {markers, points: this.routePoints, entries};
    }
    return this.guideCache.entries;
  }

  milesAlong(metres: number): string {
    return `${(metres / 1609.344).toFixed(1)} miles from the start`;
  }

  focusWaypoint(entry: RouteGuideEntry): void {
    this.guideOpen = true;
    const previous = this.guideEntries.find(item => item.marker === this.activeMarker) || null;
    const entries = this.guideEntries;
    const wraps = previous === entries[entries.length - 1] && entry === entries[0];
    this.cancelTravel();
    this.travelling = false;
    this.suppressViewportHandler = true;
    this.highlightWaypoint(entry.marker);
    if (previous && previous !== entry && !wraps && this.mapRef && this.routePoints.length > 1) {
      this.mapRef.closePopup();
      this.travelling = true;
      this.refreshMarkerIcon(entry.marker);
      this.cancelTravel = travelAlongRoute({
        map: this.mapRef,
        points: this.routePoints,
        fromIndex: nearestPointIndex(this.routePoints, previous.marker),
        toIndex: nearestPointIndex(this.routePoints, entry.marker),
        headingUp: this.headingUp && this.fullscreen,
        speed: this.stepSpeed,
        travellerIcon: this.mapMarkerStyle.headingRingIcon(this.markerProvider, 0),
        onDone: () => {
          this.travelling = false;
          this.refreshMarkerIcon(entry.marker);
          this.markerLayers.get(entry.marker)?.openPopup();
          this.suppressViewportHandler = false;
        }
      });
    } else {
      this.applyHeadingUp(entry, true);
      this.markerLayers.get(entry.marker)?.openPopup();
      this.mapRef?.panTo([entry.marker.latitude, entry.marker.longitude], {animate: true});
      setTimeout(() => this.suppressViewportHandler = false, 900);
    }
    if (!this.editing) {
      const position = entries.indexOf(entry);
      void this.uiActions.updateQueryParameters({[StoredValue.STEP]: position >= 0 ? String(position + 1) : null});
    }
  }

  private cancelTravel: () => void = () => undefined;
  private travelling = false;

  private applyPendingStep(): void {
    const entries = this.guideEntries;
    if (this.pendingStep !== null && entries[this.pendingStep - 1] && this.markerLayers.size > 0) {
      const entry = entries[this.pendingStep - 1];
      this.pendingStep = null;
      this.focusWaypoint(entry);
    }
  }

  openStepThrough(): void {
    if (!this.fullscreen) {
      this.routeMap?.cycle();
    }
    if (this.activeIndex < 0 && this.guideEntries.length > 0) {
      this.focusWaypoint(this.guideEntries[0]);
    }
  }

  toggleMapHeading(): void {
    this.headingUp = !this.headingUp;
    this.uiActions.saveValueFor(StoredValue.MAP_HEADING_UP, this.headingUp);
    const gestures = this.mapRef ? mapGesturesFor(this.mapRef) : null;
    if (this.headingUp) {
      const active = this.guideEntries.find(entry => entry.marker === this.activeMarker);
      if (active) {
        this.applyHeadingUp(active, true);
      }
    } else {
      gestures?.resetNorth(true);
    }
  }

  private applyHeadingUp(entry: RouteGuideEntry, animate = false): void {
    const gestures = this.mapRef && this.headingUp && this.fullscreen ? mapGesturesFor(this.mapRef) : null;
    if (gestures && this.routePoints.length > 1) {
      const bearing = travelBearingAt(this.routePoints, nearestPointIndex(this.routePoints, entry.marker));
      if (bearing !== null) {
        gestures.setBearing(-bearing, animate);
      }
    }
  }

  get guideListId(): string {
    return this.stringUtils.kebabCase("route-guide", this.uniqueId);
  }

  get markerColour(): string {
    return this.mapMarkerStyle.numberedMarkerColour(this.row?.map?.provider);
  }

  turnDegrees(marker: MapMarker): number {
    return turnRotationDegrees(marker.turn);
  }

  get guidePanelPosition(): RouteGuidePanelPosition {
    return this.row?.map?.guidePanel || RouteGuidePanelPosition.BELOW;
  }

  get guidePanelVisible(): boolean {
    const positioned = this.guidePanelPosition !== RouteGuidePanelPosition.HIDDEN;
    return this.guideEntries.length > 0 && (this.stepsEditing || (positioned && (this.fullscreen || this.guideOpen)));
  }

  toggleGuide(): void {
    this.guideOpen = !this.guideOpen;
  }

  onGuideTextChange(): void {
    this.guideCache = null;
    this.mapConfigChange.emit({markers: this.row.map?.markers});
    this.scheduleAutosave();
  }

  get editingNow(): boolean {
    return this.editing || this.liveEditing;
  }

  get stepsEditing(): boolean {
    return this.editingNow && this.showSteps;
  }

  get pinsDraggable(): boolean {
    return this.liveEditing || (this.editing && this.fullscreen);
  }

  private syncPinDragging(): void {
    this.markerLayers.forEach(layer => this.pinsDraggable ? layer.dragging?.enable() : layer.dragging?.disable());
  }

  get canLiveEdit(): boolean {
    return !this.editing && !!this.pageContent?.id && this.memberLoginService.allowContentEdits();
  }

  toggleLiveEdit(): void {
    this.liveEditing = !this.liveEditing;
    this.guideCache = null;
    this.undoStack = [];
    this.editSnapshot = this.liveEditing ? cloneDeep(this.row.map?.markers || []) : null;
    if (this.liveEditing && this.headingUp) {
      this.toggleMapHeading();
    }
    this.syncPinDragging();
    if (!this.liveEditing) {
      this.flushAutosave();
    }
  }

  discardLiveEdit(): void {
    if (this.liveEditing && this.editSnapshot && this.row.map) {
      this.row.map.markers = this.editSnapshot;
      this.waypointsChanged();
    }
    this.toggleLiveEdit();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  beginGuideEdit(): void {
    this.recordUndo();
  }

  recordUndo(): void {
    const snapshot = cloneDeep(this.row.map?.markers || []);
    const top = this.undoStack[this.undoStack.length - 1];
    if (!top || JSON.stringify(top) !== JSON.stringify(snapshot)) {
      this.undoStack = [...this.undoStack.slice(-(ROUTE_UNDO_LIMIT - 1)), snapshot];
    }
  }

  undo(): void {
    const snapshot = this.undoStack.pop();
    if (snapshot && this.row.map) {
      this.row.map.markers = snapshot;
      this.waypointsChanged();
    }
  }

  addStepAfter(entry: RouteGuideEntry): void {
    if (this.row.map && this.routePoints.length > 1) {
      this.recordUndo();
      const entries = this.guideEntries;
      const position = entries.indexOf(entry);
      const cumulative = cumulativeDistances(this.routePoints);
      const from = entry.distanceMetres ?? 0;
      const next = entries[position + 1]?.distanceMetres ?? cumulative[cumulative.length - 1];
      const along = pointAlongRoute(this.routePoints, cumulative, (from + next) / 2);
      const marker: MapMarker = {id: this.numberUtils.generateUid(), latitude: along.point.latitude, longitude: along.point.longitude, label: "", instruction: "", kind: RouteWaypointKind.TURN};
      this.row.map.markers = [...(this.row.map.markers || []), marker];
      this.waypointsChanged();
      this.highlightWaypoint(marker);
    }
  }

  removeStep(entry: RouteGuideEntry): void {
    if (this.row.map) {
      this.recordUndo();
      this.row.map.markers = (this.row.map.markers || []).filter(marker => marker !== entry.marker);
      this.waypointsChanged();
    }
  }

  private waypointsChanged(): void {
    this.renumberSteps();
    this.guideCache = null;
    this.updateLayersForWaypoints();
    this.mapConfigChange.emit({markers: this.row.map?.markers});
    this.scheduleAutosave();
  }

  private renumberSteps(): void {
    const markers = this.row.map?.markers || [];
    const directed = markers.filter(marker => marker.kind === RouteWaypointKind.TURN || !!marker.instruction?.trim());
    const others = markers.filter(marker => !directed.includes(marker));
    const ordered = [...directed].sort((left, right) => (distanceAlongRouteMetres(this.routePoints, left) ?? 0) - (distanceAlongRouteMetres(this.routePoints, right) ?? 0));
    ordered.forEach((marker, index) => marker.label = String(index + 1));
    this.row.map.markers = [...others, ...ordered];
  }

  private scheduleAutosave(): void {
    if (this.liveEditing) {
      this.saveState = RouteSaveState.PENDING;
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = setTimeout(() => this.flushAutosave(), ROUTE_AUTOSAVE_DELAY_MS);
    }
  }

  private flushAutosave(): void {
    clearTimeout(this.autosaveTimer);
    if (this.saveState === RouteSaveState.PENDING && this.pageContent?.id) {
      this.saveState = RouteSaveState.SAVING;
      this.pageContentService.update(this.pageContent)
        .then(() => this.saveState = RouteSaveState.SAVED)
        .catch(error => {
          this.logger.error("autosave failed", error);
          this.saveState = RouteSaveState.FAILED;
        });
    }
  }

  get guideOnRight(): boolean {
    return this.guidePanelVisible && (this.stepsEditing || this.guidePanelPosition === RouteGuidePanelPosition.RIGHT || (this.fullscreen && (this.guidePanelPosition === RouteGuidePanelPosition.ABOVE || this.guidePanelPosition === RouteGuidePanelPosition.BELOW)));
  }

  get guideBelow(): boolean {
    return !this.stepsEditing && this.guidePanelPosition === RouteGuidePanelPosition.BELOW;
  }

  get guideOnLeft(): boolean {
    return this.guidePanelVisible && this.guidePanelPosition === RouteGuidePanelPosition.LEFT;
  }

  get activeIndex(): number {
    return this.guideEntries.findIndex(entry => entry.marker === this.activeMarker);
  }

  onMapSizeChange(state: MaximisableMapState): void {
    this.fullscreen = state.fullScreen;
    this.syncPinDragging();
    if (!state.fullScreen && this.mapRef) {
      mapGesturesFor(this.mapRef)?.resetNorth();
    }
    setTimeout(() => {
      this.mapRef?.invalidateSize();
      if (this.mapRef && this.routePoints.length > 1) {
        const padding = state.fullScreen ? ROUTE_FULLSCREEN_FIT_PADDING : ROUTE_FIT_PADDING;
        this.mapRef.fitBounds(L.latLngBounds(this.routePoints.map(point => [point.latitude, point.longitude])), {animate: false, padding: [padding, padding]});
      }
      if (state.fullScreen && this.pendingStep === null && this.activeIndex < 0 && this.guideEntries.length > 0) {
        this.guideOpen = true;
        this.highlightWaypoint(this.guideEntries[0].marker);
      } else if (state.fullScreen && this.activeIndex >= 0) {
        this.pendingGuideScroll = this.guideEntries[this.activeIndex]?.index ?? null;
        setTimeout(() => this.scrollGuideList(false), 350);
      }
      if (state.fullScreen && this.headingUp && this.activeIndex >= 0) {
        const active = this.guideEntries.find(entry => entry.marker === this.activeMarker);
        if (active) {
          this.applyHeadingUp(active, true);
        }
      }
    }, state.fullScreen ? ROUTE_FULLSCREEN_SETTLE_MS : ROUTE_RESIZE_SETTLE_MS);
  }

  nextStep(): void {
    if (this.activeIndex >= this.guideEntries.length - 1) {
      this.firstStep();
    } else {
      this.stepBy(1);
    }
  }

  firstStep(): void {
    if (this.guideEntries.length > 0) {
      this.focusWaypoint(this.guideEntries[0]);
    }
  }

  previousStep(): void {
    this.stepBy(-1);
  }

  private stepBy(offset: number): void {
    const entries = this.guideEntries;
    const target = Math.min(Math.max(this.activeIndex + offset, 0), entries.length - 1);
    if (entries[target]) {
      this.focusWaypoint(entries[target]);
    }
  }

  @HostListener("document:keydown", ["$event"])
  onKeydown(event: KeyboardEvent): void {
    if (this.fullscreen) {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        this.nextStep();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        this.previousStep();
      }
    }
  }

  private highlightStretch(marker: MapMarker): void {
    this.highlightLayer?.remove();
    this.highlightLayer = null;
    const entries = this.guideEntries;
    const position = entries.findIndex(entry => entry.marker === marker);
    if (this.mapRef && position >= 0 && this.routePoints.length > 1) {
      const from = nearestPointIndex(this.routePoints, marker);
      const next = entries[position + 1];
      const to = next ? nearestPointIndex(this.routePoints, next.marker) : this.routePoints.length - 1;
      const stretch = this.routePoints.slice(Math.min(from, to), Math.max(from, to) + 1).map(point => [point.latitude, point.longitude] as [number, number]);
      if (stretch.length > 1) {
        const colour = this.row.map?.routes?.find(route => route.visible !== false)?.color || PaletteColor.ROSE;
        this.highlightLayer = L.polyline(stretch, {color: colour, weight: 14, opacity: 0.35, interactive: false}).addTo(this.mapRef);
      }
    }
  }

  private selectWaypoint(marker: MapMarker): void {
    if (this.activeMarker !== marker && this.guideEntries.some(entry => entry.marker === marker)) {
      this.highlightWaypoint(marker);
    }
  }

  private highlightWaypoint(marker: MapMarker): void {
    const previous = this.activeMarker;
    this.activeMarker = marker;
    if (previous && previous !== marker) {
      this.refreshMarkerIcon(previous);
    }
    this.refreshMarkerIcon(marker);
    this.highlightStretch(marker);
    this.pendingGuideScroll = (this.row?.map?.markers || []).indexOf(marker);
    setTimeout(() => this.scrollGuideList());
  }

  private pendingGuideScroll: number | null = null;

  private scrollGuideList(smooth = true): void {
    const list = document.getElementById(this.guideListId);
    const item = this.pendingGuideScroll === null ? null : list?.querySelector<HTMLElement>(`[data-guide-index="${this.pendingGuideScroll}"]`);
    const container = list && list.scrollHeight > list.clientHeight + 1 ? list : list?.closest<HTMLElement>(".route-guide-panel") || list;
    if (container && item && container.clientHeight > 0) {
      this.pendingGuideScroll = null;
      const offset = item.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({top: Math.max(0, offset - (container.clientHeight - item.offsetHeight) / 2), behavior: smooth ? "smooth" : "auto"});
    }
  }

  setStepSpeed(speed: number): void {
    this.stepSpeed = speed;
    this.uiActions.saveValueFor(StoredValue.ROUTE_STEP_SPEED, speed);
  }

  onGuideHeightChange(height: number): void {
    this.guideHeight = height;
  }

  saveGuideHeight(): void {
    this.uiActions.saveValueFor(StoredValue.ROUTE_GUIDE_HEIGHT, this.guideHeight);
  }

  onGuideWidthChange(width: number): void {
    this.guideWidth = width;
    setTimeout(() => this.mapRef?.invalidateSize(), 60);
  }

  saveGuideWidth(): void {
    this.uiActions.saveValueFor(StoredValue.ROUTE_GUIDE_WIDTH, this.guideWidth);
  }

  openFollow(): void {
    const route = (this.row.map?.routes || []).find(item => item.visible !== false && item.gpxFile?.awsFileName);
    const queryParams: Record<string, string> = {};
    if (this.pageContent?.path) {
      queryParams.path = this.pageContent.path;
    }
    if (route?.id) {
      queryParams.routeId = route.id;
    }
    void this.router.navigate(["/app/follow"], {queryParams});
  }

  toggleControls() {
    if (!this.allowControlsToggle) {
      return;
    }
    this.showControls = !this.showControls;
    if (this.editing && this.row.map) {
      this.row.map.showControlsDefault = this.showControls;
      this.mapConfigChange.emit({showControlsDefault: this.showControls});
    }
    setTimeout(() => this.updateMapSize(), 200);
  }

  toggleWaypoints() {
    if (!this.allowWaypointsToggle) {
      return;
    }
    this.showWaypoints = !this.showWaypoints;
    if (this.editing && this.row.map) {
      this.row.map.showWaypointsDefault = this.showWaypoints;
      this.mapConfigChange.emit({showWaypointsDefault: this.showWaypoints});
    }
    this.updateLayersForWaypoints();
  }

  async applyOverlayConfigFromEditor(config?: MapData) {
    if (!config) {
      return;
    }
    this.logger.info("applyOverlayConfigFromEditor: received config", config);
    this.suppressViewportHandler = true;
    const provider = (config.provider as MapProvider) || this.mapControlsState.provider;
    const style = config.osStyle || this.mapControlsState.osStyle;
    const providerChanged = provider !== this.mapControlsState.provider;
    const styleChanged = style !== this.mapControlsState.osStyle;
    if (providerChanged || styleChanged) {
      this.logger.info("applyOverlayConfigFromEditor: changing provider/style", provider, style);
      this.mapControlsState = {...this.mapControlsState, provider, osStyle: style};
      await this.initialiseMap();
    }
    if (!isUndefined(config.mapHeight) && config.mapHeight !== this.mapHeight) {
      this.logger.info("applyOverlayConfigFromEditor: updating map height", config.mapHeight);
      this.mapHeight = config.mapHeight;
      this.mapControlsState = {...this.mapControlsState, mapHeight: config.mapHeight};
      this.updateMapSize();
    }
    if (!isUndefined(config.mapZoom) && this.mapRef && config.mapZoom !== this.mapRef.getZoom()) {
      this.logger.info("applyOverlayConfigFromEditor: updating map zoom", config.mapZoom);
      this.mapRef.setZoom(config.mapZoom);
    }
    if (config.mapCenter && this.mapRef) {
      const currentCenter = this.mapRef.getCenter();
      const nextCenter = L.latLng(config.mapCenter[0], config.mapCenter[1]);
      if (!currentCenter.equals(nextCenter)) {
        this.logger.info("applyOverlayConfigFromEditor: updating map center", nextCenter);
        this.mapRef.panTo(nextCenter, {animate: false});
      }
    }
    const showControlsDefault = isUndefined(config.showControlsDefault) ? true : config.showControlsDefault;
    if (showControlsDefault !== this.showControls) {
      this.logger.info("applyOverlayConfigFromEditor: toggling controls visibility", showControlsDefault);
      this.showControls = showControlsDefault;
      setTimeout(() => this.updateMapSize(), 200);
    }
    const allowControls = config.allowControlsToggle !== false;
    if (allowControls !== this.allowControlsToggle) {
      this.logger.info("applyOverlayConfigFromEditor: updating allowControlsToggle", allowControls);
      this.allowControlsToggle = allowControls;
    }
    const showWaypointsDefault = isUndefined(config.showWaypointsDefault) ? true : config.showWaypointsDefault;
    if (showWaypointsDefault !== this.showWaypoints) {
      this.logger.info("applyOverlayConfigFromEditor: toggling waypoint visibility", showWaypointsDefault);
      this.showWaypoints = showWaypointsDefault;
      this.updateLayersForWaypoints();
    }
    const allowWaypoints = config.allowWaypointsToggle !== false;
    if (allowWaypoints !== this.allowWaypointsToggle) {
      this.logger.info("applyOverlayConfigFromEditor: updating allowWaypointsToggle", allowWaypoints);
      this.allowWaypointsToggle = allowWaypoints;
    }
    const autoFitEnabled = config.autoFitBounds !== false;
    if (autoFitEnabled) {
      this.logger.info("applyOverlayConfigFromEditor: auto-fit enabled, recalculating bounds");
      this.calculateFitBounds();
      if (this.mapRef && this.fitBounds) {
        this.logger.info("applyOverlayConfigFromEditor: fitting to bounds", this.fitBounds.getSouthWest(), this.fitBounds.getNorthEast());
        this.mapRef.fitBounds(this.fitBounds);
      }
    }
    setTimeout(() => this.suppressViewportHandler = false, 400);
  }

  private updateLayersForWaypoints() {
    const currentBounds = this.mapRef?.getBounds();
    const maxTracksWithoutFiltering = 500;

    const routeLayers = this.visibleRoutes.flatMap(route => {
      const gpxData = this.routeData.get(route.id);
      if (!gpxData?.tracksWithBounds || gpxData.tracksWithBounds.length === 0) {
        this.routeVisibleCounts.set(route.id, 0);
        return [];
      }

      let tracksToRender = gpxData.tracksWithBounds;

      if (this.searchTerm && this.searchTerm.trim().length > 0) {
        tracksToRender = tracksToRender.filter(twb => this.matchesSearch(twb.track));
      }

      if (this.useViewportFiltering && currentBounds) {
        tracksToRender = tracksToRender.filter(twb => currentBounds.intersects(twb.bounds));
      } else {
        tracksToRender = tracksToRender.slice(0, maxTracksWithoutFiltering);
      }

      this.routeVisibleCounts.set(route.id, tracksToRender.length);

      return tracksToRender
        .map(twb => this.createRouteLayer(twb.track, gpxData.waypoints, route))
        .filter((layer): layer is L.Layer => layer !== null);
    });

    const markerLayers = this.showWaypoints ? this.createStandaloneMarkers(this.row.map?.markers || []) : [];
    this.leafletLayers = [...routeLayers, ...markerLayers];
  }

  onProviderChange(provider: MapProvider) {
    this.mapControlsState = {...this.mapControlsState, provider};
    this.updateRowMap({provider});
    this.rebuildMap();
  }

  onStyleChange(style: string) {
    this.mapControlsState = {...this.mapControlsState, osStyle: style};
    this.updateRowMap({osStyle: style});
    this.rebuildMap();
  }

  private rebuildMap() {
    this.options = undefined;
    this.mapRef = undefined;
    setTimeout(() => this.initialiseMap(), 0);
  }

  onHeightChange(height: number) {
    this.mapHeight = height;
    this.mapControlsState = {...this.mapControlsState, mapHeight: height};
    this.updateRowMap({mapHeight: height});
    this.updateMapSize();
  }

  private updateMapSize() {
    if (this.mapRef) {
      setTimeout(() => {
        this.mapRef?.invalidateSize();
      }, 100);
    }
  }

  private routeUrl(route: MapRoute): string | undefined {
    return this.fileDownloadUrl(route.gpxFile as Partial<ServerFileNameData> | undefined);
  }

  private filePath(fileData: Partial<ServerFileNameData> | undefined): string | undefined {
    if (!fileData || !fileData.awsFileName) {
      return undefined;
    } else if (fileData.rootFolder && !fileData.awsFileName.startsWith(`${fileData.rootFolder}/`)) {
      return `${fileData.rootFolder}/${fileData.awsFileName}`;
    } else {
      return fileData.awsFileName;
    }
  }

  public fileDownloadUrl(fileData: (Partial<ServerFileNameData> | FileNameData) | undefined): string | undefined {
    const filePath = this.filePath(fileData);
    if (!filePath) {
      return undefined;
    }
    if (this.urlService.isRemoteUrl(filePath)) {
      return filePath;
    }
    return this.urlService.resourceRelativePathForAWSFileName(filePath) || undefined;
  }

  private routesSignature(): string {
    const routes = this.row.map?.routes || [];
    return JSON.stringify(routes.map(route => ({
      id: route.id,
      gpx: route.gpxFile?.awsFileName,
      esri: route.esriFile?.awsFileName,
      visible: route.visible !== false,
      color: route.color,
      weight: route.weight,
      opacity: route.opacity,
      name: route.name
    })));
  }

  private attachMapListeners() {
    if (!this.mapRef) {
      return;
    } else {
      this.mapRef.on("moveend", this.mapViewChangeHandler);
      this.mapRef.on("zoomend", this.mapViewChangeHandler);
      this.mapRef.once("load", this.mapLoadHandler);
      this.mapRef.on("click", this.mapClickHandler);
    }
  }

  private detachMapListeners() {
    if (!this.mapRef) {
      return;
    } else {
      this.mapRef.off("moveend", this.mapViewChangeHandler);
      this.mapRef.off("zoomend", this.mapViewChangeHandler);
      this.mapRef.off("load", this.mapLoadHandler);
      this.mapRef.off("click", this.mapClickHandler);
    }
  }

  private handleMapLoadComplete() {
    this.loadingRoutes = false;
  }

  private captureMapView() {
    if (!this.mapRef || !this.row?.map || this.suppressViewportHandler) {
      return;
    }

    const center = this.mapRef.getCenter();
    const zoom = this.mapRef.getZoom();
    this.logger.info("captureMapView: center:", center.lat, center.lng, "zoom:", zoom, "editing:", this.editing);

    if (this.editing) {
      this.updateRowMap({
        mapCenter: [center.lat, center.lng],
        mapZoom: zoom
      });
    } else {
      this.sessionMapCenter = [center.lat, center.lng];
      this.sessionMapZoom = zoom;
      this.logger.info(`Session position updated: center=${this.sessionMapCenter}, zoom=${this.sessionMapZoom}`);
    }
  }

  private updateRowMap(partial: Partial<MapData>) {
    if (!this.row?.map) {
      return;
    }
    if (!isUndefined(partial.mapCenter) || !isUndefined(partial.mapZoom)) {
      partial.autoFitBounds = false;
    }
    let changed = false;
    const currentMap = this.row.map as Record<string, any>;
    (keys(partial) as (keyof MapData)[]).forEach(key => {
      const nextValue = partial[key];
      if (isUndefined(nextValue)) {
        return;
      }
      const previous = currentMap[key as string];
      if (!this.valuesEqual(previous, nextValue)) {
        currentMap[key as string] = nextValue;
        changed = true;
      }
    });
    if (changed) {
      this.mapConfigChange.emit(this.row.map);
    }
  }

  private valuesEqual(current: any, next: any): boolean {
    if (isArray(current) && isArray(next)) {
      if (current.length !== next.length) {
        return false;
      }
      return current.every((value, index) => value === next[index]);
    }
    return current === next;
  }

  private createEndpointMarkers(latLngs: [number, number][], color: string, weight: number): L.CircleMarker[] {
    if (latLngs.length === 0) {
      return [];
    }
    const radius = Math.max(weight + 2, 6);
    const start = L.circleMarker(latLngs[0], {
      radius,
      color: "#ffffff",
      weight: 3,
      fillColor: color,
      fillOpacity: 1,
      interactive: false
    });
    const end = L.circleMarker(latLngs[latLngs.length - 1], {
      radius: radius + 1,
      color: "#ffffff",
      weight: 3,
      fillColor: color,
      fillOpacity: 1,
      interactive: false
    });
    return [start, end];
  }

  private get markerProvider(): MapProvider {
    return (this.row.map?.provider as MapProvider) || MapProvider.OSM;
  }

  private stepPopupHtml(marker: MapMarker): string {
    const entry = this.guideEntries.find(item => item.marker === marker);
    const [width, height, , , pathData] = faArrowUp.icon;
    const path = isString(pathData) ? pathData : pathData.join(" ");
    const turn = marker.turn ? `<svg class="route-guide-turn" viewBox="0 0 ${width} ${height}" width="12" height="12" style="transform:rotate(${turnRotationDegrees(marker.turn)}deg)" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>` : "";
    const distance = entry && entry.distanceMetres !== null ? this.escapeHtml(this.milesAlong(entry.distanceMetres)) : "";
    const note = marker.note ? `<span class="route-guide-note">${this.escapeHtml(marker.note)}</span>` : "";
    return `<div class="route-step-card"><span class="route-guide-number" style="background:${this.markerColour}">${this.escapeHtml(marker.label)}</span><span class="route-guide-body"><span class="route-guide-distance">${turn}${distance}</span><span class="route-step-instruction">${this.escapeHtml(marker.instruction)}</span>${note}</span></div>`;
  }

  private refreshMarkerIcon(marker: MapMarker): void {
    const layer = this.markerLayers.get(marker);
    const label = marker.label?.trim();
    if (layer && label && label.length <= 3) {
      const active = marker === this.activeMarker && this.routePoints.length > 1 && !this.travelling;
      const bearing = active ? travelBearingAt(this.routePoints, nearestPointIndex(this.routePoints, marker)) : null;
      layer.setIcon(this.mapMarkerStyle.numberedMarkerIcon(label, this.markerProvider, this.row.map?.osStyle || DEFAULT_OS_STYLE, bearing));
    }
  }

  private createStandaloneMarkers(markers: MapMarker[]): L.Layer[] {
    const provider = this.markerProvider;
    const osStyle = this.row.map?.osStyle || DEFAULT_OS_STYLE;
    const icon = this.mapMarkerStyle.markerIcon(provider, osStyle);
    this.markerLayers.clear();
    return markers.map(marker => {
      const latlng: [number, number] = [marker.latitude, marker.longitude];
      const label = marker.label?.trim();
      const markerIcon = label && label.length <= 3 ? this.mapMarkerStyle.numberedMarkerIcon(label, provider, osStyle) : icon;
      const leafletMarker = L.marker(latlng, {icon: markerIcon, draggable: this.pinsDraggable});
      this.markerLayers.set(marker, leafletMarker);
      leafletMarker.on("popupopen", event => {
        this.highlightWaypoint(marker);
        event.popup.update();
      });
      leafletMarker.on("click", () => this.selectWaypoint(marker));
      leafletMarker.on("dragstart", () => {
        if (this.pinsDraggable) {
          this.recordUndo();
        }
      });
      leafletMarker.on("dragend", () => {
        if (this.pinsDraggable) {
          const moved = leafletMarker.getLatLng();
          const snapped = snapToRoute(this.routePoints, cumulativeDistances(this.routePoints), {latitude: moved.lat, longitude: moved.lng});
          const position = snapped ? snapped.point : {latitude: moved.lat, longitude: moved.lng};
          leafletMarker.setLatLng([position.latitude, position.longitude]);
          marker.latitude = position.latitude;
          marker.longitude = position.longitude;
          this.guideCache = null;
          this.selectWaypoint(marker);
          this.mapConfigChange.emit({markers: this.row.map?.markers});
          this.scheduleAutosave();
        }
      });
      if (marker.label || marker.instruction) {
        const numbered = !!label && label.length <= 3;
        const title = marker.instruction && numbered ? "" : `<div><strong>${this.escapeHtml(marker.label || "Waypoint")}</strong></div>`;
        const instruction = marker.instruction ? `<div${title ? " class=\"mt-1\"" : ""}>${this.escapeHtml(marker.instruction)}</div>` : "";
        const note = marker.note ? `<div class="mt-1"><small>${this.escapeHtml(marker.note)}</small></div>` : "";
        if (numbered && marker.instruction) {
          leafletMarker.bindPopup(() => this.stepPopupHtml(marker), {autoPan: false, className: ROUTE_STEP_POPUP_CLASS, minWidth: ROUTE_STEP_POPUP_MIN_WIDTH, maxWidth: ROUTE_STEP_POPUP_MAX_WIDTH});
        } else {
          leafletMarker.bindPopup(`${title}${instruction}${note}`, {autoPan: false});
        }
      }
      return leafletMarker;
    });
  }

  private createArrowMarkers(latLngs: [number, number][], track: GpxTrack, weight: number): L.Marker[] {
    if (latLngs.length < 2) {
      return [];
    }

    const spacing = this.arrowSpacing(track);
    const markers: L.Marker[] = [];
    if (spacing <= 0) {
      return markers;
    }

    const placeArrowsAlongSegment = (acc: {distanceSinceLast: number; markers: L.Marker[]}, segment: {start: L.LatLng; end: L.LatLng; segmentDistance: number}) => {
      const {start, end, segmentDistance} = segment;
      const bearing = this.bearingBetween(start, end);
      const total = acc.distanceSinceLast + segmentDistance;
      const count = Math.floor(total / spacing);
      const newMarkers = Array.from({length: count}, (_, k) => {
        const ratio = ((k + 1) * spacing - acc.distanceSinceLast) / segmentDistance;
        const lat = start.lat + (end.lat - start.lat) * ratio;
        const lng = start.lng + (end.lng - start.lng) * ratio;
        return this.createArrowMarker([lat, lng], bearing, weight);
      });
      return {distanceSinceLast: total - count * spacing, markers: [...acc.markers, ...newMarkers]};
    };
    const segments = latLngs.slice(1).map((_, idx) => {
      const start = L.latLng(latLngs[idx]);
      const end = L.latLng(latLngs[idx + 1]);
      return {start, end, segmentDistance: start.distanceTo(end)};
    }).filter(seg => seg.segmentDistance > 0);
    const result = segments.reduce(placeArrowsAlongSegment, {distanceSinceLast: 0, markers: []});
    result.markers.forEach(m => markers.push(m));

    if (markers.length === 0) {
      const midIndex = Math.floor(latLngs.length / 2);
      const direction = this.bearingBetween(L.latLng(latLngs[0]), L.latLng(latLngs[latLngs.length - 1]));
      markers.push(this.createArrowMarker(latLngs[midIndex], direction, weight));
    }

    return markers;
  }

  private createWaypointMarkers(track: GpxTrack, waypoints: GpxWaypoint[], route: MapRouteViewModel): L.Marker[] {
    const markers: L.Marker[] = [];

    if (!this.showWaypoints || waypoints.length === 0) {
      return markers;
    }

    const provider = (this.row.map?.provider as MapProvider) || MapProvider.OSM;
    const osStyle = this.row.map?.osStyle || DEFAULT_OS_STYLE;
    const icon = this.mapMarkerStyle.markerIcon(provider, osStyle);

    let unnamedIndex = 1;
    waypoints.forEach(waypoint => {
      const label = waypoint.name || `${route.name || "Waypoint"} ${unnamedIndex++}`;
      const shortLabel = waypoint.name?.trim();
      const waypointIcon = shortLabel && shortLabel.length <= 3 ? this.mapMarkerStyle.numberedMarkerIcon(shortLabel, provider, osStyle) : icon;
      const popup = this.createWaypointPopupContent(label, waypoint.description);
      const marker = L.marker([waypoint.latitude, waypoint.longitude], {icon: waypointIcon});
      marker.bindPopup(popup);
      markers.push(marker);
    });

    return markers;
  }

  private createWaypointPopupContent(name: string, description?: string): string {
    const title = this.escapeHtml(name);
    const details = description
      ? `<div class="mt-1"><small>${this.escapeHtml(description)}</small></div>`
      : `<div class="mt-1 text-muted"><small>This waypoint has no description</small></div>`;
    return `<div><strong>${title}</strong></div>${details}`;
  }

  private escapeHtml(value?: string): string {
    if (!value) {
      return "";
    }
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private arrowSpacing(track: GpxTrack): number {
    const distance = track.totalDistance || 0;
    if (distance <= 0) {
      return 2000;
    }
    const spacing = distance / 6;
    return Math.min(Math.max(spacing, 2000), 8000);
  }

  private createArrowMarker(position: [number, number], bearing: number, weight: number): L.Marker {
    const size = Math.max(14, Math.min(weight * 4, 28));
    const height = Math.round(size / 2.4);
    const strokeWidth = Math.max(1.5, weight / 3);
    const html = `
        <div class="route-arrow" style="transform: rotate(${bearing - 90}deg);">
          <svg viewBox="0 0 24 8" width="${size}" height="${height}">
            <path d="M2 4 L16 4" stroke-width="${strokeWidth}" stroke-linecap="round"></path>
            <polygon points="16,0 24,4 16,8"></polygon>
          </svg>
        </div>`;
    return L.marker(position, {
      icon: L.divIcon({
        className: "route-arrow-icon",
        html,
        iconSize: [size, height],
        iconAnchor: [size / 2, height / 2]
      }),
      interactive: false
    });
  }

  private bearingBetween(start: L.LatLng, end: L.LatLng): number {
    const startLat = start.lat * Math.PI / 180;
    const endLat = end.lat * Math.PI / 180;
    const dLng = (end.lng - start.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    const angle = Math.atan2(y, x) * 180 / Math.PI;
    return (angle + 360) % 360;
  }

  private latLngsFromLayer(layer: L.Layer): L.LatLng[] {
    if (layer instanceof L.Polyline) {
      return this.flattenLatLngs(layer.getLatLngs());
    } else if (layer instanceof L.CircleMarker) {
      return [layer.getLatLng()];
    } else if (layer instanceof L.Marker) {
      return [layer.getLatLng()];
    } else if (layer instanceof L.LayerGroup) {
      const nested: L.LatLng[] = [];
      layer.getLayers().forEach(child => nested.push(...this.latLngsFromLayer(child)));
      return nested;
    } else {
      return [];
    }
  }

  private flattenLatLngs(latLngs: L.LatLng[] | L.LatLng[][] | L.LatLng[][][]): L.LatLng[] {
    const flat: L.LatLng[] = [];
    latLngs.forEach(entry => {
      if (isArray(entry)) {
        flat.push(...this.flattenLatLngs(entry as any));
      } else {
        flat.push(entry as L.LatLng);
      }
    });
    return flat;
  }
}
