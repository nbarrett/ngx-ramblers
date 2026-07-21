import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject, Observable, throwError } from "rxjs";
import { catchError, filter, switchMap, take } from "rxjs/operators";
import { AuthTokens } from "../models/auth-tokens";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private logger: Logger = inject(LoggerFactory).createLogger("AuthInterceptor", NgxLoggerLevel.ERROR);
  authService = inject(AuthService);
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (this.authService.authToken()) {
      request = this.addAuthToken(request, this.authService.authToken());
    }

    const authRequest = request.url.includes("login") || request.url.includes("reset-password") || request.url.includes("forgot-password") || request.url.includes("refresh") || request.url.includes("logout");
    if (!authRequest && this.authService.authToken() && this.authService.tokenExpired()) {
      this.logger.info("token expired - refreshing before sending request to:", request.url);
      return this.handle401Error(request, next);
    }

    return next.handle(request).pipe(catchError(error => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !authRequest) {
        return this.handle401Error(request, next);
      } else {
        return throwError(() => error);
      }
    }));
  }

  private addAuthToken(request: HttpRequest<any>, authToken: string) {
    this.logger.debug("addAuthToken to header", authToken);
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`
      }
    });
  }

  private withoutAuthToken(request: HttpRequest<any>) {
    return request.clone({headers: request.headers.delete("Authorization")});
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    this.logger.info("handle401Error called:isRefreshing - ", !this.isRefreshing, "request - ", request);
    if (!this.authService.refreshToken()) {
      this.logger.info("handle401Error:no refresh token - logging out and sending request unauthenticated");
      this.authService.scheduleLogout();
      return next.handle(this.withoutAuthToken(request));
    }
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.logger.info("handle401Error:beginning refresh");
      this.refreshTokenSubject.next(null);
      return this.authService.performTokenRefresh().pipe(
        switchMap((tokens: AuthTokens) => {
          this.logger.info("handle401Error:refresh completed - received new auth token:", tokens.auth);
          this.isRefreshing = false;
          this.refreshTokenSubject.next(tokens.auth);
          return next.handle(this.addAuthToken(request, tokens.auth));
        }),
        catchError(error => {
          this.logger.info("handle401Error:refresh failed - logging out and sending request unauthenticated", error);
          this.isRefreshing = false;
          this.authService.scheduleLogout();
          this.refreshTokenSubject.next("");
          return next.handle(this.withoutAuthToken(request));
        }));
    } else {
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(token => token
          ? next.handle(this.addAuthToken(request, token))
          : next.handle(this.withoutAuthToken(request))));
    }
  }
}
