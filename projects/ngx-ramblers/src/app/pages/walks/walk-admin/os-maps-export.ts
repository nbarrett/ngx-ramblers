import { isNumber } from "es-toolkit/compat";
import { routeMemberIsAdmin } from "../../../functions/route-access";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { OsMapsAccountScope, RouteVisibility } from "../../../models/os-maps-export.model";
import { OsMapsPersonalAccountComponent } from "../../../modules/common/os-maps-personal-account";
import { RouteNearbyService } from "../../../services/maps/route-nearby.service";
import { GeoCoordinate } from "../../../services/maps/geo-distance.service";
import { DistanceRangeSlider } from "../../../components/distance-range-slider/distance-range-slider";
import { DistanceRange } from "../../../models/search.model";
import { APP_NEARBY_MILES, APP_NEARBY_MILES_MAX } from "../../../models/route-follow.model";
import { KM_PER_MILE } from "../../../models/walk.model";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { RouteWalkReference } from "../../../models/os-maps-export.model";
import { RouteAuditComponent } from "../../../modules/common/route-audit";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faTrash, faArrowLeft, faArrowUpRightFromSquare, faXmark, faArrowDownWideShort, faArrowUpShortWide, faBookmark, faCalendarDays, faCircleCheck, faCircleExclamation, faDownload, faMagnifyingGlass, faMap, faPersonWalking, faPowerOff, faSpinner, faSync } from "@fortawesome/free-solid-svg-icons";
import { ActivatedRoute } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { exhaustMap, Subscription, timer } from "rxjs";
import { ResizerComponent, ResizerOrientation, ResizerVariant } from "../../../modules/common/resizer/resizer";
import { OsMapsRoutePreviewMapComponent } from "./os-maps-route-preview-map";
import {
  OsMapsExportJobStatus,
  OsMapsExportJobResult,
  OsMapsExportTab,
  OS_MAPS_EXPORT_POLL_INTERVAL_MS,
  OsMapsListedRoute,
  OsMapsRouteListFilter,
  OsMapsRouteListing,
  OsMapsRouteSource,
  osMapsRouteUserNames,
  osMapsRouteVisible
} from "../../../models/os-maps-export.model";
import { SortDirection } from "../../../models/sort.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { StoredValue } from "../../../models/ui-actions";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UIDateFormat } from "../../../models/date-format.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { OsMapsExportService } from "../../../services/maps/os-maps-export.service";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { DistanceUnit } from "../../../models/search.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { UrlService } from "../../../services/url.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalkDisplayService } from "../walk-display.service";
import { followRouteCommands } from "../../../models/route-follow.model";
import { ROUTES_HOW_TO_IMPORT_URL } from "../../../models/walks-route-paths.model";
import { Router, RouterLink } from "@angular/router";
import { OsMapsLoginRequiredAlertComponent } from "../walk-edit/os-maps-login-required-alert";
import { SerenityJobAuditPanelComponent } from "./serenity-job-audit-panel";
import { serenityFeatureFromFileName, SerenityFeature } from "../../../models/serenity-feature.model";
import { RamblersUploadAuditService } from "../../../services/walks/ramblers-upload-audit.service";
import { AuditType, RamblersUploadAudit, Status } from "../../../models/ramblers-upload-audit.model";
import { WalkProgrammePageComponent } from "../walk-programme-view-selector/walk-programme-page";

