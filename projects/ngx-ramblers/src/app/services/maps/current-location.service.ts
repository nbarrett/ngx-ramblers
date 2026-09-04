import { inject, Injectable, NgZone } from "@angular/core";
import { LatLngLiteral } from "leaflet";
import { CURRENT_LOCATION_MAX_AGE_MS, CURRENT_LOCATION_TIMEOUT_MS } from "../../models/current-location.model";

@Injectable({providedIn: "root"})
export class CurrentLocationService {
  private zone = inject(NgZone);

  available(): boolean {
    return !!globalThis.navigator?.geolocation;
  }

  currentPosition(): Promise<LatLngLiteral | null> {
    return new Promise(resolve => {
      if (this.available()) {
        navigator.geolocation.getCurrentPosition(
          position => this.zone.run(() => resolve({lat: position.coords.latitude, lng: position.coords.longitude})),
          () => this.zone.run(() => resolve(null)),
          {enableHighAccuracy: false, timeout: CURRENT_LOCATION_TIMEOUT_MS, maximumAge: CURRENT_LOCATION_MAX_AGE_MS}
        );
      } else {
        resolve(null);
      }
    });
  }

  asOrigin(position: LatLngLiteral): string {
    return `${position.lat},${position.lng}`;
  }
}
