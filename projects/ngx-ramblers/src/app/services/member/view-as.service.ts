import { ViewAsSelection } from "../../models/view-as.model";
import { isString } from "es-toolkit/compat";
import { inject, Injectable, Injector, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { AuthService } from "../../auth/auth.service";
import { Member, MemberCookie } from "../../models/member.model";
import { CommitteeMember } from "../../models/committee.model";
import { StoredValue } from "../../models/ui-actions";
import { MemberService } from "./member.service";
import { canViewAsMember, toMemberCookie, VIEW_AS_MEMBER_HEADER } from "../../functions/member-cookie";
import { roleRecipientMemberIds } from "../../models/committee.model";
import { viewAsLooksLikeMemberId, viewAsSlug, viewAsSlugCandidates } from "../../functions/view-as-slug";


@Injectable({providedIn: "root"})
export class ViewAsService implements OnDestroy {
  private subscriptions: Subscription[] = [];
  private readonly chromeShortcut = (event: KeyboardEvent) => this.restoreChromeFromShortcut(event);
  private injector = inject(Injector);
  private viewedMember: Member | null = null;
  readonly optedInChanges = new BehaviorSubject<boolean>(window.localStorage.getItem(StoredValue.VIEW_AS_OPT_IN) === "true");
  readonly chromeVisibleChanges = new BehaviorSubject<boolean>(window.localStorage.getItem(StoredValue.VIEW_AS_CHROME) !== "false");
  readonly availableChanges = new BehaviorSubject<boolean>(false);

  constructor() {
    window.addEventListener("keydown", this.chromeShortcut);
    queueMicrotask(() => {
      const auth = this.injector.get(AuthService);
      this.refreshAvailability();
      this.subscriptions.push(auth.authResponse().subscribe(() => this.refreshAvailability()));
      this.subscriptions.push(auth.sessionChanges().subscribe(() => this.refreshAvailability()));
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener("keydown", this.chromeShortcut);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshAvailability(): void {
    this.availableChanges.next(this.enabled());
    if (!this.enabled()) {
      this.viewedMember = null;
      this.storeSelection(null);
    }
  }

  private memberService(): MemberService {
    return this.injector.get(MemberService);
  }

  enabled(): boolean {
    return canViewAsMember(this.injector.get(AuthService).parseAuthToken()) && !this.injector.get(AuthService).tokenExpired();
  }

  optedIn(): boolean {
    return this.optedInChanges.value;
  }

  barVisible(): boolean {
    return this.enabled() && (this.optedIn() || !!this.memberIdFromLocation() || !!this.roleTypeFromLocation()) && this.chromeVisible();
  }

  chromeVisible(): boolean {
    return this.chromeVisibleChanges.value;
  }

  setOptedIn(on: boolean): void {
    window.localStorage.setItem(StoredValue.VIEW_AS_OPT_IN, on ? "true" : "false");
    this.optedInChanges.next(on);
    if (on) {
      this.setChromeVisible(true);
    }
  }

  setChromeVisible(on: boolean): void {
    window.localStorage.setItem(StoredValue.VIEW_AS_CHROME, on ? "true" : "false");
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
    return new URLSearchParams(window.location.search).get(StoredValue.VIEW_AS) || this.storedSelection()?.memberSlug || null;
  }

  roleTypeFromLocation(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get(StoredValue.VIEW_AS)
      ? params.get(StoredValue.VIEW_AS_ROLE)
      : this.storedSelection()?.roleType || null;
  }

  private storedSelection(): ViewAsSelection | null {
    try {
      const raw = window.sessionStorage.getItem(StoredValue.VIEW_AS_SELECTION);
      const selection: ViewAsSelection = raw ? JSON.parse(raw) : null;
      const actorId = this.injector.get(AuthService).parseAuthToken()?.memberId;
      return selection && this.enabled() && selection.actorId === actorId && isString(selection.memberSlug)
        && (selection.roleType === null || isString(selection.roleType)) ? selection : null;
    } catch {
      return null;
    }
  }

  private storeSelection(selection: ViewAsSelection | null): void {
    try {
      if (selection) {
        window.sessionStorage.setItem(StoredValue.VIEW_AS_SELECTION, JSON.stringify(selection));
      } else {
        window.sessionStorage.removeItem(StoredValue.VIEW_AS_SELECTION);
      }
    } catch {
      this.viewedMember = null;
    }
  }

  viewedCookie(): MemberCookie | null {
    return this.enabled() && this.viewedMember ? toMemberCookie(this.viewedMember) : null;
  }

  currentMember(): Member | null {
    return this.viewedMember;
  }

  async hydrateFromLocation(): Promise<void> {
    const slug = this.memberIdFromLocation();
    if (!this.enabled() || !slug) {
      this.viewedMember = null;
    } else {
      const actorId = this.injector.get(AuthService).parseAuthToken()?.memberId;
      this.storeSelection({actorId, memberSlug: slug, roleType: this.roleTypeFromLocation()});
      const member = await this.memberForViewAsSlug(slug);
      this.viewedMember = this.enabled() && this.memberIdFromLocation() === slug
        && this.injector.get(AuthService).parseAuthToken()?.memberId === actorId ? member : null;
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
      this.assignViewAs(null, null);
    }
  }

  private assignViewAs(slug: string | null, roleType: string | null): void {
    const url = new URL(window.location.href);
    const actorId = this.injector.get(AuthService).parseAuthToken()?.memberId;
    this.storeSelection(slug && this.enabled() ? {actorId, memberSlug: slug, roleType} : null);
    this.viewedMember = null;
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
