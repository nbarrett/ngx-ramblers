import { envConfig } from "../env-config/env-config";
import debug from "debug";
import mongoose from "mongoose";
import transforms = require("./controllers/transforms");

const debugLog = debug(envConfig.logNamespace("local-database"));
debugLog.enabled = false;
let connected = false;

function createDebugFor(model: any): debug.Debugger {
  return debug(envConfig.logNamespace(`local-database:${model.modelName}`));
}

export function execute(mongoFunction: () => any): Promise<any> {
  if (!connected) {
    const debug: debug.Debugger = createDebugFor({model: "unknown"});
    return connect(debug).then(() => mongoFunction());
  } else {
    return mongoFunction();
  }
}

export function create<T>(model: mongoose.Model<mongoose.Document>, data: T) {
  const debugCreate: debug.Debugger = createDebugFor(model);
  debugCreate.enabled = false;
  const performCreate = () => {
    const document = transforms.createDocumentRequest<T>(data);
    debugCreate("create:data:", data, "document:", document);
    return new model(document).save()
      .then(result => {
        return transforms.toObjectWithId(result);
      })
      .catch(error => {
        return {
          error: transforms.parseError(error),
          message: `Creation of ${model.modelName} failed`,
          request: data,
        };
      });
  };
  if (!connected) {
    debugCreate("establishing database connection");
    return connect(debugCreate).then(() => performCreate());
  } else {
    return performCreate();
  }
}

export function connect(debug?: debug.Debugger) {
  const mongoUri = envConfig.mongo.uri.replace(/^"|"$/g, ""); ;
  debugLog("MongoDB URI:", mongoUri);
  const debugConnect = debug || debugLog;
  return mongoose.connect(mongoUri, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  }).then(response => {
    debugConnect("Connected to database:", mongoUri, "configured models:", response.models);
    connected = true;
    return true;
  }).catch(error => {
    debugConnect("Connection failed:", mongoUri, "error:", error);
    throw error;
  });
}
