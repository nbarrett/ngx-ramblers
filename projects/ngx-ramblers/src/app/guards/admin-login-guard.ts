import { inject } from "@angular/core";
import { Router, RouterStateSnapshot } from "@angular/router";
import { MemberLoginService } from "../services/member/member-login.service";
import { StoredValue } from "../models/ui-actions";

export function LoggedInGuard(_route: unknown, state: RouterStateSnapshot): boolean {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const router: Router = inject(Router);

  const allowed = memberLoginService.memberLoggedIn();
  if (!allowed) {
    router.navigate(["/login"], {queryParams: {[StoredValue.REDIRECT]: state.url}});
  }
  return allowed;
}
