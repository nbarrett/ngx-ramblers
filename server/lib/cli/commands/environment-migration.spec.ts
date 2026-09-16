import expect from "expect";
import { describe, it } from "mocha";
import { targetAwsFrom } from "./environment-migration";
import { AWS_DEFAULTS } from "../../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";

describe("environment-migration command", () => {

  describe("targetAwsFrom", () => {

    it("returns null when no destination AWS flags are supplied", () => {
      expect(targetAwsFrom({ targetCluster: "cluster" }, {})).toBeNull();
    });

    it("fails fast when the bucket and key id are supplied without the secret", () => {
      expect(() => targetAwsFrom({ targetBucket: "bucket", targetAccessKeyId: "AKIA" }, {}))
        .toThrow(/must be supplied together/);
    });

    it("fails fast when only the secret is supplied", () => {
      expect(() => targetAwsFrom({}, { [Environment.MIGRATION_TARGET_AWS_SECRET_ACCESS_KEY]: "secret" }))
        .toThrow(/must be supplied together/);
    });

    it("reads the secret from the environment and defaults the region", () => {
      expect(targetAwsFrom({ targetBucket: "bucket", targetAccessKeyId: "AKIA" }, { [Environment.MIGRATION_TARGET_AWS_SECRET_ACCESS_KEY]: "from-env" }))
        .toEqual({ bucket: "bucket", region: AWS_DEFAULTS.REGION, accessKeyId: "AKIA", secretAccessKey: "from-env" });
    });

    it("prefers the flag over the environment variable and keeps an explicit region", () => {
      expect(targetAwsFrom({ targetBucket: "bucket", targetRegion: "eu-west-1", targetAccessKeyId: "AKIA", targetSecretAccessKey: "from-flag" }, { [Environment.MIGRATION_TARGET_AWS_SECRET_ACCESS_KEY]: "from-env" }))
        .toEqual({ bucket: "bucket", region: "eu-west-1", accessKeyId: "AKIA", secretAccessKey: "from-flag" });
    });

  });

});
