import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { take } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { InstagramMediaPost, InstagramRecentMediaData } from "../../models/instagram.model";
import { ExternalSystems } from "../../models/system.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { InstagramService } from "../../services/instagram.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { CardContainerComponent } from "../../modules/common/card-container/card-container.component";
import { DynamicContentComponent } from "../../modules/common/dynamic-content/dynamic-content";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BuiltInAnchor } from "../../models/content-text.model";

@Component({
    selector: "app-instagram",
    templateUrl: "./instagram.component.html",
    styleUrls: ["./instagram.component.sass"],
    imports: [CardContainerComponent, DynamicContentComponent, TooltipDirective]
})
export class InstagramComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("InstagramComponent", NgxLoggerLevel.ERROR);
  private instagramServiceActive = false;
  private instagramService = inject(InstagramService);
  private systemConfigService = inject(SystemConfigService);
  dateUtils = inject(DateUtilsService);
  public recentMedia: InstagramMediaPost[] = [];
  public externalSystems: ExternalSystems;
  private subscriptions: Subscription[] = [];
  protected readonly BuiltInAnchor = BuiltInAnchor;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.externalSystems = item.externalSystems));
    if (this.instagramServiceActive) {
      this.instagramService.recentMedia()
      .then((recentMedia: InstagramRecentMediaData) => {
        this.logger.debug("Refreshed instagram recent media:recentMedia:", recentMedia);
        this.recentMedia = take(recentMedia?.data, 14);
        this.logger.info("Refreshed instagram recent media", this.recentMedia, "count =", this.recentMedia?.length);
      });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  imageWidth(media: InstagramMediaPost): string {
    return this.recentMedia.indexOf(media) <= 1 ? "50%" : "25%";
  }

  imageHeight(media: InstagramMediaPost): string {
    return this.recentMedia.indexOf(media) <= 1 ? "250px" : "130px";
  }
}
