import { inject, Injectable } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { filter } from "rxjs/operators";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { PageService } from "./page.service";
import { UrlService } from "./url.service";

@Injectable({
  providedIn: "root"
})
export class RouterHistoryService {

  private logger: Logger = inject(LoggerFactory).createLogger("RouterHistoryService", NgxLoggerLevel.ERROR);
  private router = inject(Router);
  private urlService = inject(UrlService);
  private pageService = inject(PageService);
  public pageHistory: string[] = [];

  constructor() {
    this.loadRouting();
  }

  public loadRouting(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(({urlAfterRedirects}: NavigationEnd) => {
        this.pageHistory = [...this.pageHistory, urlAfterRedirects];
        this.logger.debug("constructed: pageHistory:urlAfterRedirects", urlAfterRedirects, "history now:", this.pageHistory);
      });
  }

  navigateBackToLastMainPage(unconditionally?: boolean) {
    const validPages: string[] = this.pageService.group.pages.map(page => page.href);
    const lastPage = this.pageHistory.reverse()
      .find(page => {
        const pagePortion = first(page.substring(1).split("/"));
        const match = validPages.includes(pagePortion);
        this.logger.debug("event:pagePortion", pagePortion, "of", page, "match ->", match);
        return match;
      });
    this.logger.debug("event:pageHistory", this.pageHistory, "lastPage ->", lastPage);
    if (unconditionally) {
      this.urlService.navigateUnconditionallyTo([lastPage]);
    } else {
      this.urlService.navigateTo([lastPage]);
    }

  }

  setRoot() {
    return this.urlService.navigateTo([]);
  }

}
