import { Component, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Footer, Ramblers } from "../models/system.model";
import { DateUtilsService } from "../services/date-utils.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { SystemConfigService } from "../services/system/system-config.service";

@Component({
  selector: "app-footer",
  templateUrl: "./footer.html",
  styleUrls: ["./footer.sass"]
})
export class FooterComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public year: string;
  public footer: Footer;
  private subscriptions: Subscription[] = [];
  private national: Ramblers;
  constructor(private dateUtils: DateUtilsService,
              private systemConfigService: SystemConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("FooterComponent", NgxLoggerLevel.OFF);
    this.logger.debug("constructed");
  }

  ngOnInit() {
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      return this.footer = item.footer;
      return this.national = item.national;
    }));
    this.year = this.dateUtils.asString(this.dateUtils.momentNow().valueOf(), undefined, "YYYY");
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


}
