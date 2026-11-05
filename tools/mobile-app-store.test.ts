import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { AppleAppStoreState, AppleBuildProcessingState, AppleStoreReleaseConfiguration } from "../projects/ngx-ramblers/src/app/models/mobile-release.model";
import { submitProcessedBuild } from "./mobile-app-store";

const keyPair = generateKeyPairSync("ec", {namedCurve: "prime256v1"});
const configuration: AppleStoreReleaseConfiguration = {
  appId: "example-app",
  buildNumber: "4101",
  versionString: "1.1",
  keyId: "EXAMPLEKEY",
  issuerId: "example-issuer",
  privateKey: keyPair.privateKey.export({type: "pkcs8", format: "pem"}).toString()
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {status});
}

function mockApple(routes: (url: URL, method: string) => Response | null): {requests: Request[]; restore: () => void} {
  const originalFetch = global.fetch;
  const requests: Request[] = [];
  global.fetch = async (input, options) => {
    const recorded = new Request(input, options);
    requests.push(recorded);
    const url = new URL(recorded.url);
    const bearer = recorded.headers.get("Authorization").replace("Bearer ", "");
    const [header, payload, signature] = bearer.split(".");
    assert.equal(verify("sha256", Buffer.from(`${header}.${payload}`), {key: keyPair.publicKey, dsaEncoding: "ieee-p1363"}, Buffer.from(signature, "base64url")), true);
    const matched = routes(url, recorded.method);
    if (matched) {
      return matched;
    } else {
      return new Response(null, {status: 204});
    }
  };
  return {requests, restore: () => global.fetch = originalFetch};
}

test("keeps an unprocessed build out of App Review", async () => {
  const mock = mockApple(url => url.pathname === "/v1/builds"
    ? jsonResponse({data: [{id: "example-build", attributes: {version: "4101", processingState: AppleBuildProcessingState.PROCESSING}}]})
    : null);
  try {
    assert.equal(await submitProcessedBuild(configuration), false);
    assert.equal(mock.requests.length, 1);
  } finally {
    mock.restore();
  }
});

test("fails when Apple rejects a build", async () => {
  const mock = mockApple(() => jsonResponse({data: [{id: "example-build", attributes: {version: "4101", processingState: AppleBuildProcessingState.INVALID}}]}));
  try {
    await assert.rejects(submitProcessedBuild(configuration), /Apple rejected native build/);
  } finally {
    mock.restore();
  }
});

test("creates version 1.1, attaches the build and submits it for App Review", async () => {
  const mock = mockApple((url, method) => {
    if (url.pathname === "/v1/builds") {
      return jsonResponse({data: [{id: "example-build", attributes: {version: "4101", processingState: AppleBuildProcessingState.VALID}}]});
    } else if (url.pathname === "/v1/appStoreVersions" && method === "GET") {
      return jsonResponse({data: []});
    } else if (url.pathname === "/v1/appStoreVersions" && method === "POST") {
      return jsonResponse({data: {id: "version-11", attributes: {versionString: "1.1", appStoreState: AppleAppStoreState.PREPARE_FOR_SUBMISSION}}});
    } else if (url.pathname === "/v1/reviewSubmissions" && method === "POST") {
      return jsonResponse({data: {id: "review-1", attributes: {submitted: false}}});
    } else {
      return null;
    }
  });
  try {
    assert.equal(await submitProcessedBuild(configuration), true);
    assert.deepEqual(mock.requests.map(request => `${request.method} ${new URL(request.url).pathname}`), [
      "GET /v1/builds",
      "GET /v1/appStoreVersions",
      "POST /v1/appStoreVersions",
      "PATCH /v1/appStoreVersions/version-11/relationships/build",
      "PATCH /v1/appStoreVersions/version-11",
      "POST /v1/reviewSubmissions",
      "POST /v1/reviewSubmissionItems",
      "PATCH /v1/reviewSubmissions/review-1"
    ]);
    assert.deepEqual(await mock.requests[2].json(), {
      data: {
        type: "appStoreVersions",
        attributes: {platform: "IOS", versionString: "1.1", releaseType: "AFTER_APPROVAL"},
        relationships: {app: {data: {type: "apps", id: "example-app"}}}
      }
    });
    assert.deepEqual(await mock.requests[7].json(), {
      data: {type: "reviewSubmissions", id: "review-1", attributes: {submitted: true}}
    });
  } finally {
    mock.restore();
  }
});

test("leaves a version already with Apple Review alone", async () => {
  const mock = mockApple(url => {
    if (url.pathname === "/v1/builds") {
      return jsonResponse({data: [{id: "example-build", attributes: {version: "4101", processingState: AppleBuildProcessingState.VALID}}]});
    } else if (url.pathname === "/v1/appStoreVersions") {
      return jsonResponse({data: [{id: "version-11", attributes: {versionString: "1.1", appStoreState: AppleAppStoreState.WAITING_FOR_REVIEW}}]});
    } else {
      return null;
    }
  });
  try {
    assert.equal(await submitProcessedBuild(configuration), true);
    assert.deepEqual(mock.requests.map(request => `${request.method} ${new URL(request.url).pathname}`), [
      "GET /v1/builds",
      "GET /v1/appStoreVersions"
    ]);
  } finally {
    mock.restore();
  }
});

test("fails when version 1.1 is already for sale", async () => {
  const mock = mockApple(url => {
    if (url.pathname === "/v1/builds") {
      return jsonResponse({data: [{id: "example-build", attributes: {version: "4101", processingState: AppleBuildProcessingState.VALID}}]});
    } else {
      return jsonResponse({data: [{id: "version-11", attributes: {versionString: "1.1", appStoreState: AppleAppStoreState.READY_FOR_SALE}}]});
    }
  });
  try {
    await assert.rejects(submitProcessedBuild(configuration), /already for sale/);
  } finally {
    mock.restore();
  }
});
