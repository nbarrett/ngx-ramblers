import { envConfig } from "../env-config/env-config";
import debug from "debug";
import mongoose, { Model } from "mongoose";
import * as transforms from "./controllers/transforms";

const debugLog = debug(envConfig.logNamespace("local-database"));
debugLog.enabled = false;
let connected = false;

function createDebugFor<T>(model: Model<T>): debug.Debugger {
  const debugLog = debug(envConfig.logNamespace("local-database:" + model.modelName));
  debugLog.enabled = false;
  return debugLog;
}

export async function execute<T>(mongoFunction: () => Promise<T>): Promise<T> {
  if (!connected) {
    const model = {modelName: "unknown"};
    const debug: debug.Debugger = createDebugFor(model as Model<T>);
    await connect(debug);
    return mongoFunction();
  } else {
    return mongoFunction();
  }
}

export async function create<T>(model: Model<T>, data: T, debugLog?: debug.Debugger): Promise<T> {
  const debugCreate: debug.Debugger = debugLog || createDebugFor(model);
  const performCreate = async () => {
    const document = transforms.createDocumentRequest<T>(data);
    debugCreate("create:data:", data, "document:", document);
    try {
      const result = await model.create(document);
      return transforms.toObjectWithId(result) as T;
    } catch (error) {
      debugCreate("create:error:", error);
      throw new Error(`Failed to create document: ${error.message}`);
    }
  };
  if (!connected) {
    debugCreate("establishing database connection");
    await connect(debugCreate);
  }
  return performCreate();
}

export async function upsert<T>(model: Model<T>, filter: any, data: T, debugLog?: debug.Debugger): Promise<T> {
  const debugUpsert: debug.Debugger = debugLog || createDebugFor(model);
  const performUpsert = async () => {
    const document = transforms.createDocumentRequest<T>(data);
    debugUpsert("upsert:filter:", filter, "document:", document);
    try {
      const result = await model.findOneAndUpdate(filter, document, { upsert: true, new: true, setDefaultsOnInsert: true });
      return transforms.toObjectWithId(result) as T;
    } catch (error) {
      debugUpsert("upsert:error:", error);
      throw new Error(`Failed to upsert document: ${error.message}`);
    }
  };
  if (!connected) {
    debugUpsert("establishing database connection");
    await connect(debugUpsert);
  }
  return performUpsert();
}

export async function connect(debug?: debug.Debugger): Promise<boolean> {
  const mongoUri = envConfig.mongo().uri.replace(/^"|"$/g, "");
  const debugConnect = debug || debugLog;
  if (mongoose.connection.readyState === 1) {
    debugConnect("Already connected to database:", mongoUri);
    return true;
  }
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      maxPoolSize: 10,
      connectTimeoutMS: 30000,
      ssl: true
    });
    mongoose.connection.on("connected", () => {
      debugConnect("Connected to database:", mongoUri);
      connected = true;
    });
    mongoose.connection.on("disconnected", () => {
      debugConnect("Disconnected from database:", mongoUri);
      connected = false;
    });
    mongoose.connection.on("error", err => {
      debugConnect("Connection error:", err);
      connected = false;
    });
    return true;
  } catch (error) {
    debugConnect("Connection failed:", mongoUri, "error:", error);
    throw error;
  }
}
