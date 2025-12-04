import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { GroupAreaConfig, GroupAreaRegionConfig, ONSGeoJSON, RegionConfig, RegionGroup } from "../models/group-area.model";
import { forkJoin, Observable, of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { isNull } from "es-toolkit/compat";

@Injectable({ providedIn: "root" })
export class GroupAreasService {
  private http = inject(HttpClient);
  private logger: Logger = inject(LoggerFactory).createLogger("GroupAreasService", NgxLoggerLevel.ERROR);
  private apiUrl = "/api";

  private regionConfigs: Record<string, RegionConfig> = {};

  private queryRegionConfig(regionName?: string): Observable<RegionConfig> {
    if (!regionName) {
      throw new Error("regionName is required");
    }

    if (this.regionConfigs[regionName]) {
      return of(this.regionConfigs[regionName]);
    }

    return this.http.get<RegionConfig>(`${this.apiUrl}/regions?regionName=${encodeURIComponent(regionName)}`).pipe(
      map(config => {
        this.regionConfigs[regionName] = config;
        return config;
      })
    );
  }

  queryArea(areaName: string, regionName?: string): Observable<GroupAreaConfig> {
    return this.queryRegionConfig(regionName).pipe(
      switchMap(regionConfig => {
        const group = regionConfig.groups.find(g => g.name === areaName);
        if (!group) {
          return of({
            name: areaName,
            url: "",
            groupCode: "",
            description: "",
            color: "hsl(0, 0%, 50%)",
            geoJsonFeature: {
              type: "Feature" as const,
              properties: {},
              geometry: { type: "Polygon" as const, coordinates: [] }
            }
          });
        }

        if (group.nonGeographic) {
          return of({
            name: areaName,
            url: group.url || "",
            groupCode: group.groupCode,
            description: "",
            color: group.color || "hsl(0, 0%, 50%)",
            geoJsonFeature: {
              type: "Feature" as const,
              properties: {},
              geometry: { type: "Polygon" as const, coordinates: [] }
            }
          });
        }

        if (!regionName) {
          throw new Error("regionName is required for geographic groups");
        }

        return this.http.get<ONSGeoJSON>(`${this.apiUrl}/areas?areaName=${encodeURIComponent(areaName)}&regionName=${encodeURIComponent(regionName)}`).pipe(
          map(geojson => {
            if (geojson.features.length === 0) {
              this.logger.warn(`No features for ${areaName} - returning empty geometry`);
              return {
                name: areaName,
                url: group.url || "",
                description: "",
                color: group.color || "hsl(0, 0%, 50%)",
                geoJsonFeature: {
                  type: "Feature" as const,
                  properties: {},
                  geometry: { type: "Polygon" as const, coordinates: [] }
                }
              };
            }

            const geoJsonFeature = geojson.features.length === 1
              ? geojson.features[0] as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
              : {
                  type: "FeatureCollection" as const,
                  features: geojson.features
                } as any;

            return {
              name: areaName,
              url: group.url,
              groupCode: group.groupCode,
              description: `${areaName} Ramblers Group`,
              color: group.color || "hsl(0, 0%, 50%)",
              geoJsonFeature
            };
          }),
          catchError(error => {
            this.logger.error(`Failed to fetch area ${areaName}:`, error);
            return of({
              name: areaName,
              url: group.url || "",
              groupCode: group.groupCode,
              description: "",
              color: group.color || "hsl(0, 0%, 50%)",
              geoJsonFeature: {
                type: "Feature" as const,
                properties: {},
                geometry: { type: "Polygon" as const, coordinates: [] }
              }
            });
          })
        );
      })
    );
  }

  queryAllAreas(regionName?: string): Observable<GroupAreaConfig[]> {
    return this.queryRegionConfig(regionName).pipe(
      switchMap(regionConfig => {
        const geographicGroups: RegionGroup[] = regionConfig.groups.filter(group => !group.nonGeographic);
        this.logger.info(`geographicGroups:`, geographicGroups);
        if (geographicGroups.length === 0) {
          return of([]);
        }

        const areaRequests = geographicGroups.map(group =>
          this.queryArea(group.name, regionName).pipe(
            catchError(error => {
              this.logger.warn(`Failed to fetch ${group.name}:`, error);
              return of(null);
            })
          )
        );

        return forkJoin(areaRequests).pipe(
          map((results: (GroupAreaConfig | null)[]) => results.filter(area => !isNull(area)) as GroupAreaConfig[])
        );
      })
    );
  }


  getRegionWithBoundsAsync(region: string, bounds: { north: number; south: number; west: number; east: number }): Observable<GroupAreaRegionConfig | null> {
    return this.queryRegionConfig(region).pipe(
      switchMap(regionConfig => {
        if (!regionConfig) {
          return of(null);
        }

        return this.queryAllAreas(region).pipe(
          map(areas => ({
            name: regionConfig.name,
            center: regionConfig.center as [number, number],
            zoom: regionConfig.zoom,
            areas
          }))
        );
      }),
      catchError(error => {
        this.logger.warn(`Failed to fetch region config for ${region}:`, error);
        return of(null);
      })
    );
  }

  private isAreaInBounds(area: { coordinates: [number, number][] }, bounds: { north: number; south: number; west: number; east: number }): boolean {
    if (!area.coordinates || area.coordinates.length === 0) {
      return false;
    }

    return area.coordinates.some(([lat, lng]) =>
      lat >= bounds.south && lat <= bounds.north &&
      lng >= bounds.west && lng <= bounds.east
    );
  }

}