@Component({
  selector: "app-os-maps-export",
  imports: [DistanceRangeSlider, OsMapsPersonalAccountComponent, SortableTableComponent, SortableTableCellDirective, RouterLink, RouteAuditComponent, WalkProgrammePageComponent, FormsModule, FontAwesomeModule, OsMapsLoginRequiredAlertComponent, SerenityJobAuditPanelComponent, TabsetComponent, TabDirective, TooltipDirective, OsMapsRoutePreviewMapComponent, ResizerComponent],
  template: `
    <app-walk-programme-page>
      @if (!loginConfigured && account === OsMapsAccountScope.GROUP) {
        <div class="mb-3">
          <app-os-maps-login-required-alert/>
        </div>
      }
      @if (account === OsMapsAccountScope.PERSONAL) {
        <app-os-maps-personal-account (configured)="personalAccountConfigured($event)"/>
        <div class="mb-3">
          <label for="import-visibility" class="form-label">Imported routes</label>
          <select id="import-visibility" class="form-select" [(ngModel)]="importVisibility">
            <option [ngValue]="RouteVisibility.PRIVATE">Private — visible to me and administrators</option>
            <option [ngValue]="RouteVisibility.GROUP">Shared with the group</option>
          </select>
        </div>
      }
      <div class="os-maps-export-actions d-flex flex-wrap align-items-center gap-2 mb-3">
        <button type="button" class="btn btn-quiet" (click)="navigateBackToAdmin()"><fa-icon [icon]="faArrowLeft" class="me-2"/>{{ isAdmin() ? "Back to walks admin" : "Back to walks" }}</button>
        @if (!listing.listedAt) {
          <button type="button" class="btn btn-primary" (click)="refreshRoutes()" [disabled]="busy() || !loginConfigured">
            <fa-icon [icon]="loading ? faSpinner : faSync" [animation]="loading ? 'spin' : null" class="me-2"/>
            {{ loading ? "Loading routes…" : "Load routes from OS Maps" }}
          </button>
        } @else {
          <button type="button" class="btn btn-primary" (click)="convertSelected()" [disabled]="busy() || !loginConfigured || selectedIds.size === 0">
            <fa-icon [icon]="converting ? faSpinner : faDownload" [animation]="converting ? 'spin' : null" class="me-2"/>
            {{ converting ? (jobStatusUnavailable ? "Checking conversion…" : "Converting…") : "Convert selected to GPX" }}
          </button>
          @if (converting && isAdmin()) {
            <button type="button" class="btn btn-quiet" (click)="confirmCancel = true" [disabled]="cancelling">
              <fa-icon [icon]="cancelling ? faSpinner : faPowerOff" [animation]="cancelling ? 'spin' : null" class="me-2"/>
              {{ cancelling ? "Stopping…" : "Stop job" }}
            </button>
          }
        }
        @if (isAdmin()) {
          <div class="os-maps-account-control d-flex align-items-center gap-2">
            <label for="os-maps-account" class="mb-0 text-nowrap">Import from</label>
            <select id="os-maps-account" class="form-select" [ngModel]="account" (ngModelChange)="changeAccount($event)" [disabled]="busy()">
              <option [ngValue]="OsMapsAccountScope.GROUP">Group OS Maps account</option>
              <option [ngValue]="OsMapsAccountScope.PERSONAL">My OS Maps account</option>
            </select>
          </div>
        }
        @if (listing.listedAt) {
          <div class="d-flex align-items-center gap-2 ms-sm-auto os-maps-export-actions-status">
            <span class="text-muted">Last loaded {{ lastLoadedLabel }}</span>
            <button type="button" class="btn btn-quiet btn-icon os-maps-export-actions-icon" (click)="refreshRoutes()" [disabled]="busy() || !loginConfigured"
                    tooltip="Reload routes from OS Maps" container="body">
              <fa-icon [icon]="loading ? faSpinner : faSync" [animation]="loading ? 'spin' : null"/>
            </button>
          </div>
        }
      </div>
      @if (errorMessage) {
        <div class="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div>
            <strong>Could not load or convert routes</strong>
            <div>{{ errorMessage }}</div>
          </div>
        </div>
      }
      @if (warningMessage || successMessage) {
        <div class="alert d-flex align-items-start gap-2" [class.alert-warning]="!!warningMessage"
             [class.alert-success]="!warningMessage" role="alert">
          <fa-icon [icon]="warningMessage ? faCircleExclamation : faCircleCheck"/>
          <div>
            <strong>{{ completionTitle() }}</strong>
            @if (successMessage) {
              <div>{{ successMessage }}</div>
            }
            @if (warningMessage) {
              <div>{{ warningMessage }}</div>
            }
          </div>
        </div>
      }
      @if (confirmCancel) {
        <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div class="flex-grow-1">
            <strong>Stop this job?</strong>
            <div>The conversion will be stopped and reported as failed.</div>
            <div class="mt-2 d-flex gap-2">
              <button type="button" class="btn btn-primary btn-sm" (click)="cancelActive()"><fa-icon [icon]="faPowerOff" class="me-2"/>Stop job</button>
              <button type="button" class="btn btn-quiet btn-sm" (click)="confirmCancel = false"><fa-icon [icon]="faXmark" class="me-2"/>Cancel</button>
            </div>
          </div>
        </div>
      }
      <tabset class="custom-tabset">
        <tab [active]="activeTabId === OsMapsExportTab.ROUTES" (selectTab)="selectTab(OsMapsExportTab.ROUTES)"
             heading="Routes">
          <div class="thumbnail-heading-frame">
            <div class="thumbnail-heading">Routes</div>
            <p class="os-maps-route-intro">Search and tick the routes you want, then convert them to GPX. Imported routes stay marked so you can see what is still to do next time. When new routes have been saved on an OS Maps account, reload the list using the button next to the last-loaded time.</p>
            <p class="mb-3"><a [href]="routesHowToImportUrl" target="_blank" rel="noopener noreferrer">How to import routes from OS Maps</a></p>
            <div class="mb-3">
              <button type="button" class="btn" [class.btn-primary]="nearbyOnly" [class.btn-quiet]="!nearbyOnly"
                      [attr.aria-pressed]="nearbyOnly" (click)="chooseNearby()">Near me</button>
              @if (nearbyOnly) {
                <app-distance-range-slider label="Within" [singleThumb]="true" [minValue]="1" [maxValue]="APP_NEARBY_MILES_MAX"
                  [range]="nearbyRange" (rangeChange)="onNearbyRange($event)"/>
                <p class="text-muted mb-0">Routes without a known start location are excluded.</p>
              }
              @if (locationError) { <p class="mb-0 mt-2">{{ locationError }}</p> }
            </div>
            <div class="os-maps-route-filters d-flex flex-wrap align-items-end gap-2 mb-2">
              <div class="os-maps-route-filter-search flex-grow-1">
                <label class="form-label mb-1" for="os-maps-route-search">Search</label>
                <div class="input-group">
                  <label class="input-group-text" for="os-maps-route-search" aria-label="Focus search">
                    <fa-icon [icon]="faMagnifyingGlass"/>
                  </label>
                  <input id="os-maps-route-search" name="os-maps-route-search" type="text" class="form-control"
                         placeholder="Search route titles"
                         [ngModel]="search" (ngModelChange)="onSearchChange($event)"
                         autocapitalize="none" autocomplete="search" autocorrect="off" spellcheck="false"
                         data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other"/>
                </div>
              </div>
              <div class="os-maps-route-filter-show">
                <label class="form-label mb-1" for="os-maps-route-filter">Show</label>
                <select id="os-maps-route-filter" class="form-select" [ngModel]="importFilter" (ngModelChange)="onFilterChange($event)">
                  <option [value]="OsMapsRouteListFilter.ALL">All routes</option>
                  <option [value]="OsMapsRouteListFilter.NOT_IMPORTED">Not imported</option>
                  <option [value]="OsMapsRouteListFilter.IMPORTED">Imported</option>
                </select>
              </div>
              <div class="os-maps-route-filter-user">
                <label class="form-label mb-1" for="os-maps-route-user">User</label>
                <select id="os-maps-route-user" class="form-select" [ngModel]="userFilter" (ngModelChange)="onUserFilterChange($event)">
                  <option value="">All users</option>
                  @for (user of userFilterOptions(); track user) {
                    <option [value]="user">{{ user }}</option>
                  }
                </select>
              </div>
              <div class="os-maps-route-filter-sort">
                <label class="form-label mb-1" for="os-maps-route-sort">Sort by</label>
                <div class="d-flex">
                  <select id="os-maps-route-sort" class="form-select" [ngModel]="sortKey" (ngModelChange)="onSortKeyChange($event)">
                    <option value="createdAtValue">Date</option>
                    <option value="title">Title</option>
                    <option value="distanceMetres">Distance</option>
                    <option value="importedAt">Imported</option>
                  </select>
                  <button type="button" class="btn btn-quiet btn-icon flex-shrink-0 ms-1" (click)="toggleSortDirection()"
                          tooltip="Reverse sort order" container="body" aria-label="Reverse sort order">
                    <fa-icon [icon]="sortDirection === ASCENDING ? faArrowUpShortWide : faArrowDownWideShort"/>
                  </button>
                </div>
              </div>
            </div>
            @if (visibleRoutes().length > 0) {
              <div class="os-maps-route-summary d-flex align-items-center gap-3 mb-2">
                @if (selectableRoutes().length > 0) {
                <div class="form-check mb-0 text-nowrap">
                  <input type="checkbox" class="form-check-input" id="select-all-os-maps-routes"
                         [checked]="allSelected()" (change)="toggleSelectAll()"/>
                  <label class="form-check-label" for="select-all-os-maps-routes">
                    Select all shown ({{ selectableRoutes().length }})
                  </label>
                </div>
                }
                @if (selectedIds.size > 0) {
                  <span class="text-muted text-nowrap">{{ selectedIds.size }} selected</span>
                }
                <span class="text-muted ms-auto text-end text-nowrap os-maps-route-summary-count">
                  @if (matchedCount() > visibleRoutes().length) {
                    Showing the first {{ visibleRoutes().length }} of {{ matchedCount() }}
                  } @else {
                    {{ matchedCount() }} of {{ listing.routes.length }} routes
                  }
                </span>
              </div>
            }
            <div class="d-flex flex-column gap-2">
                @for (route of visibleRoutes(); track route.id) {
                  <div class="img-thumbnail os-maps-route-card p-3"
                       [style.--os-maps-route-preview-width.px]="previewWidth">
                    <app-os-maps-route-preview-map class="os-maps-route-preview" fill [route]="route"
                                                    [style.height.px]="previewHeight"
                                                    [style.cursor]="canEditRoute(route) ? 'pointer' : null"
                                                    (click)="canEditRoute(route) && editRoute(route)"/>
                    <app-resizer class="os-maps-route-width-resizer" subtle
                                 [orientation]="ResizerOrientation.HORIZONTAL" [variant]="ResizerVariant.BAR"
                                 [size]="previewWidth" [minSize]="minPreviewWidth" [maxSize]="maxPreviewWidth"
                                 resizeHint="Drag to change the width of the map"
                                 (sizeChange)="onPreviewWidthChange($event)" (resizeEnd)="savePreviewWidth()"/>
                    <app-resizer class="os-maps-route-height-resizer" subtle
                                 [orientation]="ResizerOrientation.VERTICAL" [variant]="ResizerVariant.BAR"
                                 [size]="previewHeight" [minSize]="minPreviewHeight" [maxSize]="maxPreviewHeight"
                                 resizeHint="Drag to change the height of the map"
                                 (sizeChange)="onPreviewHeightChange($event)" (resizeEnd)="savePreviewHeight()"/>
                    <app-resizer class="os-maps-route-corner-resizer" subtle
                                 [orientation]="ResizerOrientation.CORNER" [variant]="ResizerVariant.BAR"
                                 [size]="previewWidth" [minSize]="minPreviewWidth" [maxSize]="maxPreviewWidth"
                                 [secondarySize]="previewHeight" [minSecondarySize]="minPreviewHeight" [maxSecondarySize]="maxPreviewHeight"
                                 resizeHint="Drag to change the width and height of the map"
                                 (sizeChange)="onPreviewWidthChange($event)" (secondarySizeChange)="onPreviewHeightChange($event)"
                                 (resizeEnd)="savePreviewWidth()" (secondaryResizeEnd)="savePreviewHeight()"/>
                    <div class="os-maps-route-copy min-w-0">
                      <div class="os-maps-route-header d-flex align-items-start gap-2 min-w-0">
                        <span class="fw-bold flex-grow-1 min-w-0 text-break">{{ route.title }}</span>
                        <input type="checkbox" class="form-check-input flex-shrink-0 mt-1 os-maps-route-selection"
                               [attr.aria-label]="'Select ' + route.title"
                               [disabled]="!canSelectRoute(route)" [checked]="isSelected(route)" (change)="toggleSelected(route)"/>
                      </div>
                      <div class="os-maps-route-details d-flex flex-wrap align-items-center gap-2 text-muted">
                        <span><fa-icon [icon]="faPersonWalking" class="me-1"/>{{ displayDistance(route) }}</span>
                        <span><fa-icon [icon]="faCalendarDays" class="me-1"/>{{ displayDateShort(route) }}</span>
                        <span [tooltip]="sourceLabel(route)" container="body">
                          <fa-icon [icon]="route.source === OsMapsRouteSource.BOOKMARKED ? faBookmark : faMap"/>
                        </span>
                      </div>
                      @if (route.walkedByName || route.walkedAt) {
                        <small class="d-block text-muted text-break">
                          Walked
                          @if (route.walkedByName) {
                            by {{ route.walkedByName }}
                          }
                          @if (route.walkedAt) {
                            on {{ displayWalkedDate(route) }}
                          }
                        </small>
                      }
                      @if (route.gpxFile) {
                        <app-route-audit class="os-maps-route-audit min-w-0" compact createdLabel="Imported" [audit]="route.gpxFile"/>
                      }
                      <div class="mt-2">
                        @if (route.walks?.length) {
                          <strong>Referenced by {{ route.walks.length }} {{ route.walks.length === 1 ? 'walk' : 'walks' }}</strong>
                          <app-sortable-table [columns]="walkColumns" [rows]="route.walks || []" [flat]="true"
                                              [defaultSortKey]="walkSortKey" [defaultSortDirection]="walkSortDirection"
                                              emptyMessage="No walks reference this route" (sortChange)="changeWalkSort($event)">
                            <ng-template appSortableTableCell="title" let-walk>
                              <a [routerLink]="walkReferenceLink(walk)">{{ walk.title }}</a>
                            </ng-template>
                            <ng-template appSortableTableCell="startDateTime" let-walk>
                              <a [routerLink]="walkReferenceLink(walk)">{{ displayReferenceDate(walk) }}</a>
                            </ng-template>
                          </app-sortable-table>
                        } @else {
                          <span>No walks reference this route</span>
                        }
                      </div>
                      @if (route.gpxFile?.awsFileName) {
                        <div class="d-flex align-items-center gap-2 mt-2">
                          @if (route.canEdit) {
                            <label [for]="'route-visibility-' + route.id" class="mb-0">Visibility</label>
                            <select [id]="'route-visibility-' + route.id" class="form-select form-select-sm" [ngModel]="route.visibility || RouteVisibility.GROUP"
                              (ngModelChange)="changeVisibility(route, $event)" [disabled]="busy()">
                              <option [ngValue]="RouteVisibility.PRIVATE">Private</option>
                              <option [ngValue]="RouteVisibility.GROUP">Shared with the group</option>
                            </select>
                          } @else {
                            <span>{{ route.visibility === RouteVisibility.PRIVATE ? "Private" : "Shared with the group" }}</span>
                          }
                          @if (nearbyOnly && here) { <span class="text-nowrap">{{ nearby.label(milesAway(route)) }}</span> }
                        </div>
                      }
                      <div class="os-maps-route-actions d-flex flex-wrap align-items-stretch gap-2 mt-auto pt-1">
                        @if (canEditRoute(route)) {
                          <button type="button" class="btn btn-primary btn-sm flex-grow-1" (click)="editRoute(route)"
                                  [attr.aria-label]="'Open ' + route.title">
                            <fa-icon [icon]="faArrowUpRightFromSquare" class="me-2"/>Open
                          </button>
                        }
                        @if (route.gpxFile?.awsFileName && isAdmin()) {
                          @if (deleteRouteId === route.id) {
                            <span class="d-inline-flex align-items-center gap-2">
                              <button type="button" class="btn btn-danger btn-sm text-nowrap" [disabled]="deletingRoute"
                                      (click)="deleteRoute(route)">Confirm delete?</button>
                              <button type="button" class="btn btn-quiet btn-icon" aria-label="Cancel delete" tooltip="Cancel delete" container="body"
                                      [disabled]="deletingRoute" (click)="deleteRouteId = null">
                                <fa-icon [icon]="faXmark"/>
                              </button>
                            </span>
                          } @else {
                            <span [tooltip]="route.walks?.length ? 'Cannot delete a route linked to a walk' : 'Delete route'" container="body">
                              <button type="button" class="btn btn-grey-danger btn-icon" aria-label="Delete route"
                                      [disabled]="loading || deletingRoute || !route.walks || route.walks.length > 0"
                                      (click)="deleteRouteId = route.id">
                                <fa-icon [icon]="faTrash"/>
                              </button>
                            </span>
                          }
                        }
                        <a [href]="route.url" target="_blank" rel="noopener"
                           class="btn btn-quiet btn-sm flex-grow-1 d-inline-flex align-items-center justify-content-center gap-2">
                          <img src="/assets/images/local/os-api/os-logo-maps.svg" alt="" width="46" height="12"/>
                          OS Maps
                        </a>
                      </div>
                    </div>
                  </div>
                } @empty {
                  <div class="text-muted p-2">{{ emptyMessage() }}</div>
                }
            </div>
          </div>
        </tab>
        <tab [active]="activeTabId === OsMapsExportTab.JOB_PROGRESS"
             (selectTab)="selectTab(OsMapsExportTab.JOB_PROGRESS)" heading="Job progress">
          @if (isAdmin()) {
          <app-serenity-job-audit-panel [fileName]="currentJobFileName"
                                        [starting]="startingJob"
                                        [jobRunning]="converting || loading"
                                        [exportResult]="exportResult"
                                        (finished)="onJobFinished($event)"
                                        [feature]="jobFeature"/>
          } @else {
            <p>{{ loading ? "Loading your routes from OS Maps…" : converting ? "Converting your routes…" : "Your job has finished." }}</p>
          }
        </tab>
      </tabset>
    </app-walk-programme-page>
  `,
  styles: [`
    .os-maps-route-card
      --resizer-vertical-alignment: flex-end
      --resizer-corner-bottom-inset: 0px
      display: grid
      grid-template-columns: var(--os-maps-route-preview-width, 638px) 14px minmax(12rem, 1fr)
      grid-template-rows: auto 14px
      grid-template-areas: "map width copy" "height corner copy"
      gap: 0
      align-items: stretch

      @media (max-width: 575.98px)
        grid-template-columns: minmax(0, 1fr)
        grid-template-rows: auto auto auto
        grid-template-areas: "map" "height" "copy"
        gap: var(--space-2, .5rem)

    .os-maps-route-preview
      grid-area: map
      width: 100%
      min-width: 0
      min-height: 0

    .os-maps-route-width-resizer
      grid-area: width
      min-height: 8rem

      @media (max-width: 575.98px)
        display: none

    .os-maps-route-height-resizer
      grid-area: height
      width: 100%
      height: 14px

    .os-maps-route-corner-resizer
      grid-area: corner

      @media (max-width: 575.98px)
        display: none

    .os-maps-route-copy
      grid-area: copy
      display: flex
      flex-direction: column
      gap: 0.35rem
      min-width: 0
      min-height: 0

    .os-maps-route-selection
      width: 1.25rem
      height: 1.25rem
      margin: 0

    .os-maps-route-audit
      overflow-wrap: anywhere

    .os-maps-route-actions
      .btn
        min-height: 40px
      .btn:not(.btn-icon)
        flex: 1 1 0
        min-width: 0
      .btn-icon
        flex: 0 0 40px
        width: 40px
        height: 40px

    .os-maps-route-intro
      @media (max-width: 575.98px)
        display: none

    .os-maps-account-control
      flex: 0 1 auto
      .form-select
        width: auto
        min-width: 14rem

    .os-maps-export-actions
      @media (max-width: 575.98px)
        flex-direction: column
        align-items: stretch

        .btn:not(.os-maps-export-actions-icon)
          width: 100%

        .os-maps-export-actions-status
          justify-content: space-between
          margin-left: 0

    .os-maps-route-filters
      .input-group-text
        cursor: pointer

      @media (max-width: 575.98px)
        .os-maps-route-filter-search
          flex: 1 1 100%

        .os-maps-route-filter-show,
        .os-maps-route-filter-user,
        .os-maps-route-filter-sort
          flex: 1 1 calc(50% - 0.5rem)
          min-width: 9rem

    .os-maps-route-summary
      @media (max-width: 575.98px)
        flex-wrap: wrap
        gap: 0.25rem 0.75rem

        .os-maps-route-summary-count
          margin-left: 0
          width: 100%
          text-align: left
  `]
})
export class OsMapsExportPage implements OnInit, OnDestroy {
  private memberLogin = inject(MemberLoginService);
  protected nearby = inject(RouteNearbyService);
  protected readonly OsMapsAccountScope = OsMapsAccountScope;
  protected readonly RouteVisibility = RouteVisibility;
  protected readonly APP_NEARBY_MILES_MAX = APP_NEARBY_MILES_MAX;
  protected readonly routesHowToImportUrl = ROUTES_HOW_TO_IMPORT_URL;
  account = OsMapsAccountScope.GROUP;
  importVisibility = RouteVisibility.PRIVATE;
  private personalConfigured = false;
  nearbyOnly = false;
  nearbyMiles = APP_NEARBY_MILES;
  nearbyRange: DistanceRange = {min: 1, max: APP_NEARBY_MILES, unit: DistanceUnit.MILES};
  here: GeoCoordinate | null = null;
  locationError = "";
  private logger = inject(LoggerFactory).createLogger("OsMapsExportPage", NgxLoggerLevel.ERROR);
  private osMapsExportService = inject(OsMapsExportService);
  private distanceValidation = inject(DistanceValidationService);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private stringUtils = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private urlService = inject(UrlService);
  private router = inject(Router);
  private walkDisplay = inject(WalkDisplayService);
  private systemConfigService = inject(SystemConfigService);
  private ramblersUploadAuditService = inject(RamblersUploadAuditService);
  private subscriptions: Subscription[] = [];
  loginConfigured = false;
  currentJobFileName: string | null = null;
  exportResult: OsMapsExportJobResult | null = null;
  private currentJobId: string | null = null;
  startingJob = false;
  jobFeature = SerenityFeature.OS_MAPS_EXPORT;
  private destroyed = false;
  faTrash = faTrash;
  faArrowLeft = faArrowLeft;
  faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  faXmark = faXmark;
  faSync = faSync;
  faSpinner = faSpinner;
  faDownload = faDownload;
  faPowerOff = faPowerOff;
  faMagnifyingGlass = faMagnifyingGlass;
  faCircleExclamation = faCircleExclamation;
  faCircleCheck = faCircleCheck;
  faMap = faMap;
  faPersonWalking = faPersonWalking;
  faCalendarDays = faCalendarDays;
  faBookmark = faBookmark;
  faArrowUpShortWide = faArrowUpShortWide;
  faArrowDownWideShort = faArrowDownWideShort;
  listing: OsMapsRouteListing = {listedAt: 0, routes: []};
  selectedIds = new Set<string>();
  deleteRouteId: string | null = null;
  deletingRoute = false;
  walkSortKey = "startDateTime";
  walkSortDirection = DESCENDING;
  walkColumns: SortableTableColumn<RouteWalkReference>[] = [
    {key: "title", label: "Walk", sortKey: "title"},
    {key: "startDateTime", label: "Date", sortKey: "startDateTime", cellClass: "text-nowrap"}
  ];
  loading = false;
  converting = false;
  jobStatusUnavailable = false;
  checkingJob = true;
  cancelling = false;
  confirmCancel = false;
  activeTabId = OsMapsExportTab.ROUTES;
  errorMessage = "";
  warningMessage = "";
  successMessage = "";
  search = "";
  importFilter = OsMapsRouteListFilter.ALL;
  userFilter = "";
  sortKey = "createdAtValue";
  sortDirection = DESCENDING;
  lastLoadedLabel = "";
  protected readonly OsMapsRouteListFilter = OsMapsRouteListFilter;
  protected readonly OsMapsRouteSource = OsMapsRouteSource;
  protected readonly OsMapsExportTab = OsMapsExportTab;
  protected readonly SerenityFeature = SerenityFeature;
  protected readonly ASCENDING = ASCENDING;
  protected readonly ResizerOrientation = ResizerOrientation;
  protected readonly ResizerVariant = ResizerVariant;
  protected readonly minPreviewWidth = 240;
  protected readonly maxPreviewWidth = 720;
  protected readonly defaultPreviewWidth = 638;
  protected readonly minPreviewHeight = 160;
  protected readonly maxPreviewHeight = 560;
  protected readonly defaultPreviewHeight = 257;
  protected previewWidth = Number(this.uiActions.initialValueFor(StoredValue.OS_MAPS_ROUTE_PREVIEW_WIDTH)) || this.defaultPreviewWidth;
  protected previewHeight = Number(this.uiActions.initialValueFor(StoredValue.OS_MAPS_ROUTE_PREVIEW_HEIGHT)) || this.defaultPreviewHeight;
  private searchWait = {timer: null as ReturnType<typeof setTimeout> | null};
  private readonly maxVisibleRoutes = 50;
  private readonly sortKeys = ["createdAtValue", "title", "distanceMetres", "importedAt"];

