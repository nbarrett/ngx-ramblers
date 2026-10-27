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

function processedBuildRequests(state: AppleExternalBuildState, autoNotifyEnabled = true, alreadyAssigned = false, internalGroup = false, activateOnEnable = false) {
  const originalFetch = global.fetch;
  const requests: Request[] = [];
  const distribution = {state};
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
      return Response.json({data: {id: "example-detail", attributes: {autoNotifyEnabled, externalBuildState: distribution.state}}});
    } else if (url.pathname === "/v1/buildBetaNotifications" || (url.pathname === "/v1/buildBetaDetails/example-detail" && activateOnEnable)) {
      distribution.state = AppleExternalBuildState.IN_BETA_TESTING;
      return new Response(null, {status: 204});
    } else {
      return new Response(null, {status: 204});
    }
  };
  return {requests, restore: () => global.fetch = originalFetch};
}

test("submits the exact validated build for external review with automatic availability without inviting testers again", async () => {
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

test("enables automatic availability when a processed build has notifications disabled", async () => {
  const mock = processedBuildRequests(AppleExternalBuildState.READY_FOR_BETA_SUBMISSION, false);
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
    assert.deepEqual(await mock.requests[3].json(), {data: {type: "buildBetaDetails", id: "example-detail", attributes: {autoNotifyEnabled: true}}});
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
  const mock = processedBuildRequests(AppleExternalBuildState.IN_BETA_TESTING, true, true);
  try {
    assert.equal(await assignProcessedBuild(configuration), true);
    assert.deepEqual(mock.requests.map(request => request.method), ["GET", "GET", "GET"]);
  } finally {
    mock.restore();
  }
});

for (const state of [AppleExternalBuildState.BETA_APPROVED, AppleExternalBuildState.READY_FOR_BETA_TESTING]) {
  test(`releases an approved build still awaiting distribution in ${state}`, async () => {
    const mock = processedBuildRequests(state, true, true);
    try {
      assert.equal(await assignProcessedBuild(configuration), true);
      assert.deepEqual(mock.requests.map(request => `${request.method} ${new URL(request.url).pathname}`), [
        "GET /v1/builds",
        "GET /v1/betaGroups/example-pilot",
        "GET /v1/builds/example-build/buildBetaDetail",
        "GET /v1/builds/example-build/buildBetaDetail",
        "POST /v1/buildBetaNotifications",
        "GET /v1/builds/example-build/buildBetaDetail"
      ]);
      assert.deepEqual(await mock.requests[4].json(), {data: {type: "buildBetaNotifications", relationships: {build: {data: {type: "builds", id: "example-build"}}}}});
    } finally {
      mock.restore();
    }
  });
}

test("does not send a second notification when enabling automatic availability releases the approved build", async () => {
  const mock = processedBuildRequests(AppleExternalBuildState.BETA_APPROVED, false, true, false, true);
  try {
    assert.equal(await assignProcessedBuild(configuration), true);
    assert.deepEqual(mock.requests.map(request => `${request.method} ${new URL(request.url).pathname}`), [
      "GET /v1/builds",
      "GET /v1/betaGroups/example-pilot",
      "GET /v1/builds/example-build/buildBetaDetail",
      "PATCH /v1/buildBetaDetails/example-detail",
      "GET /v1/builds/example-build/buildBetaDetail"
    ]);
  } finally {
    mock.restore();
  }
});

function notificationResponses(status: number, states: AppleExternalBuildState[], advanceTime: (() => void) | null = null) {
  const mock = processedBuildRequests(AppleExternalBuildState.BETA_APPROVED, true, true);
  const originalFetch = global.fetch;
  const progress = {notified: false, reads: 0};
  global.fetch = async (input, options) => {
    const response = await originalFetch(input, options);
    const path = new URL(input.toString()).pathname;
    if (path === "/v1/buildBetaNotifications") {
      progress.notified = true;
      return new Response(null, {status});
    } else if (progress.notified && path === "/v1/builds/example-build/buildBetaDetail") {
      const state = states[Math.min(progress.reads, states.length - 1)];
      progress.reads += 1;
      advanceTime?.();
      return Response.json({data: {id: "example-detail", attributes: {autoNotifyEnabled: true, externalBuildState: state}}});
    } else {
      return response;
    }
  };
  return mock;
}

test("waits for Apple's delayed availability without notifying twice", async () => {
  const mock = notificationResponses(204, [AppleExternalBuildState.BETA_APPROVED, AppleExternalBuildState.READY_FOR_BETA_TESTING, AppleExternalBuildState.IN_BETA_TESTING]);
  try {
    assert.equal(await assignProcessedBuild(configuration), true);
    assert.equal(mock.requests.filter(request => request.method === "POST").length, 1);
    assert.equal(mock.requests.filter(request => new URL(request.url).pathname.endsWith("/buildBetaDetail")).length, 5);
  } finally {
    mock.restore();
  }
});

for (const states of [[AppleExternalBuildState.IN_BETA_TESTING], [AppleExternalBuildState.READY_FOR_BETA_TESTING, AppleExternalBuildState.IN_BETA_TESTING]]) {
  test(`accepts a notification conflict only after confirming testing through ${states.join(", ")}`, async () => {
    const mock = notificationResponses(409, states);
    try {
      assert.equal(await assignProcessedBuild(configuration), true);
      assert.equal(mock.requests.filter(request => request.method === "POST").length, 1);
    } finally {
      mock.restore();
    }
  });
}

for (const status of [204, 409]) {
  test(`fails after the confirmation deadline when notification status ${status} never results in testing`, async context => {
    context.mock.timers.enable({apis: ["Date"]});
    const mock = notificationResponses(status, [AppleExternalBuildState.READY_FOR_BETA_TESTING], () => context.mock.timers.tick(16000));
    try {
      await assert.rejects(assignProcessedBuild(configuration), new RegExp(`has not confirmed external availability.*notification status ${status}`));
      assert.equal(mock.requests.filter(request => request.method === "POST").length, 1);
    } finally {
      mock.restore();
      context.mock.timers.reset();
    }
  });
}

test("preserves notification errors other than conflicts", async () => {
  const mock = notificationResponses(403, [AppleExternalBuildState.IN_BETA_TESTING]);
  try {
    await assert.rejects(assignProcessedBuild(configuration), /request failed \(403\)/);
    assert.equal(mock.requests.length, 5);
  } finally {
    mock.restore();
  }
});

test("retries a transient App Store Connect failure then continues", async () => {
  const originalFetch = global.fetch;
  const requests: string[] = [];
  const remainingFailures = {count: 1};
  global.fetch = async input => {
    requests.push(input.toString());
    if (remainingFailures.count > 0) {
      remainingFailures.count -= 1;
      return new Response(JSON.stringify({errors: [{status: "500", code: "UNEXPECTED_ERROR"}]}), {status: 500});
    } else {
      return Response.json({data: [{id: "example-build", attributes: {version: "101", processingState: AppleBuildProcessingState.PROCESSING}}]});
    }
  };
  try {
    assert.equal(await assignProcessedBuild(configuration), false);
    assert.equal(requests.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fails promptly if Apple rejects a build while availability is being confirmed", async () => {
  const mock = notificationResponses(204, [AppleExternalBuildState.BETA_APPROVED, AppleExternalBuildState.BETA_REJECTED]);
  try {
    await assert.rejects(assignProcessedBuild(configuration), /has not confirmed external availability.*BETA_REJECTED/);
    assert.equal(mock.requests.filter(request => request.method === "POST").length, 1);
  } finally {
    mock.restore();
  }
});
