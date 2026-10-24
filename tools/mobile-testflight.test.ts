import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { AppleBuildProcessingState, AppleExternalBuildState, ApplePilotReleaseConfiguration } from "../projects/ngx-ramblers/src/app/models/mobile-release.model";
import { assignProcessedBuild } from "./mobile-testflight";

const keyPair = generateKeyPairSync("ec", {namedCurve: "prime256v1"});
const configuration: ApplePilotReleaseConfiguration = {
  appId: "example-app",
  groupId: "example-pilot",
  buildNumber: "101",
  keyId: "EXAMPLEKEY",
  issuerId: "example-issuer",
  privateKey: keyPair.privateKey.export({type: "pkcs8", format: "pem"}).toString()
};

test("keeps an unprocessed build out of the pilot group", async () => {
  const originalFetch = global.fetch;
  const requests: string[] = [];
  global.fetch = async input => {
    requests.push(input.toString());
    return Response.json({data: [{id: "example-build", attributes: {version: "101", processingState: AppleBuildProcessingState.PROCESSING}}]});
  };
  try {
    assert.equal(await assignProcessedBuild(configuration), false);
    assert.equal(requests.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

function processedBuildRequests(state: AppleExternalBuildState, autoNotifyEnabled = false, alreadyAssigned = false, internalGroup = false) {
  const originalFetch = global.fetch;
  const requests: Request[] = [];
  global.fetch = async (input, options) => {
    const recorded = new Request(input, options);
    requests.push(recorded);
    const url = new URL(recorded.url);
    const bearer = recorded.headers.get("Authorization").replace("Bearer ", "");
    const [header, payload, signature] = bearer.split(".");
    assert.equal(verify("sha256", Buffer.from(`${header}.${payload}`), {key: keyPair.publicKey, dsaEncoding: "ieee-p1363"}, Buffer.from(signature, "base64url")), true);
    if (url.pathname === "/v1/builds") {
      assert.equal(url.searchParams.get("filter[app]"), "example-app");
      assert.equal(url.searchParams.get("filter[version]"), "101");
      return Response.json({data: [{id: "older-build", attributes: {version: "100", processingState: AppleBuildProcessingState.VALID}}, {id: "example-build", attributes: {version: "101", processingState: AppleBuildProcessingState.VALID}, relationships: {betaGroups: {data: alreadyAssigned ? [{id: configuration.groupId}] : []}}}]});
    } else if (url.pathname === "/v1/betaGroups/example-pilot") {
      return Response.json({data: {attributes: {isInternalGroup: internalGroup}, relationships: {app: {data: {id: configuration.appId}}}}});
    } else if (url.pathname === "/v1/builds/example-build/buildBetaDetail") {
      return Response.json({data: {id: "example-detail", attributes: {autoNotifyEnabled, externalBuildState: state}}});
    } else {
      return new Response(null, {status: 204});
    }
  };
  return {requests, restore: () => global.fetch = originalFetch};
}

test("keeps Apple tester emails off and submits the exact validated build for external review without inviting testers again", async () => {
  const mock = processedBuildRequests(AppleExternalBuildState.READY_FOR_BETA_SUBMISSION);
  try {
    assert.equal(await assignProcessedBuild(configuration), true);
    assert.deepEqual(mock.requests.map(request => `${request.method} ${new URL(request.url).pathname}`), [
      "GET /v1/builds",
      "GET /v1/betaGroups/example-pilot",
      "GET /v1/builds/example-build/buildBetaDetail",
      "POST /v1/betaGroups/example-pilot/relationships/builds",
      "POST /v1/betaAppReviewSubmissions"
    ]);
    assert.deepEqual(await mock.requests[3].json(), {data: [{type: "builds", id: "example-build"}]});
    assert.deepEqual(await mock.requests[4].json(), {data: {type: "betaAppReviewSubmissions", relationships: {build: {data: {type: "builds", id: "example-build"}}}}});
  } finally {
    mock.restore();
  }
});

test("turns Apple tester emails off when a processed build still has them enabled", async () => {
  const mock = processedBuildRequests(AppleExternalBuildState.READY_FOR_BETA_SUBMISSION, true);
  try {
    assert.equal(await assignProcessedBuild(configuration), true);
    assert.deepEqual(mock.requests.map(request => `${request.method} ${new URL(request.url).pathname}`), [
      "GET /v1/builds",
      "GET /v1/betaGroups/example-pilot",
      "GET /v1/builds/example-build/buildBetaDetail",
      "PATCH /v1/buildBetaDetails/example-detail",
      "POST /v1/betaGroups/example-pilot/relationships/builds",
      "POST /v1/betaAppReviewSubmissions"
    ]);
    assert.deepEqual(await mock.requests[3].json(), {data: {type: "buildBetaDetails", id: "example-detail", attributes: {autoNotifyEnabled: false}}});
  } finally {
    mock.restore();
  }
});

for (const state of [AppleExternalBuildState.WAITING_FOR_BETA_REVIEW, AppleExternalBuildState.IN_BETA_REVIEW, AppleExternalBuildState.IN_BETA_TESTING]) {
  test(`does not resubmit or reinvite testers when the build is already ${state}`, async () => {
    const mock = processedBuildRequests(state);
    try {
      assert.equal(await assignProcessedBuild(configuration), true);
      assert.deepEqual(mock.requests.map(request => new URL(request.url).pathname), ["/v1/builds", "/v1/betaGroups/example-pilot", "/v1/builds/example-build/buildBetaDetail", "/v1/betaGroups/example-pilot/relationships/builds"]);
    } finally {
      mock.restore();
    }
  });
}

for (const state of [AppleExternalBuildState.BETA_REJECTED, AppleExternalBuildState.EXPIRED]) {
  test(`fails distribution when external testing is ${state}`, async () => {
    const mock = processedBuildRequests(state);
    try {
      await assert.rejects(assignProcessedBuild(configuration), /external testing is blocked/);
      assert.equal(mock.requests.length, 3);
    } finally {
      mock.restore();
    }
  });
}

test("fails the release when Apple rejects a build", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({data: [{id: "example-build", attributes: {version: "101", processingState: AppleBuildProcessingState.INVALID}}]});
  try {
    await assert.rejects(assignProcessedBuild(configuration), /Apple rejected native build/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("rejects an internal group before changing distribution", async () => {
  const mock = processedBuildRequests(AppleExternalBuildState.IN_BETA_TESTING, true, false, true);
  try {
    await assert.rejects(assignProcessedBuild(configuration), /must be external/);
    assert.deepEqual(mock.requests.map(request => request.method), ["GET", "GET"]);
  } finally {
    mock.restore();
  }
});

test("leaves an available build in its existing trial group without sending another invitation", async () => {
  const mock = processedBuildRequests(AppleExternalBuildState.IN_BETA_TESTING, false, true);
  try {
    assert.equal(await assignProcessedBuild(configuration), true);
    assert.deepEqual(mock.requests.map(request => request.method), ["GET", "GET", "GET"]);
  } finally {
    mock.restore();
  }
});
