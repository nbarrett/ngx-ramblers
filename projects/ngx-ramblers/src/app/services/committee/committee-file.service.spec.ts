import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { vi } from "vitest";
import { CommitteeFile } from "../../models/committee.model";
import { PageContent, PageContentType } from "../../models/content-text.model";
import { SortDirection } from "../../models/sort.model";
import { DateUtilsService } from "../date-utils.service";
import { LoggerFactory } from "../logger-factory.service";
import { PageContentService } from "../page-content.service";
import { CommitteeFileService } from "./committee-file.service";

describe("CommitteeFileService addToCommitteeDocumentsPage", () => {
  let service: CommitteeFileService;
  let pageContentService: {
    findByPath: ReturnType<typeof vi.fn>;
    all: ReturnType<typeof vi.fn>;
    createOrUpdate: ReturnType<typeof vi.fn>;
  };

  const yearPage = (path: string, fileIds: string[]): PageContent => ({
    id: `id-${path}`,
    path,
    rows: [{
      type: PageContentType.COMMITTEE_DOCUMENTS,
      showSwiper: false,
      columns: [],
      committeeDocuments: {
        fileIds,
        autoFromFirstActionButton: false,
        showFileActions: true,
        sortDirection: SortDirection.DESC
      }
    }]
  } as PageContent);

  const file = (id: string, eventDate = 1787241600000): CommitteeFile => ({
    id,
    eventDate,
    fileType: "Committee Meeting Agenda",
    createdDate: eventDate,
    document: {title: "Committee Meeting", markdown: ""}
  } as CommitteeFile);

  beforeEach(() => {
    pageContentService = {
      findByPath: vi.fn(),
      all: vi.fn(),
      createOrUpdate: vi.fn().mockImplementation((page: PageContent) => Promise.resolve(page))
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CommitteeFileService,
        {provide: PageContentService, useValue: pageContentService},
        {
          provide: DateUtilsService,
          useValue: {asString: vi.fn().mockReturnValue("2026")}
        },
        {
          provide: LoggerFactory,
          useValue: {
            createLogger: vi.fn().mockReturnValue({
              info: vi.fn(),
              error: vi.fn(),
              warn: vi.fn(),
              debug: vi.fn(),
              off: vi.fn()
            })
          }
        }
      ]
    });
    service = TestBed.inject(CommitteeFileService);
  });

  it("adds the file to the committee year page", async () => {
    const page = yearPage("committee/2026", ["existing"]);
    pageContentService.findByPath.mockResolvedValue(page);
    const path = await service.addToCommitteeDocumentsPage(file("new-file"));
    expect(path).toBe("committee/2026");
    expect(page.rows[0].committeeDocuments.fileIds).toEqual(["existing", "new-file"]);
    expect(pageContentService.createOrUpdate).toHaveBeenCalledWith(page);
    expect(pageContentService.all).not.toHaveBeenCalled();
  });

  it("does not write when the file is already on the year page", async () => {
    const page = yearPage("committee/2026", ["new-file"]);
    pageContentService.findByPath.mockResolvedValue(page);
    const path = await service.addToCommitteeDocumentsPage(file("new-file"));
    expect(path).toBe("committee/2026");
    expect(pageContentService.createOrUpdate).not.toHaveBeenCalled();
  });

  it("falls back to the latest year page when the meeting year has no page", async () => {
    const latest = yearPage("committee/2025", ["older"]);
    pageContentService.findByPath.mockResolvedValue(null);
    pageContentService.all.mockResolvedValue([latest]);
    const path = await service.addToCommitteeDocumentsPage(file("new-file"));
    expect(path).toBe("committee/2025");
    expect(latest.rows[0].committeeDocuments.fileIds).toEqual(["older", "new-file"]);
  });

  it("returns null when no committee documents page exists", async () => {
    pageContentService.findByPath.mockResolvedValue(null);
    pageContentService.all.mockResolvedValue([]);
    const path = await service.addToCommitteeDocumentsPage(file("new-file"));
    expect(path).toBeNull();
    expect(pageContentService.createOrUpdate).not.toHaveBeenCalled();
  });
});
