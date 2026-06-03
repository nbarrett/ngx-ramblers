import expect from "expect";
import { describe, it } from "mocha";
import { classifyMissingRequiredSecrets, REQUIRED_SECRETS } from "./secrets";

function allRequiredSecrets(): Record<string, string> {
  return REQUIRED_SECRETS.reduce((accumulator, key) => ({ ...accumulator, [key]: `value-${key}` }), {});
}

describe("classifyMissingRequiredSecrets", () => {

  it("reports nothing missing when every required secret is present", () => {
    const result = classifyMissingRequiredSecrets(allRequiredSecrets());
    expect(result).toEqual({ missing: [], autoGeneratable: [], unrecoverable: [] });
  });

  it("classifies a missing AUTH_SECRET as auto-generatable", () => {
    const secrets = allRequiredSecrets();
    delete secrets.AUTH_SECRET;
    const result = classifyMissingRequiredSecrets(secrets);
    expect(result.missing).toEqual(["AUTH_SECRET"]);
    expect(result.autoGeneratable).toEqual(["AUTH_SECRET"]);
    expect(result.unrecoverable).toEqual([]);
  });

  it("classifies a missing NODE_ENV as auto-generatable from its static default", () => {
    const secrets = allRequiredSecrets();
    delete secrets.NODE_ENV;
    const result = classifyMissingRequiredSecrets(secrets);
    expect(result.missing).toEqual(["NODE_ENV"]);
    expect(result.autoGeneratable).toEqual(["NODE_ENV"]);
    expect(result.unrecoverable).toEqual([]);
  });

  it("classifies a missing AWS credential as unrecoverable", () => {
    const secrets = allRequiredSecrets();
    delete secrets.AWS_BUCKET;
    const result = classifyMissingRequiredSecrets(secrets);
    expect(result.missing).toEqual(["AWS_BUCKET"]);
    expect(result.autoGeneratable).toEqual([]);
    expect(result.unrecoverable).toEqual(["AWS_BUCKET"]);
  });

  it("separates auto-generatable from unrecoverable when both are missing", () => {
    const secrets = allRequiredSecrets();
    delete secrets.AUTH_SECRET;
    delete secrets.MONGODB_URI;
    const result = classifyMissingRequiredSecrets(secrets);
    expect(result.autoGeneratable).toEqual(["AUTH_SECRET"]);
    expect(result.unrecoverable).toEqual(["MONGODB_URI"]);
  });

  it("treats an empty bundle as every required secret missing", () => {
    const result = classifyMissingRequiredSecrets({});
    expect(result.missing).toEqual(REQUIRED_SECRETS);
    expect(result.autoGeneratable).toEqual(["AUTH_SECRET", "NODE_ENV"]);
  });

});
