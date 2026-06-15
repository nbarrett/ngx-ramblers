import { Injectable } from "@angular/core";
import { CachedMapView } from "../../models/map.model";

@Injectable({
  providedIn: "root"
})
export class MapViewCacheService {
  private cache = new Map<string, CachedMapView>();

  get(key: string): CachedMapView | undefined {
    return this.cache.get(key);
  }

  set(key: string, view: CachedMapView): void {
    this.cache.set(key, view);
  }
}
