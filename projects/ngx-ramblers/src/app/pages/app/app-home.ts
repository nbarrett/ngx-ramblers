import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { faCircleExclamation, faPersonWalking, faShareNodes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { PageContentType } from "../../models/content-text.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import {
  AppAppearance,
  AppInstallPlatform,
  AppPath,
  followCacheKey,
  RouteFollowOfflineStatus,
  RouteFollowQueryParam,
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
import { WalkDisplayService } from "../walks/walk-display.service";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { DisplayTimePipe } from "../../pipes/display-time.pipe";

@Component({
  selector: "app-home",
  template: `
    <div class="app-home">
      <div class="app-home-header">
        <p class="app-home-kicker">{{ groupName }}</p>
        <h1>Walks</h1>
        <p class="app-home-lead">Pick a walk, then tap Follow. Or paste a Ramblers route link.</p>
      </div>

      <form class="app-home-open" (submit)="openRamblersRoute($event)">
        <label class="app-home-open-label" for="ramblers-route-url">Ramblers route</label>
        <input id="ramblers-route-url"
               class="form-control app-home-open-input"
               type="text"
               name="ramblersUrl"
               [(ngModel)]="ramblersUrl"
               placeholder="https://www.ramblers.org.uk/go-walking/routes/egerton-kent"
               autocomplete="off"
               inputmode="url">
        <button class="btn btn-primary app-home-open-btn" type="submit" [disabled]="openingRamblers">
          {{ openingRamblers ? "Opening…" : "Follow this Ramblers route" }}
        </button>
        @if (ramblersError) {
          <p class="app-home-open-error">{{ ramblersError }}</p>
        }
      </form>

      @if (showInstallHint) {
        <section class="app-home-install">
          <fa-icon [icon]="faCircleExclamation"/>
          <div>
            <strong>Add this to your Home Screen</strong>
            @if (platform === AppInstallPlatform.IOS) {
              <p>Tap <fa-icon [icon]="faShareNodes"/> Share, then Add to Home Screen. It then opens like an app, with no website header.</p>
            } @else if (platform === AppInstallPlatform.ANDROID) {
              <p>Tap Install, or open the browser menu and choose Add to Home screen / Install app.</p>
            } @else {
              <p>Open this page on your phone, then add it to your Home Screen for the full-screen walking app.</p>
            }
            @if (canInstall) {
              <button class="btn btn-primary app-home-install-btn" type="button" (click)="install()">Install app</button>
            }
          </div>
        </section>
      }

      @if (routes.length > 0) {
        <section class="app-home-section">
          <h2>Follow a route</h2>
          @for (route of routes; track route.path || route.routeId) {
            <a class="app-home-card" [routerLink]="'/' + AppPath.ROOT + '/' + AppPath.FOLLOW"
               [queryParams]="routeQuery(route)">
              <div class="app-home-card-copy">
                <h3>{{ route.title }}</h3>
                <p class="app-home-meta">
                  @if (route.distanceMiles) {
                    {{ route.distanceMiles }} miles
                  }
                  @if (route.startDescription) {
                    @if (route.distanceMiles) {
                      ·
                    }
                    {{ route.startDescription }}
                  }
                </p>
                <p class="app-home-offline">{{ offlineLabel(route) }}</p>
              </div>
              <span class="btn btn-primary app-home-card-btn">
                <fa-icon [icon]="faPersonWalking"/>Follow
              </span>
            </a>
          }
        </section>
      }

      <section class="app-home-section">
        <h2>Upcoming walks</h2>
        @if (loading) {
          <p class="app-home-empty">Finding walks…</p>
        } @else if (walks.length === 0) {
          <p class="app-home-empty">There are no upcoming walks on the programme.</p>
        }
        @for (walk of walks; track walk.id) {
          <article class="app-home-card app-home-card-stack">
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
              @if (payloadService.walkHasGpx(walk)) {
                <p class="app-home-offline">{{ offlineLabelForWalk(walk) }}</p>
              }
            </div>
            <div class="app-home-actions">
              @if (payloadService.walkHasGpx(walk)) {
                <a class="btn btn-primary app-home-card-btn" [routerLink]="'/' + AppPath.ROOT + '/' + AppPath.FOLLOW"
                   [queryParams]="walkQuery(walk)">
                  <fa-icon [icon]="faPersonWalking"/>Follow
                </a>
                <a class="app-home-details" [routerLink]="walkDetailsLink(walk)">Walk details</a>
              } @else if (canRecordWalk(walk)) {
                <a class="btn btn-primary app-home-card-btn" [routerLink]="'/' + AppPath.ROOT + '/' + AppPath.FOLLOW"
                   [queryParams]="walkQuery(walk)">
                  Record route
                </a>
                <a class="app-home-details" [routerLink]="walkDetailsLink(walk)">Walk details</a>
              } @else {
                <a class="btn btn-primary app-home-card-btn" [routerLink]="walkDetailsLink(walk)">Walk details</a>
              }
            </div>
          </article>
        }
      </section>

      <section class="app-home-section">
        <h2>Website</h2>
        <div class="app-home-appearance">
          <a class="btn btn-quiet btn-sm app-home-appearance-btn" href="/">Home</a>
          <a class="btn btn-quiet btn-sm app-home-appearance-btn" href="/admin">Admin</a>
        </div>
      </section>

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
    </div>
  `,
  styleUrls: ["./app-home.sass"],
  imports: [RouterLink, FormsModule, FontAwesomeModule, DisplayDatePipe, DisplayTimePipe]
})
export class AppHomeComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("AppHomeComponent", NgxLoggerLevel.ERROR);
  private pageContentService = inject(PageContentService);
  private walkProgrammeService = inject(WalkProgrammeService);
  private dateUtils = inject(DateUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private appShell = inject(AppShellService);
  private ramblersLibrary = inject(RamblersLibraryRouteService);
  private followCache = inject(RouteFollowCacheService);
  private router = inject(Router);
  protected display = inject(WalkDisplayService);
  protected payloadService = inject(RouteFollowPayloadService);
  protected routes: RouteFollowSummary[] = [];
  protected walks: ExtendedGroupEvent[] = [];
  protected loading = true;
  protected showInstallHint = false;
  protected canInstall = false;
  protected platform: AppInstallPlatform = AppInstallPlatform.OTHER;
  protected groupName = "Ramblers";
  protected ramblersUrl = "";
  protected ramblersError: string | null = null;
  protected openingRamblers = false;
  protected offlineByKey: Record<string, RouteFollowOfflineStatus> = {};
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly faShareNodes = faShareNodes;
  protected readonly AppPath = AppPath;
  protected readonly AppInstallPlatform = AppInstallPlatform;
  protected readonly AppAppearance = AppAppearance;
  protected appearance: AppAppearance = AppAppearance.SYSTEM;
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
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
    }));
    void this.load();
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

  async openRamblersRoute(event: Event): Promise<void> {
    event.preventDefault();
    this.ramblersError = null;
    this.openingRamblers = true;
    try {
      const route = await this.ramblersLibrary.lookup(this.ramblersUrl);
      await this.router.navigate(["/" + AppPath.ROOT, AppPath.FOLLOW], {
        queryParams: {[RouteFollowQueryParam.RAMBLERS_SLUG]: route.slug}
      });
    } catch (error) {
      this.logger.error("openRamblersRoute failed", error);
      this.ramblersError = "That Ramblers route could not be opened. Check the link and try again.";
    }
    this.openingRamblers = false;
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
    return slug ? {[RouteFollowQueryParam.WALK_ID]: slug} : {};
  }

  walkDetailsLink(walk: ExtendedGroupEvent): string[] {
    const area = (this.display.groupEventArea() || "walks").replace(/^\/+/, "");
    return ["/" + area, this.display.walkSlug(walk)];
  }

  routeQuery(route: RouteFollowSummary): Record<string, string> {
    const params: Record<string, string> = {};
    if (route.path) {
      params[RouteFollowQueryParam.PATH] = route.path;
    }
    if (route.routeId) {
      params[RouteFollowQueryParam.ROUTE_ID] = route.routeId;
    }
    if (route.ramblersSlug) {
      params[RouteFollowQueryParam.RAMBLERS_SLUG] = route.ramblersSlug;
    }
    return params;
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const now = this.dateUtils.dateTimeNowNoTime();
      const until = now.plus({days: 90});
      const [pages, walks] = await Promise.all([
        this.pageContentService.all({
          criteria: {
            $or: [
              {"rows.type": PageContentType.MAP},
              {"rows.type": PageContentType.ROUTE},
              {"rows.map.routes.gpxFile.awsFileName": {$exists: true}}
            ]
          }
        }),
        this.walkProgrammeService.eventsInRange({
          dateFrom: now.toMillis(),
          dateTo: until.toMillis(),
          walksOnly: true
        })
      ]);
      this.offlineByKey = await this.followCache.statusByKey();
      const live = [
        ...this.ramblersLibrary.recentSummaries(),
        ...this.payloadService.summariesFromPages(pages || [])
      ];
      const cached = navigator.onLine ? [] : await this.followCache.summaries();
      this.routes = [...cached, ...live].filter((route, index, list) => {
        const key = followCacheKey(route);
        return list.findIndex(item => followCacheKey(item) === key) === index;
      });
      this.walks = (walks || []).sort((left, right) => {
        const leftDate = left.groupEvent?.start_date_time || "";
        const rightDate = right.groupEvent?.start_date_time || "";
        return leftDate < rightDate ? -1 : (leftDate > rightDate ? 1 : 0);
      });
      this.logger.info("load: routes", this.routes.length, "walks", this.walks.length);
    } catch (error) {
      this.logger.error("load failed", error);
      this.routes = [];
      this.walks = [];
    }
    this.loading = false;
  }
}
