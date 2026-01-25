import { inject, Injectable } from "@angular/core";
import { isNumber } from "es-toolkit/compat";
import { DistanceValidationService } from "../walks/distance-validation.service";

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: "root" })
export class GeoDistanceService {
  private distanceValidationService = inject(DistanceValidationService);
  private EARTH_RADIUS_KM = 6371;

  calculateDistanceMiles(from: GeoCoordinate, to: GeoCoordinate): number | null {
    const distanceKm = this.calculateDistanceKm(from, to);
    if (distanceKm === null) {
      return null;
    }
    return this.distanceValidationService.convertKmToMiles(distanceKm);
  }

  calculateDistanceKm(from: GeoCoordinate, to: GeoCoordinate): number | null {
    if (!this.isValidCoordinate(from) || !this.isValidCoordinate(to)) {
      return null;
    }
    return this.haversineDistance(from, to);
  }

  private haversineDistance(from: GeoCoordinate, to: GeoCoordinate): number {
    const dLat = this.degreesToRadians(to.latitude - from.latitude);
    const dLon = this.degreesToRadians(to.longitude - from.longitude);
    const lat1 = this.degreesToRadians(from.latitude);
    const lat2 = this.degreesToRadians(to.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS_KM * c;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private isValidCoordinate(coord: GeoCoordinate | null | undefined): coord is GeoCoordinate {
    return coord !== null &&
           coord !== undefined &&
           isNumber(coord.latitude) &&
           isNumber(coord.longitude) &&
           !isNaN(coord.latitude) &&
           !isNaN(coord.longitude);
  }
}
