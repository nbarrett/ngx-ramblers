import { Component, inject } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { Link } from "../models/page.model";
import { BroadcastService } from "../services/broadcast-service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { PageService } from "../services/page.service";
import { UrlService } from "../services/url.service";
import { NgClass } from "@angular/common";
import { RouterLink } from "@angular/router";

@Component({
    selector: "app-page-navigator",
    templateUrl: "./page-navigator.component.html",
    styleUrls: ["./page-navigator.component.sass"],
    imports: [NgClass, RouterLink]
})
export class PageNavigatorComponent {

  private logger: Logger = inject(LoggerFactory).createLogger("PageNavigatorComponent", NgxLoggerLevel.ERROR);
  private broadcastService = inject<BroadcastService<boolean>>(BroadcastService);
  private pageService = inject(PageService);
  private urlService = inject(UrlService);

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
