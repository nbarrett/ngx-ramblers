import expect from "expect";
import { describe, it } from "mocha";
import mongoose from "mongoose";
import { defaultWalksManagerSyncModels, walksManagerSyncModelsFor } from "./walks-manager-sync-models";

describe("walks manager sync models", () => {
  it("registers the sync models on the supplied connection rather than the global one", () => {
    const connection = mongoose.createConnection();
    const models = walksManagerSyncModelsFor(connection);
    const globalModels = defaultWalksManagerSyncModels();
    expect(models.extendedGroupEvent.db).toBe(connection);
    expect(models.member.db).toBe(connection);
    expect(models.config.db).toBe(connection);
    expect(models.extendedGroupEvent).not.toBe(globalModels.extendedGroupEvent);
    expect(models.extendedGroupEvent.modelName).toBe(globalModels.extendedGroupEvent.modelName);
    expect(globalModels.extendedGroupEvent.db).toBe(mongoose.connection);
  });
});
