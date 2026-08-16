import expect from "expect";
import { describe, it } from "mocha";
import { isOsMapsRouteUrl } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { parseExportedGpx, gpxMatchesRoute } from "./exported-gpx-parser";

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OS Maps - Web" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Elham Valley North</name>
  </metadata>
  <wpt lat="51.22000" lon="1.15000"><name>Start</name></wpt>
  <wpt lat="51.23000" lon="1.16000"><name>Mid</name></wpt>
  <wpt lat="51.24000" lon="1.17000"><name>Finish</name></wpt>
  <trk>
    <name>Elham Valley North</name>
    <trkseg>
      <trkpt lat="51.22000" lon="1.15000"></trkpt>
      <trkpt lat="51.23000" lon="1.16000"></trkpt>
      <trkpt lat="51.24000" lon="1.17000"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("exported-gpx-parser", () => {

  it("parses OS Maps GPX track points, waypoints and distance", () => {
    const summary = parseExportedGpx(SAMPLE_GPX, "sample.gpx");
    expect(summary.fileName).toEqual("sample.gpx");
    expect(summary.creator).toEqual("OS Maps - Web");
    expect(summary.name).toEqual("Elham Valley North");
    expect(summary.trackPointCount).toEqual(3);
    expect(summary.waypointCount).toEqual(3);
    expect(summary.totalDistanceKm).toBeGreaterThan(2);
    expect(summary.totalDistanceKm).toBeLessThan(4);
    expect(summary.startLat).toEqual(51.22);
    expect(summary.startLng).toEqual(1.15);
    expect(gpxMatchesRoute(summary, 2.8, 1, 3, 3)).toEqual(true);
  });

  it("accepts explore.osmaps.com route URLs only", () => {
    expect(isOsMapsRouteUrl("https://explore.osmaps.com/route/29532353/elham")).toEqual(true);
    expect(isOsMapsRouteUrl("https://explore.osmaps.com/local/foo")).toEqual(false);
    expect(isOsMapsRouteUrl("")).toEqual(false);
  });

  it("rejects empty content", () => {
    expect(() => parseExportedGpx("   ")).toThrow("GPX content is empty");
  });

  it("rejects invalid XML", () => {
    expect(() => parseExportedGpx("<not-gpx></not-gpx>")).toThrow("Invalid GPX file format");
  });

  it("uses route points when the file has no track points", () => {
    const routeOnly = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OS Maps - Web" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <rtept lat="51.22000" lon="1.15000"></rtept>
    <rtept lat="51.23000" lon="1.16000"></rtept>
  </rte>
</gpx>`;
    const summary = parseExportedGpx(routeOnly);
    expect(summary.trackPointCount).toEqual(2);
    expect(summary.totalDistanceMetres).toBeGreaterThan(0);
  });

});
