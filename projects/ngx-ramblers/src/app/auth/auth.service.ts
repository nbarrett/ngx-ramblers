import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { share, tap } from "rxjs/operators";
import { AuthPayload, AuthResponse } from "../models/auth-data.model";
import { AuthTokens } from "../models/auth-tokens";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { LoginResponse } from "../models/member.model";
import { BroadcastService } from "../services/broadcast-service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { SiteEditService } from "../site-edit/site-edit.service";
import { StoredValue } from "../models/ui-actions";
import { DateUtilsService } from "../services/date-utils.service";

@Injectable({
  providedIn: "root"
})
export class AuthService {

  private logger: Logger = inject(LoggerFactory).createLogger("AuthService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  private siteEditService = inject(SiteEditService);
  private BASE_URL = "/api/database/auth";
  private authPayload: {};
  private authResponseSubject = new Subject<LoginResponse>();

  login(userName: string, password: string): Promise<LoginResponse> {
    const url = `${this.BASE_URL}/login`;
    this.logger.info("logging in", userName, "via", url);
    const body = {userName, password};
    return this.performAuthPost(url, body, "login", NamedEventType.MEMBER_LOGIN_COMPLETE);
  }

  resetPassword(userName: string, newPassword: string, newPasswordConfirm: string): Promise<LoginResponse> {
    const url = `${this.BASE_URL}/reset-password`;
    const type = "resetting password";
    this.logger.info(type + " for", userName, "via", url);
    const body = {userName, newPassword, newPasswordConfirm};
    return this.performAuthPost(url, body, type);
  }

  logout(): Promise<LoginResponse> {
    const url = `${this.BASE_URL}/logout`;
    this.logger.info("logging out user via", url);
    const loginResponseObservable = this.performAuthPost(url, {
      refreshToken: this.refreshToken(),
      member: this.parseAuthToken(),
    }, "logout", NamedEventType.MEMBER_LOGOUT_COMPLETE);
    this.removeTokens();
    return loginResponseObservable;
  }

  private async performAuthPost(url: string, body: object, postType: string, broadcastEvent?: NamedEventType): Promise<LoginResponse> {
    const shared: Observable<AuthResponse> = this.http.post<any>(url, body).pipe(share());
    shared.subscribe((authResponse: AuthResponse) => {
      this.logger.info(postType, "- authResponse", authResponse);
      if (authResponse?.tokens) {
        this.storeTokens(authResponse.tokens);
      }
      this.authResponseSubject.next(authResponse?.loginResponse);
      if (broadcastEvent) {
        this.broadcastService.broadcast(NamedEvent.withData(broadcastEvent, authResponse?.loginResponse));
      }
    }, (httpErrorResponse: HttpErrorResponse) => {
      this.logger.error(postType, "- error", httpErrorResponse);
      const loginResponse: LoginResponse = httpErrorResponse.error.loginResponse;
      this.authResponseSubject.next(loginResponse);
    });
    const authResponse = await shared.toPromise();
    return authResponse?.loginResponse;
  }

  authResponse() {
    return this.authResponseSubject.asObservable();
  }

  performTokenRefresh() {
    const url = `${this.BASE_URL}/refresh`;
    const refreshToken = this.refreshToken();
    this.logger.info("performTokenRefresh:calling:", url, "with refresh token:", refreshToken);
    return this.http.post<any>(url, {
      refreshToken
    }).pipe(
      tap((tokens: AuthTokens) => {
        this.storeAuthToken(tokens.auth);
      })
    );
  }

  authToken() {
    return localStorage.getItem(StoredValue.AUTH_TOKEN);
  }

  refreshToken(): string {
    return localStorage.getItem(StoredValue.REFRESH_TOKEN);
  }

  private tokenIssued(jsonPayload: AuthPayload) {
    return this.dateUtils.displayDateAndTime(jsonPayload.iat * 1000);
  }

  private tokenExpires(jsonPayload: AuthPayload) {
    return this.dateUtils.displayDateAndTime(jsonPayload.exp * 1000);
  }

  parseAuthToken(): AuthPayload {
    if (!this.authPayload) {
      const token = this.authToken();
      if (token) {
        const items = token.split(".");
        if (items.length === 0) {
          this.logger.error("authPayload items zero length");
          this.authPayload = {};
        } else {
          const base64Url = items[1];
          if (!base64Url) {
            this.logger.error("authPayload is null");
            this.authPayload = {};
          } else {
            const base64 = base64Url.replace("-", "+").replace("_", "/");
            const jsonPayload = JSON.parse(atob(base64));
            this.logger.info("authPayload:", jsonPayload, "issued:", this.tokenIssued(jsonPayload), "expires:", this.tokenExpires(jsonPayload));
            this.authPayload = jsonPayload;
          }
        }
      }
    }
    return this.authPayload || {};
  }

  private storeAuthToken(authToken: string): void {
    this.logger.info("storing auth token:", authToken);
    localStorage.setItem(StoredValue.AUTH_TOKEN, authToken);
    delete this.authPayload;
  }

  private storeTokens(tokens: AuthTokens): void {
    this.storeAuthToken(tokens.auth);
    this.storeRefreshToken(tokens.refresh);
  }

  private storeRefreshToken(refreshToken: string): void {
    this.logger.info("storing refresh token:", refreshToken);
    localStorage.setItem(StoredValue.REFRESH_TOKEN, refreshToken);
  }

  private removeTokens() {
    if (this.siteEditService.active()) {
      this.siteEditService.toggle(false);
    }
    localStorage.removeItem(StoredValue.AUTH_TOKEN);
    localStorage.removeItem(StoredValue.REFRESH_TOKEN);
    delete this.authPayload;
  }

  scheduleLogout() {
    this.removeTokens();
  }

}
