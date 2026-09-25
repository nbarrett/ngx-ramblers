import { inject, Injectable, Injector } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { environment } from "../../../environments/environment";
import { Member, MemberCookie } from "../../models/member.model";
import { CommitteeMember } from "../../models/committee.model";
import { StoredValue } from "../../models/ui-actions";
import { MemberService } from "./member.service";
import { MemberResourcesReferenceDataService } from "./member-resources-reference-data.service";
import { toMemberCookie, VIEW_AS_MEMBER_HEADER } from "../../functions/member-cookie";
import { roleRecipientMemberIds } from "../../models/committee.model";
import { viewAsLooksLikeMemberId, viewAsSlug, viewAsSlugCandidates } from "../../functions/view-as-slug";

const OPT_IN_KEY = "ngx-view-as-opt-in";
const CHROME_KEY = "ngx-view-as-chrome";

@Injectable({providedIn: "root"})
export class ViewAsService {
  private injector = inject(Injector);
  private viewedMember: Member | null = null;
  readonly optedInChanges = new BehaviorSubject<boolean>(window.localStorage.getItem(OPT_IN_KEY) === "true");
  readonly chromeVisibleChanges = new BehaviorSubject<boolean>(window.localStorage.getItem(CHROME_KEY) !== "false");
  readonly availableChanges = new BehaviorSubject<boolean>(false);

  constructor() {
    window.addEventListener("keydown", event => this.restoreChromeFromShortcut(event));
    queueMicrotask(() => {
      this.injector.get(MemberResourcesReferenceDataService).platformAdminEnabledChanges().subscribe(on => {
        this.availableChanges.next(!environment.production && on);
      });
    });
  }

  private memberService(): MemberService {
    return this.injector.get(MemberService);
  }

  enabled(): boolean {
    return this.availableChanges.value;
  }

  optedIn(): boolean {
    return this.optedInChanges.value;
  }

  barVisible(): boolean {
    return this.enabled() && this.optedIn() && this.chromeVisible();
  }

  chromeVisible(): boolean {
    return this.chromeVisibleChanges.value;
  }

  setOptedIn(on: boolean): void {
    window.localStorage.setItem(OPT_IN_KEY, on ? "true" : "false");
    this.optedInChanges.next(on);
    if (on) {
      this.setChromeVisible(true);
    }
  }

  setChromeVisible(on: boolean): void {
    window.localStorage.setItem(CHROME_KEY, on ? "true" : "false");
    this.chromeVisibleChanges.next(on);
  }

  private restoreChromeFromShortcut(event: KeyboardEvent): void {
    if (this.enabled() && event.altKey && event.shiftKey && event.code === "KeyV") {
      event.preventDefault();
      if (this.barVisible()) {
        this.setChromeVisible(false);
      } else {
        this.setOptedIn(true);
        this.setChromeVisible(true);
      }
    }
  }

  headerName(): string {
    return VIEW_AS_MEMBER_HEADER;
  }

  memberIdFromLocation(): string | null {
    return new URLSearchParams(window.location.search).get(StoredValue.VIEW_AS);
  }

  roleTypeFromLocation(): string | null {
    return new URLSearchParams(window.location.search).get(StoredValue.VIEW_AS_ROLE);
  }

  viewedCookie(): MemberCookie | null {
    return this.viewedMember ? toMemberCookie(this.viewedMember) : null;
  }

  currentMember(): Member | null {
    return this.viewedMember;
  }

  async hydrateFromLocation(): Promise<void> {
    const slug = this.memberIdFromLocation();
    if (!this.enabled() || !slug) {
      this.viewedMember = null;
    } else {
      this.viewedMember = await this.memberForViewAsSlug(slug);
    }
  }

  applyMember(member: Member | null): void {
    if (!member?.id) {
      this.assignViewAs(null, null);
    } else {
      this.memberService().getById(member.id).then(full => this.assignViewAs(viewAsSlug(full), null));
    }
  }

  applyRole(role: CommitteeMember | null): void {
    const memberId = role ? roleRecipientMemberIds(role)[0] : null;
    if (memberId) {
      this.memberService().getById(memberId).then(member => this.assignViewAs(viewAsSlug(member), role.type));
    } else {
      this.assignViewAs(null, role?.type || null);
    }
  }

  private assignViewAs(slug: string | null, roleType: string | null): void {
    const url = new URL(window.location.href);
    if (slug) {
      url.searchParams.set(StoredValue.VIEW_AS, slug);
    } else {
      url.searchParams.delete(StoredValue.VIEW_AS);
    }
    if (roleType) {
      url.searchParams.set(StoredValue.VIEW_AS_ROLE, roleType);
    } else {
      url.searchParams.delete(StoredValue.VIEW_AS_ROLE);
    }
    window.location.assign(url.toString());
  }

  private async memberForViewAsSlug(slug: string): Promise<Member | null> {
    if (viewAsLooksLikeMemberId(slug)) {
      return this.memberService().getById(slug).catch(() => null);
    } else {
      return this.memberService().query({criteria: {userName: {$in: viewAsSlugCandidates(slug)}}}).catch(() => null);
    }
  }

  clear(): void {
    this.applyMember(null);
  }
}
