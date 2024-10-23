import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { ConfigKey } from "../../models/config.model";
import { BroadcastService } from "../broadcast-service";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { StringUtilsService } from "../string-utils.service";
import { WalksConfig } from "../../models/walk-notification.model";

@Injectable({
  providedIn: "root"
})
export class WalksConfigService {

  private subject = new ReplaySubject<WalksConfig>();
  private logger: Logger;
  private cachedWalksConfig: WalksConfig;

  constructor(private config: ConfigService,
              private broadcastService: BroadcastService<WalksConfig>,
              public stringUtils: StringUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalksConfigService", NgxLoggerLevel.ERROR);
    this.refresh();
  }

  async refresh() {
    this.logger.info("refresh query:started");
    const cachedWalksConfig = await this.getConfig();
    this.cacheAndNotify(cachedWalksConfig);
  }

  private cacheAndNotify(walksConfig: WalksConfig) {
    this.cachedWalksConfig = walksConfig;
    this.logger.info("notifying walksConfig subscribers with:", this.cachedWalksConfig);
    this.subject.next(this.cachedWalksConfig);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALKS_CONFIG_LOADED, this.cachedWalksConfig));
  }

  private async getConfig(): Promise<WalksConfig> {
    return await this.config.queryConfig<WalksConfig>(ConfigKey.WALKS, this.default());
  }

  saveConfig(config: WalksConfig) {
    return this.config.saveConfig<WalksConfig>(ConfigKey.WALKS, config).then((savedConfig: any) => this.cacheAndNotify(savedConfig.value));
  }

  public walksConfig(): WalksConfig {
    return this.cachedWalksConfig;
  }

  public events(): Observable<WalksConfig> {
    return this.subject.pipe(shareReplay());
  }

  default(): WalksConfig {
    return {
      milesPerHour: 2.13
    };
  };

}
