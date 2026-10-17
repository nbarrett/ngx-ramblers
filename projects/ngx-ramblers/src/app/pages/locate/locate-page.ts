import { Component, inject, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ClipboardService } from "../../services/clipboard.service";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { CopyIconComponent } from "../../modules/common/copy-icon/copy-icon";

import { LocateMarkersService } from "../../services/maps/locate-markers.service";
import { LocatePointsListComponent } from "./locate-points-list";
import { LocateCoordinateFormat, LocatePinSelection, LocateSavedPoint, LocatePointNameChange, LocateCoordinateInputs } from "../../models/locate.model";
import { NgTemplateOutlet } from "@angular/common";
import { MaximisableMapComponent, MaximisableMapState } from "../../modules/common/maximisable-map/maximisable-map";
import { Subscription } from "rxjs";
import { GoogleMapsService } from "../../services/google-maps.service";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faRotateLeft, faLocationCrosshairs, faLocationDot, faLocationArrow, faCircleExclamation, faSpinner, faLink, faPlus, faObjectGroup, faWandMagicSparkles, faExpand, faCheck } from "@fortawesome/free-solid-svg-icons";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import * as L from "leaflet";
import { NgxLoggerLevel } from "ngx-logger";
import { briefPlaceName, locateParentPath, locationLabel, osMapsUrl, savedPointName, wazeEmbedUrl } from "../../functions/locate";
import { asNumber, generateUid } from "../../functions/numbers";
import { sortBy } from "../../functions/arrays";
import { GridReferenceLookupResponse } from "../../models/address-model";
import { DirectionsApp, GOOGLE_MAPS_PROVIDER_LABEL, LOCATE_OVERVIEW_CENTRE, LOCATE_OVERVIEW_ZOOM, LOCATE_POINT_ZOOM, LOCATE_SIDEBAR_WIDTH_MIN, LocatePoint } from "../../models/locate.model";
import { DEFAULT_GRID_REFERENCE_DIGITS, GRID_REFERENCE_DIGIT_OPTIONS, GridReferenceDigits, WalkDetailsMapProvider } from "../../models/walks-config.model";
import { KeyValue } from "../../functions/enums";
import { DEFAULT_OS_STYLE, MapProvider, osStyleForKey } from "../../models/map.model";
import { isArray, isNumber, isString, range, values } from "es-toolkit/compat";
import { LocationDetails } from "../../models/ramblers-walks-manager";
import { StoredValue } from "../../models/ui-actions";
import { LocationLinksComponent } from "../../modules/common/location-links/location-links.component";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { GridReferenceService } from "../../services/maps/grid-reference.service";
import { CurrentLocationService } from "../../services/maps/current-location.service";
import { MapTilesService } from "../../services/maps/map-tiles.service";
import { PageService } from "../../services/page.service";
import { UiActionsService } from "../../services/ui-actions.service";
import { UrlService } from "../../services/url.service";
import { AddressQueryService } from "../../services/walks/address-query.service";
import { DirectionsPill } from "../../shared/components/directions-pill";
import { DrivingOrigin } from "../../shared/components/driving-origin";
import { DrivingOriginMode } from "../../models/current-location.model";
import { MemberLoginService } from "../../services/member/member-login.service";
import { LocationAutocompleteComponent } from "../../shared/components/location-autocomplete";
import { MapControls, MapControlsConfig, MapControlsState } from "../../shared/components/map-controls";
import { ResizerComponent, ResizerOrientation, ResizerVariant } from "../../modules/common/resizer/resizer";
import { WalkDisplayService } from "../walks/walk-display.service";
import { WalksConfigService } from "../../services/system/walks-config.service";
import { DomSanitizer, SafeHtml, SafeResourceUrl } from "@angular/platform-browser";
import { MapMarkerStyleService } from "../../services/maps/map-marker-style.service";
import { AdvancedToggle } from "../../shared/components/advanced-toggle";
import { DELAYED_TOOLTIP_PROVIDERS } from "../../modules/common/tooltip-config";


