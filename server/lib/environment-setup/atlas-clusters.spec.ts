import expect from "expect";
import { describe, it } from "mocha";
import { AtlasAwsRegion, AtlasClusterTier, clusterCapacity } from "../../../projects/ngx-ramblers/src/app/models/atlas-cluster.model";
import { atlasClusterCreateBody, clusterHostFromSrv, registrationMongoCluster } from "./atlas-clusters";

describe("atlas-clusters", () => {
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
