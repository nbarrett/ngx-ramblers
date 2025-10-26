import debug from "debug";
import { booleanOf } from "../shared/string-utils";
import { Environment } from "./environment-model";

const debugLog = debug("env-config");

const env = environmentVariable(Environment.NODE_ENV) || "development";

function logNamespace(moduleName: string) {
  return `ngx-ramblers:${env}:${moduleName || ""}`;
}

function environmentVariable(variableName: string) {
  return process.env[variableName];
}

function booleanEnvironmentVariable(variableName: string) {
  return booleanOf(environmentVariable(variableName));
}

function validatedEnvironmentVariable(variableName: string): string {

  const variableValue = environmentVariable(variableName);
  if (!variableValue) {
    throw new Error(`Environment variable '${variableName}' must be set`);
  } else {
    debugLog(`Environment variable '${variableName}' is set to '${variableValue}'`);
    return variableValue;
  }
}

function isProduction(): boolean {
  return env === "production";
}

export const envConfig = {
  booleanValue: booleanEnvironmentVariable,
  isProduction,
  logNamespace,
  production: env === "production",
  auth: {
    secret: validatedEnvironmentVariable(Environment.AUTH_SECRET),
  },
  aws: {
    accessKeyId: validatedEnvironmentVariable(Environment.AWS_ACCESS_KEY_ID),
    bucket: validatedEnvironmentVariable(Environment.AWS_BUCKET),
    region: validatedEnvironmentVariable(Environment.AWS_REGION),
    secretAccessKey: validatedEnvironmentVariable(Environment.AWS_SECRET_ACCESS_KEY),
    uploadUrl: `https://${validatedEnvironmentVariable(Environment.AWS_BUCKET)}.s3.amazonaws.com`,
  },
  dev: env !== "production",
  env,
  googleMaps: {
    apiKey: validatedEnvironmentVariable(Environment.GOOGLE_MAPS_APIKEY),
  },
  mongo: {
    uri: validatedEnvironmentVariable(Environment.MONGODB_URI),
  },
  server: {
    listenPort: 5001,
    staticUrl: "/",
    uploadDir: "/tmp/uploads",
  },
};
