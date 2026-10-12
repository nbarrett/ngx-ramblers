import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, Router } from "@angular/router";
import { MobileAppAccessService } from "../services/maps/mobile-app-access.service";
import { MobileAppAction } from "../models/walks-config.model";
import { StoredValue } from "../models/ui-actions";
import { NativeSiteService } from "../services/maps/native-site.service";
import { AppPath } from "../models/route-follow.model";

export async function MobileAppAccessGuard(route: ActivatedRouteSnapshot): Promise<boolean> {
  const router = inject(Router);
  const nativeSite = inject(NativeSiteService);
  if (nativeSite.needsChooser()) {
    const appHome = route.routeConfig?.path === AppPath.ROOT;
    if (!appHome) {
      void router.navigate(["/" + AppPath.ROOT]);
    }
    return appHome;
  } else {
    const access = inject(MobileAppAccessService);
    const action = route.queryParamMap.has(StoredValue.RECORD_ROUTE) ? MobileAppAction.RECORD : MobileAppAction.ACCESS;
    await access.ready();
    const allowed = access.allowed(action);
    if (!allowed) {
      void router.navigate(["/login"], {queryParams: {[StoredValue.REDIRECT]: "/" + AppPath.ROOT}});
    }
    return allowed;
  }
}
