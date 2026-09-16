import { Connection } from "mongoose";
import { modelOnConnection } from "../mongo/utils/model-utils";
import { WalksManagerSyncModels } from "./walks-manager.model";
import { extendedGroupEvent, extendedGroupEventSchema } from "../mongo/models/extended-group-event";
import { member, memberSchema } from "../mongo/models/member";
import { config, configSchema } from "../mongo/models/config";

export function defaultWalksManagerSyncModels(): WalksManagerSyncModels {
  return {extendedGroupEvent, member, config};
}

export function walksManagerSyncModelsFor(connection: Connection): WalksManagerSyncModels {
  return {
    extendedGroupEvent: modelOnConnection(connection, extendedGroupEvent.modelName, extendedGroupEventSchema),
    member: modelOnConnection(connection, member.modelName, memberSchema),
    config: modelOnConnection(connection, config.modelName, configSchema)
  };
}
