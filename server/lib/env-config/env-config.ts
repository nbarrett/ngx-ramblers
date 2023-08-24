function validatedEnvironmentVariable(variableName: string): string {
  const variableValue = process.env[variableName];
  if (!variableValue) {
    throw new Error("Environment variable '" + variableName + "' must be set");
  }
  return variableValue;
}

const env = validatedEnvironmentVariable("NODE_ENV");

function logNamespace(moduleName: string) {
  return `ekwg:${env}:${moduleName || ""}`;
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
  instagram: {
    accessToken: validatedEnvironmentVariable("INSTAGRAM_ACCESS_TOKEN"),
    clientId: validatedEnvironmentVariable("INSTAGRAM_CLIENT_ID"),
    clientSecret: validatedEnvironmentVariable("INSTAGRAM_CLIENT_SECRET"),
    userId: validatedEnvironmentVariable("INSTAGRAM_USER_ID"),
  },
  logNamespace,
  meetup: {
    apiUrl: null,
    group: null,
    oauth: {
      accessToken: validatedEnvironmentVariable("MEETUP_ACCESS_TOKEN"),
    },
    url: null,
  },
  mongo: {
    uri: validatedEnvironmentVariable("MONGODB_URI"),
  },
  server: {
    listenPort: process.env.PORT || 5000,
    staticUrl: "/",
    uploadDir: "/tmp/uploads",
  },
};
