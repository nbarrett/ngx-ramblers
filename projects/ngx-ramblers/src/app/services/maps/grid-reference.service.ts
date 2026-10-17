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
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    } else {
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
  }

  fromEastingsNorthings(eastings: number, northings: number): LocatePoint | null {
    if (!Number.isFinite(eastings) || !Number.isFinite(northings) || eastings < 0 || eastings >= 700000 || northings < 0 || northings >= 1300000) {
      return null;
    } else {
      this.mapTiles.initializeProjections();
      const [longitude, latitude] = proj4(MapProjectionCode.BRITISH_NATIONAL_GRID, WGS84, [eastings, northings]);
      return this.fromLatLng(latitude, longitude);
    }
  }

  fromSearch(query: string): LocatePoint | null {
    const coordinates = query.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)$/);
    if (coordinates) {
      const first = Number(coordinates[1]);
      const second = Number(coordinates[2]);
      return Math.abs(first) > 90 ? this.fromEastingsNorthings(first, second) : this.fromLatLng(first, second);
    } else {
      return this.fromGridReference(query);
    }
  }

  fromGridReference(gridReference: string): LocatePoint | null {
    const parsed = parseGridReference(gridReference || "");
    if (!parsed) {
      return null;
    } else {
      return this.fromEastingsNorthings(parsed.eastings, parsed.northings);
    }
  }
}
