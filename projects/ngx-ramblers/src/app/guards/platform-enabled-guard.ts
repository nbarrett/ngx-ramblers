import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { EnvironmentSetupService } from "../services/environment-setup/environment-setup.service";

export async function PlatformEnabledGuard(): Promise<boolean> {
  const environmentSetupService = inject(EnvironmentSetupService);
  const router = inject(Router);
  try {
    const status = await environmentSetupService.status();
    if (status.platformAdminEnabled) {
      return true;
    } else {
      await router.navigate(["/"]);
      return false;
    }
  } catch (_error) {
    await router.navigate(["/"]);
    return false;
  }
}
