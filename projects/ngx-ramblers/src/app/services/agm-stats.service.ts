import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { AgmStatsPeriod, AGMStatsRequest, AGMStatsResponse } from "../models/group-event.model";
import { AgmStatsExcelExportRequest } from "../models/agm-stats.model";

@Injectable({
  providedIn: "root"
})
export class AGMStatsService {
  private http = inject(HttpClient);
  private BASE_URL = "/api/database/walks";

  agmStats(fromDate: number, toDate: number, periods?: AgmStatsPeriod[]): Observable<AGMStatsResponse> {
    const request: AGMStatsRequest = periods?.length
      ? {fromDate, toDate, periods}
      : {fromDate, toDate};
    return this.http.post<AGMStatsResponse>(`${this.BASE_URL}/agm-stats`, request);
  }

  earliestDate(): Observable<{ earliestDate: number | null }> {
    return this.http.get<{ earliestDate: number | null }>(`${this.BASE_URL}/earliest-date`);
  }

  excelExport(request: AgmStatsExcelExportRequest): Observable<Blob> {
    return this.http.post(`${this.BASE_URL}/agm-stats/excel`, request, {responseType: "blob"});
  }
}
