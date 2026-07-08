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
    imports: [NgClass, RouterLink]
})
export class PageNavigatorComponent implements OnInit, OnDestroy {

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
    const firstPathSegment: string = this.urlService.firstPathSegment() || "";
    const isOnPage = firstPathSegment === link?.href;
    this.logger.debug("isOnPage", link, "firstPathSegment", firstPathSegment, "->", isOnPage);
    return isOnPage;
  }

  pages(): Link[] {
    return (this.pageService?.group?.pages || []).filter(link => this.hasAccess(link) && this.allowedInNgxLite(link));
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
