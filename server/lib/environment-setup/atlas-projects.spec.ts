import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import * as environmentsConfig from "../environments/environments-config";
import * as configController from "../mongo/controllers/config";
import * as atlasApi from "./atlas-admin-api";
import { atlasProjectForCluster } from "./atlas-projects";

describe("Atlas projects for individual clusters", () => {
  const sandbox = sinon.createSandbox();
  const atlas = {projectId: "original-project", publicKey: "public", privateKey: "private"};

  afterEach(() => sandbox.restore());

  it("reuses a saved project when cluster creation is retried", async () => {
    sandbox.stub(environmentsConfig, "configuredEnvironments").resolves({environments: [], atlas: {managedProjects: [{name: "hillside", projectId: "hillside-project"}]}});
    const request = sandbox.stub(atlasApi, "atlasRequest");
    expect(await atlasProjectForCluster(atlas, "hillside")).toEqual({...atlas, projectId: "hillside-project"});
    expect(request.called).toBe(false);
  });

  it("creates the project in the original organisation and preserves existing settings", async () => {
    sandbox.stub(environmentsConfig, "configuredEnvironments").resolves({environments: []});
    const request = sandbox.stub(atlasApi, "atlasRequest");
    request.onFirstCall().resolves({status: 200, body: {orgId: "organisation"}});
    request.onSecondCall().resolves({status: 201, body: {id: "hillside-project"}});
    sandbox.stub(configController, "queryKey").resolves({value: {environments: [], atlas: {...atlas, defaultCluster: "existing.abc123"}}} as never);
    const save = sandbox.stub(configController, "createOrUpdateKey").resolves(null);
    expect(await atlasProjectForCluster(atlas, "hillside")).toEqual({...atlas, projectId: "hillside-project"});
    expect(request.secondCall.args).toEqual([atlas, "POST", "/groups", {name: "hillside", orgId: "organisation"}]);
    expect(save.firstCall.args[1]).toMatchObject({atlas: {...atlas, defaultCluster: "existing.abc123", managedProjects: [{name: "hillside", projectId: "hillside-project"}]}});
  });

  it("does not save or create any further resources when permission is denied", async () => {
    sandbox.stub(environmentsConfig, "configuredEnvironments").resolves({environments: []});
    const request = sandbox.stub(atlasApi, "atlasRequest");
    request.onFirstCall().resolves({status: 200, body: {orgId: "organisation"}});
    request.onSecondCall().resolves({status: 403, body: {detail: "Project creation denied"}});
    const save = sandbox.stub(configController, "createOrUpdateKey");
    await expect(atlasProjectForCluster(atlas, "hillside")).rejects.toThrow("Project creation denied");
    expect(save.called).toBe(false);
  });
});
