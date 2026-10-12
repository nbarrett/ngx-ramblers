import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { AppleBuildProcessingState, ApplePilotReleaseConfiguration } from "../projects/ngx-ramblers/src/app/models/mobile-release.model";
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

test("assigns only the requested validated build with a signed API request", async () => {
  const originalFetch = global.fetch;
  const requests: string[] = [];
  global.fetch = async (input, options) => {
    const url = new URL(input.toString());
    requests.push(url.toString());
    const bearer = new Headers(options.headers).get("Authorization").replace("Bearer ", "");
    const [header, payload, signature] = bearer.split(".");
    assert.equal(verify("sha256", Buffer.from(`${header}.${payload}`), {key: keyPair.publicKey, dsaEncoding: "ieee-p1363"}, Buffer.from(signature, "base64url")), true);
    if (options.method === "GET") {
      assert.equal(url.searchParams.get("filter[app]"), "example-app");
      assert.equal(url.searchParams.get("filter[version]"), "101");
      return Response.json({data: [{id: "older-build", attributes: {version: "100", processingState: AppleBuildProcessingState.VALID}}, {id: "example-build", attributes: {version: "101", processingState: AppleBuildProcessingState.VALID}}]});
    } else {
      assert.equal(url.pathname, "/v1/betaGroups/example-pilot/relationships/builds");
      assert.deepEqual(JSON.parse(options.body.toString()), {data: [{type: "builds", id: "example-build"}]});
      return new Response(null, {status: 204});
    }
  };
  try {
    assert.equal(await assignProcessedBuild(configuration), true);
    assert.equal(requests.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fails the release when Apple rejects a build", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({data: [{id: "example-build", attributes: {version: "101", processingState: AppleBuildProcessingState.INVALID}}]});
  try {
    await assert.rejects(assignProcessedBuild(configuration), /Apple rejected native build/);
  } finally {
    global.fetch = originalFetch;
  }
});
