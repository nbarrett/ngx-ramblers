import { isArray, isNumber, isObject, isString } from "es-toolkit/compat";
import { dateTimeFromIso } from "../shared/dates";
import { OsMapsListedRoute, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";

export function listedRoutesFromSearchPayload(payload: unknown, source: OsMapsRouteSource): OsMapsListedRoute[] {
  const records = recordsFromPayload(payload);
  return records.map(record => listedRouteFromRecord(record, source)).filter((route): route is OsMapsListedRoute => !!route);
}

function recordsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (isArray(payload)) {
    return payload.filter(item => isObject(item)) as Record<string, unknown>[];
  } else if (isObject(payload) && isArray((payload as {content?: unknown}).content)) {
    return ((payload as {content: unknown[]}).content)
      .filter(item => isObject(item)) as Record<string, unknown>[];
  } else {
    return [];
  }
}

function listedRouteFromRecord(record: Record<string, unknown>, source: OsMapsRouteSource): OsMapsListedRoute | null {
  const id = isString(record.id) ? record.id : "";
  if (!id) {
    return null;
  } else {
    const metadata = isObject(record.metadata) ? record.metadata as Record<string, unknown> : {};
    const characteristics = isObject(record.characteristics) ? record.characteristics as Record<string, unknown> : {};
    const title = firstString(metadata.name, metadata.title, record.name, `Route ${id}`);
    const createdAt = firstString(metadata.createdAt, record.createdAt);
    const created = createdAt ? dateTimeFromIso(createdAt) : null;
    const distanceMetres = isNumber(characteristics.distance) ? characteristics.distance : 0;
    return {
      id,
      title,
      url: `https://explore.osmaps.com/route/${id}`,
      createdAt,
      createdAtValue: created?.isValid ? created.toMillis() : 0,
      distanceMetres,
      source
    };
  }
}

function firstString(...values: unknown[]): string {
  const match = values.find(value => isString(value) && value.trim().length > 0);
  return isString(match) ? match.trim() : "";
}
