import expect from "expect";
import { describe, it } from "mocha";
import { mostCommonBannerId, pickCommitteeRole } from "./notification-config-site-defaults";

describe("notification-config-site-defaults", () => {

  it("picks the banner used by the most configs", () => {
    expect(mostCommonBannerId([
      {bannerId: "logo-a"},
      {bannerId: "logo-b"},
      {bannerId: "logo-a"},
      {bannerId: null},
      {}
    ])).toEqual("logo-a");
  });

  it("maps membership to a real committee role when membership is missing", () => {
    expect(pickCommitteeRole([
      {type: "chairman", description: "Chairman"},
      {type: "secretary", description: "Group Secretary"}
    ], "membership")).toEqual("secretary");
  });

  it("keeps membership when that role exists", () => {
    expect(pickCommitteeRole([
      {type: "membership", description: "Membership Secretary"},
      {type: "secretary", description: "Secretary"}
    ], "membership")).toEqual("membership");
  });

});
