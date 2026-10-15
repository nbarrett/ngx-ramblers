import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, Observable, Subject } from "rxjs";
import { tap } from "rxjs/operators";
import { isObject, isString } from "es-toolkit/compat";
import { AuthPayload, AuthResponse } from "../models/auth-data.model";
import { AuthTokens } from "../models/auth-tokens";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { LoginResponse, MemberCookie } from "../models/member.model";
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
  private sessionChangesSubject = new Subject<MemberCookie>();

  sessionChanges(): Observable<MemberCookie> {
    return this.sessionChangesSubject.asObservable();
  }

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

  private parseAuthResponse(raw: unknown): AuthResponse | null {
    if (isString(raw)) {
      try {
        return this.parseAuthResponse(JSON.parse(raw));
      } catch {
        return null;
      }
    } else if (raw && isObject(raw)) {
      if ("loginResponse" in raw && isObject(raw.loginResponse)) {
        return raw as AuthResponse;
      } else if ("data" in raw) {
        return this.parseAuthResponse(raw.data);
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  private finishAuthPost(authResponse: AuthResponse | null, postType: string, broadcastEvent?: NamedEventType): LoginResponse {
    this.logger.info(postType, "- authResponse", authResponse);
    if (authResponse?.loginResponse?.memberLoggedIn && authResponse.tokens?.auth && authResponse.tokens?.refresh) {
      this.storeTokens(authResponse.tokens);
    }
    const loginResponse = authResponse?.loginResponse || {
      memberLoggedIn: false,
      alertMessage: "The site did not return a login response. Try again."
    };
    this.authResponseSubject.next(loginResponse);
    if (broadcastEvent && (loginResponse.memberLoggedIn || broadcastEvent === NamedEventType.MEMBER_LOGOUT_COMPLETE)) {
      this.broadcastService.broadcast(NamedEvent.withData(broadcastEvent, loginResponse));
    }
    return loginResponse;
  }

  private async performAuthPost(url: string, body: object, postType: string, broadcastEvent?: NamedEventType): Promise<LoginResponse> {
    try {
      const httpResponse = await firstValueFrom(this.http.post(url, body, {observe: "response", responseType: "text"}));
      return this.finishAuthPost(this.parseAuthResponse(httpResponse.body), postType, broadcastEvent);
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        this.logger.error(postType, "- error", error);
        const authResponse = this.parseAuthResponse(error.error);
        if (authResponse?.loginResponse) {
          return this.finishAuthPost(authResponse, postType, broadcastEvent);
        } else {
          const loginResponse: LoginResponse = {
            memberLoggedIn: false,
            alertMessage: error.status ? `Could not reach the site (${error.status}). Try again.` : "Could not reach the site. Try again."
          };
          this.authResponseSubject.next(loginResponse);
          return loginResponse;
        }
      } else {
        this.logger.error(postType, "- error", error);
        const loginResponse: LoginResponse = {
          memberLoggedIn: false,
          alertMessage: "Could not reach the site. Try again."
        };
        this.authResponseSubject.next(loginResponse);
        return loginResponse;
      }
    }
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
        if (this.refreshToken() === refreshToken && this.authToken()) {
          this.storeAuthToken(tokens.auth);
          this.sessionChangesSubject.next(this.parseAuthToken() as MemberCookie);
        }
      })
    );
  }

  authToken() {
    return localStorage.getItem(StoredValue.AUTH_TOKEN);
  }

  tokenExpired(): boolean {
    const payload: AuthPayload = this.parseAuthToken();
    return !!payload?.exp && payload.exp * 1000 < this.dateUtils.nowAsValue();
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
    const wasLoggedIn = !!this.authToken();
    this.removeTokens();
    if (wasLoggedIn) {
      const loginResponse: LoginResponse = {memberLoggedIn: false, alertMessage: "Your session has expired - please log in again"};
      this.authResponseSubject.next(loginResponse);
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MEMBER_LOGOUT_COMPLETE, loginResponse));
    }
  }

}
