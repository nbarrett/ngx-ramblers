import expect from "expect";
import sinon from "sinon";
import {afterEach, beforeEach, describe, it} from "mocha";
import * as environmentsConfig from "../../environments/environments-config";
import * as registrationStore from "../../site-registration/registration-store";
import {destroyEnvironment, validatedDatabaseForDestroy} from "./destroy";

describe("environment destruction", () => {
  const sandboxState: {sandbox: sinon.SinonSandbox | null} = {sandbox: null};

  beforeEach(() => {
    sandboxState.sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandboxState.sandbox.restore();
  });

  it("treats skipped steps as skipped, not failed, and still removes the environment entry and registration", async () => {
    const removeEnvironment = sandboxState.sandbox.stub(environmentsConfig, "removeEnvironmentFromDatabase").resolves(true);
    const deleteRegistrations = sandboxState.sandbox.stub(registrationStore, "deleteRegistrationsForEnvironment").resolves(1);
    const result = await destroyEnvironment({name: "destroy-spec", appName: "ngx-ramblers-destroy-spec", skipFly: true, skipS3: true, skipDatabase: true});
    expect(result.success).toBe(true);
    expect(result.steps.filter(step => step.skipped).map(step => step.step)).toEqual(["fly.io app", "S3 bucket and IAM", "Database"]);
    expect(result.steps.filter(step => !step.success)).toEqual([]);
    expect(removeEnvironment.calledOnceWith("destroy-spec")).toBe(true);
    expect(deleteRegistrations.calledOnceWith("destroy-spec")).toBe(true);
  });

  it("allows only the exact database named by the environment connection", () => {
    expect(validatedDatabaseForDestroy("mongodb+srv://user:pass@example.mongodb.net/ngx-ramblers-new-forest?retryWrites=true", "ngx-ramblers-new-forest"))
      .toBe("ngx-ramblers-new-forest");
    expect(() => validatedDatabaseForDestroy("mongodb+srv://user:pass@example.mongodb.net/another-site", "ngx-ramblers-new-forest"))
      .toThrow(/not ngx-ramblers-new-forest/);
  });

  it("refuses to delete MongoDB system databases", () => {
    expect(() => validatedDatabaseForDestroy("mongodb://localhost/admin", "admin")).toThrow(/system database/);
    expect(() => validatedDatabaseForDestroy("mongodb://localhost/", "ngx-ramblers-new-forest")).toThrow(/no database/);
  });
});
