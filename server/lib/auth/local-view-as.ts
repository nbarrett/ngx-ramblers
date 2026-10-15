import { NextFunction, Request, Response } from "express";
import { member as memberModel } from "../mongo/models/member";
import { toObjectWithId } from "../mongo/controllers/transforms";
import { canViewAsMember, toMemberCookie, VIEW_AS_MEMBER_HEADER } from "../../../projects/ngx-ramblers/src/app/functions/member-cookie";
import { viewAsLooksLikeMemberId, viewAsSlugCandidates } from "../../../projects/ngx-ramblers/src/app/functions/view-as-slug";
import { Member, MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { isString } from "es-toolkit/compat";

const READ_ONLY_METHODS = ["GET", "HEAD", "OPTIONS"];

export function requireReadOnlyViewAs(req: Request, res: Response, next: NextFunction): void {
  if (req.headers[VIEW_AS_MEMBER_HEADER] && !READ_ONLY_METHODS.includes(req.method)) {
    res.status(403).json({error: "Viewing as another member is read-only. Return to your profile to make changes."});
  } else {
    next();
  }
}

export async function applyViewAs(req: Request): Promise<void> {
  const headerValue = req.headers[VIEW_AS_MEMBER_HEADER];
  const slug = isString(headerValue) ? headerValue : null;
  const authenticatedRequest = req as Request & {user?: Partial<MemberCookie>};
  const acting = authenticatedRequest.user;
  if (headerValue) {
    const administrator = acting?.memberId ? await memberModel.findById(acting.memberId) : null;
    const currentAdministrator = administrator ? toMemberCookie(toObjectWithId(administrator) as Member) : null;
    if (!slug || !canViewAsMember(currentAdministrator)) {
      throw Object.assign(new Error("Member Admin and View as another member permissions are required"), {status: 403});
    } else if (!READ_ONLY_METHODS.includes(req.method)) {
      throw Object.assign(new Error("Viewing as another member is read-only"), {status: 403});
    } else {
      const document = viewAsLooksLikeMemberId(slug)
        ? await memberModel.findById(slug)
        : await memberModel.findOne({userName: {$in: viewAsSlugCandidates(slug)}});
      if (document) {
        if (req.res) {
          req.res.locals.viewAsAdministrator = currentAdministrator;
        }
        authenticatedRequest.user = toMemberCookie(toObjectWithId(document) as Member);
      } else {
        throw Object.assign(new Error("The selected member no longer exists"), {status: 404});
      }
    }
  }
}
