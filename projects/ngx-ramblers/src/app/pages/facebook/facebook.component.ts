import { Component, HostListener, inject, OnDestroy, OnInit } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Facebook } from "../../models/system.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { CardContainerComponent } from "../../modules/common/card-container/card-container.component";

@Component({
    selector: "app-facebook",
    templateUrl: "./facebook.component.html",
    styleUrls: ["./facebook.component.sass"],
    imports: [CardContainerComponent]
})
export class FacebookComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("FacebookComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  dateUtils = inject(DateUtilsService);
  private sanitiser = inject(DomSanitizer);
  public facebook: Facebook;
  public width = this.calculateWidth();
  public height = 642;
  version = "v20.0";
  pluginUrl: SafeResourceUrl;
  scriptSrcUrl: SafeResourceUrl;
  initialised: boolean;
  private subscriptions: Subscription[] = [];

  @HostListener("window:resize", ["$event"])
  onResize(event) {
  }

  private calculateWidth(): number {
    return window.innerWidth <= 375 ? window.innerWidth - 65 : window.innerWidth - 80;
  }

  parameters() {
    return [
      `href=${this?.facebook?.groupUrl}`,
      "tabs=timeline",
      `width=${this.width}`,
      `height=${this.height}`,
      "small_header=false",
      "adapt_container_width=true",
      "hide_cover=false",
      "show_facepile=true",
      `appId=${this?.facebook?.appId}`
    ].join("&");
  }

  ngOnInit() {
    this.logger.info("ngOnInit window.innerWidth:", window.innerWidth);
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.facebook = item.externalSystems.facebook;
      this.pluginUrl = this.sanitiser.bypassSecurityTrustResourceUrl(`https://www.facebook.com/plugins/page.php?${this.parameters()}`);
      this.scriptSrcUrl = this.sanitiser.bypassSecurityTrustResourceUrl(`https://connect.facebook.net/en_GB/sdk.js#xfbml=1&version=${this.version}&appId=${this.facebook.appId}`);
      this.logger.info("facebook:", this.facebook, "pluginUrl:", this.pluginUrl, "scriptSrcUrl:", this.scriptSrcUrl);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
