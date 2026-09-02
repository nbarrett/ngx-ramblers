import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";
import { AccessLevel } from "../models/member-resource.model";
import { AccessLevelService } from "../services/access-level.service";
import { PageService } from "../services/page.service";

export function PageAccessGuard(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
  const accessLevelService: AccessLevelService = inject(AccessLevelService);
  const pageService: PageService = inject(PageService);
  const router: Router = inject(Router);

  const firstSegment = state.url.split("/").filter(s => s.length > 0)[0] || "";
  const matchingPage = pageService.group?.pages?.find(page => page.href === firstSegment);

  if (!matchingPage) {
    return true;
  }

  const allowed = accessLevelService.hasAccessLevel(matchingPage.accessLevel || AccessLevel.PUBLIC);

  if (!allowed) {
    router.navigate(["/"]);
  }
  return allowed;
}
