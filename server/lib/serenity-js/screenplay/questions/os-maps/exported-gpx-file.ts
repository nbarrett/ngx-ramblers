import { Question } from "@serenity-js/core";
import { lastExportedGpx } from "./exported-gpx-store";

export class ExportedGpxFile {

  static fileName() {
    return Question.about("the exported GPX file name", () => lastExportedGpx().fileName);
  }

  static content() {
    return Question.about("the exported GPX content", () => lastExportedGpx().content);
  }

  static creator() {
    return Question.about("the exported GPX creator", () => lastExportedGpx().creator);
  }

  static trackPointCount() {
    return Question.about("the exported GPX track point count", () => lastExportedGpx().trackPointCount);
  }

  static waypointCount() {
    return Question.about("the exported GPX waypoint count", () => lastExportedGpx().waypointCount);
  }

  static totalDistanceKm() {
    return Question.about("the exported GPX distance in kilometres", () => lastExportedGpx().totalDistanceKm);
  }

}
