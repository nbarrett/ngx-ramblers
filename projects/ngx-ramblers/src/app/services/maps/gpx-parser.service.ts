import { inject, Injectable } from "@angular/core";
import { isUndefined } from "es-toolkit/compat";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../date-utils.service";

// Vendored code from geodesy by Chris Veness (MIT Licence)
// https://www.movable-type.co.uk/scripts/geodesy-library.html

let dmsSeparator = "\u202f";

class Dms {
  static get separator() {
    return dmsSeparator;
  }

  static set separator(char) {
    dmsSeparator = char;
  }

  static parse(dms: any) {
    if (!isNaN(parseFloat(dms)) && isFinite(dms)) return Number(dms);
    const dmsParts = String(dms).trim().replace(/^-/, "").replace(/[NSEW]$/i, "").split(/[^0-9.,]+/);
    if (dmsParts[dmsParts.length - 1] === "") dmsParts.splice(dmsParts.length - 1);
    if (dmsParts.length === 0) return NaN;
    let deg: any = null;
    switch (dmsParts.length) {
      case 3:
        deg = Number(dmsParts[0]) + Number(dmsParts[1]) / 60 + Number(dmsParts[2]) / 3600;
        break;
      case 2:
        deg = Number(dmsParts[0]) + Number(dmsParts[1]) / 60;
        break;
      case 1:
        deg = Number(dmsParts[0]);
        break;
      default:
        return NaN;
    }
    if (/^-|[WS]$/i.test(String(dms).trim())) deg = -deg;
    return Number(deg);
  }

  static wrap90(degrees: number) {
    if (degrees >= -90 && degrees <= 90) return degrees;
    const a = 90;
    const p = 360;
    return (4 * a / p) * Math.abs((((degrees - p / 4) % p) + p) % p - p / 2) - a;
  }

  static wrap180(degrees: number) {
    if (degrees >= -180 && degrees <= 180) return degrees;
    const a = 180;
    const p = 360;
    return (((2 * a * degrees / p - p / 2) % p) + p) % p - a;
  }
}

function toRadians(degrees: number) {
  return degrees * Math.PI / 180;
}