  isAdmin(): boolean {
    return routeMemberIsAdmin(this.memberLogin.loggedInMember());
  }

  personalAccountConfigured(configured: boolean): void {
    this.personalConfigured = configured;
    this.loginConfigured = this.account === OsMapsAccountScope.PERSONAL ? configured : this.systemConfigService.osMapsLoginConfigured();
  }

  async changeAccount(account: OsMapsAccountScope): Promise<void> {
    this.account = account;
    this.selectedIds.clear();
    this.personalAccountConfigured(this.personalConfigured);
    this.writeViewToUrl();
    await this.loadListing();
  }

  async changeVisibility(route: OsMapsListedRoute, visibility: RouteVisibility): Promise<void> {
    try {
      await this.osMapsExportService.changeVisibility(route.id, visibility);
      await this.loadListing();
    } catch (error) {
      this.errorMessage = this.failureMessage(error, "Could not change route visibility");
    }
  }

  private startPoint(route: OsMapsListedRoute): GeoCoordinate | null {
    const lat = route.gpxFile?.startLat;
    const lng = route.gpxFile?.startLng;
    return isNumber(lat) && isNumber(lng) && (lat !== 0 || lng !== 0) ? {latitude: lat, longitude: lng} : null;
  }

  milesAway(route: OsMapsListedRoute): number | null {
    return this.nearby.milesAway(this.here, this.startPoint(route));
  }

