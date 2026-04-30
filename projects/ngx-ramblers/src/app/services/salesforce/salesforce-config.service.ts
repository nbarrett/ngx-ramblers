import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { ConfigKey } from "../../models/config.model";
import { NamedEventType } from "../../models/broadcast.model";
import { SalesforceConfig } from "../../models/salesforce.model";
import { BroadcastService } from "../broadcast-service";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";

const DEFAULT_CONFIG: SalesforceConfig = {
  endpointBaseUrl: null,
  apiKeysByGroupCode: {},
  enabled: false,
};

@Injectable({
  providedIn: "root"
})
export class SalesforceConfigService {

  private logger: Logger = inject(LoggerFactory).createLogger("SalesforceConfigService", NgxLoggerLevel.ERROR);
  private configService = inject(ConfigService);
  private broadcastService = inject<BroadcastService<SalesforceConfig>>(BroadcastService);
  private subject = new ReplaySubject<SalesforceConfig>(1);
  private cachedConfig: SalesforceConfig = DEFAULT_CONFIG;
  private loadedFromServer = false;

  constructor() {
    this.broadcastService.on(NamedEventType.MEMBER_LOGIN_COMPLETE, () => this.refresh());
    this.broadcastService.on(NamedEventType.MEMBER_LOGOUT_COMPLETE, () => this.refresh());
  }

  async refresh(): Promise<SalesforceConfig> {
    try {
      const config = await this.configService.queryConfig<SalesforceConfig>(ConfigKey.SALESFORCE, DEFAULT_CONFIG);
      this.cachedConfig = { ...DEFAULT_CONFIG, ...(config || {}) };
      this.loadedFromServer = true;
    } catch (error) {
      this.logger.error("refresh:error", error);
      this.cachedConfig = DEFAULT_CONFIG;
    }
    this.subject.next(this.cachedConfig);
    return this.cachedConfig;
  }

  hasLoaded(): boolean {
    return this.loadedFromServer;
  }

  cached(): SalesforceConfig {
    return this.cachedConfig;
  }

  setLocal(value: SalesforceConfig): void {
    this.cachedConfig = { ...DEFAULT_CONFIG, ...value, apiKeysByGroupCode: { ...(value?.apiKeysByGroupCode ?? {}) } };
  }

  events(): Observable<SalesforceConfig> {
    return this.subject.pipe(shareReplay(1));
  }

  async save(value: SalesforceConfig): Promise<SalesforceConfig> {
    const saved: any = await this.configService.saveConfig<SalesforceConfig>(ConfigKey.SALESFORCE, value);
    const merged: SalesforceConfig = { ...DEFAULT_CONFIG, ...(saved?.value || value) };
    this.cachedConfig = merged;
    this.subject.next(this.cachedConfig);
    return this.cachedConfig;
  }
}
