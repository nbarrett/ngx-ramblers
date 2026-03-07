import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { MemberLoginService } from "../services/member/member-login.service";
import { PageService } from "../services/page.service";

export function WalksAuthGuard(): boolean {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const router: Router = inject(Router);
  const pageService: PageService = inject(PageService);

  const allowed = memberLoginService.allowWalkAdminEdits();
  if (!allowed) {
    router.navigate(["/" + (pageService.walksPage()?.href || "walks")]);
  }
  return allowed;
}
