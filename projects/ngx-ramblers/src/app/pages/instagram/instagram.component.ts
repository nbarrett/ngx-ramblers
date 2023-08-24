import { Component, OnDestroy, OnInit } from "@angular/core";
import take from "lodash-es/take";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { InstagramMediaPost, InstagramRecentMediaData } from "../../models/instagram.model";
import { ExternalSystems } from "../../models/system.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { InstagramService } from "../../services/instagram.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";

@Component({
  selector: "app-instagram",
  templateUrl: "./instagram.component.html",
  styleUrls: ["./instagram.component.sass"]
})
export class InstagramComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public recentMedia: InstagramMediaPost[];
  public externalSystems: ExternalSystems;
  private subscriptions: Subscription[] = [];

  constructor(private urlService: UrlService,
              private instagramService: InstagramService,
              private systemConfigService: SystemConfigService,
              public dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("InstagramComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.externalSystems = item.externalSystems));
    this.instagramService.recentMedia()
      .then((recentMedia: InstagramRecentMediaData) => {
        this.recentMedia = take(recentMedia.data, 14);
        this.logger.debug("Refreshed instagram recent media", this.recentMedia, "count =", this.recentMedia.length);
      });
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

  instagramPath() {
    return this.urlService.urlPath(this.externalSystems?.instagram?.groupUrl);
  }
}
