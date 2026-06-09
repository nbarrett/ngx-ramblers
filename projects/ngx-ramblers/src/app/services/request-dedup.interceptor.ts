import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { finalize, shareReplay } from "rxjs/operators";

@Injectable()
export class RequestDedupInterceptor implements HttpInterceptor {

  private readonly inFlight = new Map<string, Observable<HttpEvent<unknown>>>();

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (request.method !== "GET") {
      return next.handle(request);
    }
    const key = request.urlWithParams;
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }
    const shared = next.handle(request).pipe(
      finalize(() => this.inFlight.delete(key)),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.inFlight.set(key, shared);
    return shared;
  }
}