  async chooseNearby(): Promise<void> {
    this.nearbyOnly = !this.nearbyOnly;
    this.writeViewToUrl();
    if (this.nearbyOnly) {
      await this.locateNearby();
    }
  }

  private async locateNearby(): Promise<void> {
    const points = this.listing.routes.map(route => this.startPoint(route)).filter((point): point is GeoCoordinate => !!point);
    this.here = await this.nearby.origin(points);
    this.locationError = this.here ? "" : "Location is not available, so Near me cannot filter the list.";
  }

  onNearbyRange(range: DistanceRange): void {
    this.nearbyRange = range;
    this.nearbyMiles = range.unit === DistanceUnit.KILOMETERS ? range.max / KM_PER_MILE : range.max;
    this.writeViewToUrl();
  }

  onPreviewWidthChange(width: number): void {
    this.previewWidth = width;
  }

  savePreviewWidth(): void {
    this.uiActions.saveValueFor(StoredValue.OS_MAPS_ROUTE_PREVIEW_WIDTH, this.previewWidth);
  }

  onPreviewHeightChange(height: number): void {
    this.previewHeight = height;
  }

  savePreviewHeight(): void {
    this.uiActions.saveValueFor(StoredValue.OS_MAPS_ROUTE_PREVIEW_HEIGHT, this.previewHeight);
  }

