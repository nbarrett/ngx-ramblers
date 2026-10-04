import { NextFunction, Request, Response } from "express";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { OsMapsImportContext, OsMapsListedRoute } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { routeEditableByMember, routeMemberIsAdmin, routeVisibleToMember } from "../../../projects/ngx-ramblers/src/app/functions/route-access";
import { osMapsImportedRoute } from "../mongo/models/os-maps-imported-route";
import * as mongooseClient from "../mongo/mongoose-client";

export function routeAdmin(member: MemberCookie | null): boolean {
  return routeMemberIsAdmin(member);
}

export function canViewImportedRoute(route: OsMapsImportContext, member: MemberCookie | null): boolean {
  return routeVisibleToMember(route, member);
}

export function canEditImportedRoute(route: OsMapsImportContext, member: MemberCookie | null): boolean {
  return routeEditableByMember(route, member);
}

export function accessibleRoutes(routes: OsMapsListedRoute[], member: MemberCookie | null): OsMapsListedRoute[] {
  return routes.filter(route => canViewImportedRoute(route, member)).map(route => ({...route, canEdit: canEditImportedRoute(route, member)}));
}

export async function requireRouteFileAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = `${req.params.bucket}${req.params[0] || ""}`;
    const record = key.startsWith("gpx-routes/")
      ? await mongooseClient.execute(() => osMapsImportedRoute.findOne({"gpxFile.awsFileName": key.substring("gpx-routes/".length)}).lean())
      : null;
    if (record && !canViewImportedRoute(record, req.user as MemberCookie || null)) {
      res.status(404).json({error: "That route file was not found"});
    } else {
      if (record?.visibility) {
        res.locals.privateRouteFile = true;
      }
      next();
    }
  } catch (error) {
    next(error);
  }
}
