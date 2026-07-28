import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { take } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faSpinner } from "@fortawesome/free-solid-svg-icons";
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
  imports: [CardContainerComponent, DynamicContentComponent, TooltipDirective, FontAwesomeModule]
})
export class InstagramComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("InstagramComponent", NgxLoggerLevel.ERROR);
  private instagramService = inject(InstagramService);
  private systemConfigService = inject(SystemConfigService);
  dateUtils = inject(DateUtilsService);
  public recentMedia: InstagramMediaPost[] = [];
  public externalSystems: ExternalSystems;
  public loading = false;
  public loadError = "";
  private loadInFlight = false;
  private subscriptions: Subscription[] = [];
  protected readonly BuiltInAnchor = BuiltInAnchor;
  protected readonly faSpinner = faSpinner;
  protected readonly faCircleExclamation = faCircleExclamation;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.externalSystems = item.externalSystems;
      this.loadRecentMedia();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  profileHref(): string {
    const groupUrl = (this.externalSystems?.instagram?.groupUrl || "").replace(/\/+$/, "");
    const groupName = (this.externalSystems?.instagram?.groupName || "").replace(/^@/, "").replace(/^\/+/, "");
    if (groupUrl && groupName && !groupUrl.toLowerCase().includes(groupName.toLowerCase())) {
      return `${groupUrl}/${groupName}`;
    } else if (groupUrl) {
      return groupUrl;
    } else if (groupName) {
      return `https://www.instagram.com/${groupName}`;
    } else {
      return "";
    }
  }

  private loadRecentMedia(): void {
    if (!this.externalSystems?.instagram?.showFeed) {
      this.recentMedia = [];
      this.loadError = "";
      this.loading = false;
    } else if (!this.loadInFlight) {
      this.loadInFlight = true;
      this.loading = true;
      this.loadError = "";
      this.instagramService.recentMedia()
        .then((recentMedia: InstagramRecentMediaData) => {
          this.recentMedia = take((recentMedia?.data || []).filter(item => item?.media_url), 14);
          this.logger.info("Refreshed instagram recent media", this.recentMedia.length);
        })
        .catch(error => {
          this.recentMedia = [];
          this.loadError = error?.error?.error || error?.message || "Could not load Instagram posts";
          this.logger.error("instagram recent media failed", error);
        })
        .finally(() => {
          this.loading = false;
          this.loadInFlight = false;
        });
    }
  }

  imageWidth(media: InstagramMediaPost): string {
    return this.recentMedia.indexOf(media) <= 1 ? "50%" : "25%";
  }

  imageHeight(media: InstagramMediaPost): string {
    return this.recentMedia.indexOf(media) <= 1 ? "250px" : "130px";
  }

  mediaTooltip(media: InstagramMediaPost): string {
    const when = media?.timestamp ? this.dateUtils.displayDate(media.timestamp) : "";
    const caption = (media?.caption || "").trim();
    return [when, caption].filter(Boolean).join(" - ");
  }
}
