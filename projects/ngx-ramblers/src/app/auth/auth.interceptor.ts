import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject, Observable, throwError } from "rxjs";
import { catchError, filter, switchMap, take } from "rxjs/operators";
import { AuthTokens } from "../models/auth-tokens";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  private logger: Logger;

  constructor(public authService: AuthService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(AuthInterceptor, NgxLoggerLevel.OFF);
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (this.authService.authToken()) {
      request = this.addAuthToken(request, this.authService.authToken());
    }

    return next.handle(request).pipe(catchError(error => {
      const loginRequest = request.url.includes("login") || request.url.includes("reset-password") || request.url.includes("forgot-password");
      if (error instanceof HttpErrorResponse && error.status === 401 && !loginRequest) {
        return this.handle401Error(request, next);
      } else {
        return throwError(error);
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

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    this.logger.debug("handle401Error called:isRefreshing - ", !this.isRefreshing, "request - ", request);
    if (request.url.includes("refresh")) {
      this.logger.debug("handle401Error refresh failed - setting logout flag");
      this.authService.scheduleLogout();
    }
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.logger.debug("handle401Error:beginning refresh");
      this.refreshTokenSubject.next(null);
      return this.authService.performTokenRefresh().pipe(
        switchMap((tokens: AuthTokens) => {
          this.logger.debug("handle401Error:refresh completed - received new auth token:", tokens.auth);
          this.isRefreshing = false;
          this.refreshTokenSubject.next(tokens.auth);
          return next.handle(this.addAuthToken(request, tokens.auth));
        }));
    } else {
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(jwt => {
          return next.handle(this.addAuthToken(request, jwt));
        }));
    }
  }
}
