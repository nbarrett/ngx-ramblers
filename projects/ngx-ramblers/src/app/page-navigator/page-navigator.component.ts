import { Component } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { Link } from "../models/page.model";
import { BroadcastService } from "../services/broadcast-service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { PageService } from "../services/page.service";
import { UrlService } from "../services/url.service";

@Component({
  selector: "app-page-navigator",
  templateUrl: "./page-navigator.component.html",
  styleUrls: ["./page-navigator.component.sass"]

})
export class PageNavigatorComponent {
  private logger: Logger;

  constructor(private broadcastService: BroadcastService<boolean>,
              private pageService: PageService,
              private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(PageNavigatorComponent, NgxLoggerLevel.OFF);
  }

  isOnPage(link: Link): boolean {
    const firstPathSegment: string = this.urlService.firstPathSegment() || "";
    const isOnPage = firstPathSegment === link?.href;
    this.logger.debug("isOnPage", link, "firstPathSegment", firstPathSegment, "->", isOnPage);
    return isOnPage;
  }

  pages(): Link[] {
    return this.pageService?.group?.pages || [];
  }

  unToggleMenu() {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MENU_TOGGLE, false));
  }
}
