import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { MemberLoginService } from "../services/member/member-login.service";

export function AdminAuthGuard(): boolean {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const router: Router = inject(Router);

  const allowed = memberLoginService.isAdmin();
  if (!allowed) {
    router.navigate(["/"]);
  }
  return allowed;
}

export function MemberAdminAuthGuard(): boolean {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const router: Router = inject(Router);

  const allowed = memberLoginService.allowMemberAdminEdits();
  if (!allowed) {
    router.navigate(["/"]);
  }
  return allowed;
}
