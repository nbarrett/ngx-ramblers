import { Injectable } from "@angular/core";

export interface ImageBounds {
  width: number;
  height: number;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

@Injectable({ providedIn: "root" })
export class PixelGeoTransformService {
  toLatLng(x: number, y: number, image: ImageBounds, bounds: GeoBounds): [number, number] {
    const nx = Math.max(0, Math.min(1, x / image.width));
    const ny = Math.max(0, Math.min(1, y / image.height));
    const lat = bounds.north + (bounds.south - bounds.north) * ny;
    const lng = bounds.west + (bounds.east - bounds.west) * nx;
    return [lat, lng];
  }

  toLatLngPolygon(points: Array<[number, number]>, image: ImageBounds, bounds: GeoBounds): Array<[number, number]> {
    return points.map(p => this.toLatLng(p[0], p[1], image, bounds));
  }
}

