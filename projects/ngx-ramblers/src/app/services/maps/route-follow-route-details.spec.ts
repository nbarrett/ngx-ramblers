import { FileNameData } from "../../models/aws-object.model";
import { MapRoute } from "../../models/content-text.model";
import { RouteFollowPayload } from "../../models/route-follow.model";
import { RouteFollowSaveService } from "./route-follow-save.service";

describe("saved route details", () => {
  it("updates the selected route name and description while preserving other routes and the original creator", () => {
    const service = Object.create(RouteFollowSaveService.prototype) as RouteFollowSaveService;
    const other: MapRoute = {id: "other-route", name: "Meadow path"};
    const routes: MapRoute[] = [{id: "edited-route", name: "Old name", gpxFile: {
      awsFileName: "original.gpx", createdBy: "fictional-creator", createdDate: 100
    }}, other];
    const file: FileNameData = {awsFileName: "updated.gpx", title: "Woodland loop", description: "Along the woodland path", createdDate: 200};
    const payload = {color: "#123456", weight: 8, opacity: 1} as RouteFollowPayload;
    const updated = service["updatedRoutes"](routes, "edited-route", "Woodland loop", file, payload);
    expect(updated[0].name).toBe("Woodland loop");
    expect(updated[0].gpxFile).toMatchObject({title: "Woodland loop", description: "Along the woodland path", createdBy: "fictional-creator", createdDate: 100});
    expect(updated[1]).toBe(other);
    expect(routes[0].name).toBe("Old name");
  });
});
