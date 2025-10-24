import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { MemberLoginService } from "../services/member/member-login.service";
import { SiteMaintenanceService } from "../services/site-maintenance.service";
import { HealthStatus } from "../models/health.model";

export async function SystemHealthyGuard(): Promise<boolean> {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const router: Router = inject(Router);
  const siteMaintenanceService: SiteMaintenanceService = inject(SiteMaintenanceService);

  if (memberLoginService.isAdmin()) {
    return true;
  }

  const health = await siteMaintenanceService.getMigrationStatus();
  const degraded = health?.status !== HealthStatus.OK;

  if (degraded) {
    router.navigate(["/admin/maintenance"]);
    return false;
  }

  return true;
}
