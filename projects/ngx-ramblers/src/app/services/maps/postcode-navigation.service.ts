import { inject, Injectable } from "@angular/core";
import { concat, from, Observable, of } from "rxjs";
import { switchMap } from "rxjs/operators";
import { NgxLoggerLevel } from "ngx-logger";
import { GridReferenceLookupResponse } from "../../models/address-model";
import { LocationDetails } from "../../models/ramblers-walks-manager";
import {
  POSTCODE_DETOUR_MINIMUM_METRES,
  POSTCODE_DETOUR_RATIO,
  POSTCODE_ROUTE_CHECK_MINIMUM_METRES,
  POSTCODE_WARNING_DISTANCE_METRES,
  PostcodeNavigationCheck,
  PostcodeNavigationStatus,
  PostcodeRoadCheckStatus
} from "../../models/postcode-navigation.model";
import { formattedUkPostcode } from "../../functions/locate";
import { AddressQueryService } from "../walks/address-query.service";
import { GoogleMapsService } from "../google-maps.service";
import { LoggerFactory } from "../logger-factory.service";
import { GeoDistanceService } from "./geo-distance.service";

@Injectable({providedIn: "root"})
export class PostcodeNavigationService {
  private addresses = inject(AddressQueryService);
  private googleMaps = inject(GoogleMapsService);
  private distances = inject(GeoDistanceService);
  private logger = inject(LoggerFactory).createLogger("PostcodeNavigationService", NgxLoggerLevel.ERROR);
  private postcodes = new Map<string, Promise<GridReferenceLookupResponse>>();

  check(location: LocationDetails, checkRoad: boolean): Observable<PostcodeNavigationCheck | null> {
    const hasCoordinates = Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)
      && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180;
    if (!hasCoordinates) {
      return of(null);
    } else {
      const snapshot = {...location};
      return from(this.postcodeCheck(snapshot)).pipe(switchMap(result => {
        const roadRequired = checkRoad && result.postcodePoint && result.separationMetres >= POSTCODE_ROUTE_CHECK_MINIMUM_METRES;
        return roadRequired
          ? concat(of({...result, roadStatus: PostcodeRoadCheckStatus.CHECKING}), from(this.roadCheck(result)))
          : of(result);
      }));
    }
  }

  private async postcodeCheck(location: LocationDetails): Promise<PostcodeNavigationCheck> {
    const postcode = formattedUkPostcode(location.postcode);
    const result: PostcodeNavigationCheck = {
      location, postcode, postcodePoint: null, separationMetres: null, drivingMetres: null,
      status: location.postcode?.trim() ? PostcodeNavigationStatus.INVALID : PostcodeNavigationStatus.MISSING,
      roadStatus: PostcodeRoadCheckStatus.NOT_CHECKED
    };
    if (!postcode) {
      return result;
    } else {
      try {
        const lookup = await this.postcodeLookup(postcode);
        const point = lookup?.latlng;
        const separation = !lookup?.error && point
          ? this.distances.calculateDistanceKm(location, {latitude: point.lat, longitude: point.lng})
          : null;
        if (separation === null || !Number.isFinite(separation)) {
          this.postcodes.delete(postcode);
          return {...result, status: PostcodeNavigationStatus.UNAVAILABLE};
        } else {
          const separationMetres = Math.round(separation * 1000);
          return {...result, postcodePoint: point, separationMetres,
            status: separationMetres >= POSTCODE_WARNING_DISTANCE_METRES ? PostcodeNavigationStatus.SEPARATED : PostcodeNavigationStatus.CLOSE};
        }
      } catch (error) {
        this.postcodes.delete(postcode);
        this.logger.warn("Postcode destination check failed:", error);
        return {...result, status: PostcodeNavigationStatus.UNAVAILABLE};
      }
    }
  }

  private postcodeLookup(postcode: string): Promise<GridReferenceLookupResponse> {
    if (!this.postcodes.has(postcode)) {
      if (this.postcodes.size >= 50) {
        this.postcodes.delete(this.postcodes.keys().next().value);
      }
      this.postcodes.set(postcode, this.addresses.gridReferenceLookup(postcode));
    }
    return this.postcodes.get(postcode);
  }

  private async roadCheck(result: PostcodeNavigationCheck): Promise<PostcodeNavigationCheck> {
    try {
      const pin = {lat: result.location.latitude, lng: result.location.longitude};
      const miles = await this.googleMaps.drivingDistanceMiles(result.postcode, `${pin.lat},${pin.lng}`, result.postcodePoint, pin);
      if (!Number.isFinite(miles) || miles === null || miles < 0) {
        return {...result, roadStatus: PostcodeRoadCheckStatus.UNAVAILABLE};
      } else {
        const drivingMetres = Math.round(miles * 1609.344);
        const detour = drivingMetres >= POSTCODE_DETOUR_MINIMUM_METRES && drivingMetres >= result.separationMetres * POSTCODE_DETOUR_RATIO;
        return {...result, drivingMetres, roadStatus: PostcodeRoadCheckStatus.FOUND,
          status: detour ? PostcodeNavigationStatus.DETOUR : result.status};
      }
    } catch (error) {
      this.logger.warn("Postcode driving route check failed:", error);
      return {...result, roadStatus: PostcodeRoadCheckStatus.UNAVAILABLE};
    }
  }
}
