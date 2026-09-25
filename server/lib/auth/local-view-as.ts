import { Request } from "express";
import { envConfig } from "../env-config/env-config";
import { member as memberModel } from "../mongo/models/member";
import { toObjectWithId } from "../mongo/controllers/transforms";
import { toMemberCookie, VIEW_AS_MEMBER_HEADER } from "../../../projects/ngx-ramblers/src/app/functions/member-cookie";
import { viewAsLooksLikeMemberId, viewAsSlugCandidates } from "../../../projects/ngx-ramblers/src/app/functions/view-as-slug";
import { Member, MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { isString } from "es-toolkit/compat";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";

export async function applyLocalViewAs(req: Request): Promise<void> {
  if (!envConfig.isProduction()) {
    const headerValue = req.headers[VIEW_AS_MEMBER_HEADER];
    const slug = isString(headerValue) ? headerValue : null;
    const authenticatedRequest = req as Request & {user?: Partial<MemberCookie>};
    const acting = authenticatedRequest.user;
    if (slug && acting?.memberId && envConfig.booleanValue(Environment.PLATFORM_ADMIN_ENABLED)) {
      const document = viewAsLooksLikeMemberId(slug)
        ? await memberModel.findById(slug)
        : await memberModel.findOne({userName: {$in: viewAsSlugCandidates(slug)}});
      if (document) {
        authenticatedRequest.user = toMemberCookie(toObjectWithId(document) as Member);
      }
    }
  }
}
