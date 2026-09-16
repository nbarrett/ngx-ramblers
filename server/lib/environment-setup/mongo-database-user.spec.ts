import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { MongoClient } from "mongodb";
import { createEnvironmentMongoUser, deleteEnvironmentMongoUser, environmentDatabaseUserName, waitForMongoLogin } from "./mongo-database-user";
import { atlasDigestAuthorisation } from "./atlas-admin-api";

const atlas = {projectId: "project-1", publicKey: "public-key", privateKey: "private-key"};

function atlasResponse(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {status, headers});
}

describe("createEnvironmentMongoUser", () => {
  const sandboxState: {sandbox: sinon.SinonSandbox | null} = {sandbox: null};

  beforeEach(() => {
    sandboxState.sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandboxState.sandbox.restore();
  });

  it("creates a user through the Atlas Admin API with read and write on the new database only", async () => {
    const fetchStub = sandboxState.sandbox.stub(globalThis, "fetch");
    fetchStub.onFirstCall().resolves(atlasResponse(401, {}, {"www-authenticate": "Digest realm=\"MMS Public API\", nonce=\"abc\", qop=\"auth\""}));
    fetchStub.onSecondCall().resolves(atlasResponse(201));
    const created = await createEnvironmentMongoUser(atlas, "ngx-ramblers-new-group", "new-group");
    const [url, init] = fetchStub.secondCall.args as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(url).toBe("https://cloud.mongodb.com/api/atlas/v2/groups/project-1/databaseUsers");
    expect((init.headers as Record<string, string>).Authorization).toContain("Digest username=\"public-key\"");
    expect(created.username).toBe("ngx_new_group_db_user");
    expect(created.password.length).toBeGreaterThan(20);
    expect(body).toMatchObject({databaseName: "admin", username: "ngx_new_group_db_user", password: created.password});
    expect(body.roles).toEqual([
      {databaseName: "ngx-ramblers-new-group", roleName: "readWrite"},
      {databaseName: "ngx-ramblers-new-group", roleName: "dbAdmin"}
    ]);
  });

  it("resets the password when that user already exists", async () => {
    const fetchStub = sandboxState.sandbox.stub(globalThis, "fetch");
    fetchStub.onFirstCall().resolves(atlasResponse(409, {errorCode: "USER_ALREADY_EXISTS"}));
    fetchStub.onSecondCall().resolves(atlasResponse(200));
    const created = await createEnvironmentMongoUser(atlas, "ngx-ramblers-new-group", "new-group");
    const [url, init] = fetchStub.secondCall.args as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(url).toBe("https://cloud.mongodb.com/api/atlas/v2/groups/project-1/databaseUsers/admin/ngx_new_group_db_user");
    expect(JSON.parse(init.body as string).password).toBe(created.password);
  });

  it("explains what to set up when there is no Atlas API key, and never shows a password", async () => {
    await expect(createEnvironmentMongoUser({projectId: "project-1"}, "ngx-ramblers-new-group", "new-group")).rejects.toThrow("MongoDB Atlas API access is not set up");
    await expect(createEnvironmentMongoUser({publicKey: "p", privateKey: "k"}, "ngx-ramblers-new-group", "new-group")).rejects.toThrow("no MongoDB Atlas project ID");
    const fetchStub = sandboxState.sandbox.stub(globalThis, "fetch");
    fetchStub.resolves(atlasResponse(403, {errorCode: "USER_UNAUTHORIZED", detail: "Not authorised"}));
    const failure: Error = await createEnvironmentMongoUser(atlas, "ngx-ramblers-new-group", "new-group").catch(error => error);
    expect(failure.message).toBe("MongoDB Atlas would not create the database user ngx_new_group_db_user (403 USER_UNAUTHORIZED): Not authorised");
  });

  it("answers the digest challenge as RFC 2617 describes", () => {
    const header = atlasDigestAuthorisation("Digest realm=\"r\", nonce=\"n\", qop=\"auth\"", "GET", "/api/atlas/v2/groups", {publicKey: "u", privateKey: "p"}, "c");
    expect(header).toContain("response=\"");
    expect(header).toContain("uri=\"/api/atlas/v2/groups\"");
    expect(header).toContain("cnonce=\"c\"");
  });

  it("waits for Atlas to activate a new user before carrying on", async () => {
    const connect = sandboxState.sandbox.stub(MongoClient, "connect");
    connect.onFirstCall().rejects(new Error("bad auth : Authentication failed."));
    connect.onSecondCall().resolves({db: () => ({command: sinon.stub().resolves({ok: 1})}), close: sinon.stub().resolves()} as any);
    const waits: number[] = [];
    await waitForMongoLogin("cluster.mongodb.net", {username: "ngx_new_group_db_user", password: "secret"}, "ngx-ramblers-new-group", attempt => waits.push(attempt), 1);
    expect(waits).toEqual([1, 0]);
    expect(connect.callCount).toBe(2);
  });

  it("deletes the site's own user through Atlas, and treats a missing one as already gone", async () => {
    const fetchStub = sandboxState.sandbox.stub(globalThis, "fetch");
    fetchStub.onFirstCall().resolves(new Response(null, {status: 204}));
    fetchStub.onSecondCall().resolves(atlasResponse(404, {errorCode: "USERNAME_NOT_FOUND"}));
    expect(await deleteEnvironmentMongoUser(atlas, "ngx_new_group_db_user")).toBe("Deleted ngx_new_group_db_user");
    const [url, init] = fetchStub.firstCall.args as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(url).toBe("https://cloud.mongodb.com/api/atlas/v2/groups/project-1/databaseUsers/admin/ngx_new_group_db_user");
    expect(await deleteEnvironmentMongoUser(atlas, "ngx_new_group_db_user")).toBe("ngx_new_group_db_user not found (already deleted)");
    expect(environmentDatabaseUserName("new-forest")).toBe("ngx_new_forest_db_user");
  });
});
