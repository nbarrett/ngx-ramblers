import expect from "expect";
import { describe, it } from "mocha";
import { toGroupShortName } from "./database-initialiser";

describe("toGroupShortName", () => {
  it("gives a readable short name without the words Ramblers and Group", () => {
    expect(toGroupShortName("New Forest Group")).toEqual("New Forest");
    expect(toGroupShortName("Milton Keynes & District Group")).toEqual("Milton Keynes & District");
    expect(toGroupShortName("Ramblers Canterbury Group")).toEqual("Canterbury");
    expect(toGroupShortName("East Kent Walking Group")).toEqual("East Kent");
    expect(toGroupShortName("Pang Valley Ramblers")).toEqual("Pang Valley");
    expect(toGroupShortName("Hike Essex")).toEqual("Hike Essex");
    expect(toGroupShortName("Group")).toEqual("Group");
  });
});
