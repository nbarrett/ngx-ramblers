import expect from "expect";
import { describe, it } from "mocha";
import { SaveAndContinue } from "./save-and-continue";

describe("SaveAndContinue", () => {
  it("describes a step save as waiting to leave that wizard path", () => {
    expect(SaveAndContinue.awayFromPath("/walks-manager/walk/details/").toString())
      .toContain("saves the current step and waits to navigate away from /walks-manager/walk/details/");
  });

  it("describes a publish save as publishing and waiting to leave that wizard path", () => {
    expect(SaveAndContinue.byPublishingAwayFromPath("/walks-manager/walk/details/").toString())
      .toContain("publishes the walk and waits to navigate away from /walks-manager/walk/details/");
  });
});
