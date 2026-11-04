import expect from "expect";
import sinon from "sinon";
import {afterEach, describe, it} from "mocha";
import {Db, MongoClient} from "mongodb";
import {EmptyCollectionCandidate} from "../../../projects/ngx-ramblers/src/app/models/environment-collection-cleanup.model";
import {RegistrationSettings} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import * as environments from "../environments/environments-config";
import * as registration from "../site-registration/registration-store";
import {removeEmptyCollections} from "./collection-cleanup";

describe("empty collection deletion", () => {
  const sandbox = sinon.createSandbox();
  const source = {environment: "protected-source", cluster: "cluster.example.org", database: "source", collection: "review_fixture", documentCount: 0, indexCount: 1} as EmptyCollectionCandidate;
  const target = {...source, environment: "destination", database: "destination"};

  afterEach(() => sandbox.restore());

  it("skips the protected source even when it is supplied directly or selected before the source setting changed", async () => {
    sandbox.stub(environments, "configuredEnvironments").resolves({environments: [source, target].map(candidate => ({
      environment: candidate.environment, mongo: {cluster: candidate.cluster, db: candidate.database, username: "fixture", password: "fixture"}
    }))});
    sandbox.stub(registration, "registrationSettings").resolves({sourceEnvironmentName: source.environment} as RegistrationSettings);
    const connect = sandbox.stub(MongoClient.prototype, "connect").resolves();
    expect(await removeEmptyCollections(source.cluster, [source])).toEqual({removed: [], skipped: [source]});
    expect(connect.called).toBe(false);
  });

  it("still removes eligible destination collections and rejects a collection which has gained documents", async () => {
    sandbox.stub(environments, "configuredEnvironments").resolves({environments: [{
      environment: target.environment, mongo: {cluster: target.cluster, db: target.database, username: "fixture", password: "fixture"}
    }]});
    sandbox.stub(registration, "registrationSettings").resolves({sourceEnvironmentName: source.environment} as RegistrationSettings);
    sandbox.stub(MongoClient.prototype, "connect").resolves();
    sandbox.stub(MongoClient.prototype, "close").resolves();
    const drop = sandbox.stub().resolves(true);
    const countDocuments = sandbox.stub().onFirstCall().resolves(0).onSecondCall().resolves(1);
    sandbox.stub(MongoClient.prototype, "db").returns({
      collection: () => ({countDocuments, indexes: async () => [{name: "_id_", key: {_id: 1}}], drop}),
      listCollections: () => ({next: async () => ({name: target.collection, type: "collection", options: {}})})
    } as unknown as Db);
    expect(await removeEmptyCollections(target.cluster, [target])).toEqual({removed: [target], skipped: []});
    expect(await removeEmptyCollections(target.cluster, [target])).toEqual({removed: [], skipped: [target]});
    expect(drop.calledOnce).toBe(true);
  });
});
