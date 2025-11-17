import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { AGMStatsRequest, AGMStatsResponse } from "../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class AGMStatsService {
  private http = inject(HttpClient);
  private BASE_URL = "/api/database/walks";

  agmStats(fromDate: number, toDate: number): Observable<AGMStatsResponse> {
    const request: AGMStatsRequest = { fromDate, toDate };
    return this.http.post<AGMStatsResponse>(`${this.BASE_URL}/agm-stats`, request);
  }

  earliestDate(): Observable<{ earliestDate: number | null }> {
    return this.http.get<{ earliestDate: number | null }>(`${this.BASE_URL}/earliest-date`);
  }
}
