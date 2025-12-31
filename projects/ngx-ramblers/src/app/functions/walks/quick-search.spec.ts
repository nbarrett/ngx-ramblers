import { quickSearchCriteria } from "./quick-search";
import { GroupEventField } from "../../models/walk.model";

describe("quickSearchCriteria", () => {
  it("returns null when term empty", () => {
    expect(quickSearchCriteria("")).toBeNull();
    expect(quickSearchCriteria("   ")).toBeNull();
  });

  it("builds regex criteria across fields", () => {
    const criteria = quickSearchCriteria("Walmer");
    expect(criteria).toBeTruthy();
    const orConditions = criteria.$or;
    expect(Array.isArray(orConditions)).toBe(true);
    expect(orConditions[0][GroupEventField.TITLE]).toEqual({ $regex: "Walmer", $options: "i" });
  });
});
