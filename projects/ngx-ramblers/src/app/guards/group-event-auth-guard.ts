import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, Router, UrlTree } from "@angular/router";
import { MemberLoginService } from "../services/member/member-login.service";
import { PageService } from "../services/page.service";
import { WalksAndEventsService } from "../services/walks-and-events/walks-and-events.service";
import { GroupEventDisplayService } from "../pages/group-events/group-event-display.service";
import { RouteParam } from "../models/content-text.model";

export async function GroupEventAuthGuard(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
  const memberLoginService = inject(MemberLoginService);
  const pageService = inject(PageService);
  const router = inject(Router);
  const walksAndEvents = inject(WalksAndEventsService);
  const display = inject(GroupEventDisplayService);
  const identifier = route.paramMap.get(RouteParam.ID);
  const fallback = router.parseUrl(pageService.groupEventPage()?.href || "/");
  if (memberLoginService.allowSocialAdminEdits()) {
    return true;
  } else if (memberLoginService.memberLoggedIn() && identifier) {
    try {
      const event = await walksAndEvents.queryById(identifier);
      return display.canEditEvent(event) || fallback;
    } catch {
      return fallback;
    }
  } else {
    return fallback;
  }
}
