import { randomBytes } from "crypto";
import { buildSecretsContent } from "../shared/secrets";
import { EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";

export interface ContributorBundleAws {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ContributorBundleRequest {
  environment: string;
  appName: string;
  mongoUri: string;
  aws: ContributorBundleAws;
}

export interface ContributorBundleFile {
  path: string;
  content: string;
}

export function generateAuthSecret(): string {
  return randomBytes(32).toString("hex");
}

export function buildEnvironmentsManifest(environment: string, appName: string): string {
  const manifest: EnvironmentsConfig = {
    environments: [{ environment, flyio: { appName } }]
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function buildContributorSecretsContent(request: ContributorBundleRequest): string {
  return buildSecretsContent({
    MONGODB_URI: request.mongoUri,
    AUTH_SECRET: generateAuthSecret(),
    NODE_ENV: "development",
    AWS_REGION: request.aws.region,
    AWS_BUCKET: request.aws.bucket,
    AWS_ACCESS_KEY_ID: request.aws.accessKeyId,
    AWS_SECRET_ACCESS_KEY: request.aws.secretAccessKey
  });
}

function buildReadme(request: ContributorBundleRequest): string {
  return [
    `Contributor environment bundle for ${request.environment}`,
    "",
    "Unpack the two files below into the root of an ngx-ramblers checkout, then run:",
    `  ./bin/ngx-cli local dev ${request.environment} --no-docker-worker`,
    "",
    "Files:",
    `  non-vcs/secrets/secrets.${request.appName}.env  - environment secrets (local use only)`,
    "  non-vcs/secrets/environments.local.json         - environments manifest",
    "",
    "Everything needed to run the stack locally is already filled in - no",
    "further configuration is required.",
    "",
    "AUTH_SECRET is generated fresh for this bundle and is unique to it. The",
    "MongoDB and AWS storage values are this group's own credentials; keep",
    "the secrets file private and do not commit it.",
    ""
  ].join("\n");
}

export function buildContributorBundle(request: ContributorBundleRequest): ContributorBundleFile[] {
  return [
    {
      path: `non-vcs/secrets/secrets.${request.appName}.env`,
      content: buildContributorSecretsContent(request)
    },
    {
      path: "non-vcs/secrets/environments.local.json",
      content: buildEnvironmentsManifest(request.environment, request.appName)
    },
    {
      path: "README-contributor-environment.txt",
      content: buildReadme(request)
    }
  ];
}
