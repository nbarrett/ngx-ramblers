// Re-export from the single source of truth
export {
  ParsedMongoUri,
  MongoDbConnectionConfig,
  buildMongoUri,
  parseMongoUri,
  extractGroupNameFromDatabase,
  extractClusterFromUri,
  extractUsernameFromUri
} from "../../../projects/ngx-ramblers/src/app/functions/mongo";

// Type alias for backwards compatibility
export type MongoDbInfo = import("../../../projects/ngx-ramblers/src/app/functions/mongo").ParsedMongoUri;
