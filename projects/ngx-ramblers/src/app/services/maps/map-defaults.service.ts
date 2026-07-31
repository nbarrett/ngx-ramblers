import { inject, Injectable } from "@angular/core";
import { UK_MAP_CENTER, UK_MAP_ZOOM } from "../../models/map.model";
import { SystemConfigService } from "../system/system-config.service";

@Injectable({
  providedIn: "root"
})
export class MapDefaultsService {

  private systemConfigService = inject(SystemConfigService);

  public center(): [number, number] {
    const center = this.systemConfigService.systemConfig()?.group?.center;
    return center?.length === 2 ? [center[0], center[1]] : [...UK_MAP_CENTER];
  }

  public zoom(): number {
    return this.systemConfigService.systemConfig()?.group?.zoom || UK_MAP_ZOOM;
  }
}
