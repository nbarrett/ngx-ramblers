import debug from "debug";

const ENV_PREFIX: string = "SITE_";

const debugLog = debug("env-config");

const env = validatedEnvironmentVariable("NODE_ENV");

function logNamespace(moduleName: string) {
  return `ngx-ramblers:${env}:${moduleName || ""}`;
}

function validatedEnvironmentVariable(variableName: string, prefixed?: boolean): string {
  const resolvedName = prefixed ? ENV_PREFIX + variableName : variableName;
  const variableValue = process.env[resolvedName] || process.env[variableName];
  if (!variableValue) {
    throw new Error(`Environment variable '${resolvedName}' must be set`);
  } else {
    debugLog(`Environment variable '${resolvedName}' is set to '${variableValue}'`);
    return variableValue;
  }
}

export const envConfig = {
  production: env === "production",
  auth: {
    secret: validatedEnvironmentVariable("AUTH_SECRET"),
  },
  aws: {
    accessKeyId: validatedEnvironmentVariable("AWS_ACCESS_KEY_ID"),
    bucket: validatedEnvironmentVariable("AWS_BUCKET"),
    region: validatedEnvironmentVariable("AWS_REGION"),
    secretAccessKey: validatedEnvironmentVariable("AWS_SECRET_ACCESS_KEY"),
    uploadUrl: `https://${validatedEnvironmentVariable("AWS_BUCKET")}.s3.amazonaws.com`,
  },
  dev: env !== "production",
  env,
  googleMaps: {
    apiKey: validatedEnvironmentVariable("GOOGLE_MAPS_APIKEY"),
  },
  logNamespace,
  mongo: {
    uri: validatedEnvironmentVariable("MONGODB_URI"),
  },
  server: {
    listenPort: process.env.PORT || 5000,
    staticUrl: "/",
    uploadDir: "/tmp/uploads",
  },
};
