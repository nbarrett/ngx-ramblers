import { placeNameChoiceFor, placeNamesMatch, resultPlaceName } from "./venue";

describe("venue place names", () => {
  it("joins name and address without repeating a part already in the name", () => {
    expect(resultPlaceName({name: "Hillside Lane & Station Approach, Hillside Park", address1: "Hillside Park"})).toBe("Hillside Lane & Station Approach, Hillside Park");
    expect(resultPlaceName({name: "Hillside Lane", address1: "Hillside Park"})).toBe("Hillside Lane, Hillside Park");
  });

  it("treats names as the same ignoring extra spaces and case", () => {
    expect(placeNamesMatch("Hillside Park", "  hillside   park ")).toBe(true);
    expect(placeNamesMatch("Hillside Park", "Station Approach")).toBe(false);
  });

  it("offers a keep-or-replace choice only when the typed wording differs from the result", () => {
    expect(placeNameChoiceFor("Junction of Hillside Lane and Station Approach, Hillside Park", {
      name: "Hillside Lane & Station Approach, Hillside Park"
    })).toEqual({
      typed: "Junction of Hillside Lane and Station Approach, Hillside Park",
      fromResult: "Hillside Lane & Station Approach, Hillside Park"
    });
    expect(placeNameChoiceFor("Hillside Park", {name: "Hillside Park"})).toBeNull();
  });
});
