import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { MongoClient } from "mongodb";
import { createEnvironmentMongoUser } from "./mongo-database-user";

describe("createEnvironmentMongoUser", () => {
  const sandboxState: {sandbox: sinon.SinonSandbox | null} = {sandbox: null};

  beforeEach(() => {
    sandboxState.sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandboxState.sandbox.restore();
  });

  it("creates a readWrite user named for the environment and does not reuse the admin user name", async () => {
    const command = sinon.stub().resolves();
    sandboxState.sandbox.stub(MongoClient, "connect").resolves({
      db: () => ({command}),
      close: sinon.stub().resolves()
    } as any);
    const created = await createEnvironmentMongoUser(
      {cluster: "cluster.mongodb.net", username: "shared_admin", password: "shared-secret"},
      "ngx-ramblers-new-group",
      "new-group"
    );
    expect(created.username).toBe("ngx_new_group_db_user");
    expect(created.username).not.toBe("shared_admin");
    expect(created.password).not.toBe("shared-secret");
    expect(created.password.length).toBeGreaterThan(20);
    expect(command.firstCall.args[0].createUser).toBe("ngx_new_group_db_user");
    expect(command.firstCall.args[0].roles).toEqual([
      {role: "readWrite", db: "ngx-ramblers-new-group"},
      {role: "dbAdmin", db: "ngx-ramblers-new-group"}
    ]);
  });

  it("resets the password when that user already exists", async () => {
    const command = sinon.stub();
    command.onFirstCall().rejects({codeName: "DuplicateUser", code: 51003});
    command.onSecondCall().resolves();
    sandboxState.sandbox.stub(MongoClient, "connect").resolves({
      db: () => ({command}),
      close: sinon.stub().resolves()
    } as any);
    const created = await createEnvironmentMongoUser(
      {cluster: "cluster.mongodb.net", username: "shared_admin", password: "shared-secret"},
      "ngx-ramblers-new-group",
      "new-group"
    );
    expect(command.secondCall.args[0].updateUser).toBe("ngx_new_group_db_user");
    expect(command.secondCall.args[0].pwd).toBe(created.password);
  });
});
