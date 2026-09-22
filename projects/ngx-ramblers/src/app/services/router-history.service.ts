import { inject, Injectable } from "@angular/core";
import { NavigationEnd, Params, Router } from "@angular/router";
import { first, isArray, isString } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { filter } from "rxjs/operators";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { PageService } from "./page.service";
import { UrlService } from "./url.service";
import { AppPath } from "../models/route-follow.model";

@Injectable({
  providedIn: "root"
})
export class RouterHistoryService {

  private logger: Logger = inject(LoggerFactory).createLogger("RouterHistoryService", NgxLoggerLevel.ERROR);
  private router = inject(Router);
  private urlService = inject(UrlService);
  private pageService = inject(PageService);
  private readonly pageHistoryStorageKey = "router-page-history";
  public pageHistory: string[] = this.storedPageHistory();
  private pendingAppBackUrl: string | null = null;

  constructor() {
    this.loadRouting();
  }

  public loadRouting(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(({urlAfterRedirects}: NavigationEnd) => {
        if (this.pendingAppBackUrl === urlAfterRedirects) {
          this.pendingAppBackUrl = null;
        } else {
          this.pendingAppBackUrl = null;
          this.pageHistory = [...this.pageHistory, urlAfterRedirects];
        }
        this.savePageHistory();
        this.logger.debug("constructed: pageHistory:urlAfterRedirects", urlAfterRedirects, "history now:", this.pageHistory);
      });
  }

  private storedPageHistory(): string[] {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(this.pageHistoryStorageKey) || "[]");
      return isArray(stored) && stored.every(isString) ? stored : [];
    } catch (error) {
      this.logger.error("storedPageHistory failed", error);
      return [];
    }
  }

  private savePageHistory(): void {
    try {
      window.sessionStorage.setItem(this.pageHistoryStorageKey, JSON.stringify(this.pageHistory));
    } catch (error) {
      this.logger.error("savePageHistory failed", error);
    }
  }

  appBackDestination(): string {
    const current = this.router.url;
    const previous = [...this.pageHistory].reverse().find(url => url !== current);
    return previous || this.walksProgrammeDestination() || "/" + AppPath.ROOT;
  }

  hasAppBackDestination(): boolean {
    return this.pageHistory.some(url => url !== this.router.url) || !!this.walksProgrammeDestination();
  }

  private walksProgrammeDestination(): string | null {
    const walksPath = this.pageService.walksPage()?.href;
    const currentPath = this.router.url.split("?")[0];
    return walksPath && currentPath.startsWith(`/${walksPath}/`) ? `/${walksPath}` : null;
  }

  navigateBackWithinApp(): void {
    const destination = this.appBackDestination();
    const index = this.pageHistory.lastIndexOf(destination);
    if (index >= 0) {
      this.pageHistory = this.pageHistory.slice(0, index + 1);
      this.pendingAppBackUrl = destination;
      this.savePageHistory();
    }
    void this.router.navigateByUrl(destination);
  }

  forgetCurrentPage(): void {
    const current = this.router.url;
    const index = this.pageHistory.lastIndexOf(current);
    if (index >= 0) {
      this.pageHistory = this.pageHistory.filter((url, position) => position !== index);
      this.savePageHistory();
    }
  }

  navigateBackToLastMainPage(unconditionally?: boolean) {
    const validPages: string[] = this.pageService.group.pages.map(page => page.href);
    const lastPage = [...this.pageHistory].reverse()
      .find(page => {
        const pagePortion = first(page.substring(1).split("/"));
        const match = validPages.includes(pagePortion);
        this.logger.debug("event:pagePortion", pagePortion, "of", page, "match ->", match);
        return match;
      });
    this.logger.debug("event:pageHistory", this.pageHistory, "lastPage ->", lastPage);
    if (!lastPage) {
      return;
    }
    const queryIndex = lastPage.indexOf("?");
    const path = queryIndex >= 0 ? lastPage.substring(0, queryIndex) : lastPage;
    const queryString = queryIndex >= 0 ? lastPage.substring(queryIndex + 1) : "";
    const queryParams: Params | undefined = queryString
      ? Object.fromEntries(new URLSearchParams(queryString))
      : undefined;
    if (unconditionally) {
      this.urlService.navigateUnconditionallyTo([path], queryParams);
    } else {
      this.urlService.navigateTo([path], queryParams);
    }

  }

  setRoot() {
    return this.urlService.navigateTo([]);
  }

}
