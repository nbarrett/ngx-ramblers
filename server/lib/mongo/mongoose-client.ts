import { envConfig } from "../env-config/env-config";
import debug from "debug";
import mongoose = require("mongoose");
import transforms = require("./controllers/transforms");

let connected = false;

function createDebugFor(model: any): any {
  return debug(envConfig.logNamespace(`local-database:${model.modelName}`));
}

export function execute(mongoFunction: () => any): Promise<any> {
  if (!connected) {
    return connect().then(() => mongoFunction());
  } else {
    return mongoFunction();
  }
}

export function create(model: any, data: any) {
  const debugCreate = createDebugFor(model);
  debugCreate.enabled = true;
  const performCreate = () => {
    const document = transforms.createDocumentRequest({body: data});
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
    return connect().then(() => performCreate());
  } else {
    return performCreate();
  }
}

export function connect() {
  return mongoose.connect(envConfig.mongo.uri, {
    useUnifiedTopology: true,
    keepAlive: true,
    useNewUrlParser: true,
  }).then(response => {
    debug("Connected to database:", envConfig.mongo.uri, "configured models:", response.models);
    connected = true;
    return true;
  }).catch(error => {
    debug("Connection failed:", envConfig.mongo.uri, "error:", error);
    throw error;
  });
}
