import { inject, Injectable } from "@angular/core";
import proj4 from "proj4";
import { gridReference10From, gridReference6From, gridReference8From, parseGridReference } from "../../functions/grid-reference";
import { LocatePoint } from "../../models/locate.model";
import { MapProjectionCode } from "../../common/maps/map-projection.constants";
import { MapTilesService } from "./map-tiles.service";

const WGS84 = "EPSG:4326";

@Injectable({providedIn: "root"})
export class GridReferenceService {
  private mapTiles = inject(MapTilesService);

  fromLatLng(latitude: number, longitude: number): LocatePoint | null {
    this.mapTiles.initializeProjections();
    const [eastingsRaw, northingsRaw] = proj4(WGS84, MapProjectionCode.BRITISH_NATIONAL_GRID, [longitude, latitude]);
    const eastings = Math.round(eastingsRaw);
    const northings = Math.round(northingsRaw);
    const inRange = eastings >= 0 && eastings < 700000 && northings >= 0 && northings < 1300000;
    return inRange ? {
      latitude,
      longitude,
      eastings,
      northings,
      gridReference6: gridReference6From(eastings, northings),
      gridReference8: gridReference8From(eastings, northings),
      gridReference10: gridReference10From(eastings, northings)
    } : null;
  }

  fromGridReference(gridReference: string): LocatePoint | null {
    const parsed = parseGridReference(gridReference || "");
    if (!parsed) {
      return null;
    } else {
      this.mapTiles.initializeProjections();
      const [longitude, latitude] = proj4(MapProjectionCode.BRITISH_NATIONAL_GRID, WGS84, [parsed.eastings, parsed.northings]);
      return this.fromLatLng(latitude, longitude);
    }
  }
}
