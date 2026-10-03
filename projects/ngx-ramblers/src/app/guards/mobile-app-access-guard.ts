import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, Router } from "@angular/router";
import { MobileAppAccessService } from "../services/maps/mobile-app-access.service";
import { MobileAppAction } from "../models/walks-config.model";
import { StoredValue } from "../models/ui-actions";

export async function MobileAppAccessGuard(route: ActivatedRouteSnapshot): Promise<boolean> {
  const access = inject(MobileAppAccessService);
  const router = inject(Router);
  const action = route.queryParamMap.has(StoredValue.RECORD_ROUTE) ? MobileAppAction.RECORD : MobileAppAction.ACCESS;
  await access.ready();
  const allowed = access.allowed(action);
  if (!allowed) {
    void router.navigate(["/login"], {queryParams: {[StoredValue.REDIRECT]: "/app"}});
  }
  return allowed;
}
