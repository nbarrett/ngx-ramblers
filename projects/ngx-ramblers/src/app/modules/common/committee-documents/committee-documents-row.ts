import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { first, last } from "es-toolkit/compat";
import { AuthService } from "../../../auth/auth.service";
import { CommitteeFile } from "../../../models/committee.model";
import { NamedEventType } from "../../../models/broadcast.model";
import { CommitteeDocumentsData, PageContent, PageContentRow, PathSegment } from "../../../models/content-text.model";
import { SortDirection } from "../../../models/sort.model";
import { FALLBACK_MEDIA } from "../../../models/walk.model";
import { ConfirmType } from "../../../models/ui-actions";
import { AlertTarget } from "../../../models/alert-target.model";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { UrlService } from "../../../services/url.service";
import { BroadcastService } from "../../../services/broadcast-service";
import { CommitteeDisplayService } from "../../../pages/committee/committee-display.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { sortBy } from "../../../functions/arrays";
import { CommitteeFileEditor } from "../../../pages/committee/edit/committee-file-editor";

@Component({
  selector: "app-committee-documents-row",
  template: `
    <div [class]="actions.rowClasses(row)">
      <div class="col-sm-12">
        <div class="card mb-3">
          @if (imageSource) {
            <div class="wrapper w-100 position-relative">
              <img class="h-100 w-100 position-absolute"
                   role="presentation"
                   [src]="resolvedImageSource()">
            </div>
          }
          <div class="card-body">
            <div class="card-title mb-4 d-flex align-items-center justify-content-between">
              <h4 class="mb-0">Committee events for {{ pageTitle }}</h4>
              @if (display.allowAddCommitteeFile() && committeeDocumentsConfig?.showFileActions && !editingFile) {
                <input (click)="addCommitteeFile()"
                       class="btn btn-primary btn-sm" title="Add new File" type="submit"
                       value="Add File">
              }
            </div>
            @if (editingFile) {
              <div class="card bg-light mb-3">
                <div class="card-body">
                  <h5 class="card-title mb-3">{{ editingFileIsNew ? "Add" : "Edit" }} Committee File</h5>
                  <app-committee-file-editor
                    [committeeFile]="editingFile"
                    (saved)="onFileSaved($event)"
                    (cancelled)="cancelEdit()"/>
                </div>
              </div>
            }
            @for (committeeFile of committeeFiles; track committeeFile.id) {
              <div class="file-item"
                   (mouseover)="selectCommitteeFile(committeeFile)">
                @if (committeeFile.fileNameData) {
                  <div class="file-download">
                    <img [alt]="display.iconFile(committeeFile)"
                         [src]="'assets/images/ramblers/' + display.iconFile(committeeFile)"
                         class="icon"/>
                    <a [href]="display.fileUrl(committeeFile)"
                       [title]="display.fileTitle(committeeFile)" class="morelink"
                       target="_blank">Download</a>
                  </div>
                }
                <div class="file-detail">
                  <h6>{{ committeeFile.fileType }}</h6>
                  <p>{{ display.fileTitle(committeeFile) }}</p>
                  @if (memberLoginService.allowCommittee() && isActive(committeeFile) && committeeDocumentsConfig?.showFileActions && !editingFile) {
                    <div class="d-flex gap-2 flex-wrap mt-2">
                      @if (!display.confirm.deleteConfirmOutstanding()) {
                        @if (display.allowEditCommitteeFile(committeeFile)) {
                          <input type="submit" value="Edit File"
                                 (click)="editCommitteeFile(committeeFile)"
                                 class="btn btn-success btn-sm">
                        }
                        @if (display.allowEditCommitteeFile(committeeFile)) {
                          <input type="submit" value="Send Email"
                                 (click)="sendNotification(committeeFile)"
                                 class="btn btn-warning btn-sm">
                        }
                        @if (display.allowDeleteCommitteeFile(committeeFile)) {
                          <input type="submit" value="Delete File"
                                 (click)="deleteCommitteeFile()"
                                 class="btn btn-danger btn-sm">
                        }
                      }
                      @if (display.confirm.deleteConfirmOutstanding()) {
                        <input (click)="confirmDeleteCommitteeFile(committeeFile)"
                               class="btn btn-danger btn-sm"
                               type="submit" value="Confirm Delete">
                        <input (click)="display.confirm.clear();" class="btn btn-secondary btn-sm"
                               type="submit" value="Cancel Delete">
                      }
                    </div>
                  }
                </div>
                @if (!isLast(committeeFile)) {
                  <hr class="rule">
                }
              </div>
            }
            @if (committeeFiles?.length === 0 && !editingFile) {
              <p class="text-muted">No documents available.</p>
            }
          </div>
        </div>
      </div>
    </div>`,
  styleUrls: ["./committee-documents-row.sass"],
  imports: [CommitteeFileEditor]
})
export class CommitteeDocumentsRow implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeDocumentsRow", NgxLoggerLevel.ERROR);
  memberLoginService = inject(MemberLoginService);
  display = inject(CommitteeDisplayService);
  private authService = inject(AuthService);
  actions = inject(PageContentActionsService);
  private committeeFileService = inject(CommitteeFileService);
  private pageContentService = inject(PageContentService);
  private pageService = inject(PageService);
  urlService = inject(UrlService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private notifierService = inject(NotifierService);
  private subscriptions: Subscription[] = [];
  public selectedCommitteeFile: CommitteeFile;
  public committeeFiles: CommitteeFile[] = [];
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public imageSource: string;
  public pageTitle: string;
  public editingFile: CommitteeFile;
  public editingFileIsNew = false;

  public row: PageContentRow;
  @Input() rowIndex: number;
  private initialised = false;

  @Input("row") set rowValue(row: PageContentRow) {
    this.row = row;
    this.logger.info("row set:", row?.type, "committeeDocuments:", row?.committeeDocuments);
    if (this.initialised && row?.committeeDocuments) {
      this.applyRowData();
    }
  }

  get committeeDocumentsConfig(): CommitteeDocumentsData {
    return this.row?.committeeDocuments;
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.initialised = true;
    this.applyRowData();
    this.subscriptions.push(this.authService.authResponse().subscribe(() => this.loadFiles()));
    this.subscriptions.push(this.broadcastService.on(NamedEventType.REFRESH, () => {
      this.logger.info("REFRESH event received — reloading files");
      this.loadFiles();
    }));
  }

  private applyRowData(): void {
    this.pageTitle = this.pageService.pageSubtitle();
    this.imageSource = this.committeeDocumentsConfig?.imageSource;
    this.loadFiles();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private loadFiles(): void {
    this.logger.info("loadFiles:autoFromFirstActionButton:", this.committeeDocumentsConfig?.autoFromFirstActionButton, "fileIds:", this.committeeDocumentsConfig?.fileIds);
    if (this.committeeDocumentsConfig?.autoFromFirstActionButton) {
      this.loadFilesFromFirstActionButton();
    } else {
      this.loadFilesByIds(this.committeeDocumentsConfig?.fileIds);
    }
  }

  private loadFilesByIds(fileIds: string[]): void {
    if (fileIds?.length > 0) {
      const sortPrefix = this.committeeDocumentsConfig?.sortDirection === SortDirection.ASC ? "" : "-";
      this.committeeFileService.all({criteria: {_id: {$in: fileIds}}})
        .then(files => {
          this.committeeFiles = files
            .filter(file => this.display.committeeReferenceData?.isPublic(file.fileType)
              || this.memberLoginService.allowCommittee()
              || this.memberLoginService.allowFileAdmin())
            .sort(sortBy(`${sortPrefix}eventDate`));
          this.logger.info("loadFiles:loaded", this.committeeFiles.length, "visible files of", files.length, "total for", fileIds.length, "IDs");
        });
    } else {
      this.committeeFiles = [];
    }
  }

  private async loadFilesFromFirstActionButton(): Promise<void> {
    const currentPath = this.urlService.urlPath();
    this.logger.info("loadFilesFromFirstActionButton:currentPath:", currentPath);
    const childPages: PageContent[] = await this.pageContentService.all({
      criteria: {path: {$regex: `^${currentPath}/[^/]+$`}},
      sort: {path: -1}
    });
    this.logger.info("loadFilesFromFirstActionButton:found", childPages.length, "child pages");
    const targetPage = first(childPages);
    if (!targetPage?.rows) {
      this.logger.info("loadFilesFromFirstActionButton:no child pages found for:", currentPath);
      return;
    }
    this.pageTitle = last(targetPage.path.split("/"));
    this.logger.info("loadFilesFromFirstActionButton:using most recent child page:", targetPage.path);
    const committeeDocsRow = targetPage.rows.find(row => this.actions.isCommitteeDocuments(row));
    if (committeeDocsRow?.committeeDocuments) {
      if (committeeDocsRow.committeeDocuments.imageSource) {
        this.imageSource = committeeDocsRow.committeeDocuments.imageSource;
        this.logger.info("loadFilesFromFirstActionButton:resolved imageSource from target page:", this.imageSource);
      }
      if (committeeDocsRow.committeeDocuments.fileIds?.length > 0) {
        this.logger.info("loadFilesFromFirstActionButton:found", committeeDocsRow.committeeDocuments.fileIds.length, "file IDs from", targetPage.path);
        this.loadFilesByIds(committeeDocsRow.committeeDocuments.fileIds);
      }
    }
  }

  resolvedImageSource(): string {
    if (this.imageSource) {
      return this.urlService.imageSource(this.imageSource);
    }
    return this.urlService.imageSource(FALLBACK_MEDIA.url);
  }

  selectCommitteeFile(committeeFile: CommitteeFile) {
    if (this.display.confirm.noneOutstanding()) {
      this.selectedCommitteeFile = committeeFile;
    }
  }

  isActive(committeeFile: CommitteeFile): boolean {
    return committeeFile === this.selectedCommitteeFile;
  }

  isLast(committeeFile: CommitteeFile): boolean {
    return last(this.committeeFiles) === committeeFile;
  }

  addCommitteeFile() {
    this.display.confirm.as(ConfirmType.CREATE_NEW);
    this.editingFile = this.display.defaultCommitteeFile();
    this.editingFileIsNew = true;
  }

  editCommitteeFile(committeeFile: CommitteeFile) {
    this.editingFile = {...committeeFile, fileNameData: committeeFile.fileNameData ? {...committeeFile.fileNameData} : null};
    this.editingFileIsNew = false;
  }

  cancelEdit() {
    this.editingFile = null;
    this.editingFileIsNew = false;
    this.display.confirm.clear();
  }

  async onFileSaved(savedFile: CommitteeFile): Promise<void> {
    this.logger.info("onFileSaved:", savedFile);
    if (this.editingFileIsNew && savedFile?.id) {
      await this.addFileIdToPageContent(savedFile.id);
    }
    this.editingFile = null;
    this.editingFileIsNew = false;
    this.display.confirm.clear();
    this.loadFiles();
  }

  private async addFileIdToPageContent(fileId: string): Promise<void> {
    const pageContent = await this.resolveTargetPageContent();
    if (!pageContent) {
      this.logger.info("addFileIdToPageContent:no target page content found");
      return;
    }
    const committeeDocsRow = pageContent.rows?.find(row => this.actions.isCommitteeDocuments(row));
    if (committeeDocsRow?.committeeDocuments) {
      committeeDocsRow.committeeDocuments.fileIds = [...(committeeDocsRow.committeeDocuments.fileIds || []), fileId];
      await this.pageContentService.createOrUpdate(pageContent);
      this.logger.info("addFileIdToPageContent:added fileId:", fileId, "to page:", pageContent.path, "total fileIds:", committeeDocsRow.committeeDocuments.fileIds.length);
    }
  }

  private async resolveTargetPageContent(): Promise<PageContent> {
    const currentPath = this.urlService.urlPath();
    if (this.committeeDocumentsConfig?.autoFromFirstActionButton) {
      const childPages: PageContent[] = await this.pageContentService.all({
        criteria: {path: {$regex: `^${currentPath}/[^/]+$`}},
        sort: {path: -1}
      });
      const targetPage = first(childPages);
      if (targetPage) {
        this.logger.info("resolveTargetPageContent:auto-populate mode — resolved to child page:", targetPage.path);
        return targetPage;
      }
      this.logger.info("resolveTargetPageContent:auto-populate mode — no child pages found, falling back to current path:", currentPath);
    }
    return this.pageContentService.findByPath(currentPath);
  }

  confirmDeleteCommitteeFile(committeeFile: CommitteeFile) {
    this.display.confirmDeleteCommitteeFile(this.notify, committeeFile).then(() => {
      this.removeFileIdFromPageContent(committeeFile.id);
      this.loadFiles();
    });
  }

  private async removeFileIdFromPageContent(fileId: string): Promise<void> {
    const pageContent = await this.resolveTargetPageContent();
    if (!pageContent) {
      return;
    }
    const committeeDocsRow = pageContent.rows?.find(row => this.actions.isCommitteeDocuments(row));
    if (committeeDocsRow?.committeeDocuments?.fileIds) {
      committeeDocsRow.committeeDocuments.fileIds = committeeDocsRow.committeeDocuments.fileIds.filter(id => id !== fileId);
      await this.pageContentService.createOrUpdate(pageContent);
      this.logger.info("removeFileIdFromPageContent:removed fileId:", fileId, "from page:", pageContent.path);
    }
  }

  sendNotification(committeeFile: CommitteeFile) {
    this.urlService.navigateTo([this.urlService.area(), PathSegment.SEND_NOTIFICATION, committeeFile.id]);
  }

  deleteCommitteeFile() {
    this.display.confirm.as(ConfirmType.DELETE);
  }
}
