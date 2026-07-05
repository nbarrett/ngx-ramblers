import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { MemberLoginService } from "../services/member/member-login.service";

export function EmailComposerAuthGuard(): boolean {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const router: Router = inject(Router);

  const allowed = memberLoginService.allowCommittee() || memberLoginService.allowSocialAdminEdits();
  if (!allowed) {
    router.navigate(["/"]);
  }
  return allowed;
}
