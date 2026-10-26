import { FileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { MapRoute, PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { pageContent } from "../mongo/models/page-content";
import * as mongooseClient from "../mongo/mongoose-client";
import { isArray, isObject, isString, keys } from "es-toolkit/compat";

export function applyLibraryGpxToMapRoute(route: MapRoute, routeId: string, gpxFile: FileNameData, previousAwsFileName: string | null): MapRoute {
  const aws = route.gpxFile?.awsFileName || "";
  const linked = route.osMapsRouteId === routeId
    || aws === gpxFile.awsFileName
    || (!!previousAwsFileName && aws === previousAwsFileName);
  if (linked) {
    return {
      ...route,
      osMapsRouteId: routeId,
      name: gpxFile.title || route.name,
      gpxFile
    };
  } else {
    return route;
  }
}

export function applyLibraryGpxToTree(node: unknown, routeId: string, gpxFile: FileNameData, previousAwsFileName: string | null): unknown {
  if (isArray(node)) {
    return node.map(item => applyLibraryGpxToTree(item, routeId, gpxFile, previousAwsFileName));
  } else if (!isObject(node)) {
    return node;
  } else {
    const record = node as Record<string, unknown>;
    if (isArray(record.routes) && record.routes.some((route: MapRoute) => isString(route?.id) || route?.gpxFile)) {
      return {
        ...record,
        routes: (record.routes as MapRoute[]).map(route => applyLibraryGpxToMapRoute(route, routeId, gpxFile, previousAwsFileName))
      };
    } else {
      const next: Record<string, unknown> = {};
      keys(record).forEach(key => {
        next[key] = applyLibraryGpxToTree(record[key], routeId, gpxFile, previousAwsFileName);
      });
      return next;
    }
  }
}

export async function syncImportedRoutePages(routeId: string, gpxFile: FileNameData | null | undefined, previousAwsFileName: string | null = null): Promise<number> {
  if (!gpxFile?.awsFileName) {
    return 0;
  } else {
    const names = [gpxFile.awsFileName, previousAwsFileName].filter(Boolean) as string[];
    const pages = await mongooseClient.execute(() => pageContent.find({
      $or: [
        {"rows.map.routes.osMapsRouteId": routeId},
        {"rows.columns.rows.map.routes.osMapsRouteId": routeId},
        {"rows.columns.rows.columns.rows.map.routes.osMapsRouteId": routeId},
        {"rows.map.routes.gpxFile.awsFileName": {$in: names}},
        {"rows.columns.rows.map.routes.gpxFile.awsFileName": {$in: names}},
        {"rows.columns.rows.columns.rows.map.routes.gpxFile.awsFileName": {$in: names}}
      ]
    }).lean()) as PageContent[];
    const written = await Promise.all((pages || []).map(async page => {
      const rows = applyLibraryGpxToTree(page.rows || [], routeId, gpxFile, previousAwsFileName);
      await mongooseClient.execute(() => pageContent.updateOne({_id: (page as { _id?: string })._id || page.id}, {$set: {rows}}));
      return 1;
    }));
    return written.length;
  }
}
