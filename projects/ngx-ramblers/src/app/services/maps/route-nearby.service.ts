import { inject, Injectable } from "@angular/core";
import { GeoCoordinate, GeoDistanceService } from "./geo-distance.service";
import { CurrentLocationService } from "./current-location.service";
import { APP_NEARBY_GPS_TRUST_MILES } from "../../models/route-follow.model";

@Injectable({providedIn: "root"})
export class RouteNearbyService {
  private distance = inject(GeoDistanceService);
  private location = inject(CurrentLocationService);

  milesAway(from: GeoCoordinate | null, point: GeoCoordinate | null): number | null {
    return from && point ? this.distance.calculateDistanceMiles(from, point) : null;
  }

  centre(points: GeoCoordinate[]): GeoCoordinate | null {
    return points.length ? {
      latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
      longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length
    } : null;
  }

  trustedOrigin(gps: GeoCoordinate, points: GeoCoordinate[]): GeoCoordinate {
    const distances = points.map(point => this.milesAway(gps, point)).filter((miles): miles is number => miles !== null);
    const centre = this.centre(points);
    return centre && (!distances.length || Math.min(...distances) > APP_NEARBY_GPS_TRUST_MILES) ? centre : gps;
  }

  async origin(points: GeoCoordinate[]): Promise<GeoCoordinate | null> {
    const position = await this.location.currentPosition();
    return position ? this.trustedOrigin({latitude: position.lat, longitude: position.lng}, points) : this.centre(points);
  }

  label(miles: number | null): string | null {
    return miles === null ? null : miles < 0.1 ? "Here" : miles < 1 ? "Under a mile away" : miles.toFixed(1) + " miles away";
  }
}
