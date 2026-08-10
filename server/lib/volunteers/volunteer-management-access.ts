import { NextFunction, Request, Response } from "express";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { volunteerAdminAllowed } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-management";

export function requireVolunteerAdmin(req: Request, res: Response, next: NextFunction): void {
  const authenticatedMember = req.user as Partial<MemberCookie>;
  if (volunteerAdminAllowed(authenticatedMember)) {
    next();
  } else {
    res.status(403).json({error: "Volunteer admin permission required"});
  }
}
