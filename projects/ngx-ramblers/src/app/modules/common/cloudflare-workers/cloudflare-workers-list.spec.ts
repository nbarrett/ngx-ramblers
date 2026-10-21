import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { CloudflareWorkersList } from "./cloudflare-workers-list";
import { CloudflareWorkerSortField, WorkerEmailUsageStatus } from "../../../models/cloudflare-email-routing.model";
import { StoredValue } from "../../../models/ui-actions";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";

describe("shared Cloudflare workers list", () => {
  const params = new BehaviorSubject(convertToParamMap({}));
  const navigate = vi.fn();

  beforeEach(async () => {
    params.next(convertToParamMap({}));
    navigate.mockClear();
    await TestBed.configureTestingModule({
      imports: [CloudflareWorkersList],
      providers: [
        {provide: ActivatedRoute, useValue: {queryParamMap: params}},
        {provide: Router, useValue: {navigate}}
      ]
    }).compileComponents();
  });

  function createComponent(inventory = true): ComponentFixture<CloudflareWorkersList> {
    const fixture = TestBed.createComponent(CloudflareWorkersList);
    fixture.componentInstance.inventory = inventory;
    fixture.componentInstance.accountId = "account-1";
    fixture.componentInstance.rows = [{id: "email-inbox-router", mapped: "group.example.org.uk: Catch-all", status: WorkerEmailUsageStatus.REFERENCED}];
    fixture.detectChanges();
    return fixture;
  }

  it("renders email usage and references through the shared table without deletion controls", () => {
    const fixture = createComponent();
    expect(fixture.nativeElement.textContent).toContain("Referenced by email routing");
    expect(fixture.nativeElement.textContent).toContain("group.example.org.uk: Catch-all");
    expect(fixture.nativeElement.querySelector('button[aria-label="Delete worker"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[aria-label="Open in Cloudflare"]').href).toContain("/account-1/workers/services/view/email-inbox-router/production");
  });

  it("offers delete only for unreferenced workers on the inventory view", () => {
    const fixture = createComponent();
    fixture.componentRef.setInput("allowDelete", true);
    fixture.componentInstance.rows = [
      {id: "email-inbox-router", mapped: "group.example.org.uk: Catch-all", status: WorkerEmailUsageStatus.REFERENCED},
      {id: "ngx-public-site-fetch", mapped: "Site migration fetch worker", status: WorkerEmailUsageStatus.RESERVED},
      {id: "old-router", mapped: "No references found", status: WorkerEmailUsageStatus.UNREFERENCED}
    ];
    fixture.detectChanges();
    const chosen: string[] = [];
    fixture.componentInstance.requestDelete.subscribe(id => chosen.push(id));
    const deletes = [...fixture.nativeElement.querySelectorAll('button[aria-label="Delete worker"]')];
    expect(deletes).toHaveLength(1);
    deletes[0].click();
    expect(chosen).toEqual(["old-router"]);
  });

  it("retains the existing site view and its administrator delete confirmation", () => {
    const fixture = createComponent(false);
    const chosen: string[] = [];
    fixture.componentRef.setInput("allowDelete", true);
    fixture.componentInstance.requestDelete.subscribe(id => chosen.push(id));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Mapped");
    expect(fixture.nativeElement.textContent).not.toContain("Referenced By");
    fixture.nativeElement.querySelector('button[aria-label="Delete worker"]').click();
    expect(chosen).toEqual(["email-inbox-router"]);
    fixture.componentRef.setInput("deleteConfirmPending", "email-inbox-router");
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[aria-label="Confirm delete"]')).not.toBeNull();
  });

  it("restores sorting from the URL and responds to back navigation", () => {
    params.next(convertToParamMap({[StoredValue.CLOUDFLARE_WORKER_SORT]: CloudflareWorkerSortField.STATUS, [StoredValue.CLOUDFLARE_WORKER_SORT_ORDER]: DESCENDING}));
    const fixture = createComponent();
    expect(fixture.componentInstance.sortKey).toBe(CloudflareWorkerSortField.STATUS);
    expect(fixture.componentInstance.sortDirection).toBe(DESCENDING);
    params.next(convertToParamMap({}));
    expect(fixture.componentInstance.sortKey).toBe(CloudflareWorkerSortField.SCRIPT);
    expect(fixture.componentInstance.sortDirection).toBe(ASCENDING);
  });

  it("rejects an unavailable sort column on the site view", () => {
    params.next(convertToParamMap({[StoredValue.CLOUDFLARE_WORKER_SORT]: CloudflareWorkerSortField.STATUS}));
    expect(createComponent(false).componentInstance.sortKey).toBe(CloudflareWorkerSortField.SCRIPT);
  });

  it("writes sorting to the URL while preserving other page settings", () => {
    const fixture = createComponent();
    fixture.componentInstance.sortChanged({key: CloudflareWorkerSortField.MAPPING, direction: DESCENDING});
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: {[StoredValue.CLOUDFLARE_WORKER_SORT]: CloudflareWorkerSortField.MAPPING, [StoredValue.CLOUDFLARE_WORKER_SORT_ORDER]: DESCENDING},
      queryParamsHandling: "merge"
    }));
  });

  it("shows the shared table's empty message", () => {
    const fixture = createComponent();
    fixture.componentRef.setInput("rows", []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("No Cloudflare workers found");
  });
});
