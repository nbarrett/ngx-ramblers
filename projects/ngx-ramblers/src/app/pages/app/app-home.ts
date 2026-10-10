import { RouteNearbyService } from "../../services/maps/route-nearby.service";
import { VersionCheckService } from "../../services/version-check.service";
import { uniqBy } from "es-toolkit/compat";
import { RouteContributor } from "../../models/audit";
import { MobileAppAccessService } from "../../services/maps/mobile-app-access.service";
import { MobileAppAction } from "../../models/walks-config.model";
import { RouteFollowService } from "../../services/maps/route-follow.service";
import { generateUid } from "../../functions/numbers";
import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { NgTemplateOutlet } from "@angular/common";
import { NgSelectModule } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription, take } from "rxjs";
import { faArrowLeft, faCalendarDay, faCheck, faCircle, faCircleExclamation, faCircleHalfStroke, faCircleInfo, faEyeSlash, faFileImport, faLocationDot, faMagnifyingGlass, faMap, faMoon, faPersonWalking, faArrowsRotate, faShareNodes, faSliders, faStar, faSun, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { PageContentType } from "../../models/content-text.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import {
  APP_HOME_NETWORK_TIMEOUT_MS,
  APP_NEARBY_MILES,
  APP_NEARBY_MILES_MAX,
  AppAppearance,
  AppHomeLayout,
  AppHomeView,
  AppInstallPlatform,
  AppPath,
  walkingAppName,
  firstCompleted,
  followCacheKey,
  followRouteCommands,
  isLiveFollowMode,
  RouteFollowOfflineStatus,
  RouteFollowSession,
  RouteFollowPoint,
  RouteFollowSource,
  RouteFollowSummary
} from "../../models/route-follow.model";
import { SystemConfig } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { PageContentService } from "../../services/page-content.service";
import { RouteFollowPayloadService } from "../../services/maps/route-follow-payload.service";
import { RamblersLibraryRouteService } from "../../services/maps/ramblers-library-route.service";
import { RouteFollowCacheService } from "../../services/maps/route-follow-cache.service";
import { AppHomeListCacheService } from "../../services/maps/app-home-list-cache.service";
import { RouteListPreferencesService } from "../../services/maps/route-list-preferences.service";
import { RouteMapActionsComponent } from "../../modules/common/route-map-actions";
import { AppShellService } from "../../services/maps/app-shell.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { WalkProgrammeService } from "../../services/walks-and-events/walk-programme.service";
import { UrlService } from "../../services/url.service";
import { WalkDisplayService } from "../walks/walk-display.service";
import { RouteAuditComponent } from "../../modules/common/route-audit";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { DisplayTimePipe } from "../../pipes/display-time.pipe";
import { StoredValue } from "../../models/ui-actions";
import { UiActionsService } from "../../services/ui-actions.service";
import { OsMapsRoutePreviewMapComponent } from "../walks/walk-admin/os-maps-route-preview-map";
import { MediaQueryService } from "../../services/committee/media-query.service";
import { OsMapsExportService } from "../../services/maps/os-maps-export.service";
import { OsMapsListedRoute } from "../../models/os-maps-export.model";
import { CurrentLocationService } from "../../services/maps/current-location.service";
import { DistanceRangeSlider } from "../../components/distance-range-slider/distance-range-slider";
import { DistanceRange, DistanceUnit } from "../../models/search.model";
import { KM_PER_MILE } from "../../models/walk.model";
import { MemberLoginService } from "../../services/member/member-login.service";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { LoginModalComponent } from "../login/login-modal/login-modal.component";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { nativeApiUrl } from "../../functions/native-walking";
import { AuthService } from "../../auth/auth.service";
import { VisibilityObserverDirective } from "../../notifications/common/visibility-observer.directive";
import { PullToRefreshComponent } from "../../modules/common/pull-to-refresh/pull-to-refresh";
import { StringUtilsService } from "../../services/string-utils.service";

const MAP_LIST_BATCH_SIZE = 20;

