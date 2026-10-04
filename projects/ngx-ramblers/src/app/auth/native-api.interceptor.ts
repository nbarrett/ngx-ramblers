import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { nativeApiUrl } from "../functions/native-walking";

@Injectable()
export class NativeApiInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = nativeApiUrl(request.url);
    return next.handle(url === request.url ? request : request.clone({url}));
  }
}
