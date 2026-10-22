import {NO_ERRORS_SCHEMA} from "@angular/core";
import {provideNoopAnimations} from "@angular/platform-browser/animations";
import {TestBed} from "@angular/core/testing";
import {ActivatedRoute, Router} from "@angular/router";
import {LoggerTestingModule} from "ngx-logger/testing";
import {finalize, Subject} from "rxjs";
import {MigrationHealthComponent} from "./migration-health.component";
import {PageComponent} from "../../../page/page.component";
import {CrossEnvironmentHealthService} from "../../../services/cross-environment-health.service";
import {DateUtilsService} from "../../../services/date-utils.service";
import {EnvironmentHealthCheckStatus, EnvironmentHealthProgress, HealthSortColumn} from "../../../models/health.model";
import {StoredValue} from "../../../models/ui-actions";
import {ASCENDING, DESCENDING} from "../../../models/table-filtering.model";

function progress(): EnvironmentHealthProgress {
  return {complete: false, response: {
    timestamp: "2026-10-01T12:00:00Z", summary: {total: 27, healthy: 1, degraded: 0, pending: 0, unreachable: 0},
    environments: [{environment: "hillside", appName: "example-hillside", adminUrl: "https://group.example.org.uk", url: "https://example-hillside.fly.dev", checkStatus: EnvironmentHealthCheckStatus.HEALTHY, responseTimeMs: 25}]
  }};
}

async function screen(queryParams = {}) {
  const results = new Subject<EnvironmentHealthProgress>();
  const cancelled = vi.fn();
  const navigate = vi.fn().mockResolvedValue(true);
  await TestBed.configureTestingModule({
    imports: [MigrationHealthComponent, LoggerTestingModule],
    providers: [
      provideNoopAnimations(),
      {provide: CrossEnvironmentHealthService, useValue: {progressiveHealthCheck: () => results.pipe(finalize(cancelled))}},
      {provide: ActivatedRoute, useValue: {snapshot: {queryParams}}},
      {provide: Router, useValue: {navigate, createUrlTree: vi.fn(), serializeUrl: vi.fn(), events: new Subject(), url: "/"}},
      {provide: DateUtilsService, useValue: {displayDateAndTime: () => "1 October 2026"}}
    ]
  }).overrideComponent(MigrationHealthComponent, {remove: {imports: [PageComponent]}, add: {schemas: [NO_ERRORS_SCHEMA]}}).compileComponents();
  const fixture = TestBed.createComponent(MigrationHealthComponent);
  fixture.detectChanges();
  return {fixture, component: fixture.componentInstance, results, cancelled, navigate};
}

describe("MigrationHealthComponent progressive monitoring", () => {
  it("renders arriving rows and preserves them when Stop is clicked", async () => {
    const {fixture, results, cancelled} = await screen();
    results.next(progress());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("app-sortable-table").textContent).toContain("hillside");
    expect(fixture.nativeElement.textContent).toContain("1 of 27 environments");
    const buttons = [...fixture.nativeElement.querySelectorAll("button")] as HTMLButtonElement[];
    buttons.find(button => button.textContent.trim() === "Stop").click();
    fixture.detectChanges();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain("Stopped after");
    expect(fixture.nativeElement.textContent).toContain("hillside");
  });

  it("restores bookmarked search and sort, and writes changed sort to the URL", async () => {
    const {component, navigate, fixture} = await screen({[StoredValue.SEARCH]: "hillside", [StoredValue.SORT]: HealthSortColumn.ENVIRONMENT, [StoredValue.SORT_ORDER]: DESCENDING});
    expect(component.search).toBe("hillside");
    expect(component.sortColumn).toBe(HealthSortColumn.ENVIRONMENT);
    expect(component.sortDirection).toBe(DESCENDING);
    component.sortChanged({key: HealthSortColumn.RESPONSE, direction: ASCENDING});
    expect(navigate).toHaveBeenCalledWith([], {queryParams: {[StoredValue.SORT]: HealthSortColumn.RESPONSE, [StoredValue.SORT_ORDER]: ASCENDING}, queryParamsHandling: "merge"});
    fixture.destroy();
  });

  it("cancels unfinished checks when leaving the screen", async () => {
    const {fixture, cancelled} = await screen();
    fixture.destroy();
    expect(cancelled).toHaveBeenCalledOnce();
  });
});
