import { MapsLibraryComponent } from "./maps-library";
import { RouteFollowSummary } from "../../models/route-follow.model";

describe("maps library creator filter", () => {
  it("lists a person once when routes were saved under more than one member id", () => {
    const view = Object.create(MapsLibraryComponent.prototype) as MapsLibraryComponent;
    view["routes"] = [
      {createdBy: "member-one", createdByName: "Alex Reed"} as RouteFollowSummary,
      {createdBy: "member-two", createdByName: "Alex Reed"} as RouteFollowSummary,
      {createdBy: "member-three", createdByName: "Sam Field"} as RouteFollowSummary
    ];
    expect(view.creatorOptions().map(contributor => contributor.name)).toEqual(["Alex Reed", "Sam Field"]);
  });
});