  ngOnInit(): void {
    const sessionFileName = this.activatedRoute.snapshot.queryParams[StoredValue.SESSION];
    const sessionFeature = sessionFileName ? serenityFeatureFromFileName(sessionFileName) : null;
    if (sessionFeature === SerenityFeature.OS_MAPS_LIST || sessionFeature === SerenityFeature.OS_MAPS_EXPORT) {
      this.jobFeature = sessionFeature;
      this.currentJobFileName = sessionFileName;
      this.checkingJob = sessionFeature === SerenityFeature.OS_MAPS_EXPORT;
    }
    const walkSortParam = this.activatedRoute.snapshot.queryParams[StoredValue.ROUTE_WALKS_SORT];
    this.walkSortKey = walkSortParam === "title" ? "title" : "startDateTime";
    this.walkSortDirection = this.activatedRoute.snapshot.queryParams[StoredValue.ROUTE_WALKS_SORT_ORDER] === SortDirection.ASC ? ASCENDING : DESCENDING;
    const sortParam = this.activatedRoute.snapshot.queryParams[StoredValue.SORT];
    const matchedSortKey = this.sortKeys.find(key => this.stringUtils.kebabCase(key) === sortParam);
    if (matchedSortKey) {
      this.sortKey = matchedSortKey;
    }
    if (this.activatedRoute.snapshot.queryParams[StoredValue.SORT_ORDER] === SortDirection.ASC) {
      this.sortDirection = ASCENDING;
    }
    const tabParam = this.activatedRoute.snapshot.queryParams[StoredValue.TAB];
    if (tabParam === OsMapsExportTab.JOB_PROGRESS) {
      this.activeTabId = tabParam;
    }
    this.search = this.activatedRoute.snapshot.queryParams[StoredValue.SEARCH] || "";
    this.userFilter = this.activatedRoute.snapshot.queryParams[StoredValue.USER] || "";
    const filterParam = this.activatedRoute.snapshot.queryParams[StoredValue.FILTER];
    if (filterParam === OsMapsRouteListFilter.IMPORTED || filterParam === OsMapsRouteListFilter.NOT_IMPORTED) {
      this.importFilter = filterParam;
    }
    this.account = this.isAdmin() && this.activatedRoute.snapshot.queryParams[StoredValue.OS_MAPS_ACCOUNT] !== OsMapsAccountScope.PERSONAL
      ? OsMapsAccountScope.GROUP : OsMapsAccountScope.PERSONAL;
    this.nearbyOnly = this.activatedRoute.snapshot.queryParams[StoredValue.NEARBY] === "true";
    this.nearbyMiles = Number(this.activatedRoute.snapshot.queryParams[StoredValue.NEARBY_MILES]) || APP_NEARBY_MILES;
    this.nearbyRange = {...this.nearbyRange, max: this.nearbyMiles};
    this.loginConfigured = this.account === OsMapsAccountScope.GROUP && this.systemConfigService.osMapsLoginConfigured();
    this.subscriptions.push(this.systemConfigService.events().subscribe(() => {
      this.loginConfigured = this.account === OsMapsAccountScope.GROUP ? this.systemConfigService.osMapsLoginConfigured() : this.personalConfigured;
    }));
    void this.loadListing();
    this.subscriptions.push(timer(0, OS_MAPS_EXPORT_POLL_INTERVAL_MS).pipe(
      exhaustMap(() => this.loadLatestExportResult())
    ).subscribe());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.searchWait.timer) {
      clearTimeout(this.searchWait.timer);
    }
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  completionTitle(): string {
    if (this.exportResult?.status === OsMapsExportJobStatus.COMPLETED) {
      return `${this.exportResult.gpxFiles.length} of ${this.exportResult.routeUrls?.length || this.exportResult.gpxFiles.length} routes converted`;
    } else {
      return this.warningMessage ? "Check job progress" : "Routes loaded";
    }
  }

