import { inject, Injectable } from "@angular/core";
import { AccessLevel } from "../models/member-resource.model";
import { Link } from "../models/page.model";
import { MemberLoginService } from "./member/member-login.service";

@Injectable({
  providedIn: "root"
})
export class AccessLevelService {

  private memberLoginService = inject(MemberLoginService);

  hasAccess(link: Link): boolean {
    return this.hasAccessLevel(link?.accessLevel);
  }

  hasAccessLevel(accessLevel: AccessLevel): boolean {
    const level = accessLevel || AccessLevel.PUBLIC;
    if (level === AccessLevel.PUBLIC) {
      return true;
    } else if (level === AccessLevel.LOGGED_IN_MEMBER) {
      return this.memberLoginService.memberLoggedIn();
    } else if (level === AccessLevel.COMMITTEE) {
      return this.memberLoginService.allowCommittee();
    } else if (level === AccessLevel.HIDDEN) {
      return false;
    } else {
      return true;
    }
  }
}
