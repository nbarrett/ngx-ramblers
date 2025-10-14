import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { MigrationConfig, SiteMigrationConfig } from "../../models/migration-config.model";
import { ConfigKey } from "../../models/config.model";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class MigrationConfigService {
  private logger: Logger = inject(LoggerFactory).createLogger("MigrationConfigService", NgxLoggerLevel.ERROR);
  private config = inject(ConfigService);
  private migrationConfigSubject = new ReplaySubject<MigrationConfig>();

  constructor() {
    this.refreshConfig();
  }

  emptySiteMigrationConfig(): SiteMigrationConfig {
    return {
      expanded: true,
      name: "New Site",
      baseUrl: "",
      siteIdentifier: "",
      menuSelector: ".BMenu a",
      contentSelector: "#BContent",
      galleryPath: "",
      gallerySelector: "",
      galleryImagePath: "",
      specificAlbums: [],
      useNestedRows: false,
      persistData: false,
      uploadTos3: false,
      enabled: true
    };
  }

  refreshConfig(): void {
    this.config.queryConfig<MigrationConfig>(ConfigKey.MIGRATION, {
      sites: []
    }).then((queriedConfig: MigrationConfig) => {
      const normalisedConfig: MigrationConfig = {
        ...queriedConfig,
        sites: (queriedConfig.sites || []).map(site => ({
          persistData: false,
          uploadTos3: false,
          ...site
        }))
      };
      this.logger.info("notifying subscribers with migrationConfig:", normalisedConfig);
      this.migrationConfigSubject.next(normalisedConfig);
    });
  }

  saveConfig(config: MigrationConfig) {
    return this.config.saveConfig<MigrationConfig>(ConfigKey.MIGRATION, config);
  }

  public migrationConfigEvents(): Observable<MigrationConfig> {
    return this.migrationConfigSubject.asObservable();
  }
}