  navigateBackToAdmin(): void {
    if (this.isAdmin()) {
      this.urlService.backToAdmin();
    } else {
      void this.router.navigate(["/" + this.walkDisplay.walksArea()]);
    }
  }

  displayDate(route: OsMapsListedRoute): string {
    if (!route.createdAtValue) {
      return "";
    } else {
      return this.dateUtils.displayDate(route.createdAtValue);
    }
  }

  displayDistance(route: OsMapsListedRoute): string {
    if (!route.distanceMetres) {
      return "";
    } else {
      const miles = this.distanceValidation.convertKmToMiles(route.distanceMetres / 1000);
      return `${miles} ${DistanceUnit.MILES}`;
    }
  }

  displayDateShort(route: OsMapsListedRoute): string {
    if (!route.createdAtValue) {
      return "";
    } else {
      return this.dateUtils.asString(route.createdAtValue, undefined, UIDateFormat.DISPLAY_DATE_NO_DAY);
    }
  }

  displayWalkedDate(route: OsMapsListedRoute): string {
    if (!route.walkedAt) {
      return "";
    } else {
      return this.dateUtils.displayDate(route.walkedAt);
    }
  }

  canEditRoute(route: OsMapsListedRoute): boolean {
    return !!route.number && !!route.importedAt && !!route.gpxFile?.awsFileName;
  }

  editRoute(route: OsMapsListedRoute): void {
    if (route.number) {
      this.walkDisplay.rememberFollowReturnUrl();
      void this.router.navigate(followRouteCommands(route.number, route.title));
    }
  }

  private matchedRoutes(): OsMapsListedRoute[] {
    return this.sortRoutes(this.listing.routes.filter(route => osMapsRouteVisible(route, this.search, this.importFilter, this.userFilter) && (!this.nearbyOnly || this.milesAway(route) !== null && this.milesAway(route) <= this.nearbyMiles)));
  }

  matchedCount(): number {
    return this.matchedRoutes().length;
  }

  visibleRoutes(): OsMapsListedRoute[] {
    return this.matchedRoutes().slice(0, this.maxVisibleRoutes);
  }

  userFilterOptions(): string[] {
    return this.listing.routes
      .reduce((names: string[], route) => [...names, ...osMapsRouteUserNames(route)], [])
      .filter((name, index, names) => names.indexOf(name) === index)
      .sort((first, second) => first.localeCompare(second));
  }

  sourceLabel(route: OsMapsListedRoute): string {
    return route.source === OsMapsRouteSource.BOOKMARKED ? "Bookmarked" : "Created";
  }

