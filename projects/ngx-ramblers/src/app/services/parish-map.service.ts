import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { ParishBBox } from "../models/parish-map.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Injectable({providedIn: "root"})
export class ParishMapService {
  private http = inject(HttpClient);
  private logger: Logger = inject(LoggerFactory).createLogger("ParishMapService", NgxLoggerLevel.ERROR);

  queryParishes(bbox: ParishBBox): Observable<GeoJSON.FeatureCollection> {
    const params = new HttpParams()
      .set("west", bbox.west.toString())
      .set("south", bbox.south.toString())
      .set("east", bbox.east.toString())
      .set("north", bbox.north.toString());
    this.logger.info("Querying parishes for bounds:", bbox);
    return this.http.get<GeoJSON.FeatureCollection>("/api/parishes/query", {params});
  }

  importCsv(csvData: string, groupCode: string, memberId: string): Observable<{ created: number; updated: number; errors: number; total: number; errorDetails?: string[] }> {
    return this.http.post<{ created: number; updated: number; errors: number; total: number }>("/api/parishes/import", {csvData, groupCode, memberId});
  }
}
