import { inject, Injectable, OnDestroy } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { firstValueFrom, from, Subject, Subscription } from "rxjs";
import { concatMap } from "rxjs/operators";
import { isEqual } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { toMemberCookie } from "../../functions/member-cookie";
import { Member } from "../../models/member.model";
import { MessageType } from "../../models/websocket.model";
import { LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";
import { WebSocketClientService } from "../websockets/websocket-client.service";
import { ViewAsService } from "./view-as.service";

@Injectable({providedIn: "root"})
export class MemberSessionService implements OnDestroy {
  private auth = inject(AuthService);
  private viewAs = inject(ViewAsService);
  private socket = inject(WebSocketClientService);
  private urlService = inject(UrlService);
  private logger = inject(LoggerFactory).createLogger("MemberSessionService", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];
  private refreshRequests = new Subject<void>();
  private started = false;
  private readonly refreshOnFocus = () => this.refreshRequests.next();
  private readonly refreshOnVisibility = () => {
    if (document.visibilityState === "visible") {
      this.refreshRequests.next();
    }
  };

  initialise(): void {
    if (!this.started) {
      this.started = true;
      this.subscriptions.push(this.refreshRequests.pipe(concatMap(() => from(this.refreshSession()))).subscribe());
      this.subscriptions.push(this.socket.receiveMessages(MessageType.MEMBER_SESSION_CHANGED).subscribe(() => this.refreshRequests.next()));
      this.subscriptions.push(this.socket.connectionOpened().subscribe(() => this.refreshRequests.next()));
      this.subscriptions.push(this.auth.authResponse().subscribe(() => this.connectSession()));
      window.addEventListener("focus", this.refreshOnFocus);
      window.addEventListener("online", this.refreshOnFocus);
      document.addEventListener("visibilitychange", this.refreshOnVisibility);
      this.connectSession();
      this.refreshRequests.next();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener("focus", this.refreshOnFocus);
    window.removeEventListener("online", this.refreshOnFocus);
    document.removeEventListener("visibilitychange", this.refreshOnVisibility);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private connectSession(): void {
    if (this.auth.authToken()) {
      void this.socket.connect().catch(error => this.logger.error("Session notifications could not connect; the socket will retry:", error));
    }
  }

  private sessionSnapshot() {
    const payload = this.auth.parseAuthToken();
    return {
      member: toMemberCookie({...payload, id: payload.memberId} as Member),
      viewed: this.viewAs.viewedCookie()
    };
  }

  private async refreshSession(): Promise<void> {
    const refreshToken = this.auth.refreshToken();
    if (this.auth.authToken() && refreshToken) {
      const before = this.sessionSnapshot();
      try {
        await firstValueFrom(this.auth.performTokenRefresh());
        if (refreshToken === this.auth.refreshToken()) {
          await this.viewAs.hydrateFromLocation();
          if (!isEqual(before, this.sessionSnapshot())) {
            this.urlService.refresh();
          }
        }
      } catch (error) {
        if (refreshToken === this.auth.refreshToken() && error instanceof HttpErrorResponse && error.status === 401) {
          this.auth.scheduleLogout();
          this.urlService.refresh();
        } else {
          this.logger.error("Could not refresh the member session:", error);
        }
      }
    }
  }
}
