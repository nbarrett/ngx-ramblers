import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { AvailableArea, AvailableAreaWithLabel } from "../models/system.model";

@Injectable({providedIn: "root"})
export class AvailableAreasService {
  private http = inject(HttpClient);
  private cached: Promise<AvailableAreaWithLabel[]> | null = null;

  areas(): Promise<AvailableAreaWithLabel[]> {
    if (!this.cached) {
      this.cached = firstValueFrom(this.http.get<{areas: AvailableArea[]}>("api/areas/available-areas"))
        .then(response => (response?.areas || []).map(area => ({...area, ngSelectLabel: `${area.areaName} (${area.areaCode})`})))
        .catch(error => {
          this.cached = null;
          throw error;
        });
    }
    return this.cached;
  }
}
