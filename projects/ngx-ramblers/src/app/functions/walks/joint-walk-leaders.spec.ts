import { describe, expect, it } from "vitest";
import {
  firstWalkLeaderName,
  isJointWalkLeaderName,
  jointWalkLeaderDisplayName,
  jointWalkLeaderNames,
  normalisedWalkLeaderName
} from "./joint-walk-leaders";
import { defaultDisplayName } from "./ramblers-event.mapper";

describe("jointWalkLeaderNames", () => {
  it("splits semicolon-separated names and trims whitespace", () => {
    expect(jointWalkLeaderNames("Tom Gamble;Sarah Mitchell")).toEqual(["Tom Gamble", "Sarah Mitchell"]);
    expect(jointWalkLeaderNames("Tom Gamble ; Sarah Mitchell")).toEqual(["Tom Gamble", "Sarah Mitchell"]);
  });

  it("returns a single name unchanged", () => {
    expect(jointWalkLeaderNames("Tom Gamble")).toEqual(["Tom Gamble"]);
  });

  it("handles empty input", () => {
    expect(jointWalkLeaderNames("")).toEqual([]);
    expect(jointWalkLeaderNames(null)).toEqual([]);
  });
});

describe("isJointWalkLeaderName", () => {
  it("detects joint leaders", () => {
    expect(isJointWalkLeaderName("Tom Gamble; Sarah Mitchell")).toBe(true);
  });

  it("returns false for single leaders and empty input", () => {
    expect(isJointWalkLeaderName("Tom Gamble")).toBe(false);
    expect(isJointWalkLeaderName("")).toBe(false);
    expect(isJointWalkLeaderName(null)).toBe(false);
  });
});

describe("normalisedWalkLeaderName", () => {
  it("normalises separator spacing", () => {
    expect(normalisedWalkLeaderName("Tom Gamble;Sarah Mitchell")).toBe("Tom Gamble; Sarah Mitchell");
  });
});

describe("firstWalkLeaderName", () => {
  it("returns the first leader from a joint name", () => {
    expect(firstWalkLeaderName("Tom Gamble; Sarah Mitchell")).toBe("Tom Gamble");
  });

  it("returns a single name unchanged", () => {
    expect(firstWalkLeaderName("Tom Gamble")).toBe("Tom Gamble");
  });
});

describe("jointWalkLeaderDisplayName", () => {
  const abbreviate = (name: string) => `${name.split(" ")[0]} ${name.split(" ")[1]?.substring(0, 1) || ""}`.trim();

  it("applies the display-name builder to each joint leader", () => {
    expect(jointWalkLeaderDisplayName("Tom Gamble; Sarah Mitchell", abbreviate)).toBe("Tom G; Sarah M");
  });

  it("applies the display-name builder to a single leader", () => {
    expect(jointWalkLeaderDisplayName("Tom Gamble", abbreviate)).toBe("Tom G");
  });

  it("returns null for empty input", () => {
    expect(jointWalkLeaderDisplayName("", abbreviate)).toBeNull();
    expect(jointWalkLeaderDisplayName(null, abbreviate)).toBeNull();
  });
});

describe("defaultDisplayName with joint leaders", () => {
  it("abbreviates each joint leader name", () => {
    expect(defaultDisplayName("Tom Gamble; Sarah Mitchell")).toBe("Tom G; Sarah M");
  });

  it("abbreviates a single leader name", () => {
    expect(defaultDisplayName("Tom Gamble")).toBe("Tom G");
  });

  it("returns empty string for empty input", () => {
    expect(defaultDisplayName("")).toBe("");
    expect(defaultDisplayName(null)).toBe("");
  });
});
