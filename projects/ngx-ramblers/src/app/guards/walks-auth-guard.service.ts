import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { MemberLoginService } from "../services/member/member-login.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Injectable()
export class WalksAuthGuard implements CanActivate {
  private logger: Logger;

  constructor(private memberLoginService: MemberLoginService,
              private router: Router,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalksAuthGuard", NgxLoggerLevel.OFF);

  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | Observable<boolean> | Promise<boolean> {
    const allowed = this.memberLoginService.allowWalkAdminEdits();
    this.logger.info("allowWalkAdminEdits allowed:", allowed);
    if (!allowed) {
      this.router.navigate(["/walks"]);
    }
    return allowed;
  }
}