@Component({
  selector: "app-locate-page",
  providers: [LocateMarkersService, ...DELAYED_TOOLTIP_PROVIDERS],
  imports: [LocatePointsListComponent, FormsModule, TooltipDirective, CopyIconComponent, FontAwesomeModule, LeafletModule, RouterLink, NgTemplateOutlet, LocationAutocompleteComponent, LocationLinksComponent, DirectionsPill, MapControls, ResizerComponent, DrivingOrigin, MaximisableMapComponent, AdvancedToggle],
  styles: [`
    .locate-map-stack
      position: relative
      width: 100%
    .locate-intro
      max-width: 52rem
      color: var(--rsm-muted)
    .locate-toolbar
      gap: var(--space-3)
    .locate-workspace
      display: grid
      grid-template-columns: minmax(0, var(--route-guide-width, 380px)) minmax(0, 1fr)
      gap: var(--space-5)
      align-items: stretch
    .locate-workspace > *
      min-width: 0
    .locate-workspace > .locate-sidebar
      order: -1
      width: 100%
      max-width: 100%
      overflow-x: hidden
    .locate-coordinate-editor
      margin-top: var(--space-6)
    .locate-fullscreen-toolbar
      width: 100%
    .locate-toolbar .btn-icon, .locate-fullscreen-toolbar .btn-icon
      min-width: var(--btn-min-height)
      min-height: var(--btn-min-height)
    .locate-sidebar .locate-readout, .locate-map-sidebar .locate-readout
      align-items: flex-start
      gap: var(--space-3)
    .locate-sidebar .locate-readout > .flex-grow-1, .locate-map-sidebar .locate-readout > .flex-grow-1
      flex-basis: 100%
    .locate-sidebar .locate-grid-reference, .locate-map-sidebar .locate-grid-reference
      font-size: 1.3rem
    @media (max-width: 991px)
      .locate-workspace
        grid-template-columns: minmax(0, 1fr)
      .locate-workspace > .locate-sidebar
        order: 2
    .locate-readout
      display: flex
      align-items: center
      flex-wrap: wrap
      gap: var(--space-3) var(--space-6)
      padding: var(--space-4) 0
    .locate-grid-reference
      font-family: "Assistant", sans-serif
      font-size: clamp(1.3rem, 3vw, 1.85rem)
      font-weight: 700
      letter-spacing: .04em
    .locate-readout-label
      font-size: .75rem
      color: var(--rsm-muted)
    .locate-share
      display: flex
      flex-direction: column
      align-items: stretch
      gap: var(--space-2)
    .locate-share .locate-readout-label
      line-height: 1.35
    .locate-hint
      position: absolute
      z-index: 500
      bottom: var(--space-4)
      left: 50%
      transform: translateX(-50%)
      max-width: calc(100% - var(--space-6))
      background: var(--rsm-panel-bg)
      border-radius: var(--radius-3)
      padding: var(--space-2) var(--space-4)
      box-shadow: 0 2px 12px rgba(0, 0, 0, .15)
      pointer-events: none
      font-size: .8rem
      text-align: center
    .locate-coordinate-input
      font-variant-numeric: tabular-nums
    .locate-map-full .locate-hint
      bottom: var(--space-6)
    .locate-nearest-content
      height: 3em
      line-height: 1.5
      display: -webkit-box
      -webkit-line-clamp: 2
      -webkit-box-orient: vertical
      overflow: hidden
    .locate-location-title
      font-weight: 600
    @media (max-width: 767px)
      .locate-fullscreen-toolbar .locate-search
        flex-basis: 100%
        max-width: calc(100% - 48px)
      .locate-fullscreen-toolbar > app-map-controls
        flex-basis: 100%
      .locate-map-sidebar .locate-readout
        padding: 0
      .locate-map-sidebar .locate-readout > fa-icon, .locate-map-sidebar .locate-readout > .locate-map-pin
        display: none
      .locate-map-pin
        display: inline-block
        width: 11px
        height: 14px
        flex-shrink: 0
      .locate-map-pin svg
        width: 100%
        height: 100%
        display: block
      .locate-map-sidebar .locate-nearest-content
        height: 3em
        -webkit-line-clamp: 2
      .locate-map-sidebar .locate-readout-label
        display: none
      .locate-map-sidebar .locate-readout > .flex-grow-1
        flex-basis: auto
      .locate-map-sidebar .thumbnail-heading
        font-size: .9rem
      .locate-map-full .locate-hint
        display: none
    @media (max-width: 575px)
      .locate-toolbar
        gap: var(--space-2)
      .locate-toolbar > .locate-search
        flex-basis: 100%
        order: -1
      .locate-hint
        width: max-content
        font-size: .75rem
    .locate-workspace:not(.has-location)
      grid-template-columns: minmax(0, 1fr)
    .locate-workspace app-maximisable-map
      height: 100%
      min-height: min(70vh, 36rem)
    .locate-map-stack:not(.locate-map-full)
      height: 100%
      min-height: min(70vh, 36rem)
    .locate-map-stack:not(.locate-map-full) .map-section,
    .locate-map-stack:not(.locate-map-full) .locate-map-surface
      height: 100%
    .locate-map-surface
      position: relative
      min-width: 0
    .locate-map-sidebar
      min-width: 0
      overflow-x: hidden
    .locate-sidebar
      margin: 0
    .locate-map-full .locate-map
      flex: 1 1 auto
      height: auto
      border-radius: 8px
    .locate-map
      border-radius: 8px
      overflow: hidden
      height: 100%
      min-height: min(50vh, 24rem)
      width: 100%
    .locate-directions
      display: block
      width: 100%
      border: 0
    .locate-search
      flex: 1 1 320px
      min-width: 0
  `],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Locate a place</div>
      <div class="col-12">
      <p class="locate-intro mb-3">Search for a place or click the map, then drag the pin to refine your location. Full screen gives you a larger map and more tools.</p>
      <div class="d-flex flex-wrap align-items-center locate-toolbar mb-3">
        @if (parentPath) {
          <a class="btn btn-quiet btn-icon" [routerLink]="parentPath" tooltip="Back" aria-label="Back"><fa-icon [icon]="faBack"/></a>
        }
        @if (!mapFullScreen) {
          <ng-container *ngTemplateOutlet="searchTemplate"/>
          <ng-container *ngTemplateOutlet="locationActionsTemplate"/>
        }
      </div>
      <ng-template #searchTemplate>
        <div class="locate-search">
          <app-location-autocomplete placeholder="Search a place, postcode or grid reference" [minTermLength]="2" [value]="searchLabel" (locationChange)="onLocationChange($event)"/>
        </div>
      </ng-template>
      <ng-template #locationActionsTemplate>
        <button type="button" class="btn btn-primary" (click)="useMyLocation()" [disabled]="findingLocation">
          <fa-icon [icon]="findingLocation ? faSpinner : faMyLocation" [animation]="findingLocation ? 'spin' : undefined" class="me-2"/>{{ findingLocation ? "Locating…" : "My location" }}
        </button>
        @if (!point) {
          <app-advanced-toggle class="d-none d-sm-inline-flex" label="Advanced" ariaControls="locate-advanced" [expanded]="advanced" (toggled)="toggleAdvanced()"/>
          <app-advanced-toggle class="d-sm-none" label="Advanced coordinates" ariaControls="locate-advanced" iconOnly buttonClass="btn btn-quiet btn-icon" [expanded]="advanced" (toggled)="toggleAdvanced()"/>
        }
      </ng-template>
      <ng-template #readoutTemplate>
        @if (point) {
          <div class="locate-readout" aria-label="Selected location">
            <fa-icon [icon]="faPin" class="colour-mintcake" size="lg"/>
            <div>
              <div class="locate-readout-label">
                Grid reference format
                <select class="form-select form-select-sm d-inline-block w-auto ms-2" [(ngModel)]="gridDigits" [attr.aria-label]="'Grid reference length for this view'">
                  @for (option of gridReferenceDigitOptions; track option.value) {
                    <option [ngValue]="option.value">{{ option.value }} figure</option>
                  }
                </select>
              </div>
              @if (display.allowAdminEdits()) {
                <div class="locate-readout-label mt-2 mb-3">
                  <a routerLink="/walks/admin/config" [queryParams]="walkViewQueryParams" fragment="walk-details-grid-reference-digits">Change the default Grid reference format</a>
                </div>
              }
              <div class="locate-grid-reference">{{ formattedGridReference }} <app-copy-icon [value]="formattedGridReference" elementName="Grid reference"/></div>
            </div>
            <div class="flex-grow-1 locate-nearest" [attr.aria-busy]="describing">
              <div class="locate-readout-label">Nearest address</div>
              <div class="locate-nearest-content" role="status" [title]="searchLabel || addressMessage">
                @if (describing) {
                  <span class="text-muted small"><fa-icon [icon]="faSpinner" animation="spin" class="me-2"/>Finding the nearest address…</span>
                } @else if (location?.description || location?.postcode) {
                  <span class="locate-location-title">{{ searchLabel }}</span>
                } @else {
                  <span class="text-muted small">{{ addressMessage || "Drag the pin to refine this location" }}</span>
                }
              </div>
            </div>
            <div class="locate-share">
              @if (confirmingReset) {
                <div class="alert alert-warning d-flex align-items-start" role="alert">
                  <fa-icon [icon]="faWarning" class="me-2 mt-1"/>
                  <div><strong class="d-block">Clear this location?</strong>This removes every pin and returns Locate to an empty map.</div>
                </div>
                <div class="row g-2">
                  <div class="col-6">
                    <button type="button" class="btn btn-primary w-100 h-100" (click)="confirmingReset = false">
                      <fa-icon [icon]="faKeep" class="me-2"/>Keep pins
                    </button>
                  </div>
                  <div class="col-6">
                    <button type="button" class="btn btn-danger w-100 h-100" (click)="confirmReset()">
                      <fa-icon [icon]="faReset" class="me-2"/>Reset
                    </button>
                  </div>
                </div>
              } @else {
                <div class="row g-2">
                  <div class="col-6">
                    <button type="button" class="btn btn-primary w-100 h-100 text-nowrap" tooltip="Save this pin in the list" (click)="addPoint()" [disabled]="!!activeSavedPointId || savedPoints.length >= 50">
                      <fa-icon [icon]="faAdd" class="me-2"/>Add
                    </button>
                  </div>
                  <div class="col-6">
                    <button type="button" class="btn btn-quiet w-100 h-100 text-nowrap" tooltip="Centre the map on this pin" (click)="centreOnPin()" [disabled]="!point">
                      <fa-icon [icon]="faCentre" class="me-2"/>Centre
                    </button>
                  </div>
                  <div class="col-6">
                    <button type="button" class="btn btn-quiet w-100 h-100 text-nowrap" tooltip="Fit the map to every pin" (click)="showAllPins()" [disabled]="!hasPins">
                      <fa-icon [icon]="faAllPins" class="me-2"/>Show all
                    </button>
                  </div>
                  <div class="col-6">
                    <button type="button" class="btn btn-quiet w-100 h-100 text-nowrap" tooltip="Copy a link that rebuilds this view" (click)="copyLocationLink()">
                      <fa-icon [icon]="linkCopied.visible ? faWand : faLink" class="me-2"/>{{ linkCopied.visible ? "Copied" : "Copy" }}
                    </button>
                  </div>
                  <div class="col-6">
                    <app-advanced-toggle class="w-100 h-100" label="Advanced" ariaControls="locate-advanced" buttonClass="btn btn-quiet w-100 h-100 text-nowrap" [expanded]="advanced" (toggled)="toggleAdvanced()"/>
                  </div>
                  <div class="col-6">
                    <button type="button" class="btn btn-quiet w-100 h-100 text-nowrap" tooltip="Remove all pins and start again" (click)="confirmingReset = true">
                      <fa-icon [icon]="faReset" class="me-2"/>Reset
                    </button>
                  </div>
                </div>
              }
              <div class="locate-readout-label">Share this URL with anyone else and they will be able to rebuild this view exactly.</div>
            </div>
          </div>
        }
      </ng-template>
      <ng-template #mapControlsTemplate>
        <app-map-controls [config]="controlsConfig" [state]="controlsState" [extraProviders]="extraProviders" (stateChange)="onControlsChange($event)"/>
      </ng-template>
      <ng-template #directionsTemplate>
        @if (location) {
          <div class="thumbnail-heading-frame thumbnail-heading-frame-compact mt-4 mb-0 w-100">
            <div class="thumbnail-heading">Directions</div>
          <app-directions-pill [compact]="true" [latitude]="location.latitude" [longitude]="location.longitude"
                               [inlineApps]="inlineApps" [shownApp]="shownApp"
                               (show)="toggleApp($event)">
            <a compact-directions class="btn btn-quiet btn-icon" [href]="osMapsLink" target="_blank" rel="noopener" tooltip="Open location in OS Maps" aria-label="Open location in OS Maps"><img src="/assets/images/local/ordnance-survey.png" width="20" height="20" alt=""/></a>
            @if (shownApp === DirectionsApp.GOOGLE_MAPS) {
              <app-driving-origin driving-origin [stacked]="true" name="locate-driving-origin" [mode]="originMode" [postcode]="originPostcode" [locating]="locating"
                                  (modeChange)="setOriginMode($event)" (postcodeChange)="setOriginPostcode($event)"/>
            }
          </app-directions-pill>
          @if (frameMessage) {
            <p class="text-muted small mt-3 mb-0" role="status">{{ frameMessage }}</p>
          }
          </div>
        }
      </ng-template>
      @if (notice) {
        <div class="alert alert-warning d-flex align-items-start" role="alert">
          <fa-icon [icon]="faWarning" class="me-2 mt-1"/><div><strong class="d-block">Location unavailable</strong>{{ notice }}</div>
        </div>
      }
      @if (!mapFullScreen) {
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <ng-container *ngTemplateOutlet="mapControlsTemplate"/>
          <span class="small text-muted d-inline-flex align-items-center gap-2"><span class="locate-map-pin" [innerHTML]="mapPinHtml" aria-hidden="true"></span>Click to place · drag to refine · <button type="button" class="btn btn-link p-0 align-baseline" (click)="enterMapFullScreen()"><fa-icon [icon]="faExpand" class="me-1"/>full screen</button> for more tools</span>
        </div>
      }
      <ng-template #advancedTemplate>
        <div id="locate-advanced" class="thumbnail-heading-frame thumbnail-heading-frame-compact locate-coordinate-editor mb-3">
          <div class="thumbnail-heading">Move the pin by typing</div>
          <p class="small text-muted mb-3">If you already know the grid reference, latitude and longitude, or eastings and northings, type them here and press Move pin. Dragging the pin on the map does the same job.</p>
          <form (ngSubmit)="movePinFromCoordinates()">
            <label for="locate-format" class="form-label">Coordinate format</label>
            <select id="locate-format" name="coordinateFormat" class="form-select mb-3" [ngModel]="coordinateFormat" (ngModelChange)="coordinateFormatChanged($event)">
              <option [ngValue]="LocateCoordinateFormat.GRID_REFERENCE">Grid reference</option>
              <option [ngValue]="LocateCoordinateFormat.LATITUDE_LONGITUDE">Latitude / longitude · WGS84</option>
              <option [ngValue]="LocateCoordinateFormat.EASTINGS_NORTHINGS">Eastings / northings · British National Grid</option>
            </select>
            @switch (coordinateFormat) {
              @case (LocateCoordinateFormat.GRID_REFERENCE) {
                <label for="locate-grid" class="form-label">Grid reference</label>
                <input id="locate-grid" name="gridReference" class="form-control locate-coordinate-input mb-3" [(ngModel)]="coordinateInputs.gridReference" placeholder="SU 12345 67890" required/>
              }
              @case (LocateCoordinateFormat.LATITUDE_LONGITUDE) {
                <div class="row g-2 mb-3">
                  <div class="col-6"><label for="locate-latitude" class="form-label">Latitude</label><input id="locate-latitude" name="latitude" class="form-control locate-coordinate-input" [(ngModel)]="coordinateInputs.latitude" inputmode="decimal" required/></div>
                  <div class="col-6"><label for="locate-longitude" class="form-label">Longitude</label><input id="locate-longitude" name="longitude" class="form-control locate-coordinate-input" [(ngModel)]="coordinateInputs.longitude" inputmode="decimal" required/></div>
                </div>
              }
              @case (LocateCoordinateFormat.EASTINGS_NORTHINGS) {
                <div class="row g-2 mb-3">
                  <div class="col-6"><label for="locate-eastings" class="form-label">Eastings</label><input id="locate-eastings" name="eastings" class="form-control locate-coordinate-input" [(ngModel)]="coordinateInputs.eastings" inputmode="decimal" required/></div>
                  <div class="col-6"><label for="locate-northings" class="form-label">Northings</label><input id="locate-northings" name="northings" class="form-control locate-coordinate-input" [(ngModel)]="coordinateInputs.northings" inputmode="decimal" required/></div>
                </div>
              }
            }
            <button type="submit" class="btn btn-primary w-100"><fa-icon [icon]="faPin" class="me-2"/>Move pin</button>
          </form>
        </div>
      </ng-template>
      <ng-template #locationPanelTemplate>
          <div class="thumbnail-heading">{{ location ? "Your location" : "Find a location" }}</div>
          <ng-container *ngTemplateOutlet="readoutTemplate"/>
          @if (advanced) {
            <ng-container *ngTemplateOutlet="advancedTemplate"/>
          }
        @if (savedPoints.length) {
          <div class="thumbnail-heading-frame thumbnail-heading-frame-compact mt-4">
            <div class="thumbnail-heading">Saved points ({{ savedPoints.length }})</div>
            <app-locate-points-list [points]="savedPoints" [gridDigits]="gridDigits" [gridSpaced]="gridSpaced" (select)="selectSavedPoint($event)" (rename)="renameSavedPoint($event)" (remove)="removeSavedPoint($event)" (reorder)="reorderSavedPoints($event)"/>
          </div>
        }
          @if (location) {
        <div class="thumbnail-heading-frame thumbnail-heading-frame-compact mb-3">
          <div class="thumbnail-heading">Location details</div>
          <app-location-links [location]="location" [stacked]="true" [mediaWidth]="0" [showDescription]="false" [postcodeIsNearest]="true" [postcodePending]="describing" [showPostcodePlaceholder]="true"
                              [showGridReferenceVariants]="true" [showNationalGridCoordinates]="true"
                              [nationalGridCoordinates]="nationalGridCoordinates" [coordinatePrecision]="6"/>
          <p class="small text-muted mt-2 mb-0">Grid sizes describe the reference square, not GPS accuracy. The nearest postcode may be some distance from your pin.</p>
        </div>
        <div class="d-flex flex-wrap align-items-center gap-3">
          <ng-container *ngTemplateOutlet="directionsTemplate"/>

        </div>
          }
      </ng-template>
      <div class="locate-workspace" [class.has-location]="!!location || advanced" [style.--route-guide-width]="sidebarWidth + 'px'">
      @if (frameUrl || options) {
        <app-maximisable-map #locateMap class="d-block mb-3" title="Locate a place" [allowExpanded]="false" [syncToUrl]="true" [persistFullScreen]="StoredValue.LOCATE_MAXIMISE" [toolbarLayout]="true"
                             offsetTop="8px" offsetRight="8px" (sizeChange)="onMapSizeChange($event)">
          <div slot="bar-actions" class="d-flex flex-wrap align-items-center gap-2 locate-fullscreen-toolbar">
            @if (mapFullScreen) {
              <ng-container *ngTemplateOutlet="searchTemplate"/>
              <ng-container *ngTemplateOutlet="locationActionsTemplate"/>
              <ng-container *ngTemplateOutlet="mapControlsTemplate"/>
              @if (notice) {
                <div class="alert alert-warning d-flex align-items-start" role="alert">
                  <fa-icon [icon]="faWarning" class="me-2 mt-1"/><div><strong class="d-block">Location unavailable</strong>{{ notice }}</div>
                </div>
              }
            }
          </div>
          <div class="locate-map-stack maximisable-map-fill map-sidebar-layout map-sidebar-left" [style.--route-guide-width]="sidebarWidth + 'px'" [class.locate-map-full]="mapFullScreen" [class.is-fullscreen]="mapFullScreen">
            <div class="map-section"><div class="locate-map-surface">
            @if (frameUrl) {
              <iframe class="locate-map locate-directions" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" [src]="frameUrl"></iframe>
            } @else {
              <div class="locate-map"
                   leaflet
                   [leafletOptions]="options"
                   [leafletLayers]="layers"
                   (leafletMapReady)="onMapReady($event)"
                   (leafletClick)="onMapClick($event)"></div>
              <div class="locate-hint">{{ point ? "Drag the pin · details update as you move" : "Click anywhere on the map to drop a pin" }}</div>
            }
            </div></div>
            @if (mapFullScreen && (location || advanced)) {
              <aside class="map-sidebar-panel locate-map-sidebar thumbnail-heading-frame thumbnail-heading-frame-contained">
                <ng-container *ngTemplateOutlet="locationPanelTemplate"/>
              </aside>
              <app-resizer class="map-sidebar-resizer" [variant]="ResizerVariant.BAR" [orientation]="ResizerOrientation.HORIZONTAL"
                           [size]="sidebarWidth" [minSize]="minSidebarWidth" [maxSize]="maxSidebarWidth" [growsTowardsStart]="false"
                           resizeHint="Drag to change the width of the sidebar"
                           (sizeChange)="sidebarWidth = $event" (resizeEnd)="saveSidebarWidth()"/>
            }
          </div>
        </app-maximisable-map>
      }
      @if ((location || advanced) && !mapFullScreen) {
        <aside class="locate-sidebar thumbnail-heading-frame thumbnail-heading-frame-compact thumbnail-heading-frame-contained">
          <ng-container *ngTemplateOutlet="locationPanelTemplate"/>
        </aside>
      }
      </div>
      </div>
    </div>`
})
export class LocatePageComponent implements OnInit, OnDestroy {
  protected readonly ResizerOrientation = ResizerOrientation;
  protected readonly ResizerVariant = ResizerVariant;

  protected readonly StoredValue = StoredValue;
  protected readonly faMyLocation = faLocationCrosshairs;
  protected readonly faPin = faLocationDot;
  protected readonly faCentre = faLocationArrow;
  protected readonly faWarning = faCircleExclamation;
  protected readonly faSpinner = faSpinner;
  protected readonly faLink = faLink;
  protected readonly faAdd = faPlus;
  protected readonly faKeep = faCheck;
  protected readonly faExpand = faExpand;
  protected readonly gridReferenceDigitOptions = GRID_REFERENCE_DIGIT_OPTIONS;
  protected readonly walkViewQueryParams = {[StoredValue.TAB]: "walk-view"};
  @ViewChild("locateMap") locateMap: MaximisableMapComponent;
  private walksConfigService = inject(WalksConfigService);
  private gridDigitsOverride: GridReferenceDigits | null = null;
  private clipboard = inject(ClipboardService);
  protected readonly LocateCoordinateFormat = LocateCoordinateFormat;
  coordinateFormat = LocateCoordinateFormat.GRID_REFERENCE;
  advanced = false;
  findingLocation = false;
  private locationSelectionVersion = 0;
  describing = false;
  confirmingReset = false;
  notice = "";
  addressMessage = "";
  coordinateInputs: LocateCoordinateInputs = {gridReference: "", latitude: "", longitude: "", eastings: "", northings: ""};

  private logger: Logger = inject(LoggerFactory).createLogger("LocatePageComponent", NgxLoggerLevel.ERROR);
  private pageService = inject(PageService);
  private route = inject(ActivatedRoute);
  private uiActions = inject(UiActionsService);
  private urlService = inject(UrlService);
  private mapTiles = inject(MapTilesService);
  private markers = inject(LocateMarkersService);
  savedPoints: LocateSavedPoint[] = [];
  activeSavedPointId: string | null = null;
  private gridReferences = inject(GridReferenceService);
  private addressQuery = inject(AddressQueryService);
  private zone = inject(NgZone);
  protected display = inject(WalkDisplayService);
  private map: L.Map | null = null;
  private mapResizeObserver: ResizeObserver | null = null;
  private zoom = LOCATE_OVERVIEW_ZOOM;
  protected readonly faReset = faRotateLeft;
  protected readonly faBack = faArrowLeft;
  protected readonly faAllPins = faObjectGroup;
  protected readonly faWand = faWandMagicSparkles;
  linkCopied = {visible: false, generation: 0};
  controlsConfig: MapControlsConfig = {showProvider: true, showStyle: true};
  private subscriptions: Subscription[] = [];

  get extraProviders(): KeyValue<string>[] {
    return this.display.googleDirectionsAvailable() ? [{key: GOOGLE_MAPS_PROVIDER_LABEL, value: WalkDetailsMapProvider.GOOGLE_MAPS}] : [];
  }
  controlsState: MapControlsState = {provider: MapProvider.OSM, osStyle: DEFAULT_OS_STYLE};
  parentPath = "";
  mapFullScreen = false;
  sidebarWidth = 380;
  readonly minSidebarWidth = LOCATE_SIDEBAR_WIDTH_MIN;
  private sanitiser = inject(DomSanitizer);
  private markerStyle = inject(MapMarkerStyleService);
  private currentLocation = inject(CurrentLocationService);
  private googleMaps = inject(GoogleMapsService);
  frameUrl: SafeResourceUrl | null = null;
  frameMessage = "";
  shownApp: DirectionsApp | null = null;
  originMode: DrivingOriginMode = DrivingOriginMode.MY_LOCATION;
  originPostcode = "";
  locating = false;
  protected readonly DirectionsApp = DirectionsApp;
  private memberLoginService = inject(MemberLoginService);
  private lastView: {centre: L.LatLng; zoom: number} = {centre: L.latLng(LOCATE_OVERVIEW_CENTRE[0], LOCATE_OVERVIEW_CENTRE[1]), zoom: LOCATE_OVERVIEW_ZOOM};
  options: L.MapOptions | null = null;
  layers: L.Layer[] = [];
  point: LocatePoint | null = null;
  location: LocationDetails | null = null;

  ngOnInit(): void {
    this.pageService.setTitle("Locate a place");
    this.mapTiles.initializeProjections();
    this.parentPath = locateParentPath(this.urlService.relativeUrl()) || "/";
    const hasKey = this.mapTiles.hasOsApiKey();
    this.controlsState = {provider: hasKey ? MapProvider.OS : MapProvider.OSM, osStyle: hasKey ? DEFAULT_OS_STYLE : ""};
    const params = this.route.snapshot.queryParamMap;
    this.advanced = params.get(StoredValue.LOCATE_ADVANCED) === "true";
    this.sidebarWidth = Math.min(this.maxSidebarWidth, Math.max(this.minSidebarWidth, asNumber(params.get(StoredValue.LOCATE_SIDEBAR_WIDTH) || this.uiActions.initialValueFor(StoredValue.LOCATE_SIDEBAR_WIDTH)) || 380));
    this.restoreSavedPoints();
    this.coordinateFormat = values(LocateCoordinateFormat).find(format => format === params.get(StoredValue.LOCATE_COORDINATE_FORMAT)) || LocateCoordinateFormat.GRID_REFERENCE;
    const requestedProvider = [...values(MapProvider), WalkDetailsMapProvider.GOOGLE_MAPS].find(provider => provider === params.get(StoredValue.MAP_PROVIDER)) as MapProvider | undefined;
    this.subscriptions.push(this.googleMaps.events().subscribe(() => {
      if (this.googleMapView && !this.frameUrl) {
        this.buildMap(this.point ? L.latLng(this.point.latitude, this.point.longitude) : this.lastView.centre, this.lastView.zoom);
      } else if (this.shownApp === DirectionsApp.GOOGLE_MAPS && !this.frameUrl && this.point) {
        this.showGoogleDirections();
      }
    }));
    const requestedStyle = params.get(StoredValue.MAP_OS_STYLE);
    this.controlsState = {
      provider: requestedProvider || this.controlsState.provider,
      osStyle: requestedStyle && osStyleForKey(requestedStyle) ? requestedStyle : this.controlsState.osStyle
    };
    const initial = this.pointFromQuery();
    this.zoom = asNumber(params.get(StoredValue.MAP_ZOOM)) || (initial ? this.pointZoom(initial.latitude) : this.overviewZoom());
    if (initial) {
      this.activeSavedPointId = this.savedPoints.find(saved => Math.abs(saved.point.latitude - initial.latitude) < 0.0000001 && Math.abs(saved.point.longitude - initial.longitude) < 0.0000001)?.id || null;
      this.applyPoint(initial);
    } else {
      this.locateFromPostcodeQuery();
    }
    this.buildMap(initial ? L.latLng(initial.latitude, initial.longitude) : L.latLng(LOCATE_OVERVIEW_CENTRE[0], LOCATE_OVERVIEW_CENTRE[1]), this.zoom);
    const fromPostcode = params.get(StoredValue.FROM_POSTCODE);
    this.originPostcode = fromPostcode || (this.memberLoginService.memberLoggedIn() ? this.memberLoginService.loggedInMember().postcode || "" : "");
    this.originMode = fromPostcode ? DrivingOriginMode.POSTCODE : DrivingOriginMode.MY_LOCATION;
    const requestedApp = this.uiActions.queryValueForAlias(params.get(StoredValue.DIRECTIONS), values(DirectionsApp)) as DirectionsApp | null;
    if (requestedApp && initial) {
      setTimeout(() => this.toggleApp(requestedApp));
    }
    if (!params.keys.length) {
      void this.useMyLocation();
    }
  }

  ngOnDestroy(): void {
    this.locationSelectionVersion += 1;
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.mapResizeObserver?.disconnect();
  }

  onMapReady(map: L.Map): void {
    this.mapResizeObserver?.disconnect();
    this.map = map;
    this.markers.attach(map, this.leafletProvider(), this.controlsState.osStyle, selection => this.onPinSelection(selection));
    if (globalThis.ResizeObserver) {
      this.mapResizeObserver = new ResizeObserver(() => map.invalidateSize({pan: true, animate: false}));
      this.mapResizeObserver.observe(map.getContainer());
    }
    map.on("zoomend", () => this.zone.run(() => this.syncZoomToUrl()));
    map.on("contextmenu", event => this.onMapClick(event));
    this.placeMarker(this.point);
  }

  private syncZoomToUrl(): void {
    if (this.map) {
      this.zoom = this.map.getZoom();
      const centre = this.map.getCenter();
      void this.uiActions.updateQueryParameters({[StoredValue.MAP_ZOOM]: this.zoom === this.pointZoom(centre.lat) ? null : this.zoom});
    }
  }

  private syncControlsToUrl(): void {
    const hasKey = this.mapTiles.hasOsApiKey();
    const defaultProvider = hasKey ? MapProvider.OS : MapProvider.OSM;
    void this.uiActions.updateQueryParameters({
      [StoredValue.DIRECTIONS]: null,
      [StoredValue.MAP_PROVIDER]: this.controlsState.provider === defaultProvider ? null : this.controlsState.provider,
      [StoredValue.MAP_OS_STYLE]: this.controlsState.provider === MapProvider.OS && this.controlsState.osStyle !== DEFAULT_OS_STYLE ? this.controlsState.osStyle : null
    });
  }

  onMapClick(event: L.LeafletMouseEvent): void {
    this.zone.run(() => this.chooseNewPoint(event.latlng.lat, event.latlng.lng, false));
  }

  get searchLabel(): string | null {
    return this.location ? locationLabel(this.location.postcode, this.location.description) || null : null;
  }

  onLocationChange(response: GridReferenceLookupResponse): void {
    if (response?.latlng) {
      this.chooseNewPoint(response.latlng.lat, response.latlng.lng, true, response);
    }
  }

  onControlsChange(state: MapControlsState): void {
    this.frameUrl = null;
    this.shownApp = null;
    this.frameMessage = "";
    const centre = this.map?.getCenter() || (this.point ? L.latLng(this.point.latitude, this.point.longitude) : L.latLng(LOCATE_OVERVIEW_CENTRE[0], LOCATE_OVERVIEW_CENTRE[1]));
    const targetProvider = String(state.provider) === WalkDetailsMapProvider.GOOGLE_MAPS ? MapProvider.OSM : state.provider;
    const zoom = this.mapTiles.matchingZoom(this.leafletProvider(), this.controlsState.osStyle, this.currentZoom(), targetProvider, state.osStyle, centre.lat);
    this.controlsState = {...this.controlsState, provider: state.provider, osStyle: state.osStyle};
    this.syncControlsToUrl();
    this.options = null;
    this.map = null;
    setTimeout(() => this.buildMap(centre, zoom));
  }

  onMapSizeChange(state: MaximisableMapState): void {
    this.mapFullScreen = state.fullScreen;
    [0, 50, 300].forEach(delay => setTimeout(() => this.map?.invalidateSize({pan: true, animate: false}), delay));
  }

  get inlineApps(): DirectionsApp[] {
    return [...(this.display.googleDirectionsAvailable() ? [DirectionsApp.GOOGLE_MAPS] : []), DirectionsApp.WAZE];
  }

  toggleApp(app: DirectionsApp): void {
    if (this.shownApp === app) {
      this.hideFrame();
    } else if (app === DirectionsApp.WAZE && this.point) {
      const zoom = this.mapTiles.matchingZoom(this.leafletProvider(), this.controlsState.osStyle, this.currentZoom(), MapProvider.OSM, "", this.point.latitude);
      this.showFrame(app, this.sanitiser.bypassSecurityTrustResourceUrl(wazeEmbedUrl(this.point.latitude, this.point.longitude, zoom)));
    } else if (app === DirectionsApp.GOOGLE_MAPS && this.point) {
      this.shownApp = app;
      this.showGoogleDirections();
    }
  }

  setOriginMode(mode: DrivingOriginMode): void {
    this.originMode = mode;
    this.showGoogleDirections();
  }

  setOriginPostcode(postcode: string): void {
    this.originPostcode = postcode;
    if (this.originMode === DrivingOriginMode.POSTCODE && postcode.trim().length >= 3) {
      this.showGoogleDirections();
    }
  }

  private showGoogleDirections(): void {
    if (this.originMode === DrivingOriginMode.POSTCODE) {
      void this.uiActions.updateQueryParameters({[StoredValue.FROM_POSTCODE]: this.originPostcode.trim() || null});
      if (this.originPostcode.trim().length >= 3) {
        this.showGoogleDirectionsFrom(this.originPostcode.trim());
      } else {
        this.frameMessage = "Type the postcode to drive from.";
      }
    } else {
      void this.uiActions.updateQueryParameters({[StoredValue.FROM_POSTCODE]: null});
      this.frameMessage = "Finding where you are…";
      this.locating = true;
      this.currentLocation.currentPosition().then(position => {
        this.locating = false;
        if (position) {
          this.showGoogleDirectionsFrom(this.currentLocation.asOrigin(position));
        } else {
          this.frameMessage = "Your location is not available, so choose a postcode to drive from.";
          this.originMode = DrivingOriginMode.POSTCODE;
          if (this.originPostcode.trim().length >= 3) {
            this.showGoogleDirectionsFrom(this.originPostcode.trim());
          }
        }
      });
    }
  }

  private showGoogleDirectionsFrom(origin: string): void {
    if (this.point && origin) {
      const url = this.display.googleDirectionsEmbedUrl(origin, `${this.point.latitude},${this.point.longitude}`);
      if (url) {
        this.showFrame(DirectionsApp.GOOGLE_MAPS, url);
      } else {
        this.frameMessage = "Google directions are not set up on this site.";
      }
    }
  }

  private showFrame(app: DirectionsApp, url: SafeResourceUrl): void {
    this.lastView = this.map ? {centre: this.map.getCenter(), zoom: this.map.getZoom()} : this.lastView;
    this.map = null;
    this.shownApp = app;
    this.frameUrl = url;
    this.frameMessage = "";
    void this.uiActions.updateQueryParameters({[StoredValue.DIRECTIONS]: this.uiActions.queryValueAliasFor(app)});
  }

  private hideFrame(syncUrl = true, overview = false): boolean {
    const showing = !!this.frameUrl || this.googleMapView;
    if (showing) {
      this.frameUrl = null;
      this.shownApp = null;
      this.frameMessage = "";
      if (syncUrl) {
        void this.uiActions.updateQueryParameters({[StoredValue.DIRECTIONS]: null});
      }
      const centre = overview ? L.latLng(LOCATE_OVERVIEW_CENTRE[0], LOCATE_OVERVIEW_CENTRE[1]) : this.point ? L.latLng(this.point.latitude, this.point.longitude) : this.lastView.centre;
      setTimeout(() => this.buildMap(centre, this.lastView.zoom));
    }
    return showing;
  }

  private currentZoom(): number {
    return this.map ? this.map.getZoom() : (this.point ? this.pointZoom(this.point.latitude) : this.overviewZoom());
  }

  private leafletProvider(): MapProvider {
    return this.googleMapView ? MapProvider.OSM : this.controlsState.provider;
  }

  get mapPinHtml(): SafeHtml {
    return this.sanitiser.bypassSecurityTrustHtml(this.markerStyle.previewPinHtml(this.leafletProvider()));
  }

  private pointZoom(latitude: number): number {
    return this.mapTiles.matchingZoom(MapProvider.OS, DEFAULT_OS_STYLE, LOCATE_POINT_ZOOM, this.leafletProvider(), this.controlsState.osStyle, latitude);
  }

  private overviewZoom(): number {
    return this.mapTiles.matchingZoom(MapProvider.OSM, "", LOCATE_OVERVIEW_ZOOM, this.leafletProvider(), this.controlsState.osStyle, LOCATE_OVERVIEW_CENTRE[0]);
  }

  get osMapsLink(): string {
    return this.point ? osMapsUrl(this.point.latitude, this.point.longitude) : "";
  }

  private buildMap(centre: L.LatLng, zoom: number): void {
    const {provider, osStyle} = this.controlsState;
    this.lastView = {centre, zoom};
    this.zoom = zoom;
    if (this.googleMapView) {
      this.options = null;
      this.layers = [];
      this.frameUrl = this.display.googlePlaceEmbedUrl(`${centre.lat.toFixed(6)},${centre.lng.toFixed(6)}`, this.mapTiles.matchingZoom(MapProvider.OS, DEFAULT_OS_STYLE, LOCATE_POINT_ZOOM, MapProvider.OSM, "", centre.lat));
    } else {
      this.layers = [this.mapTiles.createBaseLayer(provider, osStyle)];
      this.options = {
        center: centre,
        zoom: Math.min(zoom, this.mapTiles.maxZoomForStyle(provider, osStyle)),
        crs: this.mapTiles.crsForStyle(provider, osStyle),
        maxZoom: this.mapTiles.maxZoomForStyle(provider, osStyle)
      };
    }
  }

  get googleMapView(): boolean {
    return String(this.controlsState.provider) === WalkDetailsMapProvider.GOOGLE_MAPS;
  }

  private pointFromQuery(): LocatePoint | null {
    const params = this.route.snapshot.queryParamMap;
    const gridRef = params.get(StoredValue.GRID_REF);
    if (gridRef) {
      return this.gridReferences.fromGridReference(gridRef);
    } else if (params.has(StoredValue.LAT) && params.has(StoredValue.LON) && params.get(StoredValue.LAT).trim() && params.get(StoredValue.LON).trim()) {
      return this.gridReferences.fromLatLng(Number(params.get(StoredValue.LAT)), Number(params.get(StoredValue.LON)));
    } else {
      return null;
    }
  }

  private async locateFromPostcodeQuery(): Promise<void> {
    const postcode = this.route.snapshot.queryParamMap.get(StoredValue.POSTCODE);
    if (postcode) {
      try {
        const response = await this.addressQuery.gridReferenceLookup(postcode);
        if (response?.latlng && !response.error && !this.point) {
          this.choose(response.latlng.lat, response.latlng.lng, true, response);
        } else if (!this.point) {
          this.notice = "That postcode could not be found. Try a place name or choose a point on the map.";
        }
      } catch (error) {
        this.logger.warn("locateFromPostcodeQuery:failed", error);
        if (!this.point) {
          this.notice = "The postcode lookup is unavailable. You can still choose a point on the map.";
        }
      }
    }
  }

  private chooseNewPoint(latitude: number, longitude: number, centre: boolean, known?: GridReferenceLookupResponse): void {
    if (this.gridReferences.fromLatLng(latitude, longitude)) {
      this.activeSavedPointId = null;
    }
    this.choose(latitude, longitude, centre, known);
  }

  private choose(latitude: number, longitude: number, centre: boolean, known?: GridReferenceLookupResponse): void {
    const point = this.gridReferences.fromLatLng(latitude, longitude);
    if (point) {
      this.applyPoint(point, known);
      const frameHidden = this.hideFrame(false);
      this.placeMarker(point);
      const zoom = centre ? Math.max(this.currentZoom(), this.pointZoom(latitude)) : this.currentZoom();
      if (centre) {
        if (this.map) {
          this.map.flyTo([latitude, longitude], zoom, {animate: true, duration: 1.2});
        } else {
          this.buildMap(L.latLng(latitude, longitude), zoom);
        }
      }
      void this.uiActions.updateQueryParameters({
        [StoredValue.GRID_REF]: null,
        [StoredValue.POSTCODE]: null,
        [StoredValue.LOCATE_POINTS]: this.savedPointsQuery(),
        [StoredValue.LAT]: point.latitude.toFixed(7),
        [StoredValue.LON]: point.longitude.toFixed(7),
        [StoredValue.MAP_ZOOM]: zoom === this.pointZoom(latitude) ? null : zoom,
        ...(frameHidden ? {[StoredValue.DIRECTIONS]: null} : {})
      });
    } else {
      this.notice = "Choose a point within Great Britain to use British National Grid references.";
      if (this.point) {
        this.placeMarker(this.point);
        if (this.describing) {
          void this.describeNearest(this.point);
        }
      }
    }
  }

  private applyPoint(point: LocatePoint, known?: GridReferenceLookupResponse, describe = true): void {
    this.locationSelectionVersion += 1;
    this.notice = "";
    this.addressMessage = "";
    this.point = point;
    this.coordinateInputs = {
      gridReference: this.display.formatGrid(point.gridReference10, this.gridDigits),
      latitude: point.latitude.toFixed(7),
      longitude: point.longitude.toFixed(7),
      eastings: String(point.eastings),
      northings: String(point.northings)
    };
    this.location = {
      latitude: point.latitude,
      longitude: point.longitude,
      grid_reference_6: point.gridReference6,
      grid_reference_8: point.gridReference8,
      grid_reference_10: point.gridReference10,
      postcode: known?.postcode || "",
      description: known?.description || "",
      w3w: ""
    };
    this.updateSelectedSavedPoint();
    if (describe && !known?.postcode) {
      void this.describeNearest(point);
    } else {
      this.describing = !describe;
    }
  }

  private async describeNearest(point: LocatePoint): Promise<void> {
    this.describing = true;
    try {
      const nearest = (await this.addressQuery.gridReferenceLookupFromLatLng(L.latLng(point.latitude, point.longitude)))?.[0];
      if (this.point === point && this.location) {
        if (nearest && !nearest.error) {
          this.location = {...this.location, postcode: nearest.postcode || "", description: nearest.description || ""};
          this.updateSelectedSavedPoint();
        } else {
          this.addressMessage = "No nearby postcode found. The pin coordinates are still available.";
        }
      }
    } catch (error) {
      this.logger.warn("describeNearest:failed", error);
      if (this.point === point) {
        this.addressMessage = "The nearest address is unavailable. The pin coordinates are still available.";
      }
    } finally {
      if (this.point === point) {
        this.describing = false;
      }
    }
  }

  get gridDigits(): GridReferenceDigits {
    return this.gridDigitsOverride ?? this.walksConfigService.walksConfig()?.walkDetailsGridReferenceDigits ?? DEFAULT_GRID_REFERENCE_DIGITS;
  }

  set gridDigits(value: GridReferenceDigits) {
    this.gridDigitsOverride = value;
  }

  get gridSpaced(): boolean {
    return this.walksConfigService.walksConfig()?.walkDetailsGridReferenceSpaced !== false;
  }

  get formattedGridReference(): string {
    return this.point ? this.display.formatGrid(this.point.gridReference10, this.gridDigits) : "";
  }

  get nationalGridCoordinates(): string {
    return this.point ? `${this.point.eastings}, ${this.point.northings}` : "";
  }

  get shareUrl(): string {
    const url = new URL(window.location.href);
    if (this.point) {
      url.searchParams.delete(StoredValue.GRID_REF);
      url.searchParams.delete(StoredValue.POSTCODE);
      url.searchParams.set(StoredValue.LAT, this.point.latitude.toFixed(7));
      url.searchParams.set(StoredValue.LON, this.point.longitude.toFixed(7));
    }
    const savedPoints = this.savedPointsQuery();
    if (savedPoints) {
      url.searchParams.set(StoredValue.LOCATE_POINTS, savedPoints);
    } else {
      url.searchParams.delete(StoredValue.LOCATE_POINTS);
    }
    return url.toString();
  }

  copyLocationLink(): void {
    void this.clipboard.copyToClipboard(this.shareUrl);
    this.linkCopied.visible = true;
    const generation = this.linkCopied.generation + 1;
    this.linkCopied.generation = generation;
    setTimeout(() => {
      if (this.linkCopied.generation === generation) {
        this.linkCopied.visible = false;
      }
    }, 2500);
  }

  get hasPins(): boolean {
    return this.savedPoints.length > 0 || !!this.point;
  }

  showAllPins(): void {
    const bounds = this.markers.bounds();
    if (this.map && bounds?.isValid()) {
      this.hideFrame();
      this.map.flyToBounds(bounds, {padding: [48, 48], duration: 1.2, maxZoom: this.pointZoom(bounds.getCenter().lat)});
    }
  }

  get maxSidebarWidth(): number {
    return Math.min(520, Math.max(this.minSidebarWidth, window.innerWidth / 2));
  }

  saveSidebarWidth(): void {
    this.uiActions.saveValueFor(StoredValue.LOCATE_SIDEBAR_WIDTH, this.sidebarWidth);
    void this.uiActions.updateQueryParameters({[StoredValue.LOCATE_SIDEBAR_WIDTH]: this.sidebarWidth === 380 ? null : this.sidebarWidth});
  }

  toggleAdvanced(): void {
    this.advanced = !this.advanced;
    void this.uiActions.updateQueryParameters({[StoredValue.LOCATE_ADVANCED]: this.advanced ? true : null});
  }

  enterMapFullScreen(): void {
    this.locateMap?.cycle();
  }

  resetView(): void {
    const frameHidden = this.hideFrame(true, true);
    const centre = L.latLng(LOCATE_OVERVIEW_CENTRE[0], LOCATE_OVERVIEW_CENTRE[1]);
    const zoom = this.overviewZoom();
    this.lastView = {centre, zoom};
    if (!frameHidden && this.map) {
      this.map.setView(centre, zoom, {animate: true});
    }
  }

  confirmReset(): void {
    this.locationSelectionVersion += 1;
    this.savedPoints = [];
    this.activeSavedPointId = null;
    this.point = null;
    this.location = null;
    this.describing = false;
    this.advanced = false;
    this.confirmingReset = false;
    this.addressMessage = "";
    this.notice = "";
    this.coordinateInputs = {gridReference: "", latitude: "", longitude: "", eastings: "", northings: ""};
    this.placeMarker(null);
    this.resetView();
    void this.uiActions.updateQueryParameters({
      [StoredValue.DIRECTIONS]: null,
      [StoredValue.LAT]: null,
      [StoredValue.LON]: null,
      [StoredValue.GRID_REF]: null,
      [StoredValue.POSTCODE]: null,
      [StoredValue.LOCATE_POINTS]: null,
      [StoredValue.LOCATE_ADVANCED]: null
    });
  }

  centreOnPin(): void {
    if (this.point) {
      this.hideFrame();
      this.map?.flyTo([this.point.latitude, this.point.longitude], this.pointZoom(this.point.latitude), {animate: true, duration: 1.2});
    }
  }

  async useMyLocation(): Promise<void> {
    this.findingLocation = true;
    this.notice = "";
    const selectionVersion = this.locationSelectionVersion;
    const position = await this.currentLocation.currentPosition(true);
    this.findingLocation = false;
    if (selectionVersion === this.locationSelectionVersion) {
      if (position) {
        this.chooseNewPoint(position.lat, position.lng, true);
      } else {
        this.notice = "Your position could not be found. Allow location access in your browser, or search for a place instead.";
      }
    }
  }

  coordinateFormatChanged(format: LocateCoordinateFormat): void {
    this.coordinateFormat = format;
    void this.uiActions.updateQueryParameters({[StoredValue.LOCATE_COORDINATE_FORMAT]: format === LocateCoordinateFormat.GRID_REFERENCE ? null : format});
  }

  movePinFromCoordinates(): void {
    if (this.coordinateFormat === LocateCoordinateFormat.GRID_REFERENCE) {
      this.locateGridReference();
    } else if (this.coordinateFormat === LocateCoordinateFormat.LATITUDE_LONGITUDE) {
      this.locateCoordinates();
    } else {
      this.locateNationalGrid();
    }
  }

  locateGridReference(): void {
    this.chooseCoordinatePoint(this.gridReferences.fromGridReference(this.coordinateInputs.gridReference));
  }

  locateCoordinates(): void {
    const latitude = String(this.coordinateInputs.latitude);
    const longitude = String(this.coordinateInputs.longitude);
    this.chooseCoordinatePoint(latitude.trim() && longitude.trim() ? this.gridReferences.fromLatLng(Number(latitude), Number(longitude)) : null);
  }

  locateNationalGrid(): void {
    const eastings = String(this.coordinateInputs.eastings);
    const northings = String(this.coordinateInputs.northings);
    this.chooseCoordinatePoint(eastings.trim() && northings.trim() ? this.gridReferences.fromEastingsNorthings(Number(eastings), Number(northings)) : null);
  }

  private chooseCoordinatePoint(point: LocatePoint | null): void {
    if (point) {
      this.choose(point.latitude, point.longitude, true);
    } else {
      this.notice = "Check the coordinates or grid reference. Choose a valid point within Great Britain.";
    }
  }

  private placeMarker(point: LocatePoint | null): void {
    this.markers.render(point, this.savedPoints, this.activeSavedPointId, (pin, name) => this.pinCaption(pin, name));
  }

  private pinCaption(point: LocatePoint, name: string | null): string {
    const grid = this.display.formatGrid(point.gridReference10, this.gridDigits);
    return name ? `${name} · ${grid}` : grid;
  }

  private onPinSelection(selection: LocatePinSelection): void {
    this.zone.run(() => {
      this.activeSavedPointId = selection.id;
      if (selection.settled) {
        this.choose(selection.latitude, selection.longitude, false);
      } else {
        const point = this.gridReferences.fromLatLng(selection.latitude, selection.longitude);
        if (point) {
          this.applyPoint(point, null, false);
          const name = this.savedPoints.find(saved => saved.id === selection.id)?.name || null;
          this.markers.setCaption(selection.id, this.pinCaption(point, name));
        }
      }
    });
  }

  addPoint(): void {
    if (this.point && this.location && !this.activeSavedPointId && this.savedPoints.length < 50) {
      const id = generateUid();
      const number = this.savedPoints.reduce((highest, saved) => Math.max(highest, saved.number), 0) + 1;
      const saved: LocateSavedPoint = {id, number, name: this.uniqueSavedName(this.pointNameFromLocation(`Point ${number}`)), point: this.point, postcode: this.location.postcode, description: this.location.description};
      this.savedPoints = [...this.savedPoints, saved];
      this.activeSavedPointId = id;
      this.placeMarker(this.point);
      this.syncSavedPoints();
    }
  }

  selectSavedPoint(saved: LocateSavedPoint): void {
    this.activeSavedPointId = saved.id;
    this.choose(saved.point.latitude, saved.point.longitude, true, {latlng: {lat: saved.point.latitude, lng: saved.point.longitude}, postcode: saved.postcode, description: saved.description});
  }

  reorderSavedPoints(points: LocateSavedPoint[]): void {
    this.savedPoints = points.map((saved, index) => ({...saved, number: index + 1}));
    this.placeMarker(this.point);
    this.syncSavedPoints();
  }

  renameSavedPoint(change: LocatePointNameChange): void {
    this.savedPoints = this.savedPoints.map(saved => saved.id === change.id ? {...saved, name: change.name.slice(0, 80)} : saved);
    this.placeMarker(this.point);
    this.syncSavedPoints();
  }

  removeSavedPoint(id: string): void {
    this.savedPoints = this.savedPoints.filter(saved => saved.id !== id);
    if (this.activeSavedPointId === id) {
      this.locationSelectionVersion += 1;
      this.activeSavedPointId = null;
      this.point = null;
      this.location = null;
      this.describing = false;
      this.coordinateInputs = {gridReference: "", latitude: "", longitude: "", eastings: "", northings: ""};
      this.hideFrame(false);
      void this.uiActions.updateQueryParameters({[StoredValue.DIRECTIONS]: null, [StoredValue.LAT]: null, [StoredValue.LON]: null, [StoredValue.GRID_REF]: null, [StoredValue.POSTCODE]: null, [StoredValue.LOCATE_POINTS]: this.savedPointsQuery()});
    } else {
      this.syncSavedPoints();
    }
    this.placeMarker(this.point);
  }

  private updateSelectedSavedPoint(): void {
    if (this.activeSavedPointId && this.point && this.location) {
      this.savedPoints = this.savedPoints.map(saved => {
        if (saved.id !== this.activeSavedPointId) {
          return saved;
        } else {
          const previousAuto = this.pointNameFromLocation(`Point ${saved.number}`, saved);
          const locality = briefPlaceName(saved.description);
          const generated = !saved.name || saved.name === previousAuto || saved.name === `Point ${saved.number}` || saved.name === (saved.description || "").trim() || (locality && saved.name.startsWith(`${locality},`)) || saved.name.startsWith(`${previousAuto} (`);
          const keepName = saved.name && !generated;
          const name = keepName ? saved.name : this.uniqueSavedName(this.pointNameFromLocation(`Point ${saved.number}`), saved.id);
          return {...saved, point: this.point, postcode: this.location.postcode, description: this.location.description, name};
        }
      });
    }
  }

  private pointNameFromLocation(fallback: string, saved?: LocateSavedPoint): string {
    return savedPointName(saved?.postcode ?? this.location?.postcode, saved?.description ?? this.location?.description, this.display.formatGrid(saved?.point.gridReference10 || this.point?.gridReference10 || "", this.gridDigits)) || fallback;
  }

  private uniqueSavedName(name: string, exceptId?: string): string {
    const taken = this.savedPoints.filter(saved => saved.id !== exceptId).map(saved => saved.name);
    const candidates = [name, ...range(2, 51).map(index => `${name.slice(0, Math.max(1, 80 - ` (${index})`.length))} (${index})`)];
    return candidates.find(candidate => !taken.includes(candidate)) || name;
  }

  private savedPointsQuery(): string | null {
    return this.savedPoints.length ? JSON.stringify(this.savedPoints.map(saved => [Number(saved.point.latitude.toFixed(7)), Number(saved.point.longitude.toFixed(7)), saved.name, saved.number])) : null;
  }

  private syncSavedPoints(): void {
    void this.uiActions.updateQueryParameters({[StoredValue.LOCATE_POINTS]: this.savedPointsQuery()});
  }

  private restoreSavedPoints(): void {
    const stored = this.route.snapshot.queryParamMap.get(StoredValue.LOCATE_POINTS);
    if (stored && stored.length <= 20000) {
      try {
        const entries = JSON.parse(stored);
        this.savedPoints = (isArray(entries) ? entries.slice(0, 50).flatMap((entry, index) => {
          if (isArray(entry) && (entry.length === 3 || entry.length === 4) && isNumber(entry[0]) && isNumber(entry[1]) && isString(entry[2])) {
            const point = this.gridReferences.fromLatLng(entry[0], entry[1]);
            const number = Number.isSafeInteger(entry[3]) && entry[3] > 0 && entry[3] < 1000 ? entry[3] : index + 1;
            return point ? [{id: generateUid(), number, name: entry[2].slice(0, 80), point, postcode: "", description: ""}] : [];
          } else {
            return [];
          }
        }) : []).sort(sortBy("number"));
      } catch (error) {
        this.logger.warn("restoreSavedPoints:failed", error);
      }
    }
  }
}
