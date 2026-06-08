import { config } from "dotenv";
import { resolveServerPath } from "../shared/path-utils";

config({ path: resolveServerPath(".env") });

import debug from "debug";
import { booleanOf } from "../shared/string-utils";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { env, environmentVariable, isProduction, logNamespace } from "./env-core";

const debugLog = debug(logNamespace("env-config"));
if (process.env.LOG_ENV_CONFIG === "false") {
  debugLog.enabled = false;
}
const validatedCache = new Map<string, string>();
const SECRET_NAME_PATTERN = /(SECRET|TOKEN|PASSWORD|KEY)/i;

function redactedEnvironmentValue(variableName: Environment, variableValue: string): string {
  if (SECRET_NAME_PATTERN.test(variableName)) {
    return "[REDACTED]";
  }
  return variableValue;
}

function booleanEnvironmentVariable(variableName: Environment) {
  return booleanOf(environmentVariable(variableName));
}

function validatedEnvironmentVariable(variableName: Environment): string {
  if (validatedCache.has(variableName)) {
    return validatedCache.get(variableName)!;
  }
  const variableValue = environmentVariable(variableName);
  if (!variableValue) {
    throw new Error(`Environment variable '${variableName}' must be set`);
  } else {
    debugLog(`using environment variable: ${variableName} with: ${redactedEnvironmentValue(variableName, variableValue)}`);
    validatedCache.set(variableName, variableValue);
    return variableValue;
  }
}

function auth() {
  return {
    secret: validatedEnvironmentVariable(Environment.AUTH_SECRET),
  };
}

function aws() {
  const bucket = validatedEnvironmentVariable(Environment.AWS_BUCKET);
  return {
    accessKeyId: validatedEnvironmentVariable(Environment.AWS_ACCESS_KEY_ID),
    bucket,
    region: validatedEnvironmentVariable(Environment.AWS_REGION),
    secretAccessKey: validatedEnvironmentVariable(Environment.AWS_SECRET_ACCESS_KEY),
    uploadUrl: `https://${bucket}.s3.amazonaws.com`,
  };
}


function mongo() {
  return {
    uri: validatedEnvironmentVariable(Environment.MONGODB_URI),
  };
}

export const envConfig = {
  booleanValue: booleanEnvironmentVariable,
  isProduction,
  logNamespace,
  production: env === "production",
  value: environmentVariable,
  auth,
  aws,
  dev: env !== "production",
  env,
  mongo,
  server: {
    listenPort: +(process.env.PORT || 5001),
    staticUrl: "/",
    uploadDir: "/tmp/uploads",
  },
};
