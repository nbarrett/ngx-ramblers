export {
  ParsedMongoUri,
  MongoDbConnectionConfig,
  buildMongoUri,
  parseMongoUri,
  extractGroupNameFromDatabase,
  extractClusterFromUri,
  extractUsernameFromUri
} from "../../../projects/ngx-ramblers/src/app/functions/mongo";

export type MongoDbInfo = import("../../../projects/ngx-ramblers/src/app/functions/mongo").ParsedMongoUri;
