import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { ServerFileNameData } from "../../models/aws-object.model";
import { GpxFileListItem } from "../../models/walk.model";
import { DistanceValidationService } from "./distance-validation.service";

@Injectable({ providedIn: "root" })
export class WalkGpxService {
  private http = inject(HttpClient);
  private distanceValidationService = inject(DistanceValidationService);
  private BASE_URL = "/api/database/walks/gpx";

  uploadGpxFile(file: File): Observable<{ gpxFile: ServerFileNameData }> {
    const formData = new FormData();
    formData.append("file", file);
    return this.http.post<{ gpxFile: ServerFileNameData }>(
      `${this.BASE_URL}/upload`,
      formData
    );
  }

  listGpxFiles(): Observable<GpxFileListItem[]> {
    return this.http.get<GpxFileListItem[]>(
      `${this.BASE_URL}/list`
    );
  }

  calculateProximity(
    walkStartLat: number,
    walkStartLng: number,
    gpxFiles: GpxFileListItem[]
  ): GpxFileListItem[] {
    return gpxFiles
      .map(file => {
        const distanceMeters = this.haversineDistance(
          walkStartLat, walkStartLng,
          file.startLat, file.startLng
        );
        const distanceKm = distanceMeters / 1000;
        const distanceMiles = this.distanceValidationService.convertKmToMiles(distanceKm);

        let label: string;
        if (file.walkTitle && file.walkDate) {
          const date = new Date(file.walkDate).toLocaleDateString();
          label = `${file.walkTitle} - ${date} (${distanceMiles.toFixed(1)} miles away)`;
        } else if (file.walkTitle) {
          label = `${file.walkTitle} (${distanceMiles.toFixed(1)} miles away)`;
        } else if (file.name && !file.name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
          label = `${file.name} (${distanceMiles.toFixed(1)} miles away)`;
        } else if (file.uploadDate) {
          const uploadDateStr = new Date(file.uploadDate).toLocaleDateString();
          label = `Uploaded ${uploadDateStr} (${distanceMiles.toFixed(1)} miles away)`;
        } else {
          label = `Route ${distanceMiles.toFixed(1)} miles from start`;
        }

        return {
          ...file,
          distance: distanceMiles,
          displayLabel: label
        };
      })
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
