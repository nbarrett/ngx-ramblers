import { isArray, isBoolean, isNumber, isObject, isString } from "es-toolkit/compat";
import { dateTimeFromIso } from "../shared/dates";
import { OsMapsListedRoute, OsMapsRouteSearchPage, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";

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

export async function allListedRoutesFromSearchPages(
  payload: unknown,
  source: OsMapsRouteSource,
  fetchPage: (page: number) => Promise<unknown>,
  previousRoutes: OsMapsListedRoute[] = []
): Promise<OsMapsListedRoute[]> {
  const page = payload as OsMapsRouteSearchPage;
  if (!isArray(page?.content) || !isNumber(page.number) || !isNumber(page.totalPages)
    || !isNumber(page.totalElements) || !isBoolean(page.last)) {
    throw new Error("OS Maps returned an unrecognised route listing page");
  } else {
    const routes = listedRoutesFromSearchPayload(payload, source);
    const seen = new Set(previousRoutes.map(route => route.id));
    const combined = [...previousRoutes, ...routes.filter(route => {
      if (seen.has(route.id)) {
        return false;
      } else {
        seen.add(route.id);
        return true;
      }
    })];
    if (page.last) {
      if (combined.length !== page.totalElements) {
        throw new Error(`OS Maps listed ${combined.length} unique routes but reported ${page.totalElements}; the previous listing has been retained`);
      } else {
        return combined;
      }
    } else if (combined.length === previousRoutes.length || page.number + 1 >= page.totalPages) {
      throw new Error("OS Maps pagination did not advance; the previous listing has been retained");
    } else {
      const nextPage = page.number + 1;
      const nextPayload = await fetchPage(nextPage);
      if ((nextPayload as OsMapsRouteSearchPage)?.number !== nextPage) {
        throw new Error(`OS Maps did not return requested route page ${nextPage + 1}; the previous listing has been retained`);
      } else {
        return allListedRoutesFromSearchPages(nextPayload, source, fetchPage, combined);
      }
    }
  }
}
