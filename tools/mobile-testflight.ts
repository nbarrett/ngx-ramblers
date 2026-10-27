import { sign } from "node:crypto";
import { setInterval, setTimeout } from "node:timers/promises";
import debug from "debug";
import { dateTimeNow } from "../server/lib/shared/dates";
import { AppleBuildBetaDetailResponse, AppleBuildProcessingState, AppleExternalBuildState, ApplePilotReleaseConfiguration, ApplePilotRequestMethod, ApplePilotGroupResponse, AppleReleaseBuild, AppleReleaseBuildResponse } from "../projects/ngx-ramblers/src/app/models/mobile-release.model";

const logger = debug("ngx-ramblers:mobile:testflight");
logger.enabled = true;

function token(configuration: ApplePilotReleaseConfiguration): string {
  const issuedAt = Math.floor(dateTimeNow().toSeconds());
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${encode({alg: "ES256", kid: configuration.keyId, typ: "JWT"})}.${encode({iss: configuration.issuerId, iat: issuedAt, exp: issuedAt + 600, aud: "appstoreconnect-v1"})}`;
  const signature = sign("sha256", Buffer.from(payload), {key: configuration.privateKey, dsaEncoding: "ieee-p1363"}).toString("base64url");
  return `${payload}.${signature}`;
}

function retryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryableAppleError(error: unknown): boolean {
  return error instanceof Error && /request failed \((429|5\d\d)\)/.test(error.message);
}

async function request(configuration: ApplePilotReleaseConfiguration, path: string, body: unknown = null, method = body ? ApplePilotRequestMethod.POST : ApplePilotRequestMethod.GET, acceptedStatuses: number[] = []): Promise<Response> {
  const progress = {attempt: 0};
  const maxAttempts = 4;
  const outcome: {response: Response | null; error: string | null} = {response: null, error: null};
  for (const wait of [0, 2000, 4000, 8000]) {
    progress.attempt += 1;
    if (wait > 0) {
      await setTimeout(wait);
    }
    const response = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
      method,
      headers: {Authorization: `Bearer ${token(configuration)}`, "Content-Type": "application/json"},
      body: body ? JSON.stringify(body) : null,
      signal: AbortSignal.timeout(30000)
    });
    if (response.ok || acceptedStatuses.includes(response.status)) {
      outcome.response = response;
      break;
    } else {
      const bodyText = await response.text();
      if (retryableStatus(response.status) && progress.attempt < maxAttempts) {
        logger("App Store Connect %s returned %s; retrying %s/%s: %s", path, response.status, progress.attempt, maxAttempts, bodyText);
      } else {
        outcome.error = `App Store Connect request failed (${response.status}): ${bodyText}`;
        break;
      }
    }
  }
  if (outcome.response) {
    return outcome.response;
  } else {
    throw new Error(outcome.error);
  }
}

function awaitingExternalDistribution(state: AppleExternalBuildState): boolean {
  return state === AppleExternalBuildState.BETA_APPROVED || state === AppleExternalBuildState.READY_FOR_BETA_TESTING;
}

async function buildBetaDetail(configuration: ApplePilotReleaseConfiguration, buildId: string): Promise<AppleBuildBetaDetailResponse> {
  const response = await request(configuration, `builds/${buildId}/buildBetaDetail`);
  return response.json();
}

async function confirmExternalAvailability(configuration: ApplePilotReleaseConfiguration, buildId: string, notificationStatus: number): Promise<void> {
  const deadline = dateTimeNow().plus({seconds: 15}).toMillis();
  const initial = await buildBetaDetail(configuration, buildId);
  const availability = {state: initial.data.attributes.externalBuildState};
  if (awaitingExternalDistribution(availability.state) && dateTimeNow().toMillis() < deadline) {
    for await (const tick of setInterval(1000)) {
      if (dateTimeNow().toMillis() >= deadline) {
        break;
      } else {
        const current = await buildBetaDetail(configuration, buildId);
        availability.state = current.data.attributes.externalBuildState;
        if (!awaitingExternalDistribution(availability.state)) {
          break;
        }
      }
    }
  }
  if (availability.state !== AppleExternalBuildState.IN_BETA_TESTING) {
    throw new Error(`Apple has not confirmed external availability for build ${configuration.buildNumber}: ${availability.state} (notification status ${notificationStatus})`);
  }
}

async function distributeExternalBuild(configuration: ApplePilotReleaseConfiguration, build: AppleReleaseBuild): Promise<void> {
  const groupResponse = await request(configuration, `betaGroups/${configuration.groupId}?include=app`);
  const group: ApplePilotGroupResponse = await groupResponse.json();
  if (group.data.attributes.isInternalGroup !== false || group.data.relationships.app.data.id !== configuration.appId) {
    throw new Error("The configured TestFlight trial group must be external and belong to this app.");
  }
  const buildId = build.id;
  const detail = await buildBetaDetail(configuration, buildId);
  const state = detail.data.attributes.externalBuildState;
  if (state === AppleExternalBuildState.BETA_REJECTED || state === AppleExternalBuildState.EXPIRED) {
    throw new Error(`Apple external testing is blocked for build ${configuration.buildNumber}: ${state}`);
  } else {
    if (!detail.data.attributes.autoNotifyEnabled) {
      await request(configuration, `buildBetaDetails/${detail.data.id}`, {
        data: {type: "buildBetaDetails", id: detail.data.id, attributes: {autoNotifyEnabled: true}}
      }, ApplePilotRequestMethod.PATCH);
    }
    const alreadyAssigned = build.relationships?.betaGroups?.data?.some(group => group.id === configuration.groupId);
    if (!alreadyAssigned) {
      await request(configuration, `betaGroups/${configuration.groupId}/relationships/builds`, {data: [{type: "builds", id: buildId}]});
    }
    if (state === AppleExternalBuildState.READY_FOR_BETA_SUBMISSION) {
      await request(configuration, "betaAppReviewSubmissions", {
        data: {type: "betaAppReviewSubmissions", relationships: {build: {data: {type: "builds", id: buildId}}}}
      });
      logger("Submitted build %s for external TestFlight review with automatic availability and Apple update notifications", configuration.buildNumber);
    } else if (awaitingExternalDistribution(state)) {
      const current = await buildBetaDetail(configuration, buildId);
      if (awaitingExternalDistribution(current.data.attributes.externalBuildState)) {
        const notification = await request(configuration, "buildBetaNotifications", {
          data: {type: "buildBetaNotifications", relationships: {build: {data: {type: "builds", id: buildId}}}}
        }, ApplePilotRequestMethod.POST, [409]);
        await confirmExternalAvailability(configuration, buildId, notification.status);
      } else if (current.data.attributes.externalBuildState !== AppleExternalBuildState.IN_BETA_TESTING) {
        throw new Error(`Apple external availability changed for build ${configuration.buildNumber}: ${current.data.attributes.externalBuildState}`);
      }
      logger("Released approved build %s to the existing trial group", configuration.buildNumber);
    } else {
      logger("Assigned build %s to the existing trial group with automatic availability and Apple update notifications; external state: %s", configuration.buildNumber, state);
    }
  }
}

export async function assignProcessedBuild(configuration: ApplePilotReleaseConfiguration): Promise<boolean> {
  const filters = new URLSearchParams({"filter[app]": configuration.appId, "filter[version]": configuration.buildNumber, include: "betaGroups", limit: "2"});
  const response = await request(configuration, `builds?${filters}`);
  const builds: AppleReleaseBuildResponse = await response.json();
  const build = builds.data.find(candidate => candidate.attributes.version === configuration.buildNumber);
  const state = build?.attributes.processingState;
  const assigned = {value: false};
  if (state === AppleBuildProcessingState.FAILED || state === AppleBuildProcessingState.INVALID) {
    throw new Error(`Apple rejected native build ${configuration.buildNumber}: ${state}`);
  } else if (state === AppleBuildProcessingState.VALID) {
    await distributeExternalBuild(configuration, build);
    assigned.value = true;
  } else {
    logger("Waiting for Apple to validate build %s", configuration.buildNumber);
  }
  return assigned.value;
}

async function assignUntilDeadline(configuration: ApplePilotReleaseConfiguration, deadline: number): Promise<boolean> {
  const assigned = {value: false};
  try {
    assigned.value = await assignProcessedBuild(configuration);
  } catch (error) {
    if (retryableAppleError(error) && dateTimeNow().toMillis() < deadline) {
      logger("Pilot distribution hit a transient Apple error; will retry: %s", error instanceof Error ? error.message : error);
    } else {
      throw error;
    }
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
  const assigned = {value: false};
  assigned.value = await assignUntilDeadline(configuration, deadline);
  if (!assigned.value) {
    for await (const tick of setInterval(15000)) {
      if (dateTimeNow().toMillis() >= deadline) {
        throw new Error("Apple processing did not complete within 30 minutes. The upload is retained; check its processing status before retrying.");
      } else if (await assignUntilDeadline(configuration, deadline)) {
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
