import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Capacitor } from "@capacitor/core";
import { catchError, defer, Observable, switchMap, throwError } from "rxjs";
import { isNativeLocalShell, nativeApiUrl } from "../functions/native-walking";
import { NATIVE_HTTP, NativeSiteService } from "../services/maps/native-site.service";

@Injectable()
export class NativeApiInterceptor implements HttpInterceptor {
  private readonly nativeHttp = inject(NATIVE_HTTP);
  private readonly nativeSiteService = inject(NativeSiteService);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = nativeApiUrl(request.url);
    if (Capacitor.isNativePlatform() && /^https:\/\/[^/]+\/api(?:\/|\?|$)/.test(url)) {
      const parsed = new URL(url);
      const sameOrigin = parsed.origin === window.location.origin;
      if (isNativeLocalShell()) {
        return defer(() => this.nativeHttp.request({
          url: nativeApiUrl(request.urlWithParams),
          method: request.method,
          headers: request.headers.keys().reduce((headers, key) => ({...headers, [key]: request.headers.get(key)}), request.body !== null && !request.headers.has("Content-Type") ? {"Content-Type": "application/json"} : {}),
          data: request.body,
          connectTimeout: 10000,
          readTimeout: 20000
        })).pipe(switchMap(response => {
          if (response.status >= 200 && response.status < 300) {
            return [new HttpResponse({body: response.data, status: response.status, url: response.url})];
          } else {
            return throwError(() => new HttpErrorResponse({error: response.data, status: response.status, url: response.url}));
          }
        }));
      } else if (sameOrigin) {
        return next.handle(request.clone({url: `${parsed.origin}${parsed.pathname}${parsed.search}`}));
      } else {
        return defer(() => this.nativeSiteService.canonicalOrigin(parsed.origin)).pipe(
          catchError(error => throwError(() => new HttpErrorResponse({error, url, status: 0, statusText: "Could not check the group website"}))),
          switchMap(origin => next.handle(request.clone({url: `${origin}${parsed.pathname}${parsed.search}`})))
        );
      }
    } else {
      return next.handle(url === request.url ? request : request.clone({url}));
    }
  }
}