  private sortRoutes(routes: OsMapsListedRoute[]): OsMapsListedRoute[] {
    const direction = this.sortDirection === ASCENDING ? 1 : -1;
    if (this.nearbyOnly) {
      return [...routes].sort((first, second) => (this.milesAway(first) ?? Infinity) - (this.milesAway(second) ?? Infinity));
    } else {
      return [...routes].sort((first, second) => this.compareBySortKey(first, second) * direction);
    }
  }

  private compareBySortKey(first: OsMapsListedRoute, second: OsMapsListedRoute): number {
    if (this.sortKey === "title") {
      return (first.title || "").localeCompare(second.title || "");
    } else if (this.sortKey === "distanceMetres") {
      return (first.distanceMetres || 0) - (second.distanceMetres || 0);
    } else if (this.sortKey === "importedAt") {
      return (first.importedAt || 0) - (second.importedAt || 0);
    } else {
      return (first.createdAtValue || 0) - (second.createdAtValue || 0);
    }
  }

  emptyMessage(): string {
    if (this.listing.routes.length === 0) {
      return "No routes loaded yet. Use Load routes from OS Maps.";
    } else {
      return "No routes match those filters.";
    }
  }

  isSelected(route: OsMapsListedRoute): boolean {
    return this.selectedIds.has(route.id);
  }

  canSelectRoute(route: OsMapsListedRoute): boolean {
    return this.isAdmin() || !route.importedAt;
  }

  selectableRoutes(): OsMapsListedRoute[] {
    return this.visibleRoutes().filter(route => this.canSelectRoute(route));
  }

  allSelected(): boolean {
    const visible = this.selectableRoutes();
    return visible.length > 0 && visible.every(route => this.selectedIds.has(route.id));
  }

  toggleSelected(route: OsMapsListedRoute): void {
    const next = new Set(this.selectedIds);
    if (!this.canSelectRoute(route)) {
      next.delete(route.id);
    } else if (next.has(route.id)) {
      next.delete(route.id);
    } else {
      next.add(route.id);
    }
    this.selectedIds = next;
  }

  toggleSelectAll(): void {
    const visibleIds = this.selectableRoutes().map(route => route.id);
    if (this.allSelected()) {
      this.selectedIds = new Set([...this.selectedIds].filter(id => !visibleIds.includes(id)));
    } else {
      this.selectedIds = new Set([...this.selectedIds, ...visibleIds]);
    }
  }

  onSearchChange(value: string): void {
    this.search = value;
    if (this.searchWait.timer) {
      clearTimeout(this.searchWait.timer);
    }
    this.searchWait.timer = setTimeout(() => {
      this.writeViewToUrl();
    }, 300);
  }

  onFilterChange(value: OsMapsRouteListFilter): void {
    this.importFilter = value;
    this.writeViewToUrl();
  }

  onUserFilterChange(value: string): void {
    this.userFilter = value || "";
    this.writeViewToUrl();
  }

  onSortKeyChange(value: string): void {
    this.sortKey = value || "createdAtValue";
    this.writeViewToUrl();
  }

  toggleSortDirection(): void {
    this.sortDirection = this.sortDirection === ASCENDING ? DESCENDING : ASCENDING;
    this.writeViewToUrl();
  }

  selectTab(tab: OsMapsExportTab): void {
    this.activeTabId = tab;
    this.writeViewToUrl();
  }

  private writeViewToUrl(): void {
    this.uiActions.updateQueryParameters({
      [StoredValue.OS_MAPS_ACCOUNT]: this.account,
      [StoredValue.NEARBY]: this.nearbyOnly ? "true" : null,
      [StoredValue.NEARBY_MILES]: this.nearbyOnly ? this.nearbyMiles : null,
      [StoredValue.SESSION]: this.currentJobFileName,
      [StoredValue.TAB]: this.activeTabId === OsMapsExportTab.ROUTES ? null : this.activeTabId,
      [StoredValue.SORT]: this.sortKey ? this.stringUtils.kebabCase(this.sortKey) : null,
      [StoredValue.SORT_ORDER]: this.sortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC,
      [StoredValue.SEARCH]: this.search || null,
      [StoredValue.FILTER]: this.importFilter === OsMapsRouteListFilter.ALL ? null : this.importFilter,
      [StoredValue.USER]: this.userFilter || null
    });
  }

  walkReferenceLink(walk: RouteWalkReference): string[] {
    return ["/" + this.walkDisplay.walksArea(), walk.slug || walk.id];
  }

  displayReferenceDate(walk: RouteWalkReference): string {
    return walk.startDateTime ? this.dateUtils.displayDate(walk.startDateTime) : "Date not set";
  }

  changeWalkSort(sort: SortableTableSortState): void {
    this.walkSortKey = sort.key || "startDateTime";
    this.walkSortDirection = sort.direction;
    void this.uiActions.updateQueryParameters({
      [StoredValue.ROUTE_WALKS_SORT]: this.walkSortKey,
      [StoredValue.ROUTE_WALKS_SORT_ORDER]: sort.direction === ASCENDING ? SortDirection.ASC : SortDirection.DESC
    });
  }

  async deleteRoute(route: OsMapsListedRoute): Promise<void> {
    if (route.walks?.length) {
      this.errorMessage = "This route cannot be deleted because it is linked to a walk";
      this.deleteRouteId = null;
    } else {
      this.deletingRoute = true;
      this.errorMessage = "";
      try {
        await this.osMapsExportService.deleteRoute(route.id);
        this.selectedIds = new Set([...this.selectedIds].filter(id => id !== route.id));
        this.deleteRouteId = null;
        await this.loadListing();
        this.successMessage = "Route deleted";
      } catch (error) {
        this.logger.error("deleteRoute failed:", error);
        this.errorMessage = this.failureMessage(error, "Failed to delete route");
        this.deleteRouteId = null;
        await this.loadListing();
      } finally {
        this.deletingRoute = false;
      }
    }
  }

  async loadListing(): Promise<void> {
    try {
      this.listing = await this.osMapsExportService.listing(this.account);
      if (this.nearbyOnly && !this.here) {
        await this.locateNearby();
      }
      this.lastLoadedLabel = this.listing.listedAt
        ? this.dateUtils.asString(this.listing.listedAt, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED_TIME)
        : "";
    } catch (error) {
      this.logger.error("loadListing failed:", error);
      this.errorMessage = this.failureMessage(error, "Failed to load saved routes");
    }
  }

