import { TestBed } from "@angular/core/testing";
import { PageContentActionsService } from "./page-content-actions.service";
import { PageContentRow, PageContentType } from "../models/content-text.model";
import { LoggerTestingModule } from "ngx-logger/testing";
import { UrlService } from "./url.service";

describe("PageContentActionsService", () => {
  let service: PageContentActionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        { provide: UrlService, useValue: { pathOnlyFrom: (s: string) => s } }
      ]
    });
    service = TestBed.inject(PageContentActionsService);
  });

  it("clearColumnDragState resets all fields", () => {
    service.draggedColumnIndex = 1;
    service.draggedColumnRowIndex = 2;
    service.draggedColumnSourceRow = {} as PageContentRow;
    service.dragOverColumnRowIndex = 3;
    service.dragOverColumnIndex = 4;
    service.dragOverColumnParentColumnIndex = 5 as unknown as number;
    service.draggedColumnParentColumnIndex = 6 as unknown as number;
    service.dragInsertAfter = true;
    service.draggedColumnIsNested = true;
    service.clearColumnDragState();
    expect(service.draggedColumnIndex).toBeNull();
    expect(service.draggedColumnRowIndex).toBeNull();
    expect(service.draggedColumnSourceRow).toBeNull();
    expect(service.dragOverColumnRowIndex).toBeNull();
    expect(service.dragOverColumnIndex).toBeNull();
    expect(service.dragOverColumnParentColumnIndex).toBeNull();
    expect(service.draggedColumnParentColumnIndex).toBeNull();
    expect(service.dragInsertAfter).toBeFalse();
    expect(service.draggedColumnIsNested).toBeFalse();
  });

  it("clearNestedRowDragState resets nested indices", () => {
    service.draggedNestedColumnIndex = 1;
    service.draggedNestedRowIndex = 2;
    service.clearNestedRowDragState();
    expect(service.draggedNestedColumnIndex).toBeNull();
    expect(service.draggedNestedRowIndex).toBeNull();
  });

  it("clearNestedDragTargets resets target indices", () => {
    service.nestedDragTargetColumnIndex = 1;
    service.nestedDragTargetRowIndex = 2;
    service.clearNestedDragTargets();
    expect(service.nestedDragTargetColumnIndex).toBeNull();
    expect(service.nestedDragTargetRowIndex).toBeNull();
  });

  it("nestedRowDragTooltip returns null when source not set", () => {
    service.clearNestedRowDragState();
    service.nestedDragTargetColumnIndex = 0;
    service.nestedDragTargetRowIndex = 0;
    expect(service.nestedRowDragTooltip(0, 0)).toBeNull();
  });

  it("nestedRowDragTooltip returns 'no change' for same position", () => {
    service.draggedNestedColumnIndex = 0;
    service.draggedNestedRowIndex = 0;
    service.nestedDragTargetColumnIndex = 0;
    service.nestedDragTargetRowIndex = 0;
    expect(service.nestedRowDragTooltip(0, 0)).toContain("no change");
  });

  it("nestedRowDragTooltip returns text for before/after and into column", () => {
    service.draggedNestedColumnIndex = 0;
    service.draggedNestedRowIndex = 1;
    service.nestedDragTargetColumnIndex = 0;
    service.nestedDragTargetRowIndex = 2;
    expect(service.nestedRowDragTooltip(0, 2)).toContain("Drop nested row");
    service.draggedNestedColumnIndex = 0;
    service.draggedNestedRowIndex = 2;
    service.nestedDragTargetColumnIndex = 1;
    service.nestedDragTargetRowIndex = 0;
    expect(service.nestedRowDragTooltip(1, 0)).toContain("into column 2");
  });

  it("moveNestedRowBetweenColumns reorders within same column", () => {
    const row1: PageContentRow = { type: PageContentType.TEXT, columns: [{}, {}] } as unknown as PageContentRow;
    const row2: PageContentRow = { type: PageContentType.TEXT, columns: [{}, {}] } as unknown as PageContentRow;
    const parent: PageContentRow = { type: PageContentType.TEXT, columns: [{ rows: [row1, row2] }, { rows: [] }] } as unknown as PageContentRow;
    service.moveNestedRowBetweenColumns(parent, 0, 0, 0, 1);
    const rows = parent.columns[0].rows || [];
    expect(rows[1]).toBe(row1);
  });

  it("moveNestedRowBetweenColumns moves across columns", () => {
    const row1: PageContentRow = { type: PageContentType.TEXT, columns: [{}, {}] } as unknown as PageContentRow;
    const row2: PageContentRow = { type: PageContentType.TEXT, columns: [{}, {}] } as unknown as PageContentRow;
    const parent: PageContentRow = { type: PageContentType.TEXT, columns: [{ rows: [row1, row2] }, { rows: [] }] } as unknown as PageContentRow;
    service.moveNestedRowBetweenColumns(parent, 0, 1, 1, 0);
    const rows0 = parent.columns[0].rows || [];
    const rows1 = parent.columns[1].rows || [];
    expect(rows0.length).toBe(1);
    expect(rows1[0]).toBe(row2);
  });

  it("columnDragTooltip respects drag state and context", () => {
    service.draggedColumnIndex = 0;
    service.dragHasMoved = true;
    service.draggedColumnIsNested = false;
    service.dragOverColumnRowIndex = 1;
    service.dragOverColumnIndex = 2;
    service.dragInsertAfter = false;
    expect(service.columnDragTooltip(1, 2, false, null)).toBe("Drop before Col 3");
    service.dragInsertAfter = true;
    expect(service.columnDragTooltip(1, 2, false, null)).toBe("Drop after Col 3");
    expect(service.columnDragTooltip(0, 2, false, null)).toBeNull();
    expect(service.columnDragTooltip(1, 1, false, null)).toBeNull();
  });

  it("columnDragTooltip enforces nested parent column match", () => {
    service.draggedColumnIndex = 0;
    service.dragHasMoved = true;
    service.draggedColumnIsNested = true;
    service.dragOverColumnRowIndex = 0;
    service.dragOverColumnIndex = 1;
    service.dragOverColumnParentColumnIndex = 3;
    service.dragInsertAfter = false;
    expect(service.columnDragTooltip(0, 1, true, 2)).toBeNull();
    expect(service.columnDragTooltip(0, 1, true, 3)).toBe("Drop before Col 2");
  });

  it("moveColumnBetweenRows moves within same row", () => {
    const row: PageContentRow = { type: PageContentType.TEXT, columns: [{ columns: 6 }, { columns: 6 }, { columns: 6 }] } as unknown as PageContentRow;
    service.moveColumnBetweenRows(row, 0, row, 2);
    expect(row.columns.length).toBe(3);
  });

  it("moveColumnBetweenRows moves across rows and recalculates", () => {
    const rowA: PageContentRow = { type: PageContentType.TEXT, columns: [{ columns: 6 }, { columns: 6 }] } as unknown as PageContentRow;
    const rowB: PageContentRow = { type: PageContentType.TEXT, columns: [{ columns: 12 }] } as unknown as PageContentRow;
    service.moveColumnBetweenRows(rowA, 1, rowB, 0);
    expect(rowA.columns.length).toBe(1);
    expect(rowB.columns.length).toBe(2);
  });
});
