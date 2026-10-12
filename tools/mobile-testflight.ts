import { sign } from "node:crypto";
import { setInterval } from "node:timers/promises";
import debug from "debug";
import { dateTimeNow } from "../server/lib/shared/dates";
import { AppleBuildProcessingState, ApplePilotReleaseConfiguration, AppleReleaseBuildResponse } from "../projects/ngx-ramblers/src/app/models/mobile-release.model";

const logger = debug("ngx-ramblers:mobile:testflight");
logger.enabled = true;

function token(configuration: ApplePilotReleaseConfiguration): string {
  const issuedAt = Math.floor(dateTimeNow().toSeconds());
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${encode({alg: "ES256", kid: configuration.keyId, typ: "JWT"})}.${encode({iss: configuration.issuerId, iat: issuedAt, exp: issuedAt + 600, aud: "appstoreconnect-v1"})}`;
  const signature = sign("sha256", Buffer.from(payload), {key: configuration.privateKey, dsaEncoding: "ieee-p1363"}).toString("base64url");
  return `${payload}.${signature}`;
}

async function request(configuration: ApplePilotReleaseConfiguration, path: string, body: unknown = null): Promise<Response> {
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {Authorization: `Bearer ${token(configuration)}`, "Content-Type": "application/json"},
    body: body ? JSON.stringify(body) : null,
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    throw new Error(`App Store Connect request failed (${response.status}): ${await response.text()}`);
  }
  return response;
}

export async function assignProcessedBuild(configuration: ApplePilotReleaseConfiguration): Promise<boolean> {
  const filters = new URLSearchParams({"filter[app]": configuration.appId, "filter[version]": configuration.buildNumber, limit: "2"});
  const response = await request(configuration, `builds?${filters}`);
  const builds: AppleReleaseBuildResponse = await response.json();
  const build = builds.data.find(candidate => candidate.attributes.version === configuration.buildNumber);
  const state = build?.attributes.processingState;
  const assigned = {value: false};
  if (state === AppleBuildProcessingState.FAILED || state === AppleBuildProcessingState.INVALID) {
    throw new Error(`Apple rejected native build ${configuration.buildNumber}: ${state}`);
  } else if (state === AppleBuildProcessingState.VALID) {
    await request(configuration, `betaGroups/${configuration.groupId}/relationships/builds`, {data: [{type: "builds", id: build.id}]});
    logger("Assigned build %s to the configured pilot group", configuration.buildNumber);
    assigned.value = true;
  } else {
    logger("Waiting for Apple to validate build %s", configuration.buildNumber);
  }
  return assigned.value;
}

async function main(): Promise<void> {
  const configuration: ApplePilotReleaseConfiguration = {
    appId: process.env.APP_STORE_CONNECT_APP_ID,
    groupId: process.env.TESTFLIGHT_GROUP_ID,
    buildNumber: process.env.MOBILE_BUILD_NUMBER,
    keyId: process.env.APP_STORE_CONNECT_KEY_ID,
    issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID,
    privateKey: process.env.APP_STORE_CONNECT_PRIVATE_KEY
  };
  if ([configuration.appId, configuration.groupId, configuration.buildNumber, configuration.keyId, configuration.issuerId, configuration.privateKey].some(value => !value)) {
    throw new Error("App Store Connect API credentials, app ID, pilot group ID and build number are required.");
  }
  const deadline = dateTimeNow().plus({minutes: 30}).toMillis();
  const initialAssignment = await assignProcessedBuild(configuration);
  if (!initialAssignment) {
    for await (const tick of setInterval(15000)) {
      if (dateTimeNow().toMillis() >= deadline) {
        throw new Error("Apple processing did not complete within 30 minutes. The upload is retained; check its processing status before retrying.");
      } else if (await assignProcessedBuild(configuration)) {
        break;
      }
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    logger("Pilot distribution failed: %s", error.message);
    process.exitCode = 1;
  });
}
