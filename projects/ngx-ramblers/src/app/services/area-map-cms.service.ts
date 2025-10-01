import { inject, Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { AreaMapData, PageContent, PageContentRow } from "../models/content-text.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentService } from "./page-content.service";
import { SystemConfigService } from "./system/system-config.service";

@Injectable({
  providedIn: "root"
})
export class AreaMapCmsService {
  private logger: Logger = inject(LoggerFactory).createLogger("AreaMapCmsService", NgxLoggerLevel.ERROR);
  private pageContentService = inject(PageContentService);
  private systemConfigService = inject(SystemConfigService);

  private settingsSubject = new BehaviorSubject<AreaMapData | null>(null);
  private currentPageContent?: PageContent;
  private currentRow?: PageContentRow;

  constructor() {
  }

  initialize(row: PageContentRow, pageContent?: PageContent): AreaMapData {
    this.currentRow = row;
    this.currentPageContent = pageContent;

    const settings = this.defaultSettings();

    if (row.areaMap) {
      Object.assign(settings, row.areaMap);
    }

    this.updateRow(settings);
    this.settingsSubject.next(settings);
    this.logger.info("Initialized with settings:", settings);
    return settings;
  }

  updateSetting<K extends keyof AreaMapData>(key: K, value: AreaMapData[K]): void {
    const current = this.settingsSubject.value || this.defaultSettings();
    const updated = { ...current, [key]: value };
    this.updateRow(updated);
    this.settingsSubject.next(updated);
    this.logger.debug(`Updated ${key}:`, value);
  }

  updateSettings(settings: Partial<AreaMapData>): void {
    const current = this.settingsSubject.value || this.defaultSettings();
    const updated = { ...current, ...settings };
    this.updateRow(updated);
    this.settingsSubject.next(updated);
    this.logger.debug("Updated multiple settings:", settings);
  }

  settingsChanges() {
    return this.settingsSubject.asObservable();
  }

  resetToDefaults(): void {
    const defaults = this.defaultSettings();
    this.updateRow(defaults);
    this.settingsSubject.next(defaults);
    this.logger.info("Reset to defaults:", defaults);
  }

  private defaultSettings(): AreaMapData {
    const systemConfig = this.systemConfigService.systemConfig();
    const regionName = systemConfig?.area?.shortName;
    return {
      region: regionName,
      title: "Areas",
      mapCenter: [51.25, 0.75],
      mapZoom: 10,
      mapHeight: 480,
      showControls: true,
      selectedGroups: [],
      clickAction: "group-website" as any,
      opacityNormal: 0.5,
      opacityHover: 0.8,
      textOpacity: 0.9,
      provider: "osm",
      osStyle: "Outdoor_27700",
      areaColors: {}
    };
  }

  async saveSettings(): Promise<void> {
    const settings = this.settingsSubject.value;
    if (settings && this.currentRow) {
      this.updateRow(settings);
      if (this.currentPageContent) {
        try {
          await this.pageContentService.update(this.currentPageContent);
          this.logger.info("Successfully persisted settings to CMS:", settings);
        } catch (error) {
          this.logger.error("Failed to persist settings to CMS:", error);
        }
      } else {
        this.logger.debug("Skipping persistence - no page content available");
      }
    } else {
      this.logger.warn("Cannot persist settings - missing row context");
    }
  }

  private updateRow(settings: AreaMapData): void {
    if (this.currentRow) {
      this.currentRow.areaMap = {...settings};
    }
  }

}
