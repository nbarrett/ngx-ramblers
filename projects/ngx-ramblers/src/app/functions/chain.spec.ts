import { chain } from "./chain";

describe("chain", () => {

  const BARNEY = {user: "barney", age: 36};
  const FRED40 = {user: "fred", age: 40};
  const FRED5 = {user: "fred", age: 5};
  const PEBBLES = {user: "pebbles", age: 1};

  const data = [FRED40, PEBBLES, BARNEY, FRED5];

  it("should support filter", () => {
    expect(chain(data).filter(person => person.user === "fred").value()).toEqual([FRED40, FRED5]);
  });

  it("should support filter (object criteria)", () => {
    expect(chain(data).filter({user: "fred"}).value()).toEqual([FRED40, FRED5]);
  });

  it("should support find", () => {
    expect(chain(data).find({user: "fred"}).value()).toEqual(FRED40);
  });

  it("should support map", () => {
    expect(chain(data).map("user").value()).toEqual(["fred", "pebbles", "barney", "fred"]);
  });

  it("should support sortBy", () => {
    expect(chain(data).sortBy("age").value()).toEqual([PEBBLES, FRED5, BARNEY, FRED40]);
  });

  it("should support sortBy followed by map", () => {
    expect(chain(data).sortBy("age").map("user").value()).toEqual(["pebbles", "fred", "barney", "fred"]);
  });

  it("should support sortBy followed by map followed by uniq", () => {
    expect(chain(data).sortBy("age").map("user").unique().value()).toEqual(["pebbles", "fred", "barney"]);
  });

});
