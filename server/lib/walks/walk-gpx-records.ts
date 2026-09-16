import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { EventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { GpxCoordinates } from "../models/walk-gpx-list.model";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { osMapsImportedRoute, OsMapsImportedRouteRecord } from "../mongo/models/os-maps-imported-route";

const HAS_GPX_FILE = {$exists: true, $nin: [null, ""]};
const IMPORTED_ROUTE_AWS_FILE_NAME = "gpxFile.awsFileName";

export async function walksWithGpxFiles(): Promise<ExtendedGroupEvent[]> {
  return extendedGroupEvent.find({[EventField.GPX_FILE_AWS_FILE_NAME]: HAS_GPX_FILE})
    .select({
      [EventField.GPX_FILE]: 1,
      "groupEvent.title": 1,
      "groupEvent.start_date_time": 1,
      "groupEvent.start_location.latitude": 1,
      "groupEvent.start_location.longitude": 1
    })
    .lean<ExtendedGroupEvent[]>()
    .exec();
}

export async function importedRoutesWithGpxFiles(): Promise<OsMapsImportedRouteRecord[]> {
  return osMapsImportedRoute.find({[IMPORTED_ROUTE_AWS_FILE_NAME]: HAS_GPX_FILE})
    .select({gpxFile: 1, importedAt: 1})
    .lean<OsMapsImportedRouteRecord[]>()
    .exec();
}

export async function storeWalkGpxCoordinates(awsFileName: string, coordinates: GpxCoordinates): Promise<void> {
  await extendedGroupEvent.updateMany(
    {[EventField.GPX_FILE_AWS_FILE_NAME]: awsFileName},
    {$set: {[`${EventField.GPX_FILE}.startLat`]: coordinates.startLat, [`${EventField.GPX_FILE}.startLng`]: coordinates.startLng}}
  ).exec();
}
