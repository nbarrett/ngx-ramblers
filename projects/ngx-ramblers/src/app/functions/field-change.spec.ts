import { changedFieldValues, mapFieldChangeValues } from "./field-change";

describe("field change functions", () => {
  it("keeps only candidates whose from and to values differ", () => {
    const changes = changedFieldValues([
      {field: "title", from: "Old title", to: "New title"},
      {field: "status", from: "confirmed", to: "confirmed"}
    ], change => change.from === change.to);

    expect(changes).toEqual([{field: "title", from: "Old title", to: "New title"}]);
  });

  it("maps both sides without changing the field identity", () => {
    const change = mapFieldChangeValues({field: "distance", from: 5, to: 7}, value => `${value} miles`);

    expect(change).toEqual({field: "distance", from: "5 miles", to: "7 miles"});
  });
});
