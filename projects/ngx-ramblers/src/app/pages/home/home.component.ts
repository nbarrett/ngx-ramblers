import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { ExternalSystems } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { PageService } from "../../services/page.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { DynamicContentComponent } from "../../modules/common/dynamic-content/dynamic-content";
import { FacebookComponent } from "../facebook/facebook.component";
import { InstagramComponent } from "../instagram/instagram.component";

@Component({
    selector: "app-home",
    templateUrl: "./home.component.html",
    styleUrls: ["./home.component.sass"],
    imports: [DynamicContentComponent, FacebookComponent, InstagramComponent]
})
export class HomeComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("HomeComponent", NgxLoggerLevel.ERROR);
  pageService = inject(PageService);
  private systemConfigService = inject(SystemConfigService);
  public feeds: { facebook: {} };

  faPencil = faPencil;
  private subscriptions: Subscription[] = [];
  public externalSystems: ExternalSystems;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.externalSystems = item.externalSystems));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
