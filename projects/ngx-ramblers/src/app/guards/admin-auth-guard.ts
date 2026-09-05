import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { VolunteerManagementService } from "../services/volunteer-management.service";
import { Observable, of } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";
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

export function VolunteerAdminAuthGuard(): boolean | Observable<boolean> {
  const memberLoginService: MemberLoginService = inject(MemberLoginService);
  const router: Router = inject(Router);
  const volunteerManagementService: VolunteerManagementService = inject(VolunteerManagementService);
  if (memberLoginService.allowVolunteerAdminEdits()) {
    return true;
  } else if (memberLoginService.memberLoggedIn()) {
    return volunteerManagementService.access().pipe(
      map(scope => scope.allGroups || scope.rightsOfWayGroupCodes.length > 0),
      catchError(() => of(false)),
      tap(allowed => {
        if (!allowed) {
          router.navigate(["/"]);
        }
      })
    );
  } else {
    router.navigate(["/"]);
    return false;
  }
}