class Vector3d {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    if (isNaN(x) || isNaN(y) || isNaN(z)) throw new TypeError(`invalid vector [${x},${y},${z}]`);
    this.x = Number(x);
    this.y = Number(y);
    this.z = Number(z);
  }

  get length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  plus(v: Vector3d) {
    if (!(v instanceof Vector3d)) throw new TypeError("v is not Vector3d object");
    return new Vector3d(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  minus(v: Vector3d) {
    if (!(v instanceof Vector3d)) throw new TypeError("v is not Vector3d object");
    return new Vector3d(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  times(x: number) {
    if (isNaN(x)) throw new TypeError(`invalid scalar value “${x}”`);
    return new Vector3d(this.x * x, this.y * x, this.z * x);
  }

  dot(v: Vector3d) {
    if (!(v instanceof Vector3d)) throw new TypeError("v is not Vector3d object");
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vector3d) {
    if (!(v instanceof Vector3d)) throw new TypeError("v is not Vector3d object");
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    return new Vector3d(x, y, z);
  }

  unit() {
    const norm = this.length;
    if (norm === 1 || norm === 0) return this;
    const x = this.x / norm;
    const y = this.y / norm;
    const z = this.z / norm;
    return new Vector3d(x, y, z);
  }
}

const ellipsoids = {
  WGS84: {a: 6378137, b: 6356752.314245, f: 1 / 298.257223563},
  Airy1830: {a: 6377563.396, b: 6356256.909, f: 1 / 299.3249646},
};

const datums = {
  OSGB36: {
    ellipsoid: ellipsoids.Airy1830,
    transform: [-446.448, 125.157, -542.06, 20.4894, -0.1502, -0.2470, -0.8421]
  },
  WGS84: {ellipsoid: ellipsoids.WGS84, transform: [0, 0, 0, 0, 0, 0, 0]},
};

class Cartesian extends Vector3d {
  constructor(x: number, y: number, z: number) {
    super(x, y, z);
  }

  toLatLon(ellipsoid = ellipsoids.WGS84): LatLonEllipsoidal_Datum {
    if (!ellipsoid || !ellipsoid.a) throw new TypeError(`invalid ellipsoid “${ellipsoid}”`);
    const {x, y, z} = this;
    const {a, b, f} = ellipsoid;
    const e2 = 2 * f - f * f;
    const epsilonSq = e2 / (1 - e2);
    const p = Math.sqrt(x * x + y * y);
    const R = Math.sqrt(p * p + z * z);
    const tanBeta = (b * z) / (a * p) * (1 + epsilonSq * b / R);
    const sinBeta = tanBeta / Math.sqrt(1 + tanBeta * tanBeta);
    const cosBeta = sinBeta / tanBeta;
    const phi = isNaN(cosBeta) ? 0 : Math.atan2(z + epsilonSq * b * sinBeta * sinBeta * sinBeta, p - e2 * a * cosBeta * cosBeta * cosBeta);
    const lambda = Math.atan2(y, x);
    const sinPhi = Math.sin(phi);
    const nu = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
    const h = p * Math.cos(phi) + z * sinPhi - (a * a / nu);
    return new LatLonEllipsoidal_Datum(phi * 180 / Math.PI, lambda * 180 / Math.PI, h);
  }
}

class Cartesian_Datum extends Cartesian {
  _datum: any;

  constructor(x: number, y: number, z: number, datum: any = undefined) {
    super(x, y, z);
    if (datum) this._datum = datum;
  }

  get datum() {
    return this._datum;
  }

  toLatLon(deprecatedDatum: any = undefined): LatLonEllipsoidal_Datum {
    if (deprecatedDatum) this._datum = deprecatedDatum;
    const datum = this.datum || datums.WGS84;
    const latLon = super.toLatLon(datum.ellipsoid);
    return new LatLonEllipsoidal_Datum(latLon.lat, latLon.lon, latLon.height, this.datum);
  }

  convertDatum(toDatum: any) {
    if (!toDatum || toDatum.ellipsoid === undefined) throw new TypeError(`unrecognised datum “${toDatum}”`);
    if (!this.datum) throw new TypeError("cartesian coordinate has no datum");

    let newCartesian: Cartesian_Datum;

    if (this.datum === datums.WGS84) {
      newCartesian = this.applyTransform(toDatum.transform);
    } else if (toDatum === datums.WGS84) {
      const transform = this.datum.transform.map((p: number) => -p);
      newCartesian = this.applyTransform(transform);
    } else {
      const intermediate = this.convertDatum(datums.WGS84);
      newCartesian = intermediate.applyTransform(toDatum.transform);
    }

    newCartesian._datum = toDatum;

    return newCartesian;
  }

  applyTransform(t: number[]) {
    const {x: x1, y: y1, z: z1} = this;
    const tx = t[0];
    const ty = t[1];
    const tz = t[2];
    const s = t[3] / 1e6 + 1;
    const rx = toRadians(t[4] / 3600);
    const ry = toRadians(t[5] / 3600);
    const rz = toRadians(t[6] / 3600);
    const x2 = tx + x1 * s - y1 * rz + z1 * ry;
    const y2 = ty + x1 * rz + y1 * s - z1 * rx;
    const z2 = tz - x1 * ry + y1 * rx + z1 * s;
    return new Cartesian_Datum(x2, y2, z2);
  }
}

class LatLonEllipsoidal {
  _lat: number;
  _lon: number;
  _height: number;
  _datum: any;

  constructor(lat: number, lon: number, height = 0) {
    if (isNaN(lat) || lat === null) throw new TypeError(`invalid lat “${lat}”`);
    if (isNaN(lon) || lon === null) throw new TypeError(`invalid lon “${lon}”`);
    if (isNaN(height) || height === null) throw new TypeError(`invalid height “${height}”`);
    this._lat = Dms.wrap90(Number(lat));
    this._lon = Dms.wrap180(Number(lon));
    this._height = Number(height);
  }

  get lat() {
    return this._lat;
  }

  get lon() {
    return this._lon;
  }

  get height() {
    return this._height;
  }

  get datum() {
    return this._datum;
  }

  toCartesian(): Cartesian_Datum {
    const ellipsoid = this.datum ? this.datum.ellipsoid : datums.WGS84;
    const phi = toRadians(this.lat);
    const lambda = toRadians(this.lon);
    const h = this.height;
    const {a, f} = ellipsoid;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    const eSq = 2 * f - f * f;
    const nu = a / Math.sqrt(1 - eSq * sinPhi * sinPhi);
    const x = (nu + h) * cosPhi * cosLambda;
    const y = (nu + h) * cosPhi * sinLambda;
    const z = (nu * (1 - eSq) + h) * sinPhi;
    return new Cartesian_Datum(x, y, z, this.datum);
  }
}

class LatLonEllipsoidal_Datum extends LatLonEllipsoidal {
  constructor(lat: number, lon: number, height = 0, datum = datums.WGS84) {
    super(lat, lon, height);
    if (!datum || datum.ellipsoid === undefined) throw new TypeError(`unrecognised datum “${datum}”`);
    this._datum = datum;
  }

  convertDatum(toDatum: any) {
    if (!toDatum || toDatum.ellipsoid === undefined) throw new TypeError(`unrecognised datum “${toDatum}”`);
    const oldCartesian = this.toCartesian();
    const newCartesian = oldCartesian.convertDatum(toDatum);
    return newCartesian.toLatLon();
  }
}

export interface GpxTrackPoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  time?: Date;
  name?: string;
}

export interface GpxTrack {
  name: string;
  description?: string;
  points: GpxTrackPoint[];
  totalDistance?: number;
  minElevation?: number;
  maxElevation?: number;
  totalAscent?: number;
  totalDescent?: number;
}

export interface GpxWaypoint {
  latitude: number;
  longitude: number;
  name?: string;
  description?: string;
  symbol?: string;
}

export interface GpxMetadata {
  name?: string;
  description?: string;
  author?: string;
  time?: Date;
}

export interface ParsedGpx {
  metadata: GpxMetadata;
  tracks: GpxTrack[];
  waypoints: GpxWaypoint[];
}

@Injectable({
  providedIn: "root"
})
export class GpxParserService {
  private logger: Logger = inject(LoggerFactory).createLogger("GpxParserService", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);

  parseGpxFile(gpxContent: string): ParsedGpx {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, "text/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      this.logger.error("parseGpxFile: parsererror", parseError.textContent);
      throw new Error("Invalid GPX file format");
    }

    const metadata = this.parseMetadata(xmlDoc);
    const tracks = this.parseTracks(xmlDoc);
    const waypoints = this.parseWaypoints(xmlDoc);
    const coordinateSystem = this.determineCoordinateSystem(xmlDoc);
    this.logger.info("parseGpxFile: parsed GPX", metadata?.name, "tracks", tracks.length, "waypoints", waypoints.length, "coordinateSystem", coordinateSystem);

    if (coordinateSystem === "osgb36") {
      this.logger.info("parseGpxFile: converting OSGB36 coordinates");
      this.convertOsGbTracks(tracks);
      this.convertOsGbWaypoints(waypoints);
    } else {
      this.logger.info("parseGpxFile: no coordinate conversion required");
    }

    return {
      metadata,
      tracks,
      waypoints
    };
  }

  private parseMetadata(xmlDoc: Document): GpxMetadata {
    const metadataEl = xmlDoc.querySelector("metadata");
    if (!metadataEl) {
      return {};
    }

    return {
      name: this.getTextContent(metadataEl, "name"),
      description: this.getTextContent(metadataEl, "desc"),
      author: this.getTextContent(metadataEl, "author > name"),
      time: this.parseDate(this.getTextContent(metadataEl, "time"))
    };
  }

  private parseTracks(xmlDoc: Document): GpxTrack[] {
    const trackElements = xmlDoc.querySelectorAll("trk");
    const tracks: GpxTrack[] = [];

    trackElements.forEach(trackEl => {
      const track = this.parseTrack(trackEl);
      if (track.points.length > 0) {
        tracks.push(track);
      }
    });

    return tracks;
  }

  private parseTrack(trackEl: Element): GpxTrack {
    const name = this.getTextContent(trackEl, "name") || "Untitled Track";
    const description = this.getTextContent(trackEl, "desc");
    const points = this.parseTrackPoints(trackEl);

    const track: GpxTrack = {
      name,
      description,
      points
    };

    if (points.length > 0) {
      this.calculateTrackStatistics(track);
    }

    return track;
  }

  private parseTrackPoints(trackEl: Element): GpxTrackPoint[] {
    const trkptElements = trackEl.querySelectorAll("trkpt");
    const points: GpxTrackPoint[] = [];

    trkptElements.forEach(trkptEl => {
      const lat = parseFloat(trkptEl.getAttribute("lat") || "0");
      const lon = parseFloat(trkptEl.getAttribute("lon") || "0");

      if (!isNaN(lat) && !isNaN(lon)) {
        const point: GpxTrackPoint = {
          latitude: lat,
          longitude: lon
        };

        const eleText = this.getTextContent(trkptEl, "ele");
        if (eleText) {
          point.elevation = parseFloat(eleText);
        }

        const timeText = this.getTextContent(trkptEl, "time");
        if (timeText) {
          point.time = this.parseDate(timeText);
        }

        const name = this.getTextContent(trkptEl, "name");
        if (name) {
          point.name = name;
        }

        points.push(point);
      }
    });

    return points;
  }

  private parseWaypoints(xmlDoc: Document): GpxWaypoint[] {
    const waypointElements = xmlDoc.querySelectorAll("wpt, rtept");
    const waypoints: GpxWaypoint[] = [];

    waypointElements.forEach(element => {
      const lat = parseFloat(element.getAttribute("lat") || "");
      const lon = parseFloat(element.getAttribute("lon") || "");
      if (isNaN(lat) || isNaN(lon)) {
        return;
      }

      const name = this.getTextContent(element, "name");
      const description = this.getTextContent(element, "desc");
      const symbol = this.getTextContent(element, "sym");

      if (!this.isUsefulWaypoint(name, description, symbol)) {
        return;
      }

      waypoints.push({
        latitude: lat,
        longitude: lon,
        name,
        description,
        symbol
      });
    });

    return waypoints;
  }

  private isUsefulWaypoint(name?: string, description?: string, symbol?: string): boolean {
    if (!name && !description && !symbol) {
      return false;
    }

    if (name && /^.*\s+\d+$/.test(name) && !description) {
      return false;
    }

    return true;
  }

  private calculateTrackStatistics(track: GpxTrack): void {
    if (track.points.length < 2) {
      return;
    }

    const stats = track.points.reduce(
      (acc, point, i) => {
        const hasElevation = !isUndefined(point.elevation);
        const minElevation = hasElevation && (isUndefined(acc.minElevation) || point.elevation < acc.minElevation) ? point.elevation : acc.minElevation;
        const maxElevation = hasElevation && (isUndefined(acc.maxElevation) || point.elevation > acc.maxElevation) ? point.elevation : acc.maxElevation;
        const elevationChange = hasElevation && !isUndefined(acc.previousElevation) ? point.elevation - acc.previousElevation : 0;
        const totalAscent = elevationChange > 0 ? acc.totalAscent + elevationChange : acc.totalAscent;
        const totalDescent = elevationChange < 0 ? acc.totalDescent + Math.abs(elevationChange) : acc.totalDescent;
        const previousElevation = hasElevation ? point.elevation : acc.previousElevation;
        const distanceInc = i > 0 ? this.calculateDistance(track.points[i - 1].latitude, track.points[i - 1].longitude, point.latitude, point.longitude) : 0;
        return {totalDistance: acc.totalDistance + distanceInc, minElevation, maxElevation, totalAscent, totalDescent, previousElevation};
      },
      {totalDistance: 0, minElevation: undefined as number | undefined, maxElevation: undefined as number | undefined, totalAscent: 0, totalDescent: 0, previousElevation: undefined as number | undefined}
    );

    track.totalDistance = stats.totalDistance;
    track.minElevation = stats.minElevation;
    track.maxElevation = stats.maxElevation;
    track.totalAscent = stats.totalAscent;
    track.totalDescent = stats.totalDescent;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private getTextContent(element: Element, selector: string): string | undefined {
    const el = element.querySelector(selector);
    return el?.textContent?.trim() || undefined;
  }

  private parseDate(dateString: string | undefined): Date | undefined {
    if (!dateString) {
      return undefined;
    }
    const parsed = this.dateUtils.asDateTime(dateString);
    return parsed.isValid ? parsed.toJSDate() : undefined;
  }

  toLeafletLatLngs(track: GpxTrack): [number, number][] {
    return track.points.map(point => [point.latitude, point.longitude]);
  }

  getBounds(track: GpxTrack): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
    if (track.points.length === 0) {
      return null;
    }

    let minLat = track.points[0].latitude;
    let maxLat = track.points[0].latitude;
    let minLng = track.points[0].longitude;
    let maxLng = track.points[0].longitude;

    track.points.forEach(point => {
      if (point.latitude < minLat) minLat = point.latitude;
      if (point.latitude > maxLat) maxLat = point.latitude;
      if (point.longitude < minLng) minLng = point.longitude;
      if (point.longitude > maxLng) maxLng = point.longitude;
    });

    return { minLat, maxLat, minLng, maxLng };
  }

  private determineCoordinateSystem(xmlDoc: Document): string {
    const root = xmlDoc.documentElement;
    const creator = (root.getAttribute("creator") || "").toLowerCase();
    const declared = (root.getAttribute("data-ngx-crs") || "").toLowerCase();
    if (declared) {
      this.logger.info("determineCoordinateSystem: found data-ngx-crs", declared);
      return declared;
    }
    if (creator.includes("ngx-ramblers")) {
      this.logger.info("determineCoordinateSystem: creator indicates ngx-ramblers");
      return "wgs84";
    }
    if (creator.includes("osgb36") || creator.includes("british national grid")) {
      this.logger.info("determineCoordinateSystem: creator indicates OSGB36");
      return "osgb36";
    }
    this.logger.info("determineCoordinateSystem: defaulting to wgs84");
    return "wgs84";
  }

  private convertOsGbTracks(tracks: GpxTrack[]): void {
    tracks.forEach(track => {
      this.logger.info("convertOsGbTracks: converting track", track.name, "pointCount", track.points.length);
      track.points = track.points.map(point => {
        const osgbPoint = new LatLonEllipsoidal_Datum(point.latitude, point.longitude, point.elevation || 0, datums.OSGB36);
        const wgs84Point = osgbPoint.convertDatum(datums.WGS84);
        return {
          ...point,
          latitude: wgs84Point.lat,
          longitude: wgs84Point.lon
        };
      });
      this.calculateTrackStatistics(track);
    });
  }

  private convertOsGbWaypoints(waypoints: GpxWaypoint[]): void {
    if (waypoints.length > 0) {
      this.logger.info("convertOsGbWaypoints: converting waypoints", waypoints.length);
    }
    waypoints.forEach(point => {
      const osgbPoint = new LatLonEllipsoidal_Datum(point.latitude, point.longitude, 0, datums.OSGB36);
      const wgs84Point = osgbPoint.convertDatum(datums.WGS84);
      point.latitude = wgs84Point.lat;
      point.longitude = wgs84Point.lon;
    });
  }
}
