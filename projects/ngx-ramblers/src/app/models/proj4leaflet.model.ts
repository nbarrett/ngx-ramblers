import * as L from "leaflet";
import proj4 from "proj4";

export interface Proj4LeafletCrsOptions {
  resolutions: number[];
  origin: [number, number];
  bounds: L.Bounds;
}

export interface Proj4LeafletApi {
  setProj4?: (proj4Instance: typeof proj4) => void;
  CRS?: new (code: string, definition: string, options: Proj4LeafletCrsOptions) => L.CRS;
}
