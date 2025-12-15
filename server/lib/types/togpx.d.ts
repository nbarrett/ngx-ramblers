declare module "togpx" {
  import { GeoJsonObject } from "geojson";
  function togpx(geojson: GeoJsonObject, options?: Record<string, unknown>): string;
  export default togpx;
}
