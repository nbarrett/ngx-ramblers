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

@Injectable({
  providedIn: "root"
})
export class AuthService {

  private logger: Logger = inject(LoggerFactory).createLogger(AuthService, NgxLoggerLevel.OFF);
  private http = inject(HttpClient);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private siteEditService = inject(SiteEditService);
  private BASE_URL = "/api/database/auth";
  private readonly AUTH_TOKEN = "AUTH_TOKEN";
  private readonly REFRESH_TOKEN = "REFRESH_TOKEN";
  private authPayload: {};
  private authResponseSubject = new Subject<LoginResponse>();

  login(userName: string, password: string): Promise<LoginResponse> {
    const url = `${this.BASE_URL}/login`;
    this.logger.debug("logging in", userName, "via", url);
    const body = {userName, password};
    return this.performAuthPost(url, body, "login", NamedEventType.MEMBER_LOGIN_COMPLETE);
  }

  forgotPassword(credentialOne: string, credentialTwo: string, userDetails: string): Promise<LoginResponse> {
    const url = `${this.BASE_URL}/forgot-password`;
    const type = "forgot password";
    this.logger.debug(type + "credentialOne:", credentialOne, "credentialTwo:", credentialTwo, "via", url);
    const body = {credentialOne, credentialTwo, userDetails};
    return this.performAuthPost(url, body, type);
  }

  resetPassword(userName: string, newPassword: string, newPasswordConfirm: string): Promise<LoginResponse> {
    const url = `${this.BASE_URL}/reset-password`;
    const type = "resetting password";
    this.logger.debug(type + " for", userName, "via", url);
    const body = {userName, newPassword, newPasswordConfirm};
    return this.performAuthPost(url, body, type);
  }

  logout(): Promise<LoginResponse> {
    const url = `${this.BASE_URL}/logout`;
    this.logger.debug("logging out user via", url);
    const loginResponseObservable = this.performAuthPost(url, {
      refreshToken: this.refreshToken(),
      member: this.parseAuthPayload(),
    }, "logout", NamedEventType.MEMBER_LOGOUT_COMPLETE);
    this.removeTokens();
    return loginResponseObservable;
  }

  private async performAuthPost(url: string, body: object, postType: string, broadcastEvent?: NamedEventType): Promise<LoginResponse> {
    const shared: Observable<AuthResponse> = this.http.post<any>(url, body).pipe(share());
    shared.subscribe((authResponse: AuthResponse) => {
      this.logger.debug(postType, "- authResponse", authResponse);
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

  isLoggedIn(): boolean {
    return !!this.authToken() && !!this.refreshToken();
  }

  performTokenRefresh() {
    const url = `${this.BASE_URL}/refresh`;
    this.logger.debug("calling", url);
    return this.http.post<any>(url, {
      refreshToken: this.refreshToken()
    }).pipe(
      tap((tokens: AuthTokens) => {
        this.storeAuthToken(tokens.auth);
      })
    );
  }

  authToken() {
    return localStorage.getItem(this.AUTH_TOKEN);
  }

  tokenIssued() {
    const parseJwt1 = this.parseAuthPayload();
    return parseJwt1 && new Date(parseJwt1.iat * 1000);
  }

  tokenExpires() {
    const parseJwt1 = this.parseAuthPayload();
    return parseJwt1 && new Date(parseJwt1.exp * 1000);
  }

  parseAuthPayload(): AuthPayload {
    if (!this.authPayload) {
      const token = this.authToken();
      if (token) {
        const items = token.split(".");
        if (items.length === 0) {
          this.logger.warn("authPayload items zero length");
          this.authPayload = {};
        } else {
          const base64Url = items[1];
          if (!base64Url) {
            this.logger.warn("authPayload is null");
            this.authPayload = {};
          } else {
            const base64 = base64Url.replace("-", "+").replace("_", "/");
            const jsonPayload = JSON.parse(atob(base64));
            this.logger.debug("authPayload:", jsonPayload);
            this.authPayload = jsonPayload;
          }
        }
      }
    }
    return this.authPayload || {};
  }

  refreshToken() {
    return localStorage.getItem(this.REFRESH_TOKEN);
  }

  private storeAuthToken(authToken: string) {
    this.logger.debug("storing auth token:", authToken);
    localStorage.setItem(this.AUTH_TOKEN, authToken);
    delete this.authPayload;
  }

  private storeTokens(tokens: AuthTokens) {
    this.storeAuthToken(tokens.auth);
    this.storeRefreshToken(tokens.refresh);
  }

  private storeRefreshToken(refreshToken: string) {
    this.logger.debug("storing refresh token:", refreshToken);
    localStorage.setItem(this.REFRESH_TOKEN, refreshToken);
  }

  private removeTokens() {
    if (this.siteEditService.active()) {
      this.siteEditService.toggle(false);
    }
    localStorage.removeItem(this.AUTH_TOKEN);
    localStorage.removeItem(this.REFRESH_TOKEN);
    delete this.authPayload;
  }

  scheduleLogout() {
    this.removeTokens();
  }

}
