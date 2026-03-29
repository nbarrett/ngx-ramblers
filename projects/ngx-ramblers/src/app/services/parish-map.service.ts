import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { isArray } from "es-toolkit/compat";
import { ParishAllocation, ParishBBox } from "../models/parish-map.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Injectable({providedIn: "root"})
export class ParishMapService {
  private http = inject(HttpClient);
  private logger: Logger = inject(LoggerFactory).createLogger("ParishMapService", NgxLoggerLevel.ERROR);
  private allocationUrl = "/api/database/parish-allocation";

  queryParishes(bbox: ParishBBox): Observable<GeoJSON.FeatureCollection> {
    const params = new HttpParams()
      .set("west", bbox.west.toString())
      .set("south", bbox.south.toString())
      .set("east", bbox.east.toString())
      .set("north", bbox.north.toString());
    this.logger.info("Querying parishes for bounds:", bbox);
    return this.http.get<GeoJSON.FeatureCollection>("/api/parishes/query", {params});
  }

  allocationsByGroupCode(groupCode: string): Observable<ParishAllocation[]> {
    const params = new HttpParams().set("criteria", JSON.stringify({groupCode}));
    return this.http.get<{ response: ParishAllocation[] }>(`${this.allocationUrl}/all`, {params}).pipe(
      map(result => result?.response || [])
    );
  }

  createAllocation(allocation: ParishAllocation): Observable<ParishAllocation> {
    return this.http.post<{ response: ParishAllocation }>(this.allocationUrl, allocation).pipe(
      map(result => result.response)
    );
  }

  updateAllocation(allocation: ParishAllocation): Observable<ParishAllocation> {
    return this.http.put<{ response: ParishAllocation }>(`${this.allocationUrl}/${allocation.id}`, allocation).pipe(
      map(result => result.response)
    );
  }

  deleteAllocation(id: string): Observable<any> {
    return this.http.delete(`${this.allocationUrl}/${id}`);
  }

  deleteAllByGroupCode(groupCode: string): Observable<any> {
    return this.http.post(`${this.allocationUrl}/delete-all`, {groupCode});
  }

  importCsv(csvData: string, groupCode: string, memberId: string): Observable<{ created: number; updated: number; errors: number; total: number; errorDetails?: string[] }> {
    return this.http.post<{ created: number; updated: number; errors: number; total: number }>("/api/parishes/import", {csvData, groupCode, memberId});
  }
}
