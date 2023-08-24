import { Inject, Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { MemberLoginService } from "./services/member/member-login.service";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private memberLoginService: MemberLoginService, private router: Router) {
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | Observable<boolean> | Promise<boolean> {
    const allowed = this.memberLoginService.allowMemberAdminEdits();
    if (!allowed) {
      this.router.navigate(["/"]);
    }
    return allowed;
  }
}
