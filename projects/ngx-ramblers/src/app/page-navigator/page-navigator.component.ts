import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faPersonHiking, faSliders } from "@fortawesome/free-solid-svg-icons";
import { AdminPath } from "../models/admin-route-paths.model";
import { AccessLevel } from "../models/member-resource.model";
import { AppPath } from "../models/route-follow.model";
import { StoredValue } from "../models/ui-actions";
import { MobileAppAction } from "../models/walks-config.model";
import { MobileAppAccessService } from "../services/maps/mobile-app-access.service";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { Link } from "../models/page.model";
import { AccessLevelService } from "../services/access-level.service";
import { BroadcastService } from "../services/broadcast-service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLiteService } from "../services/ngx-lite.service";
import { PageService } from "../services/page.service";
import { UrlService } from "../services/url.service";
import { NgClass } from "@angular/common";
import { RouterLink } from "@angular/router";

const NGX_LITE_SOCIAL_PATHS = ["social-events", "group-events"];

@Component({
    selector: "app-page-navigator",
    templateUrl: "./page-navigator.component.html",
    styleUrls: ["./page-navigator.component.sass"],
    imports: [NgClass, RouterLink, FontAwesomeModule]
})
export class PageNavigatorComponent implements OnInit, OnDestroy {
  protected mobileAppAccess = inject(MobileAppAccessService);
  protected readonly MobileAppAction = MobileAppAction;
  protected readonly AppPath = AppPath;
  protected readonly appSettingsQuery = {[StoredValue.APP_SETTINGS]: true};
  protected readonly faPersonHiking = faPersonHiking;
  protected readonly faSliders = faSliders;


  private readonly inboxLink: Link = {href: AdminPath.INBOX, title: "Inbox", accessLevel: AccessLevel.COMMITTEE};

  private logger: Logger = inject(LoggerFactory).createLogger("PageNavigatorComponent", NgxLoggerLevel.ERROR);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private accessLevelService = inject(AccessLevelService);
  private pageService = inject(PageService);
  private urlService = inject(UrlService);
  private router = inject(Router);
  private ngxLiteService = inject(NgxLiteService);
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.subscriptions.push(this.broadcastService.on(NamedEventType.MEMBER_LOGOUT_COMPLETE, () => {
      this.redirectIfCurrentPageRestricted();
    }));
    this.subscriptions.push(this.broadcastService.on(NamedEventType.MEMBER_LOGIN_COMPLETE, () => {
      this.redirectIfCurrentPageRestricted();
    }));
    this.redirectIfCurrentPageRestricted();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private redirectIfCurrentPageRestricted(): void {
    const firstSegment = this.urlService.firstPathSegment() || "";
    const allPages = this.pageService?.group?.pages || [];
    const currentPage = allPages.find(page => page.href === firstSegment);
    if (currentPage && !this.hasAccess(currentPage)) {
      this.logger.info("redirectIfCurrentPageRestricted:redirecting from restricted page:", firstSegment);
      this.router.navigate(["/"]);
    }
  }

  isOnPage(link: Link): boolean {
    const currentPath = this.router.url.split(/[?#]/)[0];
    const matchingPages = this.pages().filter(page => {
      const path = this.navigationPath(page);
      return currentPath === path || (path !== "/" && currentPath.startsWith(`${path}/`));
    });
    const selectedPage = matchingPages.reduce<Link | null>((selected, page) =>
      !selected || this.navigationPath(page).length > this.navigationPath(selected).length ? page : selected, null);
    return !!selectedPage && this.navigationPath(selectedPage) === this.navigationPath(link);
  }

  private navigationPath(link: Link): string {
    return "/" + (link.href || "").replace(/^\/+|\/+$/g, "");
  }

  pages(): Link[] {
    const configuredPages = (this.pageService?.group?.pages || [])
      .filter(link => this.navigationPath(link) !== this.navigationPath(this.inboxLink));
    return [...configuredPages, this.inboxLink].filter(link => this.hasAccess(link) && this.allowedInNgxLite(link));
  }

  private hasAccess(link: Link): boolean {
    return this.accessLevelService.hasAccess(link);
  }

  private allowedInNgxLite(link: Link): boolean {
    if (!this.ngxLiteService.ngxLite) {
      return true;
    }
    if (NGX_LITE_SOCIAL_PATHS.includes(link.href || "")) {
      return this.ngxLiteService.hasLocalSocialEvents;
    }
    return true;
  }

  unToggleMenu() {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MENU_TOGGLE, false));
  }
}
