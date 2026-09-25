import { environmentNameForGroup, prefixedEnvironmentResourceName } from "./environment-setup.model";

describe("environment setup resource names", () => {
  it("derives a stable environment name from the Ramblers group name", () => {
    expect(environmentNameForGroup("North East London Ramblers Group")).toBe("north-east-london");
  });

  it("uses the area name without an area suffix for an Area site", () => {
    expect(environmentNameForGroup("Kent Area")).toBe("kent");
    expect(environmentNameForGroup("Example Area")).toBe("example");
  });

  it("uses the standard prefix where it fits and respects service length limits", () => {
    expect(prefixedEnvironmentResourceName("example", 30)).toBe("ngx-ramblers-example");
    expect(prefixedEnvironmentResourceName("a-very-long-group-environment-name", 20)).toBe("a-very-long-group-en");
  });
});