@Component({
  selector: "app-home",
  template: `
    <div #homeScroll class="app-home container">
      <div class="app-home-chrome">
        <app-pull-to-refresh #listRefresh [refreshAction]="refreshRoutes" [allowLinkPull]="true" [inline]="true"/>
      <div class="app-home-header">
        <a class="app-home-brand" routerLink="/" aria-label="Website home" tooltip="Website home" [isDisabled]="!tooltipsEnabled">
          @if (logoUrl) {
            <img class="app-home-logo" [src]="logoUrl" [alt]="groupName">
          }
          <h1 [class.visually-hidden]="!!logoUrl">{{ groupName }}</h1>
        </a>
        @if (!customising) {
          <div class="app-home-search">
            <fa-icon class="app-home-search-icon" [icon]="faMagnifyingGlass"/>
            <input type="search" class="form-control" [placeholder]="view === AppHomeView.MAPS ? 'Search maps' : 'Search walks'"
                   [ngModel]="routeSearch" (ngModelChange)="onRouteSearch($event)"
                   autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false"
                   [attr.aria-label]="view === AppHomeView.MAPS ? 'Search maps' : 'Search walks'">
            @if (routeSearch) {
              <button class="app-home-search-clear" type="button" (click)="onRouteSearch('')" aria-label="Clear search">
                <fa-icon [icon]="faXmark"/>
              </button>
            }
          </div>
        }
        @if (!customising && ((view === AppHomeView.MAPS && layout.savedRoutes) || (view === AppHomeView.UPCOMING && layout.upcomingWalks))) {
          <span class="app-home-match-count app-home-header-match-count" role="status" aria-live="polite">{{ matchCountLabel() }}</span>
        }
        <div class="app-home-header-actions">
          <button class="btn btn-quiet btn-icon d-none d-md-inline-flex" type="button"
                  (click)="listRefresh.refresh()" [disabled]="listRefresh.refreshing"
                  aria-label="Refresh walks and maps" tooltip="Refresh walks and maps">
            <fa-icon [icon]="faArrowsRotate"/>
          </button>
        <button class="btn btn-icon" type="button" (click)="customiseTooltip.hide(); toggleCustomising()"
                [class.btn-primary]="customising" [class.btn-quiet]="!customising"
                [attr.aria-expanded]="customising" aria-controls="app-home-customise"
                [attr.aria-label]="customising ? 'Back' : 'Customise'"
                [tooltip]="customising ? 'Back' : 'Customise'" [isDisabled]="!tooltipsEnabled" #customiseTooltip="bs-tooltip">
          <fa-icon [icon]="customising ? faArrowLeft : faSliders"/>
        </button>
        </div>
      </div>

      @if (!customising) {
        <div class="app-home-controls" role="group" aria-label="Walking app views and actions">
          <button class="btn" [class.btn-primary]="view === AppHomeView.MAPS" [class.btn-quiet]="view !== AppHomeView.MAPS"
                  type="button" (click)="chooseView(AppHomeView.MAPS)">
            <fa-icon [icon]="faMap"/><span>Maps</span>
          </button>
          <button class="btn" [class.btn-primary]="view === AppHomeView.UPCOMING" [class.btn-quiet]="view !== AppHomeView.UPCOMING"
                  type="button" (click)="chooseView(AppHomeView.UPCOMING)">
            <fa-icon [icon]="faCalendarDay"/><span>Upcoming</span>
          </button>
          @if (view === AppHomeView.MAPS && layout.savedRoutes) {
            <button class="btn" type="button" [attr.aria-pressed]="nearbyOnly"
                    [class.btn-primary]="nearbyOnly" [class.btn-quiet]="!nearbyOnly" (click)="chooseNearby()">
              <fa-icon [icon]="nearbyOnly ? faCheck : faLocationDot"/><span>Near me</span>
            </button>
            <button class="btn" type="button" [attr.aria-pressed]="favouritesOnly"
                    [class.btn-primary]="favouritesOnly" [class.btn-quiet]="!favouritesOnly"
                    (click)="chooseFavourites()">
              <fa-icon [icon]="favouritesOnly ? faCheck : faStar"/><span>Favourites</span>
            </button>
            <button class="btn btn-primary" type="button" (click)="chooseGpxFile()"
                    [disabled]="importingGpx || (memberLogin.memberLoggedIn() && !mobileAccess.allowed(MobileAppAction.IMPORT))">
              <fa-icon [icon]="faFileImport"/><span>{{ importingGpx ? "Importing…" : "Import GPX" }}</span>
            </button>
          }
          <button class="btn btn-primary" type="button" aria-label="Record a route"
                  [disabled]="memberLogin.memberLoggedIn() && !mobileAccess.allowed(MobileAppAction.RECORD)" (click)="recordStandaloneRoute()">
            <fa-icon [icon]="faLocationDot"/><span>Record route</span>
          </button>
        </div>
        @if (view === AppHomeView.MAPS && layout.savedRoutes) {
          <label class="visually-hidden" for="app-home-creator">Creator</label>
          <div class="app-home-filter-summary">
          <ng-select labelForId="app-home-creator" class="app-home-creator" [ngModel]="creator"
                     (ngModelChange)="chooseCreator($event)" [clearable]="false" [searchable]="false">
            <ng-option value="">All creators</ng-option>
            @for (contributor of creatorOptions(); track contributor.memberId) {
              <ng-option [value]="contributor.memberId">{{ contributor.name }}</ng-option>
            }
          </ng-select>
          </div>
        @if (nearbyOnly) {
          <app-distance-range-slider class="app-home-nearby-slider"
            label="Within"
            [singleThumb]="true"
            [minValue]="1"
            [maxValue]="APP_NEARBY_MILES_MAX"
            [range]="nearbyRange"
            (rangeInput)="onNearbyRangeInput($event)"
            (rangeChange)="onNearbyRange($event)">
          </app-distance-range-slider>
        }
        }
      }
      </div>
      @if (!customising && view === AppHomeView.MAPS && layout.savedRoutes) {
        <input #gpxInput class="d-none" type="file" accept=".gpx,application/gpx+xml"
               ng2FileSelect [uploader]="gpxUploader">
        <div ng2FileDrop [uploader]="gpxUploader" class="drop-zone app-home-import-drop">
          Or drop a GPX here
        </div>
      }

      @if (customising) {
        <section id="app-home-customise" class="app-home-customise" [attr.aria-label]="'Choose what appears in ' + groupName">
          <div class="app-home-customise-heading">
            <h2>What each view shows</h2>
          </div>
          <p class="app-home-key">Maps come from the group's website. You can also import a GPX from this phone; that saves it to the group so others can follow it too.</p>
          <label class="app-home-customise-item">
            <input type="checkbox" [checked]="layout.savedRoutes" (change)="setLayout('savedRoutes', $event)">
            <span>
              <strong>Maps</strong>
              <span>Maps come from imported routes, scheduled walks and recorded routes. Signed-in favourites and hidden maps are saved with your member profile. Hiding changes your own list; the route stays on the site.</span>
            </span>
          </label>
          <label class="app-home-customise-item">
            <input type="checkbox" [checked]="layout.upcomingWalks" (change)="setLayout('upcomingWalks', $event)">
            <span>
              <strong>Upcoming walks</strong>
              <span>The group's published programme. Walks with a GPX can be followed from here.</span>
            </span>
          </label>
          @if (listPreferences.hiddenCount()) {
            <button class="btn btn-quiet" type="button" (click)="showHiddenMaps()">{{ listPreferences.hiddenMapsActionLabel() }}</button>
          }
          <button class="btn btn-quiet" type="button" (click)="versionCheck.reloadNow()" [disabled]="!navigatorOnline() || !!activeSession">
            Update app
          </button>
          <p class="app-home-meta">Download the latest app version when connected and after finishing your saved walking session.</p>
          <h2>Appearance</h2>
          <ng-container *ngTemplateOutlet="appearanceControls"/>
        </section>
      }

      @if (!customising && view === AppHomeView.MAPS && layout.savedRoutes) {
        @if (locationError) {
          <p class="app-home-empty">{{ locationError }}</p>
        }
        @if (importError) {
          <div class="alert alert-danger d-flex align-items-start" role="alert">
            <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
            <div>
              <strong>Could not import that GPX</strong>
              <p class="mb-0">{{ importError }}</p>
            </div>
          </div>
        }
      }

      @if (listPreferences.syncMessage) {
        <div class="alert alert-warning d-flex align-items-start gap-2" role="status">
          <fa-icon [icon]="faCircleExclamation"/>
          <div><strong>Map preferences</strong><p class="mb-0">{{ listPreferences.syncMessage }}</p></div>
          <button class="btn btn-quiet btn-icon ms-auto" type="button" tooltip="Dismiss" aria-label="Dismiss map preferences message"
                  (click)="listPreferences.syncMessage = null"><fa-icon [icon]="faXmark"/></button>
        </div>
      }

      @if (!customising && view === AppHomeView.MAPS && layout.savedRoutes && activeSession) {
        <section class="app-home-section">
          <h2>Continue your route</h2>
          <a class="app-home-card" [routerLink]="routeLink(activeSession)"
             [queryParams]="routeQuery(activeSession)">
            <div class="app-home-card-copy">
              <h3>Your walk is ready to resume</h3>
              <p class="app-home-meta">Your route and progress have been saved on this device.</p>
            </div>
            <span class="btn btn-primary app-home-card-btn">Resume</span>
          </a>
        </section>
      }

      @if (!customising && showInstallHint) {
        <section class="app-home-install">
          <fa-icon [icon]="faCircleExclamation"/>
          <div>
            <strong>Add {{ groupName }} to your Home Screen</strong>
            @if (platform === AppInstallPlatform.IOS) {
              <p>Tap <fa-icon [icon]="faShareNodes"/> Share, then Add to Home Screen. It then opens like an app, with no website header.</p>
            } @else if (platform === AppInstallPlatform.ANDROID) {
              <p>Tap Add to Home Screen, or open the browser menu and choose Add to Home screen / Install app.</p>
            } @else {
              <p>Open this page on your phone, then add it to your Home Screen for the full-screen app.</p>
            }
            @if (canInstall) {
              <button class="btn btn-primary app-home-install-btn" type="button" (click)="install()">Add to Home Screen</button>
            }
          </div>
          <button class="btn btn-icon app-home-install-dismiss" type="button" (click)="dismissInstallHint()"
                  aria-label="Dismiss" tooltip="Dismiss" [isDisabled]="!tooltipsEnabled">
            <fa-icon [icon]="faXmark"/>
          </button>
        </section>
      }

      @if (!customising && view === AppHomeView.MAPS && layout.savedRoutes) {
        <section class="app-home-section app-home-map-list">
          <h2 class="visually-hidden">Maps</h2>
          @for (route of displayedRoutes(); track routeKey(route)) {
            <div class="app-home-card app-home-route-card">
              <a class="app-home-route-main" [routerLink]="routeLink(route)"
                 [queryParams]="routeQuery(route)">
                <app-os-maps-route-preview-map class="flush" fill [route]="listedOsMapsRoute(route)"
                                              [gpxFile]="route.gpxFile || null" [cacheKey]="routeKey(route)"
                                              [points]="previewPoints[routeKey(route) || ''] || []"/>
              <div class="app-home-card-copy">
                <h3>{{ route.title }}</h3>
              @if (route.description) {
                <p class="app-home-meta">{{ route.description }}</p>
              }

                <p class="app-home-meta">
                  @if (milesAwayLabel(route)) {
                    {{ milesAwayLabel(route) }}
                  }
                  @if (route.distanceMiles) {
                    @if (milesAwayLabel(route)) {
                      ·
                    }
                    {{ milesLabel(route.distanceMiles) }}
                  }
                  @if (route.startDescription) {
                    @if (milesAwayLabel(route) || route.distanceMiles) {
                      ·
                    }
                    {{ route.startDescription }}
                  }
                </p>
                @if (route.ramblersSlug) {
                  <p class="app-home-meta">Saved from a Ramblers route link</p>
                }
              <app-route-audit [audit]="route" iconsOnly showDates [walkedAt]="route.walkedAt" [walkedByName]="route.walkedByName"/>
              </div>
              </a>
              <app-route-map-actions [favourite]="isFavourite(route)" [showHide]="isWebsiteMap(route)"
                                     (favouriteToggle)="toggleFavourite(route)"
                                     (hide)="removeSavedRoute(route)">
                @if (!isWebsiteMap(route) && confirmingRemoveKey === routeKey(route)) {
                  <button class="app-home-map-action app-home-map-action-danger" type="button"
                          aria-label="Confirm delete" tooltip="Confirm delete" [isDisabled]="!tooltipsEnabled"
                          (click)="confirmRemoveSavedRoute(route); $event.stopPropagation()">
                    <fa-icon [icon]="faTrash"/>
                  </button>
                } @else if (!isWebsiteMap(route)) {
                  <button class="app-home-map-action" type="button"
                          aria-label="Delete" tooltip="Delete" [isDisabled]="!tooltipsEnabled"
                          (click)="beginRemoveSavedRoute(route); $event.stopPropagation()">
                    <fa-icon [icon]="faTrash"/>
                  </button>
                }
              </app-route-map-actions>
            </div>
          }
          @if (moreRoutesAvailable()) {
            <div app-visibility-observer="more-maps" [observeOnce]="false" rootMargin="240px 0px"
                 (visible)="showMoreRoutes()">
              <button class="btn btn-quiet w-100" type="button" (click)="showMoreRoutes()">Show more maps</button>
            </div>
          }
          @if (visibleRoutes().length === 0) {
            <p class="app-home-empty">{{ emptyMapsMessage() }}</p>
          }
        </section>
      }

      @if (!customising && view === AppHomeView.UPCOMING && !layout.upcomingWalks) {
        <div class="app-home-empty">
          <p>Upcoming walks are turned off in Customise. The group's programme is on the website; show it here to follow those walks.</p>
          <button class="btn btn-primary" type="button" (click)="enableSection('upcomingWalks')">Show the programme</button>
        </div>
      }

      @if (!customising && view === AppHomeView.MAPS && !layout.savedRoutes) {
        <div class="app-home-empty">
          <p>Maps are turned off in Customise.</p>
          <button class="btn btn-primary" type="button" (click)="enableSection('savedRoutes')">Show maps</button>
        </div>
      }

      @if (!customising && view === AppHomeView.UPCOMING && layout.upcomingWalks) {
      <section class="app-home-section">
        <h2 class="visually-hidden">Upcoming walks</h2>
        @if (loading) {
          <p class="app-home-empty">Finding walks…</p>
        } @else if (visibleWalks().length === 0) {
          <p class="app-home-empty">{{ emptyWalksMessage() }}</p>
        }
        @for (walk of visibleWalks(); track walk.id) {
          <article class="app-home-card app-home-route-card">
            <a class="app-home-route-main" [routerLink]="walkDetailsLink(walk)">
              @if (walkPhoto(walk)) {
                <img class="app-home-walk-photo" [src]="walkPhoto(walk)" [alt]="walk.groupEvent?.title || 'Walk photo'">
              }
              <div class="app-home-card-copy">
                <h3>{{ walk.groupEvent?.title }}</h3>
                <p class="app-home-meta">
                  {{ walk.groupEvent?.start_date_time | displayDate }}
                  ·
                  {{ walk.groupEvent?.start_date_time | displayTime }}
                  @if (walk.groupEvent?.distance_miles) {
                    · {{ milesLabel(walk.groupEvent.distance_miles) }}
                  }
                </p>
                @if (walk.groupEvent?.start_location?.description || walk.groupEvent?.start_location?.postcode) {
                  <p class="app-home-meta">{{ walk.groupEvent?.start_location?.description || walk.groupEvent?.start_location?.postcode }}</p>
                }
              </div>
            </a>
            <div class="app-home-route-actions">
              @if (payloadService.walkHasGpx(walk)) {
                <a class="btn btn-primary btn-icon" [routerLink]="'/' + AppPath.ROOT + '/' + AppPath.ROUTE"
                   [queryParams]="walkQuery(walk)" aria-label="Follow" tooltip="Follow" [isDisabled]="!tooltipsEnabled">
                  <fa-icon [icon]="faPersonWalking"/>
                </a>
              } @else if (canRecordWalk(walk)) {
                <a class="btn btn-primary btn-icon" [routerLink]="'/' + AppPath.ROOT + '/' + AppPath.ROUTE"
                   [queryParams]="walkQuery(walk)" aria-label="Record route" tooltip="Record route" [isDisabled]="!tooltipsEnabled">
                  <fa-icon class="red-icon" [icon]="faCircle"/>
                </a>
              }
              <a class="btn btn-quiet btn-icon" [routerLink]="walkDetailsLink(walk)"
                 aria-label="Walk details" tooltip="Walk details" [isDisabled]="!tooltipsEnabled">
                <fa-icon [icon]="faCircleInfo"/>
              </a>
            </div>
          </article>
        }
      </section>
      }

      @if (!customising) {
      <section class="app-home-section">
        <h2>Appearance</h2>
        <ng-container *ngTemplateOutlet="appearanceControls"/>
      </section>
      }
    </div>
    <ng-template #appearanceControls>
      <div class="app-home-appearance" role="group" aria-label="Appearance">
        <button type="button" class="btn btn-icon app-home-appearance-btn"
                [class.btn-primary]="appearance === AppAppearance.SYSTEM"
                [class.btn-quiet]="appearance !== AppAppearance.SYSTEM"
                (click)="chooseAppearance(AppAppearance.SYSTEM)"
                aria-label="Match phone" tooltip="Match phone" [isDisabled]="!tooltipsEnabled">
          <fa-icon [icon]="faCircleHalfStroke"/>
        </button>
        <button type="button" class="btn btn-icon app-home-appearance-btn"
                [class.btn-primary]="appearance === AppAppearance.LIGHT"
                [class.btn-quiet]="appearance !== AppAppearance.LIGHT"
                (click)="chooseAppearance(AppAppearance.LIGHT)"
                aria-label="Light" tooltip="Light" [isDisabled]="!tooltipsEnabled">
          <fa-icon [icon]="faSun"/>
        </button>
        <button type="button" class="btn btn-icon app-home-appearance-btn"
                [class.btn-primary]="appearance === AppAppearance.DARK"
                [class.btn-quiet]="appearance !== AppAppearance.DARK"
                (click)="chooseAppearance(AppAppearance.DARK)"
                aria-label="Dark" tooltip="Dark" [isDisabled]="!tooltipsEnabled">
          <fa-icon [icon]="faMoon"/>
        </button>
      </div>
    </ng-template>
  `,
  styleUrls: ["./app-home.sass"],
  imports: [NgSelectModule, PullToRefreshComponent, VisibilityObserverDirective, RouterLink, FormsModule, FontAwesomeModule, RouteAuditComponent, DisplayDatePipe, DisplayTimePipe, OsMapsRoutePreviewMapComponent, TooltipModule, DistanceRangeSlider, NgTemplateOutlet, FileUploadModule, RouteMapActionsComponent]
})
export class AppHomeComponent implements OnInit, OnDestroy {
  protected readonly refreshRoutes = async (): Promise<void> => {
    await Promise.all([this.load(), this.listPreferences.refresh()]);
  };
  private logger: Logger = inject(LoggerFactory).createLogger("AppHomeComponent", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private pageContentService = inject(PageContentService);
  private walkProgrammeService = inject(WalkProgrammeService);
  private dateUtils = inject(DateUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private urlService = inject(UrlService);
  private appShell = inject(AppShellService);
  private ramblersLibrary = inject(RamblersLibraryRouteService);
  private osMapsExport = inject(OsMapsExportService);
  private currentLocation = inject(CurrentLocationService);
  private nearby = inject(RouteNearbyService);
  private followCache = inject(RouteFollowCacheService);
  private listCache = inject(AppHomeListCacheService);
  protected listPreferences = inject(RouteListPreferencesService);
  private router = inject(Router);
  private followService = inject(RouteFollowService);
  private activatedRoute = inject(ActivatedRoute);
  private uiActions = inject(UiActionsService);
  protected display = inject(WalkDisplayService);
  private mediaQueryService = inject(MediaQueryService);
  protected payloadService = inject(RouteFollowPayloadService);
  protected memberLogin = inject(MemberLoginService);
  private authService = inject(AuthService);
  private modalService = inject(BsModalService);
  @ViewChild("gpxInput") private gpxInput!: ElementRef<HTMLInputElement>;
  @ViewChild("homeScroll") private homeScroll: ElementRef<HTMLDivElement> | null = null;
  private browseScrollTop = 0;
  private loginModalConfig: ModalOptions = {animated: false, initialState: {}};
  protected importingGpx = false;
  protected importError: string | null = null;
  protected gpxUploader = new FileUploader({
    url: nativeApiUrl("/api/database/walks/gpx/import"),
    itemAlias: "file",
    disableMultipart: false,
    autoUpload: true,
    authTokenHeader: "Authorization",
    authToken: `Bearer ${this.authService.authToken()}`
  });
  protected routes: RouteFollowSummary[] = [];
  protected creator = "";
  protected layout: AppHomeLayout = {savedRoutes: true, upcomingWalks: true};
  protected readonly APP_NEARBY_MILES_MAX = APP_NEARBY_MILES_MAX;
  protected readonly AppHomeView = AppHomeView;
  protected view = AppHomeView.MAPS;
  protected favouritesOnly = false;
  protected nearbyOnly = false;
  protected nearbyMiles = APP_NEARBY_MILES;
  protected nearbyRange: DistanceRange = {min: 1, max: APP_NEARBY_MILES, unit: DistanceUnit.MILES};
  protected routeSearch = "";
  private routeWindow = {filterKey: null as string | null, limit: MAP_LIST_BATCH_SIZE};
  protected here: {latitude: number; longitude: number} | null = null;
  protected locationError: string | null = null;
  protected confirmingRemoveKey: string | null = null;
  protected websiteMapKeys: string[] = [];
  protected importedOsMapsByKey: Record<string, OsMapsListedRoute> = {};
  protected previewPoints: Record<string, RouteFollowPoint[]> = {};
  protected customising = false;
  protected readonly tooltipsEnabled = this.appShell.platform() === AppInstallPlatform.OTHER
    && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

  protected walks: ExtendedGroupEvent[] = [];
  protected loading = true;
  protected showInstallHint = false;
  protected canInstall = false;
  protected platform: AppInstallPlatform = AppInstallPlatform.OTHER;
  protected groupName = walkingAppName();
  protected logoUrl: string | null = null;
  protected offlineByKey: Record<string, RouteFollowOfflineStatus> = {};
  protected activeSession: RouteFollowSession | null = null;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faCalendarDay = faCalendarDay;
  protected readonly faCheck = faCheck;
  protected readonly faCircle = faCircle;
  protected readonly faCircleHalfStroke = faCircleHalfStroke;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faEyeSlash = faEyeSlash;
  protected readonly faFileImport = faFileImport;
  protected readonly faLocationDot = faLocationDot;
  protected readonly faMagnifyingGlass = faMagnifyingGlass;
  protected readonly faMap = faMap;
  protected readonly faMoon = faMoon;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly faShareNodes = faShareNodes;
  protected readonly faSliders = faSliders;
  protected readonly faArrowsRotate = faArrowsRotate;
  protected readonly faStar = faStar;
  protected readonly faSun = faSun;
  protected readonly faTrash = faTrash;
  protected readonly faXmark = faXmark;
  protected readonly AppPath = AppPath;
  protected readonly AppInstallPlatform = AppInstallPlatform;
  protected readonly AppAppearance = AppAppearance;
  protected appearance: AppAppearance = AppAppearance.SYSTEM;
  protected readonly versionCheck = inject(VersionCheckService);
  protected readonly mobileAccess = inject(MobileAppAccessService);
  protected readonly MobileAppAction = MobileAppAction;
  private subscriptions: Subscription[] = [];

  toggleCustomising(): void {
    const scroller = this.homeScroll?.nativeElement;
    if (!this.customising) {
      this.browseScrollTop = scroller?.scrollTop || 0;
      this.customising = true;
      scroller?.scrollTo({top: 0, behavior: "auto"});
    } else {
      this.customising = false;
      requestAnimationFrame(() => scroller?.scrollTo({top: this.browseScrollTop, behavior: "auto"}));
    }
  }

  ngOnInit(): void {
    void this.listPreferences.refresh();
    this.layout = {...this.layout, ...this.uiActions.initialObjectValueFor<Partial<AppHomeLayout>>(StoredValue.APP_HOME_LAYOUT, {})};
    this.view = this.activatedRoute.snapshot.queryParamMap.get(StoredValue.TAB) === AppHomeView.UPCOMING ? AppHomeView.UPCOMING : AppHomeView.MAPS;
    this.creator = this.activatedRoute.snapshot.queryParamMap.get(StoredValue.CREATOR) || "";
    this.favouritesOnly = this.activatedRoute.snapshot.queryParamMap.get(StoredValue.FAVOURITES) === "true";
    this.routeSearch = this.activatedRoute.snapshot.queryParamMap.get(StoredValue.SEARCH) || "";
    this.nearbyOnly = this.activatedRoute.snapshot.queryParamMap.get(StoredValue.NEARBY) === "true";
    const storedMiles = Number(this.activatedRoute.snapshot.queryParamMap.get(StoredValue.NEARBY_MILES));
    this.nearbyMiles = storedMiles > 0 ? storedMiles : APP_NEARBY_MILES;
    this.nearbyRange = {min: 1, max: this.nearbyMiles, unit: DistanceUnit.MILES};
    if (this.nearbyOnly) {
      void this.refreshLocation();
    }
    this.platform = this.appShell.platform();
    this.appearance = this.appShell.appearance();
    this.showInstallHint = !this.appShell.installed() && this.appShell.mobilePlatform()
      && !this.uiActions.initialBooleanValueFor(StoredValue.APP_INSTALL_HINT_DISMISSED, false);
    this.canInstall = this.appShell.canPromptInstall();
    this.subscriptions.push(this.appShell.installAvailable$.subscribe(available => {
      this.canInstall = available;
      if (this.appShell.installed()) {
        this.showInstallHint = false;
      }
    }));
    this.subscriptions.push(this.appShell.appearance$.subscribe(appearance => {
      this.appearance = appearance;
    }));
    this.applyGroupIdentity(this.systemConfigService.systemConfig());
    this.subscriptions.push(this.systemConfigService.events().subscribe((config: SystemConfig) => {
      this.applyGroupIdentity(config);
    }));
    this.gpxUploader.onBeforeUploadItem = item => {
      this.gpxUploader.authToken = `Bearer ${this.authService.authToken()}`;
      this.importingGpx = true;
      this.importError = null;
      item.withCredentials = false;
    };
    this.gpxUploader.onSuccessItem = () => {
      this.importingGpx = false;
      this.gpxUploader.clearQueue();
      void this.load();
    };
    this.gpxUploader.onErrorItem = (_item, response) => {
      this.importingGpx = false;
      this.gpxUploader.clearQueue();
      try {
        const parsed = JSON.parse(response);
        this.importError = parsed?.message || parsed?.error || "The file could not be saved. Try again after signing in.";
      } catch (error) {
        this.logger.error("Could not parse GPX import failure", error);
        this.importError = response || "The file could not be saved. Try again after signing in.";
      }
    };
    this.activeSession = this.activeFollowSession();
    const coldLaunch = !this.router.lastSuccessfulNavigation()?.previousNavigation;
    if (!coldLaunch || !this.resumeActiveFollowSession()) {
      void this.load();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  chooseGpxFile(): void {
    this.afterSignIn(() => {
      if (this.mobileAccess.allowed(MobileAppAction.IMPORT)) {
        this.gpxUploader.authToken = `Bearer ${this.authService.authToken()}`;
        this.gpxInput?.nativeElement?.click();
      } else {
        this.importError = "You do not have permission to import routes.";
      }
    });
  }

  recordStandaloneRoute(): void {
    this.afterSignIn(() => {
      if (!this.mobileAccess.allowed(MobileAppAction.RECORD)) {
        this.importError = "You do not have permission to record routes.";
      } else {
        void this.followService.requestCompassPermission().catch(error => this.logger.info("Compass permission was not granted", error));
        const queryParams = this.activeSession ? this.routeQuery(this.activeSession) : {[StoredValue.RECORD_ROUTE]: generateUid()};
        void this.router.navigate(["/app/route"], {queryParams});
      }
    });
  }

  private afterSignIn(action: () => void): void {
    if (!this.memberLogin.memberLoggedIn()) {
      this.modalService.show(LoginModalComponent, this.loginModalConfig);
      this.subscriptions.push(this.modalService.onHidden.pipe(take(1)).subscribe(() => {
        if (this.memberLogin.memberLoggedIn()) {
          action();
        }
      }));
    } else {
      action();
    }
  }

  install(): void {
    void this.appShell.promptInstall().then(outcome => {
      if (outcome === "accepted") {
        this.dismissInstallHint();
      }
    });
  }

  dismissInstallHint(): void {
    this.showInstallHint = false;
    this.uiActions.saveValueFor(StoredValue.APP_INSTALL_HINT_DISMISSED, true);
  }

  chooseAppearance(appearance: AppAppearance): void {
    this.appShell.setAppearance(appearance);
  }

  chooseView(view: AppHomeView): void {
    this.view = view;
    if (view === AppHomeView.UPCOMING && !this.layout.upcomingWalks) {
      this.enableSection("upcomingWalks");
    } else if (view === AppHomeView.MAPS && !this.layout.savedRoutes) {
      this.enableSection("savedRoutes");
    }
    void this.uiActions.updateQueryParameter(StoredValue.TAB, view === AppHomeView.MAPS ? null : view);
  }

  enableSection(section: keyof AppHomeLayout): void {
    this.layout = {...this.layout, [section]: true};
    this.uiActions.saveValueFor(StoredValue.APP_HOME_LAYOUT, this.layout);
  }

  setLayout(section: keyof AppHomeLayout, event: Event): void {
    this.layout = {...this.layout, [section]: (event.target as HTMLInputElement).checked};
    this.uiActions.saveValueFor(StoredValue.APP_HOME_LAYOUT, this.layout);
  }

  showHiddenMaps(): void {
    this.listPreferences.showHidden();
    this.layout = {...this.layout, savedRoutes: true};
    this.uiActions.saveValueFor(StoredValue.APP_HOME_LAYOUT, this.layout);
  }

  routeKey(route: RouteFollowSummary): string | null {
    return followCacheKey(route);
  }

  visibleWalks(): ExtendedGroupEvent[] {
    const needle = this.routeSearch.trim().toLowerCase();
    return this.walks.filter(walk => {
      const allowed = !this.display.awaitingLeader(walk) && !this.display.walkHiddenFromPublic(walk);
      const named = needle.length === 0 || (walk.groupEvent?.title || "").toLowerCase().includes(needle);
      return allowed && named;
    });
  }

  walkPhoto(walk: ExtendedGroupEvent): string | null {
    const media = this.mediaQueryService.imageSource(walk);
    return media?.url ? this.urlService.imageSource(media.url) : null;
  }

  emptyWalksMessage(): string {
    if (this.routeSearch.trim()) {
      return "No walks match that search.";
    } else {
      return "There are no upcoming walks on the programme. When walks are published on the website, they appear here.";
    }
  }

  navigatorOnline(): boolean {
    return navigator.onLine;
  }

  creatorOptions(): RouteContributor[] {
    return uniqBy(this.routes.filter(route => !!route.createdBy).map(route => ({memberId: route.createdBy, name: route.createdByName || "Unknown user"})), contributor => contributor.memberId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  chooseCreator(value: string): void {
    this.creator = value;
    void this.uiActions.updateQueryParameter(StoredValue.CREATOR, value || null);
  }

  visibleRoutes(): RouteFollowSummary[] {
    const needle = this.routeSearch.trim().toLowerCase();
    const shown = this.routes.filter(route => {
      const key = this.routeKey(route) || "";
      const visible = !this.listPreferences.isHidden(key);
      const favourite = !this.favouritesOnly || this.isFavourite(route);
      const named = needle.length === 0 || (route.title || "").toLowerCase().includes(needle);
      const nearby = !this.nearbyOnly || this.isNearby(route);
      const creator = !this.creator || route.createdBy === this.creator;
      return visible && favourite && named && nearby && creator;
    });
    return this.nearbyOnly ? [...shown].sort((left, right) => (this.milesAway(left) ?? 9999) - (this.milesAway(right) ?? 9999)) : shown;
  }

  protected displayedRoutes(): RouteFollowSummary[] {
    const limit = this.routeWindow.filterKey === this.routeFilterKey() ? this.routeWindow.limit : MAP_LIST_BATCH_SIZE;
    return this.visibleRoutes().slice(0, limit);
  }

  protected moreRoutesAvailable(): boolean {
    return this.displayedRoutes().length < this.visibleRoutes().length;
  }

  protected showMoreRoutes(): void {
    const filterKey = this.routeFilterKey();
    const currentLimit = this.routeWindow.filterKey === filterKey ? this.routeWindow.limit : MAP_LIST_BATCH_SIZE;
    this.routeWindow = {filterKey, limit: Math.min(this.visibleRoutes().length, currentLimit + MAP_LIST_BATCH_SIZE)};
  }

  private routeFilterKey(): string {
    return JSON.stringify([this.routeSearch, this.creator, this.favouritesOnly, this.nearbyOnly, this.nearbyMiles]);
  }

  emptyMapsMessage(): string {
    if (this.loading) {
      return "Finding maps…";
    } else if (this.favouritesOnly) {
      return "No favourite maps yet.";
    } else if (this.nearbyOnly) {
      return this.nearbyEmptyMessage();
    } else if (this.routeSearch.trim()) {
      return "No maps match that search.";
    } else {
      return "No maps to show. They appear here once they have been imported from OS Maps, attached to walks on the programme, or created as part of a walk route.";
    }
  }

  matchCountLabel(): string {
    if (this.view === AppHomeView.UPCOMING) {
      return "Showing " + this.stringUtils.pluraliseWithCount(this.visibleWalks().length, "upcoming walk");
    } else {
      const noun = this.favouritesOnly ? "favourite route" : "route";
      const distance = this.nearbyOnly ? " within " + this.nearbyRangeLabel() : "";
      return "Showing " + this.stringUtils.pluraliseWithCount(this.visibleRoutes().length, noun) + distance;
    }
  }

  nearbyEmptyMessage(): string {
    return "No maps within " + this.nearbyRangeLabel() + " of you.";
  }

  private nearbyRangeLabel(): string {
    if (this.nearbyRange.unit === DistanceUnit.KILOMETERS) {
      return this.stringUtils.pluraliseWithCount(this.nearbyRange.max, "km", "km");
    } else {
      return this.stringUtils.pluraliseWithCount(this.nearbyRange.max, "mile");
    }
  }

  onRouteSearch(value: string): void {
    this.routeSearch = value;
    void this.uiActions.updateQueryParameter(StoredValue.SEARCH, value.trim() ? value : null);
  }

  onNearbyRange(range: DistanceRange): void {
    this.onNearbyRangeInput(range);
    void this.uiActions.updateQueryParameter(StoredValue.NEARBY_MILES, this.nearbyMiles);
  }

  onNearbyRangeInput(range: DistanceRange): void {
    this.nearbyRange = range;
    this.nearbyMiles = range.unit === DistanceUnit.KILOMETERS ? range.max / KM_PER_MILE : range.max;
  }

  chooseFavourites(): void {
    this.favouritesOnly = !this.favouritesOnly;
    void this.uiActions.updateQueryParameter(StoredValue.FAVOURITES, this.favouritesOnly ? "true" : null);
  }

  async chooseNearby(): Promise<void> {
    this.nearbyOnly = !this.nearbyOnly;
    this.locationError = null;
    void this.uiActions.updateQueryParameter(StoredValue.NEARBY, this.nearbyOnly ? "true" : null);
    if (this.nearbyOnly) {
      await this.refreshLocation();
    }
  }

  milesAwayLabel(route: RouteFollowSummary): string | null {
    return this.nearby.label(this.milesAway(route));
  }

  milesLabel(miles: number | null | undefined): string {
    if (!miles) {
      return "";
    } else {
      return this.stringUtils.pluraliseWithCount(Number(Number(miles).toFixed(1)), "mile");
    }
  }

  private async refreshLocation(): Promise<void> {
    const position = await this.currentLocation.currentPosition();
    if (position) {
      this.here = this.hereForNearby({latitude: position.lat, longitude: position.lng});
      this.locationError = null;
    } else {
      this.here = this.mapsCentre();
      this.locationError = this.here ? null : "Location is not available, so Near me cannot filter the list.";
    }
  }

  private hereForNearby(gps: {latitude: number; longitude: number}): {latitude: number; longitude: number} {
    return this.nearby.trustedOrigin(gps, this.routes.map(route => this.startPoint(route)).filter(point => !!point));
  }

  private mapsCentre(): {latitude: number; longitude: number} | null {
    return this.nearby.centre(this.routes.map(route => this.startPoint(route)).filter(point => !!point));
  }

  private isNearby(route: RouteFollowSummary): boolean {
    const miles = this.milesAway(route);
    return miles !== null && miles <= this.nearbyMiles;
  }

  private milesAway(route: RouteFollowSummary): number | null {
    const start = this.startPoint(route);
    if (!this.here || !start) {
      return null;
    } else {
      return this.nearby.milesAway(this.here, start);
    }
  }

  private startPoint(route: RouteFollowSummary): {latitude: number; longitude: number} | null {
    const preview = this.previewPoints[this.routeKey(route) || ""]?.[0];
    if (route.startLatitude !== null && route.startLongitude !== null) {
      return {latitude: route.startLatitude, longitude: route.startLongitude};
    } else if (preview) {
      return {latitude: preview.latitude, longitude: preview.longitude};
    } else {
      return null;
    }
  }

  isWebsiteMap(route: RouteFollowSummary): boolean {
    return this.websiteMapKeys.includes(this.routeKey(route) || "") || route.source === RouteFollowSource.OS_MAPS;
  }

  listedOsMapsRoute(route: RouteFollowSummary): OsMapsListedRoute | null {
    const key = this.routeKey(route);
    return key ? this.importedOsMapsByKey[key] || null : null;
  }

  isFavourite(route: RouteFollowSummary): boolean {
    return this.listPreferences.isFavourite(this.routeKey(route));
  }

  toggleFavourite(route: RouteFollowSummary): void {
    this.listPreferences.toggleFavourite(this.routeKey(route));
  }

  beginRemoveSavedRoute(route: RouteFollowSummary): void {
    this.confirmingRemoveKey = this.routeKey(route);
  }

  confirmRemoveSavedRoute(route: RouteFollowSummary): void {
    void this.removeSavedRoute(route);
  }

  async removeSavedRoute(route: RouteFollowSummary): Promise<void> {
    const key = this.routeKey(route);
    try {
      if (key && this.isWebsiteMap(route)) {
        this.listPreferences.hide(key);
      } else if (key) {
        await this.followCache.remove(key);
      }
      if (route.ramblersSlug && !this.isWebsiteMap(route)) {
        this.ramblersLibrary.forget(route.ramblersSlug);
      }
      if (!this.isWebsiteMap(route)) {
        this.routes = this.routes.filter(item => this.routeKey(item) !== key);
        this.listPreferences.unfavourite(key);
      }
      this.confirmingRemoveKey = null;
    } catch (error) {
      this.logger.error("removeSavedRoute failed", error);
    }
  }

  offlineLabel(route: RouteFollowSummary): string {
    const key = followCacheKey(route);
    const status = key ? this.offlineByKey[key] : null;
    if (status === RouteFollowOfflineStatus.AVAILABLE) {
      return "Available off-line";
    } else {
      return "Not available off-line";
    }
  }

  offlineLabelForWalk(walk: ExtendedGroupEvent): string {
    const key = followCacheKey({walkId: this.display.walkSlug(walk)});
    const status = key ? this.offlineByKey[key] : null;
    if (status === RouteFollowOfflineStatus.AVAILABLE) {
      return "Available off-line";
    } else {
      return "Not available off-line";
    }
  }

  canRecordWalk(walk: ExtendedGroupEvent): boolean {
    return this.display.allowEdits(walk) && this.payloadService.walkHasStart(walk);
  }

  walkQuery(walk: ExtendedGroupEvent): Record<string, string> {
    const slug = this.display.walkSlug(walk);
    return slug ? {[StoredValue.WALK_ID]: slug} : {};
  }

  walkDetailsLink(walk: ExtendedGroupEvent): string[] {
    const area = (this.display.groupEventArea() || "walks").replace(/^\/+/, "");
    return ["/" + area, this.display.walkSlug(walk)];
  }

  routeLink(route: RouteFollowSummary | RouteFollowSession): string[] {
    if (route.routeNumber) {
      const title = "title" in route ? route.title : route.payload?.title;
      return followRouteCommands(route.routeNumber, title);
    } else {
      return ["/", AppPath.ROOT, AppPath.ROUTE];
    }
  }

  routeQuery(route: RouteFollowSummary | RouteFollowSession): Record<string, string> {
    const params: Record<string, string> = {};
    if (route.routeNumber) {
      if ("trackIndex" in route && route.trackIndex) {
        params[StoredValue.TRACK] = String(route.trackIndex);
      }
      if ("via" in route && route.via?.length) {
        params[StoredValue.VIA] = route.via.join(",");
      }
    } else {
      if (route.recordingId) {
        params[StoredValue.RECORD_ROUTE] = route.recordingId;
      }
      if (route.path) {
        params[StoredValue.FOLLOW_PATH] = route.path;
      }
      if (route.routeId) {
        params[StoredValue.ROUTE_ID] = route.routeId;
      }
      if (route.ramblersSlug) {
        params[StoredValue.RAMBLERS_SLUG] = route.ramblersSlug;
      }
      if (route.osMapsRouteId) {
        params[StoredValue.OS_MAPS_ROUTE_ID] = route.osMapsRouteId;
      }
      if (route.walkId) {
        params[StoredValue.WALK_ID] = route.walkId;
      }
      if ("trackIndex" in route && route.trackIndex) {
        params[StoredValue.TRACK] = String(route.trackIndex);
      }
      if ("via" in route && route.via?.length) {
        params[StoredValue.VIA] = route.via.join(",");
      }
    }
    return params;
  }

  private resumeActiveFollowSession(): boolean {
    if (this.activeSession) {
      void this.router.navigate(this.routeLink(this.activeSession), {
        queryParams: this.routeQuery(this.activeSession),
        replaceUrl: true
      });
      return true;
    } else {
      return false;
    }
  }

  private activeFollowSession(): RouteFollowSession | null {
    try {
      const session = this.uiActions.itemExistsFor(StoredValue.FOLLOW_SESSION)
        ? this.uiActions.initialObjectValueFor<RouteFollowSession | null>(StoredValue.FOLLOW_SESSION, null)
        : null;
      return session && isLiveFollowMode(session.mode) && followCacheKey(session) ? session : null;
    } catch (error) {
      this.logger.warn("saved route session unavailable", error);
      return null;
    }
  }

  private applyGroupIdentity(config: SystemConfig | null): void {
    this.groupName = walkingAppName(config?.group);
    const logo = config?.logos?.images?.find(image => image.originalFileName === config?.header?.selectedLogo);
    this.logoUrl = logo?.awsFileName ? this.urlService.imageSource(logo.awsFileName, true) : null;
  }

  private applyListSnapshot(): boolean {
    const snapshot = this.listCache.snapshot();
    if (snapshot && (snapshot.walks.length || snapshot.routes.length)) {
      this.routes = snapshot.routes;
      this.walks = snapshot.walks;
      this.websiteMapKeys = snapshot.websiteMapKeys;
      this.importedOsMapsByKey = snapshot.importedOsMapsByKey;
      this.previewPoints = snapshot.previewPoints || {};
      this.offlineByKey = snapshot.offlineByKey || {};
      this.loading = false;
      return true;
    } else {
      return false;
    }
  }

  private persistListSnapshot(): void {
    this.listCache.save({
      routes: this.routes,
      walks: this.walks,
      websiteMapKeys: this.websiteMapKeys,
      importedOsMapsByKey: this.importedOsMapsByKey,
      previewPoints: this.previewPoints,
      offlineByKey: this.offlineByKey
    });
  }

  private uniqueByCacheKey(routes: RouteFollowSummary[]): RouteFollowSummary[] {
    return routes.filter((route, index, list) => {
      const key = followCacheKey(route);
      return list.findIndex(item => followCacheKey(item) === key) === index;
    });
  }

  private async load(): Promise<void> {
    const hadSnapshot = this.applyListSnapshot();
    if (!hadSnapshot) {
      this.loading = true;
    }
    let localRoutes: RouteFollowSummary[] = [];
    try {
      const cached = await this.followCache.homeList();
      this.offlineByKey = cached.offlineByKey;
      localRoutes = this.uniqueByCacheKey([...cached.routes, ...this.ramblersLibrary.recentSummaries()]);
      this.previewPoints = hadSnapshot
        ? {...cached.previewPoints, ...this.previewPoints}
        : cached.previewPoints;
    } catch (error) {
      this.logger.warn("cached walks unavailable", error);
    }
    if (!hadSnapshot) {
      this.routes = localRoutes;
    }
    this.loading = false;
    if (navigator.onLine) {
      try {
        const now = this.dateUtils.dateTimeNowNoTime();
        const until = now.plus({days: 90});
        const importedOsMapsPromise = this.osMapsExport.importedRoutes().catch(error => {
          this.logger.warn("imported OS Maps routes unavailable", error);
          return [] as OsMapsListedRoute[];
        });
        const [pages, walks, importedOsMaps] = await firstCompleted(Promise.all([
          this.pageContentService.all({
            criteria: {
              $or: [
                {"rows.type": PageContentType.MAP},
                {"rows.type": PageContentType.ROUTE},
                {"rows.columns.rows.type": PageContentType.MAP},
                {"rows.columns.rows.type": PageContentType.ROUTE},
                {"rows.map.routes.gpxFile.awsFileName": {$exists: true}},
                {"rows.columns.rows.map.routes.gpxFile.awsFileName": {$exists: true}}
              ]
            }
          }),
          this.walkProgrammeService.eventsInRange({
            dateFrom: now.toMillis(),
            dateTo: until.toMillis(),
            walksOnly: true
          }),
          importedOsMapsPromise
        ]), APP_HOME_NETWORK_TIMEOUT_MS, "Walk list network timed out");
        const live = this.payloadService.summariesFromPages(pages || []);
        const imported = (importedOsMaps || [])
          .map(route => this.payloadService.summaryFromOsMapsRoute(route))
          .filter((route): route is RouteFollowSummary => !!route);
        this.importedOsMapsByKey = (importedOsMaps || []).reduce((acc, route) => {
          const key = followCacheKey({osMapsRouteId: route.id});
          return key ? {...acc, [key]: route} : acc;
        }, {} as Record<string, OsMapsListedRoute>);
        this.walks = (walks || []).sort((left, right) => {
          const leftDate = left.groupEvent?.start_date_time || "";
          const rightDate = right.groupEvent?.start_date_time || "";
          return leftDate < rightDate ? -1 : (leftDate > rightDate ? 1 : 0);
        });
        const fromWalks = this.walks
          .map(walk => this.payloadService.summaryFromWalk(walk))
          .filter((route): route is RouteFollowSummary => !!route);
        this.websiteMapKeys = [...live, ...imported, ...fromWalks].map(route => followCacheKey(route)).filter((key): key is string => !!key);
        this.routes = this.uniqueByCacheKey([...imported, ...live, ...fromWalks, ...localRoutes]);
        this.previewPoints = this.routes.reduce((acc, route) => {
          const key = followCacheKey(route);
          const sketch = route.previewPoints || [];
          return key && sketch.length >= 2 && !acc[key] ? {...acc, [key]: sketch} : acc;
        }, this.previewPoints);
        this.logger.info("load: routes", this.routes.length, "walks", this.walks.length);
        this.persistListSnapshot();
      } catch (error) {
        this.logger.warn("online walk list unavailable", error);
        if (!hadSnapshot) {
          this.routes = localRoutes;
        }
      }
    } else {
      if (!hadSnapshot) {
        this.routes = localRoutes;
      }
    }
    this.loading = false;
    this.persistListSnapshot();
    if (this.nearbyOnly) {
      await this.refreshLocation();
    }
  }
}
