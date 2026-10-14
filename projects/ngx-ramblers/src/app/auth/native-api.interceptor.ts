import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Capacitor } from "@capacitor/core";
import { catchError, defer, Observable, switchMap, throwError } from "rxjs";
import { nativeApiUrl } from "../functions/native-walking";
import { NativeSiteService } from "../services/maps/native-site.service";

@Injectable()
export class NativeApiInterceptor implements HttpInterceptor {
  private readonly nativeSiteService = inject(NativeSiteService);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = nativeApiUrl(request.url);
    if (Capacitor.isNativePlatform() && /^https:\/\/[^/]+\/api(?:\/|\?|$)/.test(url)) {
      const parsed = new URL(url);
      return defer(() => this.nativeSiteService.canonicalOrigin(parsed.origin)).pipe(
        catchError(error => throwError(() => new HttpErrorResponse({error, url, status: 0, statusText: "Could not check the group website"}))),
        switchMap(origin => next.handle(request.clone({url: `${origin}${parsed.pathname}${parsed.search}`})))
      );
    } else {
      return next.handle(url === request.url ? request : request.clone({url}));
    }
  }
}
