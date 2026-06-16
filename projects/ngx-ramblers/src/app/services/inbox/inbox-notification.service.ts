import { inject, Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { isUndefined } from "es-toolkit/compat";
import { InboxNewMessageEvent, InboxUnreadRole, isInboxGeneralRoleType } from "../../models/inbox.model";
import { MessageType } from "../../models/websocket.model";
import { AuthService } from "../../auth/auth.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { WebSocketClientService } from "../websockets/websocket-client.service";
import { InboxService } from "./inbox.service";

@Injectable({providedIn: "root"})
export class InboxNotificationService implements OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("InboxNotificationService", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  private webSocketClientService = inject(WebSocketClientService);
  private memberLoginService = inject(MemberLoginService);
  private authService = inject(AuthService);

  private readonly perRoleUnread = new Map<string, number>();
  private readonly roleLabels = new Map<string, string>();
  private readonly totalSubject = new BehaviorSubject<number>(0);
  public readonly total$ = this.totalSubject.asObservable();
  private readonly breakdownSubject = new BehaviorSubject<InboxUnreadRole[]>([]);
  public readonly breakdown$ = this.breakdownSubject.asObservable();

  private wsSubscriptions: Subscription[] = [];
  private authSubscription: Subscription | null = null;
  private started = false;
  private baseTitle: string | null = null;

  constructor() {
    this.authSubscription = this.authService.authResponse().subscribe(() => this.handleAuthChange());
    this.handleAuthChange();
  }

  ngOnDestroy(): void {
    this.wsSubscriptions.forEach(subscription => subscription.unsubscribe());
    this.authSubscription?.unsubscribe();
  }

  private async handleAuthChange(): Promise<void> {
    const loggedIn = Boolean(this.memberLoginService.loggedInMember()?.memberId);
    if (!loggedIn) {
      this.resetState();
      return;
    }
    if (this.started) {
      await this.refreshFromServer();
      return;
    }
    this.started = true;
    await this.start();
  }

  private async start(): Promise<void> {
    await this.refreshFromServer();
    try {
      await this.webSocketClientService.connect();
      this.wsSubscriptions.push(this.webSocketClientService.receiveMessages<InboxNewMessageEvent>(MessageType.INBOX_NEW_MESSAGE)
        .subscribe(event => this.applyRoleEvent(event)));
      this.wsSubscriptions.push(this.webSocketClientService.receiveMessages<InboxNewMessageEvent>(MessageType.INBOX_THREAD_UPDATED)
        .subscribe(event => this.applyRoleEvent(event)));
    } catch (error) {
      this.logger.info("WebSocket connect for inbox notifications failed:", (error as Error).message);
    }
  }

  private async refreshFromServer(): Promise<void> {
    try {
      const [counts, aliases] = await Promise.all([this.inboxService.unreadCounts(), this.inboxService.listAliases()]);
      this.roleLabels.clear();
      aliases.forEach(alias => this.roleLabels.set(alias.roleType, isInboxGeneralRoleType(alias.roleType) ? "Other inbox mail" : alias.roleEmail));
      this.perRoleUnread.clear();
      counts.byRole.forEach(row => this.perRoleUnread.set(row.roleType, row.unreadCount));
      this.publishTotal();
    } catch (error) {
      this.resetState();
    }
  }

  private applyRoleEvent(event: InboxNewMessageEvent): void {
    if (!this.perRoleUnread.has(event.roleType)) {
      return;
    }
    this.perRoleUnread.set(event.roleType, event.unreadCountForRole);
    this.publishTotal();
  }

  private resetState(): void {
    this.perRoleUnread.clear();
    this.publishTotal();
  }

  private publishTotal(): void {
    const total = Array.from(this.perRoleUnread.values()).reduce((sum, value) => sum + value, 0);
    this.totalSubject.next(total);
    this.breakdownSubject.next(this.buildBreakdown());
    this.applyTitle(total);
  }

  private buildBreakdown(): InboxUnreadRole[] {
    return Array.from(this.perRoleUnread.entries())
      .filter(([, unreadCount]) => unreadCount > 0)
      .map(([roleType, unreadCount]) => ({roleType, label: this.roleLabels.get(roleType) ?? roleType, unreadCount}))
      .sort((left, right) => right.unreadCount - left.unreadCount);
  }

  private applyTitle(total: number): void {
    if (isUndefined(document)) {
      return;
    }
    if (this.baseTitle === null) {
      this.baseTitle = document.title.replace(/^\(\d+\)\s+/, "");
    }
    const stripped = document.title.replace(/^\(\d+\)\s+/, "");
    document.title = total > 0 ? `(${total}) ${stripped}` : stripped;
  }
}
