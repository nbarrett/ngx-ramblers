import {HttpEventType, provideHttpClient} from "@angular/common/http";
import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";
import {TestBed} from "@angular/core/testing";
import {LoggerTestingModule} from "ngx-logger/testing";
import {CrossEnvironmentHealthService} from "./cross-environment-health.service";
import {EnvironmentHealthCheck, EnvironmentHealthCheckStatus, EnvironmentHealthEvent, EnvironmentHealthEventType, EnvironmentHealthProgress} from "../models/health.model";

const timestamp = "2026-10-01T12:00:00Z";
const streamUrl = "/api/health/environments/stream";
const start: EnvironmentHealthEvent = {type: EnvironmentHealthEventType.START, total: 2, timestamp};
const complete: EnvironmentHealthEvent = {type: EnvironmentHealthEventType.COMPLETE, timestamp};

function result(environment: string): EnvironmentHealthEvent {
  const check: EnvironmentHealthCheck = {
    environment, appName: `example-${environment}`, url: `https://example-${environment}.fly.dev`,
    adminUrl: `https://${environment}.example.org.uk`, checkStatus: EnvironmentHealthCheckStatus.HEALTHY, responseTimeMs: 20
  };
  return {type: EnvironmentHealthEventType.RESULT, environment: check, timestamp};
}

function line(event: EnvironmentHealthEvent): string {
  return JSON.stringify(event) + "\n";
}

describe("CrossEnvironmentHealthService progressive checks", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule], providers: [provideHttpClient(), provideHttpClientTesting()]
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it("draws complete results before the request ends, handles split lines and avoids replaying cumulative text", () => {
    const received: EnvironmentHealthProgress[] = [];
    const finished = vi.fn();
    TestBed.inject(CrossEnvironmentHealthService).progressiveHealthCheck().subscribe({next: progress => received.push(progress), complete: finished});
    const request = TestBed.inject(HttpTestingController).expectOne(streamUrl);
    const first = line(start) + line(result("lakeside"));
    const rest = line(result("hillside")) + line(complete);
    request.event({type: HttpEventType.DownloadProgress, loaded: first.length + 5, partialText: first + rest.slice(0, 5)});
    expect(received.at(-1).response.environments.map(item => item.environment)).toEqual(["lakeside"]);
    expect(received.at(-1).response.summary).toEqual({total: 2, healthy: 1, degraded: 0, pending: 0, unreachable: 0});
    expect(finished).not.toHaveBeenCalled();
    request.event({type: HttpEventType.DownloadProgress, loaded: first.length + rest.length, partialText: first + rest});
    request.flush(first + rest);
    expect(received.at(-1).response.environments.map(item => item.environment)).toEqual(["lakeside", "hillside"]);
    expect(received.at(-1).complete).toBe(true);
    expect(finished).toHaveBeenCalledOnce();
    expect(received).toHaveLength(4);
  });

  it("cancels the underlying request when stopped, retaining the results already delivered", () => {
    const received: EnvironmentHealthProgress[] = [];
    const subscription = TestBed.inject(CrossEnvironmentHealthService).progressiveHealthCheck().subscribe(progress => received.push(progress));
    const request = TestBed.inject(HttpTestingController).expectOne(streamUrl);
    const partial = line(start) + line(result("hillside"));
    request.event({type: HttpEventType.DownloadProgress, loaded: partial.length, partialText: partial});
    subscription.unsubscribe();
    expect(request.cancelled).toBe(true);
    expect(received.at(-1).response.environments).toHaveLength(1);
    expect(received.at(-1).complete).toBe(false);
  });

  it("reports a truncated stream without discarding completed rows", () => {
    const received: EnvironmentHealthProgress[] = [];
    const failed = vi.fn();
    TestBed.inject(CrossEnvironmentHealthService).progressiveHealthCheck().subscribe({next: progress => received.push(progress), error: failed});
    TestBed.inject(HttpTestingController).expectOne(streamUrl).flush(line(start) + line(result("hillside")));
    expect(received.at(-1).response.environments).toHaveLength(1);
    expect(failed.mock.calls[0][0].message).toContain("before all results arrived");
  });

  it("rejects completion when some environments are missing", () => {
    const failed = vi.fn();
    TestBed.inject(CrossEnvironmentHealthService).progressiveHealthCheck().subscribe({error: failed});
    TestBed.inject(HttpTestingController).expectOne(streamUrl).flush(line(start) + line(result("hillside")) + line(complete));
    expect(failed.mock.calls[0][0].message).toContain("before all results arrived");
  });

  it("reports a server failure after partial results", () => {
    const failed = vi.fn();
    const received: EnvironmentHealthProgress[] = [];
    TestBed.inject(CrossEnvironmentHealthService).progressiveHealthCheck().subscribe({next: progress => received.push(progress), error: failed});
    TestBed.inject(HttpTestingController).expectOne(streamUrl).flush(line(start) + line(result("hillside")) + line({type: EnvironmentHealthEventType.ERROR, error: "Check unavailable"}));
    expect(received.at(-1).response.environments).toHaveLength(1);
    expect(failed.mock.calls[0][0].message).toBe("Check unavailable");
  });
});
