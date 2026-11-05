import { sign } from "node:crypto";
import { setInterval, setTimeout } from "node:timers/promises";
import debug from "debug";
import { dateTimeNow } from "../server/lib/shared/dates";
import {
  AppleAppStoreState,
  AppleAppStoreVersion,
  AppleAppStoreVersionCreateResponse,
  AppleAppStoreVersionResponse,
  AppleBuildProcessingState,
  ApplePlatform,
  AppleReleaseBuild,
  AppleReleaseBuildResponse,
  AppleReleaseType,
  AppleRequestMethod,
  AppleReviewSubmissionResponse,
  AppleStoreReleaseConfiguration
} from "../projects/ngx-ramblers/src/app/models/mobile-release.model";

const logger = debug("ngx-ramblers:mobile:app-store");
logger.enabled = true;

function token(configuration: AppleStoreReleaseConfiguration): string {
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

async function request(configuration: AppleStoreReleaseConfiguration, path: string, body: unknown = null, method = body ? AppleRequestMethod.POST : AppleRequestMethod.GET, acceptedStatuses: number[] = []): Promise<Response> {
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

function versionEditable(state: AppleAppStoreState): boolean {
  return state === AppleAppStoreState.PREPARE_FOR_SUBMISSION
    || state === AppleAppStoreState.READY_FOR_REVIEW
    || state === AppleAppStoreState.REJECTED
    || state === AppleAppStoreState.DEVELOPER_REJECTED;
}

function versionAlreadyWithApple(state: AppleAppStoreState): boolean {
  return state === AppleAppStoreState.WAITING_FOR_REVIEW || state === AppleAppStoreState.IN_REVIEW;
}

async function storeVersion(configuration: AppleStoreReleaseConfiguration): Promise<AppleAppStoreVersion> {
  const filters = new URLSearchParams({
    "filter[app]": configuration.appId,
    "filter[platform]": ApplePlatform.IOS,
    "filter[versionString]": configuration.versionString
  });
  const listed: AppleAppStoreVersionResponse = await (await request(configuration, `appStoreVersions?${filters}`)).json();
  const existing = listed.data.find(candidate => candidate.attributes.versionString === configuration.versionString);
  if (existing) {
    return existing;
  } else {
    const created: AppleAppStoreVersionCreateResponse = await (await request(configuration, "appStoreVersions", {
      data: {
        type: "appStoreVersions",
        attributes: {platform: ApplePlatform.IOS, versionString: configuration.versionString, releaseType: AppleReleaseType.AFTER_APPROVAL},
        relationships: {app: {data: {type: "apps", id: configuration.appId}}}
      }
    })).json();
    return created.data;
  }
}

async function attachBuild(configuration: AppleStoreReleaseConfiguration, version: AppleAppStoreVersion, build: AppleReleaseBuild): Promise<void> {
  await request(configuration, `appStoreVersions/${version.id}/relationships/build`, {
    data: {type: "builds", id: build.id}
  }, AppleRequestMethod.PATCH);
  await request(configuration, `appStoreVersions/${version.id}`, {
    data: {type: "appStoreVersions", id: version.id, attributes: {releaseType: AppleReleaseType.AFTER_APPROVAL}}
  }, AppleRequestMethod.PATCH);
}

async function submitForReview(configuration: AppleStoreReleaseConfiguration, version: AppleAppStoreVersion): Promise<void> {
  const created: AppleReviewSubmissionResponse = await (await request(configuration, "reviewSubmissions", {
    data: {
      type: "reviewSubmissions",
      attributes: {platform: ApplePlatform.IOS},
      relationships: {app: {data: {type: "apps", id: configuration.appId}}}
    }
  })).json();
  await request(configuration, "reviewSubmissionItems", {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: {data: {type: "reviewSubmissions", id: created.data.id}},
        appStoreVersion: {data: {type: "appStoreVersions", id: version.id}}
      }
    }
  });
  await request(configuration, `reviewSubmissions/${created.data.id}`, {
    data: {type: "reviewSubmissions", id: created.data.id, attributes: {submitted: true}}
  }, AppleRequestMethod.PATCH);
  logger("Submitted App Store version %s (build %s) for Apple review; it will release after approval", configuration.versionString, configuration.buildNumber);
}

