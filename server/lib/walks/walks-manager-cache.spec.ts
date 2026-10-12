import expect from "expect";
import { describe, it } from "mocha";
import { InputSource } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RamblersEventType } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { EventField, GroupEventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { dateTimeFromIso } from "../shared/dates";
import { deleteStaleWalksManagerCache } from "./walks-manager-cache";
import { WalksManagerSyncModels } from "./walks-manager.model";

function modelsCapturingDelete(deletedCount: number): { models: WalksManagerSyncModels; queries: unknown[] } {
  const queries: unknown[] = [];
  const models = {
    extendedGroupEvent: {
      deleteMany: (query: unknown) => {
        queries.push(query);
        return {exec: async () => ({deletedCount})};
      }
    }
  } as unknown as WalksManagerSyncModels;
  return {models, queries};
}

const hillsideConfig = {
  group: {groupCode: "HS01"}
} as SystemConfig;

describe("deleteStaleWalksManagerCache", () => {
  it("deletes cached walks in the synced window that Walks Manager no longer returned", async () => {
    const {models, queries} = modelsCapturingDelete(2);
    const deleted = await deleteStaleWalksManagerCache(
      hillsideConfig,
      dateTimeFromIso("2026-10-03T09:00:00"),
      dateTimeFromIso("2028-10-10T17:00:00"),
      [RamblersEventType.GROUP_WALK],
      ["100000001"],
      models
    );
    expect(deleted).toBe(2);
    expect(queries).toEqual([{
      [EventField.INPUT_SOURCE]: InputSource.WALKS_MANAGER_CACHE,
      [GroupEventField.ITEM_TYPE]: {$in: [RamblersEventType.GROUP_WALK]},
      [GroupEventField.GROUP_CODE]: "HS01",
      [GroupEventField.START_DATE]: {$gte: "2026-10-03", $lt: "2028-10-11"},
      [GroupEventField.ID]: {$nin: ["100000001"], $ne: null}
    }]);
  });

  it("does not delete when the group code is missing", async () => {
    const {models, queries} = modelsCapturingDelete(9);
    const deleted = await deleteStaleWalksManagerCache(
      {group: {}} as SystemConfig,
      dateTimeFromIso("2026-10-03T09:00:00"),
      dateTimeFromIso("2028-10-10T17:00:00"),
      [RamblersEventType.GROUP_WALK],
      [],
      models
    );
    expect(deleted).toBe(0);
    expect(queries).toEqual([]);
  });

  it("does not delete when no event types use Walks Manager", async () => {
    const {models, queries} = modelsCapturingDelete(9);
    const deleted = await deleteStaleWalksManagerCache(
      hillsideConfig,
      dateTimeFromIso("2026-10-03T09:00:00"),
      dateTimeFromIso("2028-10-10T17:00:00"),
      [],
      [],
      models
    );
    expect(deleted).toBe(0);
    expect(queries).toEqual([]);
  });
});
