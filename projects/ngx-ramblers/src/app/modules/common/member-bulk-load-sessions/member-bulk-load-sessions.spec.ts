import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { MemberBulkLoadSessionsComponent } from "./member-bulk-load-sessions";
import { MemberBulkLoadAudit } from "../../../models/member.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { StoredValue } from "../../../models/ui-actions";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";

describe("upload session table", () => {
  async function setup() {
    const query = new BehaviorSubject(convertToParamMap({}));
    const updateQueryParameters = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [MemberBulkLoadSessionsComponent],
      providers: [
        {provide: ActivatedRoute, useValue: {queryParamMap: query}},
        {provide: UiActionsService, useValue: {updateQueryParameters}},
        {provide: DateUtilsService, useValue: {displayDateAndTime: (value: number) => `Session ${value}`}}
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(MemberBulkLoadSessionsComponent);
    fixture.componentRef.setInput("sessions", [
      {id: "earlier", createdDate: 100, memberCount: 12},
      {id: "later", createdDate: 200, memberCount: 3}
    ] as MemberBulkLoadAudit[]);
    fixture.componentRef.setInput("selectable", true);
    fixture.detectChanges();
    const displayedSessions = () => Array.from(fixture.nativeElement.querySelectorAll("tbody tr"))
      .map((row: HTMLTableRowElement) => row.textContent.replace(/\s+/g, " ").trim());
    return {fixture, query, updateQueryParameters, displayedSessions};
  }

  it("sorts newest first and restores a bookmarked member-count sort", async () => {
    const {fixture, query, displayedSessions} = await setup();
    expect(displayedSessions()[0]).toContain("Session 200");
    query.next(convertToParamMap({[StoredValue.UPLOAD_SESSION_SORT]: "memberCount", [StoredValue.UPLOAD_SESSION_SORT_ORDER]: DESCENDING}));
    fixture.detectChanges();
    expect(displayedSessions()[0]).toContain("Session 100");
  });

  it("writes the chosen column and direction to the URL", async () => {
    const {fixture, updateQueryParameters} = await setup();
    const heading = Array.from(fixture.nativeElement.querySelectorAll("th"))
      .find((cell: HTMLTableCellElement) => cell.textContent.includes("Members in session")) as HTMLTableCellElement;
    heading.click();
    fixture.detectChanges();
    expect(updateQueryParameters).toHaveBeenCalledWith({
      [StoredValue.UPLOAD_SESSION_SORT]: "memberCount", [StoredValue.UPLOAD_SESSION_SORT_ORDER]: ASCENDING
    });
  });

  it("keeps selection tied to the session after sorting and supports selecting all", async () => {
    const {fixture, query} = await setup();
    const selected = vi.fn();
    fixture.componentInstance.selectedSessionIdsChange.subscribe(selected);
    fixture.componentRef.setInput("selectedSessionIds", ["earlier"]);
    query.next(convertToParamMap({[StoredValue.UPLOAD_SESSION_SORT]: "memberCount", [StoredValue.UPLOAD_SESSION_SORT_ORDER]: DESCENDING}));
    fixture.detectChanges();
    const checkboxes = fixture.nativeElement.querySelectorAll("tbody input") as NodeListOf<HTMLInputElement>;
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
    const all = fixture.nativeElement.querySelector("thead input") as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    all.click();
    expect(selected).toHaveBeenLastCalledWith(["earlier", "later"]);
  });
});