async function submitValidatedBuild(configuration: AppleStoreReleaseConfiguration, build: AppleReleaseBuild): Promise<void> {
  const version = await storeVersion(configuration);
  const state = version.attributes.appStoreState;
  if (state === AppleAppStoreState.READY_FOR_SALE) {
    throw new Error(`App Store version ${configuration.versionString} is already for sale. Increase MARKETING_VERSION and versionName, then push again.`);
  } else if (versionAlreadyWithApple(state)) {
    logger("App Store version %s is already %s; leaving Apple to finish review", configuration.versionString, state);
  } else if (versionEditable(state)) {
    await attachBuild(configuration, version, build);
    await submitForReview(configuration, version);
  } else {
    throw new Error(`App Store version ${configuration.versionString} is ${state} and cannot be submitted.`);
  }
}

export async function submitProcessedBuild(configuration: AppleStoreReleaseConfiguration): Promise<boolean> {
  const filters = new URLSearchParams({"filter[app]": configuration.appId, "filter[version]": configuration.buildNumber, limit: "2"});
  const response = await request(configuration, `builds?${filters}`);
  const builds: AppleReleaseBuildResponse = await response.json();
  const build = builds.data.find(candidate => candidate.attributes.version === configuration.buildNumber);
  const state = build?.attributes.processingState;
  const submitted = {value: false};
  if (state === AppleBuildProcessingState.FAILED || state === AppleBuildProcessingState.INVALID) {
    throw new Error(`Apple rejected native build ${configuration.buildNumber}: ${state}`);
  } else if (state === AppleBuildProcessingState.VALID) {
    await submitValidatedBuild(configuration, build);
    submitted.value = true;
  } else {
    logger("Waiting for Apple to validate build %s", configuration.buildNumber);
  }
  return submitted.value;
}

async function submitUntilDeadline(configuration: AppleStoreReleaseConfiguration, deadline: number): Promise<boolean> {
  const submitted = {value: false};
  try {
    submitted.value = await submitProcessedBuild(configuration);
  } catch (error) {
    if (retryableAppleError(error) && dateTimeNow().toMillis() < deadline) {
      logger("App Store submission hit a transient Apple error; will retry: %s", error instanceof Error ? error.message : error);
    } else {
      throw error;
    }
  }
  return submitted.value;
}

async function main(): Promise<void> {
  const configuration: AppleStoreReleaseConfiguration = {
    appId: process.env.APP_STORE_CONNECT_APP_ID,
    buildNumber: process.env.MOBILE_BUILD_NUMBER,
    versionString: process.env.MOBILE_STORE_VERSION,
    keyId: process.env.APP_STORE_CONNECT_KEY_ID,
    issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID,
    privateKey: process.env.APP_STORE_CONNECT_PRIVATE_KEY
  };
  if ([configuration.appId, configuration.buildNumber, configuration.versionString, configuration.keyId, configuration.issuerId, configuration.privateKey].some(value => !value)) {
    throw new Error("App Store Connect API credentials, app ID, store version and build number are required.");
  }
  const deadline = dateTimeNow().plus({minutes: 30}).toMillis();
  const submitted = {value: false};
  submitted.value = await submitUntilDeadline(configuration, deadline);
  if (!submitted.value) {
    for await (const tick of setInterval(15000)) {
      if (dateTimeNow().toMillis() >= deadline) {
        throw new Error("Apple processing did not complete within 30 minutes. The upload is retained; check its processing status before retrying.");
      } else if (await submitUntilDeadline(configuration, deadline)) {
        break;
      }
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    logger("App Store submission failed: %s", error.message);
    process.exitCode = 1;
  });
}
