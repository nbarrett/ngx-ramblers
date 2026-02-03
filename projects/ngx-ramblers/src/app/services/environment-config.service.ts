import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ReplaySubject } from "rxjs";
import { ConfigKey } from "../models/config.model";
import { AWS_DEFAULTS, EnvironmentsConfig } from "../models/environment-config.model";
import { ConfigService } from "./config.service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class EnvironmentConfigService {

  private logger: Logger = inject(LoggerFactory).createLogger("EnvironmentConfigService", NgxLoggerLevel.ERROR);
  private config = inject(ConfigService);
  private subject = new ReplaySubject<EnvironmentsConfig>();
  private cachedConfig: EnvironmentsConfig;

  constructor() {
    this.refresh();
  }

  async refresh() {
    this.logger.info("refresh query:started");
    const config = await this.queryConfig();
    this.cacheAndNotify(config);
  }

  private cacheAndNotify(environmentsConfig: EnvironmentsConfig) {
    this.cachedConfig = environmentsConfig;
    this.logger.info("notifying environmentsConfig subscribers with:", this.cachedConfig);
    this.subject.next(this.cachedConfig);
  }

  private async queryConfig(): Promise<EnvironmentsConfig> {
    const environmentsConfig = await this.config.queryConfig<EnvironmentsConfig>(ConfigKey.ENVIRONMENTS, null);
    if (environmentsConfig && environmentsConfig.environments && environmentsConfig.environments.length > 0) {
      this.logger.info("Using environments config with", environmentsConfig.environments.length, "environments");
      return environmentsConfig;
    }

    this.logger.info("No config found, returning default");
    return this.defaultConfig();
  }

  private defaultConfig(): EnvironmentsConfig {
    return {
      environments: [],
      aws: {
        bucket: "",
        region: AWS_DEFAULTS.REGION
      },
      secrets: {}
    };
  }

  events() {
    return this.subject.asObservable();
  }

  async saveConfig(environmentsConfig: EnvironmentsConfig): Promise<EnvironmentsConfig> {
    this.logger.info("saveConfig:environmentsConfig", environmentsConfig);
    const savedConfig = await this.config.saveConfig<EnvironmentsConfig>(ConfigKey.ENVIRONMENTS, environmentsConfig);
    await this.refresh();
    return savedConfig;
  }

  cachedEnvironmentsConfig(): EnvironmentsConfig | null {
    return this.cachedConfig || null;
  }
}
