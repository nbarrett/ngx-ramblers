import {inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {
  AutocompleteSuggestion,
  RouteStats,
  SpatialFeature,
  ViewportBounds,
  ViewportFeaturesResponse
} from "../models/spatial-features.model";

@Injectable({
  providedIn: "root"
})
export class SpatialFeaturesService {
  private http = inject(HttpClient);
  private readonly baseUrl = "/api";

  queryViewport(routeId: string, bounds: ViewportBounds, searchTerm?: string, limit = 1000): Observable<ViewportFeaturesResponse> {
    return this.http.post<ViewportFeaturesResponse>(
      `${this.baseUrl}/spatial-features/viewport`,
      {routeId, bounds, searchTerm, limit}
    );
  }

  search(routeId: string, query: string, limit = 20): Observable<SpatialFeature[]> {
    return this.http.get<SpatialFeature[]>(
      `${this.baseUrl}/spatial-features/search`,
      {params: {routeId, query, limit: limit.toString()}}
    );
  }

  autocomplete(routeId: string, query: string, limit = 10): Observable<AutocompleteSuggestion[]> {
    return this.http.get<AutocompleteSuggestion[]>(
      `${this.baseUrl}/spatial-features/autocomplete`,
      {params: {routeId, query, limit: limit.toString()}}
    );
  }

  getStats(routeId: string): Observable<RouteStats> {
    return this.http.get<RouteStats>(
      `${this.baseUrl}/spatial-features/stats/${routeId}`
    );
  }

  deleteRoute(routeId: string): Observable<{deletedCount: number}> {
    return this.http.delete<{deletedCount: number}>(
      `${this.baseUrl}/spatial-features/route/${routeId}`
    );
  }
}
