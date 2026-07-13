import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { EventPopulation, SystemConfig } from "../../models/system.model";
import { walksManagerSyncEnabled, walksManagerSyncEventTypes } from "./walks-manager-sync-config";

describe("Walks Manager sync configuration", () => {
  function config(walkPopulation: EventPopulation, socialEventPopulation: EventPopulation): SystemConfig {
    return {group: {walkPopulation, socialEventPopulation}} as SystemConfig;
  }

  it("syncs only group events when walks are local", () => {
    const systemConfig = config(EventPopulation.LOCAL, EventPopulation.WALKS_MANAGER);
    expect(walksManagerSyncEnabled(systemConfig)).toEqual(true);
    expect(walksManagerSyncEventTypes(systemConfig)).toEqual([RamblersEventType.GROUP_EVENT]);
  });

  it("syncs only group walks when group events are local", () => {
    expect(walksManagerSyncEventTypes(config(EventPopulation.WALKS_MANAGER, EventPopulation.LOCAL))).toEqual([RamblersEventType.GROUP_WALK]);
  });

  it("syncs both configured event types", () => {
    expect(walksManagerSyncEventTypes(config(EventPopulation.WALKS_MANAGER, EventPopulation.WALKS_MANAGER))).toEqual([
      RamblersEventType.GROUP_WALK,
      RamblersEventType.GROUP_EVENT
    ]);
  });

  it("disables sync only when both event populations are local", () => {
    expect(walksManagerSyncEnabled(config(EventPopulation.LOCAL, EventPopulation.LOCAL))).toEqual(false);
  });
});
