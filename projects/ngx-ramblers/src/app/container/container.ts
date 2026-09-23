import { Component, HostListener, inject, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { SystemConfig } from "../models/system.model";
import { SystemConfigService } from "../services/system/system-config.service";
import { HeaderBarComponent } from "../header-bar/header-bar";
import { NavbarComponent } from "../modules/common/navbar/navbar";
import { RouterOutlet } from "@angular/router";
import { FooterComponent } from "../footer/footer";
import { DataPopulationService } from "../pages/admin/data-population.service";
import { VersionCheckService } from "../services/version-check.service";
import { CanonicalLinkService } from "../services/canonical-link.service";
import { AppShellService } from "../services/maps/app-shell.service";
import { UrlService } from "../services/url.service";
import { RejoinMeetingBannerComponent } from "../pages/video-meetings/rejoin-meeting-banner";
import { NewVersionBannerComponent } from "../modules/common/new-version-banner/new-version-banner";
import { PullToRefreshComponent } from "../modules/common/pull-to-refresh/pull-to-refresh";
import { RouterHistoryService } from "../services/router-history.service";
import { Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faCheck, faCircleExclamation, faHouse, faShareNodes } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { nativeShareSupported } from "../functions/native-share";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../services/logger-factory.service";

@Component({
    selector: "app-root",
    template: `
    <app-pull-to-refresh/>
    <div class="app-page-shift">
    @if (!appShellActive) {
      @if (config?.header?.headerBar?.show) {
        <app-header-bar/>
      }
    }
    <div [class.app-shell]="appShellActive" [class.container]="!appShellActive">
      @if (!appShellActive) {
        <app-navbar/>
        <app-rejoin-meeting-banner/>
        <app-new-version-banner/>
      }
      <router-outlet/>
      @if (showFloatingNavigation()) {
        <button class="btn btn-primary btn-icon app-floating-navigation" type="button" (click)="navigateFloating()"
                [attr.aria-label]="floatingBackAvailable() ? 'Back' : 'Home'"
                [tooltip]="floatingBackAvailable() ? 'Back' : 'Home'">
          <fa-icon [icon]="floatingBackAvailable() ? faArrowLeft : faHouse"/>
        </button>
      }
      @if (showFloatingShare()) {
        <button class="btn btn-primary btn-icon app-floating-navigation app-floating-share" type="button" (click)="shareCurrentPage()"
                [attr.aria-label]="shareFeedback || 'Share or copy link'" [tooltip]="shareFeedback || 'Share or copy link'">
          <fa-icon [icon]="shareFeedback === 'Link copied' ? faCheck : shareFeedback ? faCircleExclamation : faShareNodes"/>
        </button>
        <span class="visually-hidden" role="status">{{ shareFeedback }}</span>
      }
    </div>
    @if (!appShellActive) {
      <app-footer/>
    }
    </div>
    `,
    styleUrls: ["./container.sass"],
    imports: [HeaderBarComponent, NavbarComponent, RouterOutlet, FooterComponent, RejoinMeetingBannerComponent, NewVersionBannerComponent, PullToRefreshComponent, FontAwesomeModule, TooltipModule]
})
export class ContainerComponent implements OnInit, OnDestroy {
  private routerHistory = inject(RouterHistoryService);
  private router = inject(Router);
  private logger: Logger = inject(LoggerFactory).createLogger("ContainerComponent", NgxLoggerLevel.ERROR);
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faCheck = faCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faHouse = faHouse;
  protected readonly faShareNodes = faShareNodes;
  protected shareFeedback: string | null = null;
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private dataPopulationService = inject(DataPopulationService);
  private versionCheckService = inject(VersionCheckService);
  private canonicalLinkService = inject(CanonicalLinkService);
  protected appShell = inject(AppShellService);
  private urlService = inject(UrlService);
  private subscriptions: Subscription[] = [];

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    this.urlService.handleOwnSiteClick(event);
  }
  protected config: SystemConfig;
  protected appShellActive = false;

  protected showFloatingNavigation(): boolean {
    const path = this.router.url.split("?")[0];
    return this.appShell.installed() && path !== "/" && path !== "/home" && !path.startsWith("/app/follow");
  }

  protected showFloatingShare(): boolean {
    return this.appShell.installed() && !this.router.url.split("?")[0].startsWith("/app/follow");
  }

  protected floatingBackAvailable(): boolean {
    const path = this.router.url.split("?")[0];
    return path !== "/app" && this.routerHistory.hasAppBackDestination();
  }

  protected navigateFloating(): void {
    if (this.floatingBackAvailable()) {
      this.routerHistory.navigateBackWithinApp();
    } else {
      void this.router.navigateByUrl("/");
    }
  }

  protected async shareCurrentPage(): Promise<void> {
    const url = window.location.href;
    this.shareFeedback = null;
    if (nativeShareSupported()) {
      try {
        await navigator.share({title: document.title, url});
      } catch (error) {
        if ((error as DOMException)?.name !== "AbortError") {
          this.logger.warn("shareCurrentPage failed", error);
          await this.copyCurrentPageUrl(url);
        }
      }
    } else {
      await this.copyCurrentPageUrl(url);
    }
  }

  private async copyCurrentPageUrl(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.shareFeedback = "Link copied";
    } catch (error) {
      this.logger.error("copyCurrentPageUrl failed", error);
      this.shareFeedback = "Unable to copy link";
    }
  }

  ngOnInit() {
    this.dataPopulationService.clearLegacyLocalStorage();
    this.versionCheckService.initialise();
    this.canonicalLinkService.initialise();
    this.appShellActive = this.appShell.active();
    this.subscriptions.push(this.appShell.active$.subscribe(active => {
      this.appShellActive = active;
    }));
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.appShell.applyHomeScreenIdentity(config?.group?.shortName || config?.group?.longName);
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


}
