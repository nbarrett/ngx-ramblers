import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { WalkDisplayService } from "../pages/walks/walk-display.service";

@Injectable()
export class WalksPopulationLocalGuard implements CanActivate {
  constructor(private displayService: WalkDisplayService, private router: Router) {
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | Observable<boolean> | Promise<boolean> {
    const allowed = this.displayService.walkPopulationLocal();
    if (!allowed) {
      this.router.navigate(["/walks"]);
    }
    return allowed;
  }
}