  private async loadLatestExportResult(): Promise<void> {
    try {
      const previousJobId = this.currentJobId;
      const latest = this.loading || this.jobFeature !== SerenityFeature.OS_MAPS_EXPORT
        ? null
        : await this.osMapsExportService.latestExportResult();
      if (!this.destroyed && !this.loading && this.jobFeature === SerenityFeature.OS_MAPS_EXPORT && !this.startingJob && previousJobId === this.currentJobId) {
        if (this.jobStatusUnavailable) {
          this.clearMessages();
          this.jobStatusUnavailable = false;
        }
        const wasConverting = this.converting && this.currentJobId === latest?.jobId;
        if (latest?.jobId !== this.currentJobId) {
          this.clearMessages();
          this.confirmCancel = false;
        }
        this.currentJobFileName = latest?.fileName || null;
        this.exportResult = latest;
        this.currentJobId = latest?.jobId || null;
        this.converting = latest?.status === OsMapsExportJobStatus.QUEUED;
        this.checkingJob = false;
        if (wasConverting && latest?.status === OsMapsExportJobStatus.COMPLETED) {
          this.clearMessages();
          this.successMessage = `${this.stringUtils.pluraliseWithCount(latest.gpxFiles.length, "GPX file")} saved and ready to attach to a walk`;
          this.warningMessage = latest.error || "";
          this.confirmCancel = false;
          await this.loadListing();
        } else if (wasConverting && latest?.status === OsMapsExportJobStatus.FAILED) {
          this.clearMessages();
          this.errorMessage = await this.lastJobError(latest.fileName) || latest.error || "Failed to convert the selected routes";
          this.confirmCancel = false;
        }
      }
    } catch (error) {
      this.logger.error("loadLatestExportResult failed:", error);
      this.jobStatusUnavailable = true;
      this.errorMessage = "Could not check conversion progress. Retrying automatically…";
    }
  }

  busy(): boolean {
    return this.loading || this.converting || this.checkingJob;
  }

  async onJobFinished(fileName: string): Promise<void> {
    if (fileName === this.currentJobFileName && this.jobFeature === SerenityFeature.OS_MAPS_EXPORT && !this.startingJob) {
      await this.loadLatestExportResult();
    }
  }

  private clearMessages(): void {
    this.errorMessage = "";
    this.warningMessage = "";
    this.successMessage = "";
  }

  async refreshRoutes(): Promise<void> {
    if (this.loginConfigured && !this.busy()) {
      this.loading = true;
      this.startingJob = true;
      this.jobFeature = SerenityFeature.OS_MAPS_LIST;
      this.currentJobFileName = null;
      this.exportResult = null;
      this.currentJobId = null;
      this.clearMessages();
      this.selectTab(OsMapsExportTab.JOB_PROGRESS);
      const previousListedAt = this.listing.listedAt;
      try {
        const started = await this.osMapsExportService.refresh(this.account);
        this.currentJobFileName = started.fileName || this.currentJobFileName;
        this.currentJobId = started.jobId;
        this.writeViewToUrl();
        this.startingJob = false;
        await this.waitForFreshListing(previousListedAt);
        if (this.listing.listedAt > previousListedAt) {
          this.successMessage = "Routes reloaded from OS Maps";
        } else {
          this.warningMessage = "The route list has not updated yet. Check Job progress for the reload status.";
        }
      } catch (error) {
        this.logger.error("refreshRoutes failed:", error);
        this.errorMessage = this.failureMessage(error, "Failed to start loading routes from OS Maps");
      }
      this.startingJob = false;
      this.loading = false;
    }
  }

  async convertSelected(): Promise<void> {
    if (this.loginConfigured && !this.busy() && this.selectedIds.size > 0) {
      const routeUrls = this.listing.routes
        .filter(route => this.selectedIds.has(route.id))
        .map(route => route.url);
      this.converting = true;
      this.jobFeature = SerenityFeature.OS_MAPS_EXPORT;
      this.startingJob = true;
      this.currentJobFileName = null;
      this.exportResult = null;
      this.currentJobId = null;
      this.clearMessages();
      this.selectTab(OsMapsExportTab.JOB_PROGRESS);
      try {
        const started = await this.osMapsExportService.exportRoutes(routeUrls, null, this.account, this.importVisibility);
        this.selectedIds = new Set<string>();
        this.currentJobFileName = started.fileName || this.currentJobFileName;
        this.currentJobId = started.jobId;
        this.writeViewToUrl();
      } catch (error) {
        this.logger.error("convertSelected failed:", error);
        this.converting = false;
        this.errorMessage = this.failureMessage(error, "Failed to convert the selected routes");
      }
      this.startingJob = false;
      await this.loadLatestExportResult();
    }
  }

  async cancelActive(): Promise<void> {
    this.confirmCancel = false;
    this.cancelling = true;
    this.clearMessages();
    try {
      const result = await this.osMapsExportService.cancelActive();
      if (!result.cancelled) {
        this.warningMessage = "There was no active job to stop.";
      }
    } catch (error) {
      this.logger.error("cancelActive failed:", error);
      this.errorMessage = this.failureMessage(error, "Failed to stop the job");
    }
    this.cancelling = false;
  }

  private async lastJobError(fileName: string | undefined): Promise<string> {
    if (!fileName || !this.isAdmin()) {
      return "";
    } else {
      try {
        const audits = await this.ramblersUploadAuditService.all({
          criteria: {fileName, status: Status.ERROR, type: AuditType.STEP},
          sort: {record: -1},
          limit: 10
        });
        const rows: RamblersUploadAudit[] = audits.response || [];
        const withDetail = rows.find(row => row.errorResponse?.message) || rows.find(row => /^\w*Error:/.test(row.message || ""));
        return withDetail?.errorResponse?.message || withDetail?.message || "";
      } catch (error) {
        this.logger.error("lastJobError failed:", error);
        return "";
      }
    }
  }

  private async waitForFreshListing(previousListedAt: number): Promise<void> {
    const attempts = {count: 0};
    const maxAttempts = 40;
    const poll = async (): Promise<void> => {
      await this.loadListing();
      attempts.count += 1;
      if (this.listing.listedAt > previousListedAt || attempts.count >= maxAttempts) {
        return;
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return poll();
      }
    };
    return poll();
  }

  private failureMessage(error: unknown, fallback: string): string {
    const asHttp = error as {error?: {error?: string}; message?: string};
    if (asHttp.error?.error) {
      return asHttp.error.error;
    } else {
      return asHttp.message || fallback;
    }
  }
}
