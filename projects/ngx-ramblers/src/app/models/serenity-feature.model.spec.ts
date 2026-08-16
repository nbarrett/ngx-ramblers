import { resolvedSerenityFeature, SerenityFeature, serenityFeatureFromFileName } from "./serenity-feature.model";

describe("serenity-feature", () => {

  describe("serenityFeatureFromFileName", () => {

    it("treats OS Maps export files as the OS Maps export scenario", () => {
      expect(serenityFeatureFromFileName("os-maps-export-20260816-182514.gpx")).toEqual(SerenityFeature.OS_MAPS_EXPORT);
    });

    it("treats OS Maps list files as the OS Maps list scenario", () => {
      expect(serenityFeatureFromFileName("os-maps-list-20260816-120000.json")).toEqual(SerenityFeature.OS_MAPS_LIST);
    });

    it("treats walk export files as the walks upload scenario", () => {
      expect(serenityFeatureFromFileName("walks-export-16-August-2026-18-42.csv")).toEqual(SerenityFeature.WALKS_UPLOAD);
    });

  });

  describe("resolvedSerenityFeature", () => {

    it("prefers the stored scenario when it is a known feature", () => {
      expect(resolvedSerenityFeature("os-maps-export-20260816-182514.gpx", SerenityFeature.WALKS_UPLOAD))
        .toEqual(SerenityFeature.WALKS_UPLOAD);
    });

    it("falls back to the file name when the stored scenario is missing", () => {
      expect(resolvedSerenityFeature("os-maps-export-20260816-182514.gpx")).toEqual(SerenityFeature.OS_MAPS_EXPORT);
    });

  });

});
