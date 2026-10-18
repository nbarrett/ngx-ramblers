import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { UK_MAP_CENTER, UK_MAP_ZOOM } from "../../models/map.model";
import { SystemConfig } from "../../models/system.model";
import { LoggerFactory } from "../logger-factory.service";
import { SystemConfigService } from "../system/system-config.service";
import { RamblersGroupsService } from "../walks-and-events/ramblers-groups.service";

const GROUP_AREA_ZOOM = 11;

@Injectable({
  providedIn: "root"
})
export class MapDefaultsService {

  private systemConfigService = inject(SystemConfigService);
  private ramblersGroups = inject(RamblersGroupsService);
  private logger = inject(LoggerFactory).createLogger("MapDefaultsService", NgxLoggerLevel.ERROR);
  private resolvedCentre: [number, number] | null = null;
  private resolvedZoom: number | null = null;
  private resolving: Promise<void> | null = null;

  public center(): [number, number] {
    return this.resolvedCentre ? [...this.resolvedCentre] : this.configuredCentre(this.systemConfigService.systemConfig());
  }

  public zoom(): number {
    return this.resolvedZoom ?? this.configuredZoom(this.systemConfigService.systemConfig());
  }

  public resolve(): Promise<void> {
    if (!this.resolving) {
      this.resolving = this.loadDefaults();
    }
    return this.resolving;
  }

  private async loadDefaults(): Promise<void> {
    const config = this.systemConfigService.systemConfig() || await firstValueFrom(this.systemConfigService.events());
    const configured = this.configuredCentre(config);
    if (this.isUkFallback(configured, config)) {
      const groupCode = config?.group?.groupCode;
      const groups = groupCode ? await this.ramblersGroups.list([groupCode]).catch(error => {
        this.logger.warn("Unable to load Ramblers group centre", error);
        return [];
      }) : [];
      const group = groups.find(item => item.group_code === groupCode) || groups[0];
      const latitude = Number(String(group?.latitude ?? "").trim() || NaN);
      const longitude = Number(String(group?.longitude ?? "").trim() || NaN);
      if (group && Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0)) {
        this.resolvedCentre = [latitude, longitude];
        this.resolvedZoom = config?.group?.zoom || GROUP_AREA_ZOOM;
      } else {
        this.resolvedCentre = configured;
        this.resolvedZoom = this.configuredZoom(config);
      }
    } else {
      this.resolvedCentre = configured;
      this.resolvedZoom = this.configuredZoom(config);
    }
  }

  private configuredCentre(config: SystemConfig | null): [number, number] {
    const center = config?.group?.center;
    return center?.length === 2 ? [center[0], center[1]] : [...UK_MAP_CENTER];
  }

  private configuredZoom(config: SystemConfig | null): number {
    return config?.group?.zoom || UK_MAP_ZOOM;
  }

  private isUkFallback(centre: [number, number], config: SystemConfig | null): boolean {
    return !config?.group?.center || (centre[0] === UK_MAP_CENTER[0] && centre[1] === UK_MAP_CENTER[1]);
  }
}
