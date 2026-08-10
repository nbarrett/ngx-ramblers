import expect from "expect";
import { describe, it } from "mocha";
import {
  boundsCornersAround,
  clampZoom,
  estimateLabelSize,
  featureHasRenderableGeometry,
  findLabelPlacement,
  hashedLabelOffset,
  labelBoundsAround,
  parsedStoredZoom,
  pixelRectsIntersect,
  pointInPolygonRings,
  pointInRing,
  zoomDrivenBoundsOffset,
  zoomWithinStoredRange
} from "../../../projects/ngx-ramblers/src/app/functions/area-map-geometry";
import { GeoPoint } from "../../../projects/ngx-ramblers/src/app/models/area-map.model";

describe("area map geometry", () => {

  describe("estimateLabelSize", () => {
    it("clamps short names to the minimum width", () => {
      expect(estimateLabelSize("ab")).toEqual({width: 90, height: 22});
    });

    it("clamps long names to the maximum width", () => {
      expect(estimateLabelSize("a".repeat(50))).toEqual({width: 220, height: 22});
    });

    it("scales width with text length between the clamps", () => {
      expect(estimateLabelSize("a".repeat(20))).toEqual({width: 156, height: 22});
    });
  });

  describe("hashedLabelOffset", () => {
    it("derives a deterministic offset from the label text", () => {
      expect(hashedLabelOffset("Kent")).toEqual({lat: 0, lng: 0.005});
    });

    it("returns the same offset for the same text", () => {
      expect(hashedLabelOffset("Ashford")).toEqual(hashedLabelOffset("Ashford"));
    });
  });

  describe("labelBoundsAround", () => {
    it("centres the bounds on the supplied point", () => {
      expect(labelBoundsAround({x: 100, y: 50}, {width: 90, height: 22})).toEqual({
        min: {x: 55, y: 39},
        max: {x: 145, y: 61}
      });
    });
  });

  describe("pixelRectsIntersect", () => {
    it("detects overlapping rectangles", () => {
      const first = {min: {x: 0, y: 0}, max: {x: 10, y: 10}};
      const second = {min: {x: 5, y: 5}, max: {x: 15, y: 15}};
      expect(pixelRectsIntersect(first, second)).toBe(true);
    });

    it("treats touching edges as intersecting, matching leaflet bounds semantics", () => {
      const first = {min: {x: 0, y: 0}, max: {x: 10, y: 10}};
      const second = {min: {x: 10, y: 0}, max: {x: 20, y: 10}};
      expect(pixelRectsIntersect(first, second)).toBe(true);
    });

    it("rejects separated rectangles", () => {
      const first = {min: {x: 0, y: 0}, max: {x: 10, y: 10}};
      const second = {min: {x: 11, y: 11}, max: {x: 20, y: 20}};
      expect(pixelRectsIntersect(first, second)).toBe(false);
    });
  });

  describe("findLabelPlacement", () => {
    const size = {width: 90, height: 22};

    it("keeps the label at its origin when nothing collides", () => {
      const placement = findLabelPlacement({x: 0, y: 0}, size, []);
      expect(placement.point).toEqual({x: 0, y: 0});
      expect(placement.bounds).toEqual({min: {x: -45, y: -11}, max: {x: 45, y: 11}});
    });

    it("steps diagonally clear of an existing label occupying the origin", () => {
      const existing = [labelBoundsAround({x: 0, y: 0}, size)];
      const placement = findLabelPlacement({x: 0, y: 0}, size, existing);
      expect(placement.point).toEqual({x: 14, y: 28});
      expect(pixelRectsIntersect(existing[0], placement.bounds)).toBe(false);
    });

    it("returns null when every candidate position collides", () => {
      const everywhere = [{min: {x: -10000, y: -10000}, max: {x: 10000, y: 10000}}];
      expect(findLabelPlacement({x: 0, y: 0}, size, everywhere)).toBeNull();
    });
  });

  describe("pointInRing", () => {
    const square: GeoPoint[] = [
      {lat: 0, lng: 0},
      {lat: 0, lng: 10},
      {lat: 10, lng: 10},
      {lat: 10, lng: 0}
    ];

    it("detects a point inside the ring", () => {
      expect(pointInRing({lat: 5, lng: 5}, square)).toBe(true);
    });

    it("detects a point outside the ring", () => {
      expect(pointInRing({lat: 5, lng: 15}, square)).toBe(false);
      expect(pointInRing({lat: -5, lng: 5}, square)).toBe(false);
    });
  });

  describe("pointInPolygonRings", () => {
    const west: GeoPoint[] = [
      {lat: 0, lng: 0},
      {lat: 0, lng: 10},
      {lat: 10, lng: 10},
      {lat: 10, lng: 0}
    ];
    const east: GeoPoint[] = [
      {lat: 0, lng: 20},
      {lat: 0, lng: 30},
      {lat: 10, lng: 30},
      {lat: 10, lng: 20}
    ];

    it("handles a simple polygon ring list", () => {
      expect(pointInPolygonRings({lat: 5, lng: 5}, [west])).toBe(true);
      expect(pointInPolygonRings({lat: 5, lng: 15}, [west])).toBe(false);
    });

    it("flattens nested multi polygon rings", () => {
      const nested = [[west], [east]];
      expect(pointInPolygonRings({lat: 5, lng: 25}, nested)).toBe(true);
      expect(pointInPolygonRings({lat: 5, lng: 15}, nested)).toBe(false);
    });
  });

  describe("zoomDrivenBoundsOffset", () => {
    it("widens the bounds as the zoom gets further out", () => {
      expect(zoomDrivenBoundsOffset(8)).toBe(1.2);
      expect(zoomDrivenBoundsOffset(10)).toBe(0.8);
      expect(zoomDrivenBoundsOffset(11)).toBe(0.4);
    });
  });

  describe("boundsCornersAround", () => {
    it("expands the centre by the zoom driven offset", () => {
      const corners = boundsCornersAround({lat: 51, lng: 0.5}, 10);
      expect(corners.southWest.lat).toBeCloseTo(50.2);
      expect(corners.southWest.lng).toBeCloseTo(-0.3);
      expect(corners.northEast.lat).toBeCloseTo(51.8);
      expect(corners.northEast.lng).toBeCloseTo(1.3);
    });
  });

  describe("clampZoom", () => {
    it("clamps to the leaflet zoom range", () => {
      expect(clampZoom(1)).toBe(2);
      expect(clampZoom(9)).toBe(9);
      expect(clampZoom(25)).toBe(18);
    });
  });

  describe("parsedStoredZoom", () => {
    it("accepts finite numbers", () => {
      expect(parsedStoredZoom(10)).toBe(10);
    });

    it("parses numeric strings", () => {
      expect(parsedStoredZoom("12.5")).toBe(12.5);
    });

    it("falls back to the default for unusable values", () => {
      expect(parsedStoredZoom("not-a-zoom")).toBe(9);
      expect(parsedStoredZoom(NaN)).toBe(9);
      expect(parsedStoredZoom(Infinity)).toBe(9);
      expect(parsedStoredZoom(null)).toBe(9);
      expect(parsedStoredZoom({zoom: 4})).toBe(9);
    });
  });

  describe("zoomWithinStoredRange", () => {
    it("accepts zooms between 2 and 18 inclusive", () => {
      expect(zoomWithinStoredRange(2)).toBe(true);
      expect(zoomWithinStoredRange(18)).toBe(true);
      expect(zoomWithinStoredRange(1.9)).toBe(false);
      expect(zoomWithinStoredRange(18.1)).toBe(false);
    });
  });

  describe("featureHasRenderableGeometry", () => {
    it("accepts a feature collection with features", () => {
      expect(featureHasRenderableGeometry({type: "FeatureCollection", features: [{}]})).toBe(true);
    });

    it("rejects an empty feature collection", () => {
      expect(featureHasRenderableGeometry({type: "FeatureCollection", features: []})).toBe(false);
    });

    it("accepts a feature with coordinates", () => {
      expect(featureHasRenderableGeometry({type: "Feature", geometry: {coordinates: [[[0, 0]]]}})).toBe(true);
    });

    it("rejects a feature with empty or missing coordinates", () => {
      expect(featureHasRenderableGeometry({type: "Feature", geometry: {coordinates: []}})).toBe(false);
      expect(featureHasRenderableGeometry({type: "Feature"})).toBe(false);
    });
  });
});
