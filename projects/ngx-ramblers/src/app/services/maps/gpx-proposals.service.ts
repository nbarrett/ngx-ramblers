import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { LatLng } from "leaflet";
import { cloneDeep } from "es-toolkit/compat";
import { GpxParserService, GpxTrack } from "./gpx-parser.service";
import { AddressQueryService } from "../walks/address-query.service";
import { RouteFollowPayloadService } from "./route-follow-payload.service";
import { StringUtilsService } from "../string-utils.service";
import { LoggerFactory } from "../logger-factory.service";
import { GridReferenceLookupResponse } from "../../models/address-model";
import { LocationDetails } from "../../models/ramblers-walks-manager";
import { GroupEvent } from "../../models/group-event.model";
import { FEET_PER_METRE, GPX_CIRCULAR_ENDS_METRES, INITIALISED_LOCATION, KM_PER_MILE, WalkGpxField, WalkGpxFieldProposal, WalkType } from "../../models/walk.model";
import { GpxDerivedValues } from "../../models/gpx-proposals.model";
import { FileNameData, ServerFileNameData } from "../../models/aws-object.model";
import { metresBetween } from "../../functions/route-geometry";
import { sortBy } from "../../functions/arrays";

@Injectable({
  providedIn: "root"
})
export class GpxProposalsService {
  private logger = inject(LoggerFactory).createLogger("GpxProposalsService", NgxLoggerLevel.ERROR);
  private gpxParser = inject(GpxParserService);
  private addressQueryService = inject(AddressQueryService);
  private httpClient = inject(HttpClient);
  private routeFollowPayload = inject(RouteFollowPayloadService);
  private stringUtils = inject(StringUtilsService);

  gpxContent(file: FileNameData | Partial<ServerFileNameData>): Promise<string> {
    return firstValueFrom(this.httpClient.get(this.routeFollowPayload.gpxDownloadUrl(file), {responseType: "text"}));
  }

  async derive(content: string): Promise<GpxDerivedValues | null> {
    const parsed = this.gpxParser.parseGpxFile(content);
    const track: GpxTrack | null = (parsed.tracks || []).reduce((longest, candidate) => (candidate.points?.length || 0) > (longest?.points?.length || 0) ? candidate : longest, null as GpxTrack | null);
    const points = track?.points || [];
    if (points.length < 2) {
      return null;
    } else {
      const first = points[0];
      const last = points[points.length - 1];
      const circular = metresBetween(first, last) <= GPX_CIRCULAR_ENDS_METRES;
      const km = (track.totalDistance || 0) / 1000;
      return {
        shape: circular ? WalkType.CIRCULAR : WalkType.LINEAR,
        miles: km / KM_PER_MILE,
        km,
        ascentMetres: Math.round(track.totalAscent || 0),
        startLocation: await this.locationFor(first),
        endLocation: circular ? null : await this.locationFor(last)
      };
    }
  }

  proposals(values: GpxDerivedValues, current: Partial<GroupEvent>, fields: WalkGpxField[]): WalkGpxFieldProposal[] {
    const all: (WalkGpxFieldProposal | null)[] = [
      this.proposal(WalkGpxField.SHAPE, "Walk type", current.shape ? this.stringUtils.asTitle(current.shape) : "", values.shape),
      this.proposal(WalkGpxField.DISTANCE, "Distance", current.distance_miles ? `${current.distance_miles} miles` : "", `${values.miles.toFixed(1)} miles (${values.km.toFixed(1)} km)`),
      values.ascentMetres > 0 ? this.proposal(WalkGpxField.ASCENT, "Ascent", current.ascent_metres ? `${current.ascent_metres} m` : "", `${values.ascentMetres} m (${Math.round(values.ascentMetres * FEET_PER_METRE)} ft)`) : null,
      values.startLocation ? this.proposal(WalkGpxField.START_LOCATION, "Start", this.locationSummary(current.start_location), this.locationSummary(values.startLocation)) : null,
      values.endLocation ? this.proposal(WalkGpxField.END_LOCATION, "Finish", this.locationSummary(current.end_location), this.locationSummary(values.endLocation)) : null
    ];
    return all.filter(item => !!item && fields.includes(item.field) && item.currentValue !== item.proposedValue);
  }

  apply(proposals: WalkGpxFieldProposal[], values: GpxDerivedValues, target: Partial<GroupEvent>): WalkGpxFieldProposal[] {
    const applied = proposals.filter(item => item.apply);
    applied.forEach(item => {
      if (item.field === WalkGpxField.SHAPE) {
        target.shape = values.shape.toLowerCase();
      } else if (item.field === WalkGpxField.DISTANCE) {
        target.distance_miles = Number(values.miles.toFixed(1));
        target.distance_km = Number(values.km.toFixed(1));
      } else if (item.field === WalkGpxField.ASCENT) {
        target.ascent_metres = values.ascentMetres;
        target.ascent_feet = Math.round(values.ascentMetres * FEET_PER_METRE);
      } else if (item.field === WalkGpxField.START_LOCATION && values.startLocation) {
        target.start_location = values.startLocation;
      } else if (item.field === WalkGpxField.END_LOCATION && values.endLocation) {
        target.end_location = values.endLocation;
      }
    });
    return applied;
  }

  locationSummary(location: LocationDetails | null | undefined): string {
    return [location?.postcode, location?.grid_reference_8 || location?.grid_reference_6, location?.description].filter(Boolean).join(", ");
  }

  private proposal(field: WalkGpxField, label: string, currentValue: string, proposedValue: string): WalkGpxFieldProposal {
    return {field, label, currentValue, proposedValue, apply: !currentValue};
  }

  private async locationFor(point: {latitude: number; longitude: number}): Promise<LocationDetails | null> {
    try {
      const responses: GridReferenceLookupResponse[] = await this.addressQueryService.gridReferenceLookupFromLatLng(new LatLng(point.latitude, point.longitude));
      const closest = (responses || []).sort(sortBy("distance"))[0];
      return {
        ...cloneDeep(INITIALISED_LOCATION),
        latitude: point.latitude,
        longitude: point.longitude,
        postcode: closest?.postcode || "",
        description: closest?.description || "",
        grid_reference_6: closest?.gridReference6 || "",
        grid_reference_8: closest?.gridReference8 || "",
        grid_reference_10: closest?.gridReference10 || ""
      };
    } catch (error) {
      this.logger.warn("locationFor lookup failed", error);
      return {...cloneDeep(INITIALISED_LOCATION), latitude: point.latitude, longitude: point.longitude};
    }
  }
}
