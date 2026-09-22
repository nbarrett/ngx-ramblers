import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { faCircle, faCircleExclamation, faCircleInfo, faEyeSlash, faLocationDot, faMagnifyingGlass, faPersonWalking, faShareNodes, faSliders, faStar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { PageContentType } from "../../models/content-text.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import {
  APP_NEARBY_MILES,
  APP_NEARBY_MILES_MAX,
  AppAppearance,
  AppHomeLayout,
  AppHomeView,
  AppInstallPlatform,
  AppPath,
  firstCompleted,
  followCacheKey,
  isLiveFollowMode,
  ROUTE_FOLLOW_NETWORK_TIMEOUT_MS,
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
import { AppShellService } from "../../services/maps/app-shell.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { WalkProgrammeService } from "../../services/walks-and-events/walk-programme.service";
import { UrlService } from "../../services/url.service";
import { WalkDisplayService } from "../walks/walk-display.service";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { DisplayTimePipe } from "../../pipes/display-time.pipe";
import { StoredValue } from "../../models/ui-actions";
import { UiActionsService } from "../../services/ui-actions.service";
import { OsMapsRoutePreviewMapComponent } from "../walks/walk-admin/os-maps-route-preview-map";
import { OsMapsExportService } from "../../services/maps/os-maps-export.service";
import { OsMapsListedRoute } from "../../models/os-maps-export.model";
import { CurrentLocationService } from "../../services/maps/current-location.service";
import { GeoDistanceService } from "../../services/maps/geo-distance.service";
import { DistanceRangeSlider } from "../../components/distance-range-slider/distance-range-slider";
import { DistanceRange, DistanceUnit } from "../../models/search.model";
import { KM_PER_MILE } from "../../models/walk.model";

@Component({
  selector: "app-home",
  template: `
    <div class="app-home">
      <div class="app-home-header">
        @if (logoUrl) {
          <img class="app-home-logo" [src]="logoUrl" [alt]="groupName">
        }
        <h1 [class.visually-hidden]="!!logoUrl">{{ groupName }}</h1>
        @if (!customising) {
          <div class="app-home-search">
            <fa-icon [icon]="faMagnifyingGlass"/>
            <input type="search" class="form-control" [placeholder]="view === AppHomeView.MAPS ? 'Search maps' : 'Search walks'"
                   [ngModel]="routeSearch" (ngModelChange)="onRouteSearch($event)"
                   [attr.aria-label]="view === AppHomeView.MAPS ? 'Search maps' : 'Search walks'">
          </div>
        }
        <button class="btn btn-icon" type="button" (click)="customising = !customising"
                [class.btn-primary]="customising" [class.btn-quiet]="!customising"
                [attr.aria-expanded]="customising" aria-controls="app-home-customise"
                aria-label="Customise" tooltip="Customise">
          <fa-icon [icon]="faSliders"/>
        </button>
      </div>

      @if (!customising) {
      <div class="app-home-toolbar">
        <div class="app-home-views" role="group" [attr.aria-label]="groupName + ' view'">
          <button class="btn" [class.btn-primary]="view === AppHomeView.MAPS" [class.btn-quiet]="view !== AppHomeView.MAPS"
                  type="button" (click)="chooseView(AppHomeView.MAPS)">Maps</button>
          <button class="btn" [class.btn-primary]="view === AppHomeView.UPCOMING" [class.btn-quiet]="view !== AppHomeView.UPCOMING"
                  type="button" (click)="chooseView(AppHomeView.UPCOMING)">Upcoming</button>
        </div>
        @if (view === AppHomeView.MAPS && layout.savedRoutes) {
          <button class="btn btn-icon" type="button" [attr.aria-pressed]="nearbyOnly"
                  [class.btn-primary]="nearbyOnly" [class.btn-quiet]="!nearbyOnly"
                  aria-label="Near me" tooltip="Near me"
                  (click)="chooseNearby()">
            <fa-icon [icon]="faLocationDot"/>
          </button>
          <button class="btn btn-icon" type="button" [attr.aria-pressed]="favouritesOnly"
                  [class.btn-primary]="favouritesOnly" [class.btn-quiet]="!favouritesOnly"
                  aria-label="Favourites" tooltip="Favourites"
                  (click)="favouritesOnly = !favouritesOnly">
            <fa-icon [icon]="faStar"/>
          </button>
        }
      </div>
      }

      @if (customising) {
        <section id="app-home-customise" class="app-home-customise" [attr.aria-label]="'Choose what appears in ' + groupName">
          <h2>What each view shows</h2>
          <p class="app-home-key">Nothing is created on this phone. Content comes from the group's website, then you follow it here.</p>
          <label class="app-home-customise-item">
            <input type="checkbox" [checked]="layout.savedRoutes" (change)="setLayout('savedRoutes', $event)">
            <span>
              <strong>Maps</strong>
              <span>Maps appear because they were imported from OS Maps, attached to walks on the programme, or created as part of a walk route. Hide a map on this phone only; it stays on the site.</span>
            </span>
          </label>
          <label class="app-home-customise-item">
            <input type="checkbox" [checked]="layout.upcomingWalks" (change)="setLayout('upcomingWalks', $event)">
            <span>
              <strong>Upcoming walks</strong>
              <span>The group's published programme. Walks with a GPX can be followed from here.</span>
            </span>
          </label>
          <label class="app-home-customise-item">
            <input type="checkbox" [checked]="layout.appearance" (change)="setLayout('appearance', $event)">
            <span>
              <strong>Appearance</strong>
              <span>Light, dark, or match the phone.</span>
            </span>
          </label>
          @if (hiddenKeys.length) {
            <button class="btn btn-quiet" type="button" (click)="showHiddenMaps()">Show hidden maps ({{ hiddenKeys.length }})</button>
          }
        </section>
      }

      @if (!customising && view === AppHomeView.MAPS && layout.savedRoutes) {
        @if (nearbyOnly) {
          <app-distance-range-slider class="app-home-nearby-slider"
            label="Within"
            [singleThumb]="true"
            [minValue]="1"
            [maxValue]="APP_NEARBY_MILES_MAX"
            [range]="nearbyRange"
            (rangeChange)="onNearbyRange($event)"/>
        }
        @if (locationError) {
          <p class="app-home-empty">{{ locationError }}</p>
        }
      }

      @if (!customising && view === AppHomeView.MAPS && layout.savedRoutes && activeSession) {
        <section class="app-home-section">
          <h2>Continue your route</h2>
          <a class="app-home-card" [routerLink]="'/' + AppPath.ROOT + '/' + AppPath.FOLLOW"
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
            <strong>Add this to your Home Screen</strong>
            @if (platform === AppInstallPlatform.IOS) {
              <p>Tap <fa-icon [icon]="faShareNodes"/> Share, then Add to Home Screen. It then opens like an app, with no website header.</p>
            } @else if (platform === AppInstallPlatform.ANDROID) {
              <p>Tap Install, or open the browser menu and choose Add to Home screen / Install app.</p>
            } @else {
              <p>Open this page on your phone, then add it to your Home Screen for the full-screen app.</p>
            }
            @if (canInstall) {
              <button class="btn btn-primary app-home-install-btn" type="button" (click)="install()">Install app</button>
            }
          </div>
        </section>
      }

      @if (!customising && view === AppHomeView.MAPS && layout.savedRoutes) {
        <section class="app-home-section">
          <h2 class="visually-hidden">Maps</h2>
          @for (route of visibleRoutes(); track routeKey(route)) {
            <div class="app-home-card">
              <a class="app-home-route-main" [routerLink]="'/' + AppPath.ROOT + '/' + AppPath.FOLLOW"
                 [queryParams]="routeQuery(route)">
                <app-os-maps-route-preview-map [compact]="true" [route]="listedOsMapsRoute(route)" [points]="previewPoints[routeKey(route) || ''] || []"/>
              <div class="app-home-card-copy">
                <h3>{{ route.title }}</h3>
                <p class="app-home-meta">
                  @if (milesAwayLabel(route)) {
                    {{ milesAwayLabel(route) }}
                  }
                  @if (route.distanceMiles) {
                    @if (milesAwayLabel(route)) {
                      ·
                    }
                    {{ route.distanceMiles | number:'1.0-1' }} miles
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
              </div>
              </a>
              <div class="app-home-route-actions">
                <button class="btn btn-icon app-home-favourite" type="button"
                        [attr.aria-label]="isFavourite(route) ? 'Remove from favourites' : 'Add to favourites'"
                        [attr.aria-pressed]="isFavourite(route)" tooltip="Favourite"
                        (click)="toggleFavourite(route)">
                  <fa-icon [icon]="faStar"/>
                </button>
                <button class="btn btn-quiet btn-icon" type="button"
                        [attr.aria-label]="isWebsiteMap(route) ? 'Hide' : 'Remove'"
                        [tooltip]="isWebsiteMap(route) ? 'Hide' : 'Remove'"
                        (click)="removeSavedRoute(route)">
                  <fa-icon [icon]="faEyeSlash"/>
                </button>
              </div>
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
        } @else if (walks.length === 0) {
          <p class="app-home-empty">There are no upcoming walks on the programme. When walks are published on the website, they appear here.</p>
        } @else if (visibleWalks().length === 0) {
          <p class="app-home-empty">No walks match that search.</p>
        }
        @for (walk of visibleWalks(); track walk.id) {
          <article class="app-home-card">
            <div class="app-home-card-copy">
              <h3>{{ walk.groupEvent?.title }}</h3>
              <p class="app-home-meta">
                {{ walk.groupEvent?.start_date_time | displayDate }}
                ·
                {{ walk.groupEvent?.start_date_time | displayTime }}
                @if (walk.groupEvent?.distance_miles) {
                  · {{ walk.groupEvent.distance_miles }} miles
                }
              </p>
              @if (walk.groupEvent?.start_location?.description || walk.groupEvent?.start_location?.postcode) {
                <p class="app-home-meta">{{ walk.groupEvent?.start_location?.description || walk.groupEvent?.start_location?.postcode }}</p>
              }
            </div>
            <div class="app-home-route-actions">
              @if (payloadService.walkHasGpx(walk)) {
                <a class="btn btn-primary btn-icon" [routerLink]="'/' + AppPath.ROOT + '/' + AppPath.FOLLOW"
                   [queryParams]="walkQuery(walk)" aria-label="Follow" tooltip="Follow">
                  <fa-icon [icon]="faPersonWalking"/>
                </a>
              } @else if (canRecordWalk(walk)) {
                <a class="btn btn-primary btn-icon" [routerLink]="'/' + AppPath.ROOT + '/' + AppPath.FOLLOW"
                   [queryParams]="walkQuery(walk)" aria-label="Record route" tooltip="Record route">
                  <fa-icon class="red-icon" [icon]="faCircle"/>
                </a>
              }
              <a class="btn btn-quiet btn-icon" [routerLink]="walkDetailsLink(walk)"
                 aria-label="Walk details" tooltip="Walk details">
                <fa-icon [icon]="faCircleInfo"/>
              </a>
            </div>
          </article>
        }
      </section>
      }

      @if (!customising && layout.appearance) {
      <section class="app-home-section">
        <h2>Appearance</h2>
        <div class="app-home-appearance" role="group" aria-label="Appearance">
          <button type="button" class="btn btn-sm app-home-appearance-btn"
                  [class.btn-primary]="appearance === AppAppearance.SYSTEM"
                  [class.btn-quiet]="appearance !== AppAppearance.SYSTEM"
                  (click)="chooseAppearance(AppAppearance.SYSTEM)">
            Match phone
          </button>
          <button type="button" class="btn btn-sm app-home-appearance-btn"
                  [class.btn-primary]="appearance === AppAppearance.LIGHT"
                  [class.btn-quiet]="appearance !== AppAppearance.LIGHT"
                  (click)="chooseAppearance(AppAppearance.LIGHT)">
            Light
          </button>
          <button type="button" class="btn btn-sm app-home-appearance-btn"
                  [class.btn-primary]="appearance === AppAppearance.DARK"
                  [class.btn-quiet]="appearance !== AppAppearance.DARK"
                  (click)="chooseAppearance(AppAppearance.DARK)">
            Dark
          </button>
        </div>
      </section>
      }
    </div>
  `,
  styleUrls: ["./app-home.sass"],
  imports: [RouterLink, FormsModule, FontAwesomeModule, DisplayDatePipe, DisplayTimePipe, OsMapsRoutePreviewMapComponent, TooltipModule, DecimalPipe, DistanceRangeSlider]
})
export class AppHomeComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("AppHomeComponent", NgxLoggerLevel.ERROR);
  private pageContentService = inject(PageContentService);
  private walkProgrammeService = inject(WalkProgrammeService);
  private dateUtils = inject(DateUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private urlService = inject(UrlService);
  private appShell = inject(AppShellService);
  private ramblersLibrary = inject(RamblersLibraryRouteService);
  private osMapsExport = inject(OsMapsExportService);
  private currentLocation = inject(CurrentLocationService);
  private geoDistance = inject(GeoDistanceService);
  private followCache = inject(RouteFollowCacheService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private uiActions = inject(UiActionsService);
  protected display = inject(WalkDisplayService);
  protected payloadService = inject(RouteFollowPayloadService);
  protected routes: RouteFollowSummary[] = [];
  protected layout: AppHomeLayout = {savedRoutes: true, upcomingWalks: true, appearance: false};
  protected readonly APP_NEARBY_MILES_MAX = APP_NEARBY_MILES_MAX;
  protected readonly AppHomeView = AppHomeView;
  protected view = AppHomeView.MAPS;
  protected favouritesOnly = false;
  protected nearbyOnly = false;
  protected nearbyMiles = APP_NEARBY_MILES;
  protected nearbyRange: DistanceRange = {min: 1, max: APP_NEARBY_MILES, unit: DistanceUnit.MILES};
  protected routeSearch = "";
  protected here: {latitude: number; longitude: number} | null = null;
  protected locationError: string | null = null;
  protected favouriteKeys: string[] = [];
  protected hiddenKeys: string[] = [];
  protected websiteMapKeys: string[] = [];
  protected importedOsMapsByKey: Record<string, OsMapsListedRoute> = {};
  protected previewPoints: Record<string, RouteFollowPoint[]> = {};
  protected customising = false;

  protected walks: ExtendedGroupEvent[] = [];
  protected loading = true;
  protected showInstallHint = false;
  protected canInstall = false;
  protected platform: AppInstallPlatform = AppInstallPlatform.OTHER;
  protected groupName = "Ramblers";
  protected logoUrl: string | null = null;
  protected offlineByKey: Record<string, RouteFollowOfflineStatus> = {};
  protected activeSession: RouteFollowSession | null = null;
  protected readonly faCircle = faCircle;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faEyeSlash = faEyeSlash;
  protected readonly faLocationDot = faLocationDot;
  protected readonly faMagnifyingGlass = faMagnifyingGlass;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly faShareNodes = faShareNodes;
  protected readonly faSliders = faSliders;
  protected readonly faStar = faStar;
  protected readonly AppPath = AppPath;
  protected readonly AppInstallPlatform = AppInstallPlatform;
  protected readonly AppAppearance = AppAppearance;
  protected appearance: AppAppearance = AppAppearance.SYSTEM;
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.layout = {...this.layout, ...this.uiActions.initialObjectValueFor<Partial<AppHomeLayout>>(StoredValue.APP_HOME_LAYOUT, {})};
    this.favouriteKeys = this.uiActions.initialObjectValueFor<string[]>(StoredValue.APP_FAVOURITE_ROUTES, []);
    this.hiddenKeys = this.uiActions.initialObjectValueFor<string[]>(StoredValue.APP_HIDDEN_ROUTES, []);
    this.view = this.activatedRoute.snapshot.queryParamMap.get(StoredValue.TAB) === AppHomeView.UPCOMING ? AppHomeView.UPCOMING : AppHomeView.MAPS;
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
    this.showInstallHint = !this.appShell.installed();
    this.canInstall = this.appShell.canPromptInstall();
    this.subscriptions.push(this.appShell.installAvailable$.subscribe(available => {
      this.canInstall = available;
    }));
    this.subscriptions.push(this.appShell.appearance$.subscribe(appearance => {
      this.appearance = appearance;
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe((config: SystemConfig) => {
      this.groupName = config?.group?.longName || config?.group?.shortName || "Ramblers";
      const logo = config?.logos?.images?.find(image => image.originalFileName === config?.header?.selectedLogo);
      this.logoUrl = logo?.awsFileName ? this.urlService.resourceRelativePathForAWSFileName(logo.awsFileName) : null;
    }));
    this.activeSession = this.activeFollowSession();
    const coldLaunch = !this.router.lastSuccessfulNavigation()?.previousNavigation;
    if (!coldLaunch || !this.resumeActiveFollowSession()) {
      void this.load();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  install(): void {
    void this.appShell.promptInstall();
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
    this.hiddenKeys = [];
    this.uiActions.saveValueFor(StoredValue.APP_HIDDEN_ROUTES, this.hiddenKeys);
    this.layout = {...this.layout, savedRoutes: true};
    this.uiActions.saveValueFor(StoredValue.APP_HOME_LAYOUT, this.layout);
  }

  routeKey(route: RouteFollowSummary): string | null {
    return followCacheKey(route);
  }

  visibleWalks(): ExtendedGroupEvent[] {
    const needle = this.routeSearch.trim().toLowerCase();
    if (needle.length === 0) {
      return this.walks;
    } else {
      return this.walks.filter(walk => (walk.groupEvent?.title || "").toLowerCase().includes(needle));
    }
  }

  visibleRoutes(): RouteFollowSummary[] {
    const needle = this.routeSearch.trim().toLowerCase();
    const shown = this.routes.filter(route => {
      const key = this.routeKey(route) || "";
      const visible = !this.hiddenKeys.includes(key);
      const favourite = !this.favouritesOnly || this.isFavourite(route);
      const named = needle.length === 0 || (route.title || "").toLowerCase().includes(needle);
      const nearby = !this.nearbyOnly || this.isNearby(route);
      return visible && favourite && named && nearby;
    });
    return this.nearbyOnly ? [...shown].sort((left, right) => (this.milesAway(left) ?? 9999) - (this.milesAway(right) ?? 9999)) : shown;
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

  nearbyEmptyMessage(): string {
    const unit = this.nearbyRange.unit === DistanceUnit.KILOMETERS ? "km" : "miles";
    const value = this.nearbyRange.max.toFixed(this.nearbyRange.max % 1 === 0 ? 0 : 1);
    return "No maps within " + value + " " + unit + " of you.";
  }

  onRouteSearch(value: string): void {
    this.routeSearch = value;
    void this.uiActions.updateQueryParameter(StoredValue.SEARCH, value.trim() ? value : null);
  }

  onNearbyRange(range: DistanceRange): void {
    this.nearbyRange = range;
    this.nearbyMiles = range.unit === DistanceUnit.KILOMETERS ? range.max / KM_PER_MILE : range.max;
    void this.uiActions.updateQueryParameter(StoredValue.NEARBY_MILES, this.nearbyMiles);
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
    const miles = this.milesAway(route);
    if (miles === null) {
      return null;
    } else if (miles < 0.1) {
      return "Here";
    } else if (miles < 1) {
      return "Under a mile away";
    } else {
      return miles.toFixed(1) + " miles away";
    }
  }

  private async refreshLocation(): Promise<void> {
    const position = await this.currentLocation.currentPosition();
    if (position) {
      this.here = {latitude: position.lat, longitude: position.lng};
      this.locationError = null;
    } else {
      this.here = null;
      this.locationError = "Location is not available, so Near me cannot filter the list.";
    }
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
      return this.geoDistance.calculateDistanceMiles(this.here, start);
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
    const key = this.routeKey(route);
    return !!key && this.favouriteKeys.includes(key);
  }

  toggleFavourite(route: RouteFollowSummary): void {
    const key = this.routeKey(route);
    if (key) {
      this.favouriteKeys = this.favouriteKeys.includes(key)
        ? this.favouriteKeys.filter(item => item !== key)
        : [...this.favouriteKeys, key];
      this.uiActions.saveValueFor(StoredValue.APP_FAVOURITE_ROUTES, this.favouriteKeys);
    }
  }

  async removeSavedRoute(route: RouteFollowSummary): Promise<void> {
    const key = this.routeKey(route);
    try {
      if (key && this.isWebsiteMap(route)) {
        this.hiddenKeys = [...this.hiddenKeys, key];
        this.uiActions.saveValueFor(StoredValue.APP_HIDDEN_ROUTES, this.hiddenKeys);
      } else if (key) {
        await this.followCache.remove(key);
      }
      if (route.ramblersSlug && !this.isWebsiteMap(route)) {
        this.ramblersLibrary.forget(route.ramblersSlug);
      }
      if (!this.isWebsiteMap(route)) {
        this.routes = this.routes.filter(item => this.routeKey(item) !== key);
        this.favouriteKeys = this.favouriteKeys.filter(item => item !== key);
        this.uiActions.saveValueFor(StoredValue.APP_FAVOURITE_ROUTES, this.favouriteKeys);
      }
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

  routeQuery(route: RouteFollowSummary | RouteFollowSession): Record<string, string> {
    const params: Record<string, string> = {};
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
    return params;
  }

  private resumeActiveFollowSession(): boolean {
    if (this.activeSession) {
      void this.router.navigate(["/" + AppPath.ROOT, AppPath.FOLLOW], {
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

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const cached = await this.followCache.summaries();
      const previews = await Promise.all(cached.map(async route => {
        const key = followCacheKey(route);
        const payload = key ? await this.followCache.payload(key) : null;
        return {key, points: payload?.points || []};
      }));
      this.previewPoints = previews.reduce((acc, preview) => preview.key ? {...acc, [preview.key]: preview.points} : acc, {} as Record<string, RouteFollowPoint[]>);
      this.routes = [...cached, ...this.ramblersLibrary.recentSummaries()].filter((route, index, list) => {
        const key = followCacheKey(route);
        return list.findIndex(item => followCacheKey(item) === key) === index;
      });
      this.offlineByKey = await this.followCache.statusByKey();
    } catch (error) {
      this.logger.warn("cached walks unavailable", error);
    }
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
        ]), ROUTE_FOLLOW_NETWORK_TIMEOUT_MS, "Walk list network timed out");
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
        this.routes = [...imported, ...live, ...fromWalks, ...this.routes].filter((route, index, list) => {
          const key = followCacheKey(route);
          return list.findIndex(item => followCacheKey(item) === key) === index;
        });
        this.logger.info("load: routes", this.routes.length, "walks", this.walks.length);
      } catch (error) {
        this.logger.warn("online walk list unavailable", error);
      }
    }
    this.loading = false;
  }
}
