import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";
import { AccessLevel } from "../models/member-resource.model";
import { MemberLoginService } from "../services/member/member-login.service";
import { PageService } from "../services/page.service";

function hasAccess(memberLoginService: MemberLoginService, level: AccessLevel): boolean {
  if (level === AccessLevel.PUBLIC) {
    return true;
  } else if (level === AccessLevel.LOGGED_IN_MEMBER) {
    return memberLoginService.memberLoggedIn();
  } else if (level === AccessLevel.COMMITTEE) {
    return memberLoginService.allowCommittee();
  } else if (level === AccessLevel.HIDDEN) {
    return false;
  } else {
    return true;
  }
}

export function PageAccessGuard(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const pageService: PageService = inject(PageService);
  const router: Router = inject(Router);

  const firstSegment = state.url.split("/").filter(s => s.length > 0)[0] || "";
  const matchingPage = pageService.group?.pages?.find(page => page.href === firstSegment);

  if (!matchingPage) {
    return true;
  }

  const allowed = hasAccess(memberLoginService, matchingPage.accessLevel || AccessLevel.PUBLIC);

  if (!allowed) {
    router.navigate(["/"]);
  }
  return allowed;
}
