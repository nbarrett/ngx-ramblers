import { TestBed } from "@angular/core/testing";
import { PageContentActionsService } from "./page-content-actions.service";
import { PageContent, PageContentRow, PageContentType } from "../models/content-text.model";
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

  describe("extractMarkdownLinkHrefs", () => {
    it("returns empty array for null or undefined text", () => {
      expect(service.extractMarkdownLinkHrefs(null)).toEqual([]);
      expect(service.extractMarkdownLinkHrefs(undefined)).toEqual([]);
      expect(service.extractMarkdownLinkHrefs("")).toEqual([]);
    });

    it("extracts single markdown link", () => {
      const text = "Check out [this page](how-to/guide) for more info.";
      expect(service.extractMarkdownLinkHrefs(text)).toEqual(["how-to/guide"]);
    });

    it("extracts multiple markdown links", () => {
      const text = `
- [Release 1](how-to/committee/release-notes/2023-11-30)
- [Release 2](how-to/committee/release-notes/2024-03-06)
- [Release 3](how-to/committee/release-notes/2026-01-03)
`;
      expect(service.extractMarkdownLinkHrefs(text)).toEqual([
        "how-to/committee/release-notes/2023-11-30",
        "how-to/committee/release-notes/2024-03-06",
        "how-to/committee/release-notes/2026-01-03"
      ]);
    });

    it("strips leading slashes from paths", () => {
      const text = "[page link](/how-to/guide)";
      expect(service.extractMarkdownLinkHrefs(text)).toEqual(["how-to/guide"]);
    });

    it("filters out external URLs", () => {
      const text = `
- [External](https://example.com)
- [Local](how-to/page)
- [WWW](www.example.com)
- [Mail](mailto:test@example.com)
`;
      expect(service.extractMarkdownLinkHrefs(text)).toEqual(["how-to/page"]);
    });

    it("handles links with special characters in label", () => {
      const text = "[03-Jan-2026 — #111 — Release-notes: 1 feature](how-to/release)";
      expect(service.extractMarkdownLinkHrefs(text)).toEqual(["how-to/release"]);
    });

    it("returns empty array when no markdown links present", () => {
      const text = "This is just plain text without any links.";
      expect(service.extractMarkdownLinkHrefs(text)).toEqual([]);
    });
  });

  describe("allPageHrefs", () => {
    it("returns empty array for null page content", () => {
      expect(service.allPageHrefs(null)).toEqual([]);
    });

    it("extracts hrefs from column href property", () => {
      const pageContent: PageContent = {
        rows: [{
          type: PageContentType.ACTION_BUTTONS,
          maxColumns: 2,
          showSwiper: false,
          columns: [
            { href: "page1" },
            { href: "page2" }
          ]
        }]
      };
      expect(service.allPageHrefs(pageContent)).toContain("page1");
      expect(service.allPageHrefs(pageContent)).toContain("page2");
    });

    it("extracts hrefs from contentText markdown links", () => {
      const pageContent: PageContent = {
        rows: [{
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          columns: [{
            contentText: "See [page one](how-to/page1) and [page two](how-to/page2)"
          }]
        }]
      };
      const hrefs = service.allPageHrefs(pageContent);
      expect(hrefs).toContain("how-to/page1");
      expect(hrefs).toContain("how-to/page2");
    });

    it("extracts hrefs from nested rows", () => {
      const pageContent: PageContent = {
        rows: [{
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          columns: [{
            rows: [{
              type: PageContentType.TEXT,
              maxColumns: 1,
              showSwiper: false,
              columns: [{ contentText: "[nested link](nested/path)" }]
            }]
          }]
        }]
      };
      expect(service.allPageHrefs(pageContent)).toContain("nested/path");
    });

    it("combines column hrefs and contentText hrefs", () => {
      const pageContent: PageContent = {
        rows: [{
          type: PageContentType.TEXT,
          maxColumns: 2,
          showSwiper: false,
          columns: [
            { href: "direct/link" },
            { contentText: "Check [markdown link](markdown/path)" }
          ]
        }]
      };
      const hrefs = service.allPageHrefs(pageContent);
      expect(hrefs).toContain("direct/link");
      expect(hrefs).toContain("markdown/path");
    });
  });
});
