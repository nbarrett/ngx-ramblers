import expect from "expect";
import { describe, it } from "mocha";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { parseExportedGpx } from "./exported-gpx-parser";
import { exportedGpxFromJobPath, persistExportedGpxToJobPath } from "./os-maps-exported-gpx-files";

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OS Maps - Web" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="51.22000" lon="1.15000"></trkpt>
      <trkpt lat="51.23000" lon="1.16000"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("os-maps-exported-gpx-files", () => {

  it("appends each exported GPX summary to the job path", () => {
    const jobPath = fs.mkdtempSync(path.join(os.tmpdir(), "os-maps-export-"));
    const previous = process.env[Environment.OS_MAPS_JOB_PATH];
    process.env[Environment.OS_MAPS_JOB_PATH] = jobPath;
    try {
      persistExportedGpxToJobPath(parseExportedGpx(SAMPLE_GPX, "first.gpx"));
      persistExportedGpxToJobPath(parseExportedGpx(SAMPLE_GPX, "second.gpx"));
      const summaries = exportedGpxFromJobPath(jobPath);
      expect(summaries.map(summary => summary.fileName)).toEqual(["first.gpx", "second.gpx"]);
      expect(summaries[0].content).toContain("<trkpt");
    } finally {
      if (previous) {
        process.env[Environment.OS_MAPS_JOB_PATH] = previous;
      } else {
        delete process.env[Environment.OS_MAPS_JOB_PATH];
      }
      fs.rmSync(jobPath, {recursive: true, force: true});
    }
  });

  it("returns an empty list when the job path is missing", () => {
    expect(exportedGpxFromJobPath()).toEqual([]);
  });

});
