import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { EventPopulation, SystemConfig } from "../../models/system.model";

export function walksManagerSyncEventTypes(config: SystemConfig): RamblersEventType[] {
  return [
    config?.group?.walkPopulation === EventPopulation.WALKS_MANAGER ? RamblersEventType.GROUP_WALK : null,
    config?.group?.socialEventPopulation === EventPopulation.WALKS_MANAGER ? RamblersEventType.GROUP_EVENT : null
  ].filter(item => item !== null);
}

export function walksManagerSyncEnabled(config: SystemConfig): boolean {
  return walksManagerSyncEventTypes(config).length > 0;
}
