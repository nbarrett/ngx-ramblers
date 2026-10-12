import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { AtlasAwsRegion, AtlasClusterTier, clusterCapacity } from "../../../projects/ngx-ramblers/src/app/models/atlas-cluster.model";
import { atlasClusterCreateBody, clusterHostFromSrv, createAtlasCluster, registrationMongoCluster } from "./atlas-clusters";
import * as environmentsConfig from "../environments/environments-config";
import * as registrationStore from "../site-registration/registration-store";
import * as mongoDatabaseUser from "./mongo-database-user";

describe("atlas-clusters", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => sandbox.restore());

  [AtlasClusterTier.M0, AtlasClusterTier.M20].forEach(tier => {
    it(`creates and lists a ${tier} cluster using the API version that supports regionConfigs`, async () => {
      sandbox.stub(environmentsConfig, "configuredEnvironments").resolves({environments: []});
      sandbox.stub(registrationStore, "registrationSettings").resolves({sourceEnvironmentName: "template"} as never);
      sandbox.stub(mongoDatabaseUser, "platformAtlasAccess").resolves({projectId: "project-1", publicKey: "public-key", privateKey: "private-key"});
      const cluster = {
        name: "group-sites",
        stateName: "CREATING",
        connectionStrings: {standardSrv: "mongodb+srv://group-sites.abc123.mongodb.net"},
        replicationSpecs: [{regionConfigs: [{electableSpecs: {instanceSize: tier}, regionName: "EU_WEST_2"}]}]
      };
      const fetchStub = sandbox.stub(globalThis, "fetch");
      fetchStub.onCall(0).resolves(new Response("{}", {status: 401, headers: {"www-authenticate": "Digest realm=\"Atlas\", nonce=\"nonce\", qop=\"auth\""}}));
      fetchStub.onCall(1).resolves(new Response(JSON.stringify(cluster), {status: 201}));
      fetchStub.onCall(2).resolves(new Response(JSON.stringify({results: [cluster]}), {status: 200}));
      fetchStub.onCall(3).resolves(new Response(JSON.stringify({results: []}), {status: 200}));

      const result = await createAtlasCluster({name: "group-sites", tier, region: AtlasAwsRegion.EU_WEST_1, setAsDefault: false, allowAllNetworkAccess: false});

      const [url, init] = fetchStub.secondCall.args as [string, RequestInit];
      expect(url).toBe("https://cloud.mongodb.com/api/atlas/v2/groups/project-1/clusters");
      expect(init.headers).toMatchObject({Accept: "application/vnd.atlas.2023-02-01+json", "Content-Type": "application/json"});
      expect((init.headers as Record<string, string>).Authorization).toContain("Digest username=\"public-key\"");
      expect(JSON.parse(init.body as string).replicationSpecs[0].regionConfigs[0].electableSpecs.instanceSize).toBe(tier);
      expect((fetchStub.getCall(2).args[1].headers as Record<string, string>).Accept).toBe("application/vnd.atlas.2023-02-01+json");
      expect((fetchStub.getCall(3).args[1].headers as Record<string, string>).Accept).toBe("application/vnd.atlas.2023-01-01+json");
      expect(result.cluster).toMatchObject({name: "group-sites", host: "group-sites.abc123", instanceSize: tier, stateName: "CREATING"});
    });
  });

  it("reads the host prefix from an SRV string with no user", () => {
    expect(clusterHostFromSrv("mongodb+srv://ngx-ramblers-nonprod.abc123.mongodb.net")).toBe("ngx-ramblers-nonprod.abc123");
    expect(clusterHostFromSrv("mongodb+srv://ngx-ramblers-nonprod.abc123.mongodb.net/")).toBe("ngx-ramblers-nonprod.abc123");
  });

  it("reads the host prefix from an SRV string with a user", () => {
    expect(clusterHostFromSrv("mongodb+srv://group_db_user:secret@cluster0.abc123.mongodb.net/ngx-ramblers-group")).toBe("cluster0.abc123");
  });

  it("builds a free London cluster as a tenant on AWS", () => {
    expect(atlasClusterCreateBody("ngx-ramblers-nonprod", AtlasClusterTier.M0, AtlasAwsRegion.EU_WEST_2)).toEqual({
      name: "ngx-ramblers-nonprod",
      clusterType: "REPLICASET",
      replicationSpecs: [{
        regionConfigs: [{
          electableSpecs: {instanceSize: "M0"},
          providerName: "TENANT",
          backingProviderName: "AWS",
          regionName: "EU_WEST_2",
          priority: 7
        }]
      }]
    });
  });

  it("builds a dedicated London cluster on AWS", () => {
    const body = atlasClusterCreateBody("ngx-ramblers-prod", AtlasClusterTier.M20, AtlasAwsRegion.EU_WEST_2) as any;
    expect(body.replicationSpecs[0].regionConfigs[0]).toEqual({
      electableSpecs: {instanceSize: "M20", nodeCount: 3},
      providerName: "AWS",
      regionName: "EU_WEST_2",
      priority: 7
    });
  });

  it("blocks a further site on a free cluster at the collection cap", () => {
    const capacity = clusterCapacity(AtlasClusterTier.M0, 430, 900, 7);
    expect(capacity.canAdd).toBe(false);
    expect(capacity.headline).toContain("500 collections");
  });

  it("allows a further site on an M20 with headroom", () => {
    const capacity = clusterCapacity(AtlasClusterTier.M20, 200, 400, 3);
    expect(capacity.canAdd).toBe(true);
  });

  it("treats an unknown cluster at the free-tier collection cap as full", () => {
    const capacity = clusterCapacity(AtlasClusterTier.UNKNOWN, 425, 1100, 7);
    expect(capacity.canAdd).toBe(false);
    expect(capacity.headline).toContain("500");
  });

  it("uses the Atlas default cluster for new sites instead of the content template", () => {
    expect(registrationMongoCluster({environments: [], atlas: {defaultCluster: "ngx-ramblers-nonprod.abc123"}}, "template.abc123")).toBe("ngx-ramblers-nonprod.abc123");
    expect(registrationMongoCluster({environments: []}, "template.abc123")).toBe("template.abc123");
  });
});
