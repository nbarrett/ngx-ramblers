import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ReplaySubject } from "rxjs";
import { ConfigKey } from "../models/config.model";
import { BackupConfig } from "../models/backup-session.model";
import { ConfigService } from "./config.service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class BackupConfigService {

  private logger: Logger = inject(LoggerFactory).createLogger("BackupConfigService", NgxLoggerLevel.ERROR);
  private config = inject(ConfigService);
  private subject = new ReplaySubject<BackupConfig>();
  private cachedBackupConfig: BackupConfig;

  constructor() {
    this.refresh();
  }

  async refresh() {
    this.logger.info("refresh query:started");
    const cachedBackupConfig = await this.getConfig();
    this.cacheAndNotify(cachedBackupConfig);
  }

  private cacheAndNotify(backupConfig: BackupConfig) {
    this.cachedBackupConfig = backupConfig;
    this.logger.info("notifying backupConfig subscribers with:", this.cachedBackupConfig);
    this.subject.next(this.cachedBackupConfig);
  }

  private async getConfig(): Promise<BackupConfig> {
    return await this.config.queryConfig<BackupConfig>(ConfigKey.BACKUP, this.default());
  }

  private default(): BackupConfig {
    return {
      environments: []
    };
  }

  events() {
    return this.subject.asObservable();
  }

  async saveConfig(backupConfig: BackupConfig): Promise<BackupConfig> {
    this.logger.info("saveConfig:backupConfig", backupConfig);
    const savedConfig = await this.config.saveConfig<BackupConfig>(ConfigKey.BACKUP, backupConfig);
    await this.refresh();
    return savedConfig;
  }
}
