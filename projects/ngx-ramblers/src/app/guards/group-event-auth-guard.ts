import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { MemberLoginService } from "../services/member/member-login.service";
import { PageService } from "../services/page.service";

export function GroupEventAuthGuard(): boolean {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const pageService: PageService = inject(PageService);
  const router: Router = inject(Router);

  const allowed = memberLoginService.allowSocialAdminEdits();
  if (!allowed) {
    router.navigate([pageService.groupEventPage()?.href]);
  }
  return allowed;
}
