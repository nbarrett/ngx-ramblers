import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { MemberLoginService } from "../services/member/member-login.service";
import { EnvironmentSetupService } from "../services/environment-setup/environment-setup.service";

export async function EnvironmentAdminGuard(): Promise<boolean> {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const environmentSetupService: EnvironmentSetupService = inject(EnvironmentSetupService);
  const router: Router = inject(Router);

  if (!memberLoginService.isAdmin()) {
    router.navigate(["/"]);
    return false;
  }

  try {
    const status = await environmentSetupService.status();
    if (!status.platformAdminEnabled) {
      router.navigate(["/admin"]);
      return false;
    }
    return true;
  } catch {
    router.navigate(["/admin"]);
    return false;
  }
}
