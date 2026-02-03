import { Component, EventEmitter, inject, OnDestroy, OnInit, Output } from "@angular/core";
import { faCheck, faCloudDownloadAlt, faEye, faSpinner, faTimes, faImage, faImages } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../../../services/logger-factory.service";
import { BadgeButtonComponent } from "../../../../../modules/common/badge-button/badge-button";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { AlertInstance, NotifierService } from "../../../../../services/notifier.service";
import { AlertTarget } from "../../../../../models/alert-target.model";
import { WebSocketClientService } from "../../../../../services/websockets/websocket-client.service";
import { EventType, MessageType } from "../../../../../models/websocket.model";
import { DateUtilsService } from "../../../../../services/date-utils.service";
import { DisplayTimeWithSecondsPipe } from "../../../../../pipes/display-time.pipe-with-seconds";
import { StatusIconComponent } from "../../../status-icon";
import {
  ExternalAlbumCreationMode,
  ExternalAlbumImportMode,
  ExternalAlbumImportResult,
  ExternalAlbumMetadata,
  ExternalAlbumSource,
  ExternalAlbumSummary,
  ExternalSourceOption,
  ExternalPhoto,
  ExternalUserAlbumsMetadata,
  ImageMigrationActivityLog,
  SplitAlbumPreviewEntry
} from "../../../../../models/system.model";
import { NgSelectComponent } from "@ng-select/ng-select";
import { StringUtilsService } from "../../../../../services/string-utils.service";
import { MemberLoginService } from "../../../../../services/member/member-login.service";
import { SectionToggle, SectionToggleTab } from "../../../../../shared/components/section-toggle";
import { TemplateSelectEvent, TemplateSelectorComponent } from "../../../../../modules/common/dynamic-content/template-selector";
import { PageContent } from "../../../../../models/content-text.model";
import { MarkdownEditorComponent } from "../../../../../markdown-editor/markdown-editor.component";
import { ExternalAlbumGroupComponent } from "./external-album-group";
import { UrlService } from "../../../../../services/url.service";
import { groupBy } from "es-toolkit/compat";

@Component({
  selector: "app-external-album-import",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row px-3 pt-3 pb-2">
        <div class="col-sm-12">
          <app-section-toggle
            [tabs]="importModeTabs"
            [(selectedTab)]="importMode"
            queryParamKey="import-mode">
          </app-section-toggle>
        </div>
      </div>

      <div class="row px-3 pb-3">
        <div class="col-sm-3">
          <label for="source-select">Source</label>
          <ng-select id="source-select"
                     [items]="sourceOptions"
                     [(ngModel)]="selectedSource"
                     bindLabel="label"
                     [clearable]="false"
                     dropdownPosition="bottom"
                     placeholder="Select source">
          </ng-select>
        </div>
      </div>

      <div class="row px-3 pb-3">
        <div class="col-sm-12">
          @if (importMode === ExternalAlbumImportMode.SINGLE) {
            <app-markdown-editor standalone name="external-album-import-single-help" category="admin" description="Single album import help"/>
          } @else {
            <app-markdown-editor standalone name="external-album-import-bulk-help" category="admin" description="Bulk album import help"/>
          }
        </div>
      </div>

      <div class="row px-3 pb-3">
        <div class="col-sm-6">
          <label for="album-url">{{ importMode === ExternalAlbumImportMode.SINGLE ? "Album URL" : "User Albums URL" }}</label>
          <input type="text"
                 class="form-control"
                 id="album-url"
                 [(ngModel)]="albumUrl"
                 [placeholder]="importMode === ExternalAlbumImportMode.SINGLE ? selectedSource?.singleAlbumPlaceholder : selectedSource?.bulkAlbumsPlaceholder">
        </div>
        <div class="col-sm-3 d-flex align-items-end">
          <app-badge-button [icon]="fetching ? faSpinner : faEye"
                            [disabled]="!albumUrl || fetching"
                            (click)="fetchPreview()"
                            caption="Fetch Preview"/>
        </div>
      </div>
      @if (importMode === ExternalAlbumImportMode.SINGLE && albumMetadata) {
        <div class="row px-3 pb-3">
          <div class="col-sm-12">
            <label class="d-block mb-2">Album Creation Mode</label>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="creationMode" id="defaultMode"
                     [value]="ExternalAlbumCreationMode.DEFAULT" [(ngModel)]="creationMode">
              <label class="form-check-label" for="defaultMode">Create album with default layout</label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="creationMode" id="templateMode"
                     [value]="ExternalAlbumCreationMode.TEMPLATE" [(ngModel)]="creationMode">
              <label class="form-check-label" for="templateMode">Create album from template</label>
            </div>
            <div class="form-check mt-2">
              <input class="form-check-input" type="checkbox" id="split-by-title"
                     [(ngModel)]="splitByPhotoTitle"
                     (ngModelChange)="updateSplitPreview()">
              <label class="form-check-label" for="split-by-title">Split album by photo title</label>
              <small class="form-text text-muted d-block">Creates separate album pages per repeating title and links them from the main path.</small>
            </div>
            @if (creationMode === ExternalAlbumCreationMode.TEMPLATE) {
              <div class="mt-2 ms-4">
                <app-template-selector [showActionButtons]="false" (selectionChanged)="onTemplateSelectionChanged($event)"/>
              </div>
            }
          </div>
        </div>

        @if (!splitByPhotoTitle) {
          <div class="row px-3 pb-3">
            <div class="col-sm-12">
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <span>Album Preview: <strong>{{ albumMetadata.title }}</strong></span>
                  <span class="badge bg-primary">{{ stringUtils.pluraliseWithCount(albumMetadata.photoCount, "photo") }}</span>
                </div>
                <div class="card-body">
                  @if (albumMetadata.description) {
                    <p class="text-muted mb-3">{{ albumMetadata.description }}</p>
                  }
                  <div class="d-flex flex-wrap gap-2 mb-3">
                    @for (photo of previewPhotos; track photo.id) {
                      <div class="preview-thumbnail">
                        <img [src]="photo.thumbnailUrl" [alt]="photo.title" [title]="photo.title">
                      </div>
                    }
                    @if (albumMetadata.photoCount > previewPhotos.length) {
                      <div class="preview-more d-flex align-items-center justify-content-center">
                        +{{ albumMetadata.photoCount - previewPhotos.length }} more
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        } @else if (splitPreview.length > 0) {
          <div class="row px-3 pb-3">
            <div class="col-sm-12">
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <span>Split Preview</span>
                  <span class="badge bg-secondary">{{ splitPreview.length }} sections</span>
                </div>
                <div class="card-body">
                  <div class="split-preview-list">
                    @for (item of splitPreview; track item.path) {
                      <div class="split-preview-item">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                          <div class="d-flex align-items-center gap-2 text-truncate">
                            <input class="form-check-input" type="checkbox"
                                   [(ngModel)]="item.included"
                                   (ngModelChange)="updateSplitSelection()">
                            <div class="text-truncate">
                              <strong>{{ item.title }}</strong>
                              <span class="text-muted ms-2">→ {{ item.path }}</span>
                            </div>
                          </div>
                          <span class="badge bg-warning text-dark">{{ item.count }} photos</span>
                        </div>
                        <div class="d-flex flex-wrap gap-2 mb-2">
                          @for (photo of item.previewPhotos || []; track photo.id) {
                            <div class="preview-thumbnail">
                              <img [src]="photo.thumbnailUrl" [alt]="photo.title" [title]="photo.title">
                            </div>
                          }
                          @if (item.count > (item.previewPhotos?.length || 0)) {
                            <div class="preview-more d-flex align-items-center justify-content-center">
                              +{{ item.count - (item.previewPhotos?.length || 0) }} more
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        }

        <div class="row px-3 pb-3 align-items-end">
          <div class="col-sm-4">
            <div class="form-group mb-0">
              <label for="target-path">Target Path</label>
              <input type="text"
                     class="form-control"
                     id="target-path"
                     [(ngModel)]="targetPath"
                     (ngModelChange)="onTargetPathChange()"
                     placeholder="e.g., gallery/2024/summer-walk">
            </div>
          </div>
          <div class="col-sm-4">
            <div class="form-group mb-0">
              <label for="album-title">Album Title</label>
              <input type="text"
                     class="form-control"
                     id="album-title"
                     [(ngModel)]="albumTitle"
                     [placeholder]="albumMetadata.title">
            </div>
          </div>
          <div class="col-sm-4">
            <div class="form-group mb-0">
              <label for="album-subtitle">Subtitle (optional)</label>
              <input type="text"
                     class="form-control"
                     id="album-subtitle"
                     [(ngModel)]="albumSubtitle"
                     placeholder="Optional subtitle">
            </div>
          </div>
        </div>

        <div class="row px-3 pb-3">
          <div class="col-sm-12">
            <app-badge-button [icon]="importing ? faSpinner : faImport"
                              [disabled]="!targetPath || importing"
                              (click)="runSingleImport()"
                              [caption]="'Import ' + stringUtils.pluraliseWithCount(albumMetadata.photoCount, 'Photo')"/>
          </div>
        </div>
      }

      @if (importMode === ExternalAlbumImportMode.BULK && userAlbumsMetadata) {
        <div class="row px-3 pb-3">
          <div class="col-sm-12">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <strong>Albums for user: {{ userAlbumsMetadata.username }}</strong>
                <span class="badge bg-warning text-dark ms-2">{{ selectedAlbumsCount() }} of {{ userAlbumsMetadata.totalAlbums }} selected</span>
              </div>
              <div>
                <app-badge-button [icon]="faCheck" (click)="selectAllAlbums()" caption="Select All" class="me-2"/>
                <app-badge-button [icon]="faTimes" (click)="deselectAllAlbums()" caption="Deselect All"/>
              </div>
            </div>
            <div class="row mb-3">
              <div class="col-sm-6">
                <label for="base-path">Base Path</label>
                <input type="text"
                       class="form-control"
                       id="base-path"
                       [(ngModel)]="basePath"
                       (ngModelChange)="onBasePathChange()"
                       placeholder="e.g., gallery">
                <small class="form-text text-muted">Albums will be created at base-path/album-name</small>
              </div>
              <div class="col-sm-6">
                <label class="d-block mb-2">Album Creation Mode</label>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="bulkCreationMode" id="bulkDefaultMode"
                         [value]="ExternalAlbumCreationMode.DEFAULT" [(ngModel)]="creationMode">
                  <label class="form-check-label" for="bulkDefaultMode">Create albums with default layout</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="bulkCreationMode" id="bulkTemplateMode"
                         [value]="ExternalAlbumCreationMode.TEMPLATE" [(ngModel)]="creationMode">
                  <label class="form-check-label" for="bulkTemplateMode">Create albums from template</label>
                </div>
                <div class="form-check mt-2">
                  <input class="form-check-input" type="checkbox" id="bulk-split-by-title"
                         [(ngModel)]="splitByPhotoTitle"
                         (ngModelChange)="onBulkSplitToggle()">
                  <label class="form-check-label" for="bulk-split-by-title">Split albums by photo title</label>
                  <small class="form-text text-muted d-block">Each selected album will become an index page with sub-albums under its target path.</small>
                </div>
                @if (creationMode === ExternalAlbumCreationMode.TEMPLATE) {
                  <div class="mt-2">
                    <app-template-selector [showActionButtons]="false" (selectionChanged)="onTemplateSelectionChanged($event)"/>
                  </div>
                }
              </div>
            </div>
            <div class="album-accordion">
              @for (album of userAlbumsMetadata.albums; track album.id) {
                <app-external-album-group
                  [album]="album"
                  [editableTargetPath]="true"
                  [splitByPhotoTitle]="splitByPhotoTitle"
                  (albumChanged)="onAlbumChanged($event)"
                  (splitPreviewRequested)="onSplitPreviewRequested($event)"/>
              }
            </div>
          </div>
        </div>

        <div class="row px-3 pb-3">
          <div class="col-sm-12">
            <app-badge-button [icon]="importing ? faSpinner : faImport"
                              [disabled]="selectedAlbumsCount() === 0 || importing"
                              (click)="runBulkImport()"
                              [caption]="'Import ' + stringUtils.pluraliseWithCount(selectedAlbumsCount(), 'Selected Album')"/>
          </div>
        </div>
      }

      @if (activityTarget.showAlert) {
        <div class="row px-3 pb-3">
          <div class="col-sm-12">
            <div class="alert mb-0 {{activityTarget.alert.class}}">
              <fa-icon [icon]="activityTarget.alert.icon"></fa-icon>
              @if (activityTarget.alertTitle) {
                <strong class="ms-2">{{ activityTarget.alertTitle }}: </strong>
              } {{ activityTarget.alertMessage }}
            </div>
          </div>
        </div>
      }

      @if (importResult?.success) {
        <div class="row px-3 pb-3">
          <div class="col-sm-12">
            <div class="alert alert-success mb-0">
              <strong>Import Complete!</strong> Album created at
              <a [href]="'/' + urlService.reformatLocalHref(importResult.pageContentPath)" target="_blank">
                {{ urlService.reformatLocalHref(importResult.pageContentPath) }}
              </a>
              with {{ importResult.photoCount }} photos.
            </div>
          </div>
        </div>
      }

      @if (logs.length > 0) {
        <div class="row px-3 pb-3">
          <div class="col-sm-12">
            <div class="audit-table-scroll">
              <table class="round styled-table table-striped table-hover table-sm">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Time</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  @for (log of logs; track log.id) {
                    <tr>
                      <td><app-status-icon noLabel [status]="log.status"/></td>
                      <td class="nowrap">{{ log.time | displayTimeWithSeconds }}</td>
                      <td class="text-break">{{ log.message }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .preview-thumbnail
      width: 80px
      height: 80px
      overflow: hidden
      border-radius: 4px
      border: 1px solid #dee2e6

      img
        width: 100%
        height: 100%
        object-fit: cover

    .preview-more
      width: 80px
      height: 80px
      border-radius: 4px
      border: 1px solid #dee2e6
      background-color: #f8f9fa
      color: #6c757d
      font-size: 0.875rem

    .album-accordion
      border: 1px solid #dee2e6
      border-radius: 6px
      overflow: hidden
      max-height: 400px
      overflow-y: auto

    .album-accordion app-external-album-group
      display: block
      border-bottom: 1px solid #dee2e6

    .album-accordion app-external-album-group:last-child
      border-bottom: none

    .audit-table-scroll
      position: relative
      max-height: 300px
      overflow-y: auto
      overflow-x: hidden

      table
        margin-bottom: 0
        width: 100%

      thead
        position: sticky
        top: 0
        z-index: 20
        background-clip: padding-box

        th
          position: sticky
          top: 0
          z-index: 20
          box-shadow: 0 1px 0 rgba(0,0,0,0.05)

    .split-preview-list
      display: flex
      flex-direction: column
      gap: 8px

    .split-preview-item
      padding: 8px 12px
      border: 1px solid #dee2e6
      border-radius: 6px
      background-color: #ffffff

    .split-preview-item .form-check-input
      margin-top: 0
      margin-left: 2px
  `],
  imports: [
    BadgeButtonComponent,
    FontAwesomeModule,
    FormsModule,
    DisplayTimeWithSecondsPipe,
    StatusIconComponent,
    NgSelectComponent,
    SectionToggle,
    TemplateSelectorComponent,
    MarkdownEditorComponent,
    ExternalAlbumGroupComponent
  ]
})
export class ExternalAlbumImportComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("ExternalAlbumImportComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private webSocketClientService = inject(WebSocketClientService);
  private dateUtils = inject(DateUtilsService);
  private memberLoginService = inject(MemberLoginService);
  protected stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);
  private subscriptions: Subscription[] = [];

  @Output() importComplete = new EventEmitter<ExternalAlbumImportResult>();

  protected readonly faEye = faEye;
  protected readonly faImport = faCloudDownloadAlt;
  protected readonly faSpinner = faSpinner;
  protected readonly faCheck = faCheck;
  protected readonly faTimes = faTimes;
  protected readonly faImage = faImage;
  protected readonly faImages = faImages;
  protected readonly ExternalAlbumImportMode = ExternalAlbumImportMode;

  sourceOptions: ExternalSourceOption[] = [
    {
      value: ExternalAlbumSource.FLICKR,
      label: "Flickr",
      singleAlbumPlaceholder: "https://www.flickr.com/photos/username/albums/123456",
      bulkAlbumsPlaceholder: "https://www.flickr.com/people/username or /photos/username/albums"
    }
  ];

  importModeTabs: SectionToggleTab[] = [
    { value: ExternalAlbumImportMode.SINGLE, label: "Single Album", icon: this.faImage },
    { value: ExternalAlbumImportMode.BULK, label: "Bulk Import (User Albums)", icon: this.faImages }
  ];

  selectedSource: ExternalSourceOption = this.sourceOptions[0];
  importMode: ExternalAlbumImportMode = ExternalAlbumImportMode.SINGLE;
  albumUrl = "";
  basePath = "gallery";
  targetPath = "";
  albumTitle = "";
  albumSubtitle = "";
  splitByPhotoTitle = false;

  fetching = false;
  importing = false;
  albumMetadata: ExternalAlbumMetadata | null = null;
  userAlbumsMetadata: ExternalUserAlbumsMetadata | null = null;
  importResult: ExternalAlbumImportResult | null = null;
  bulkImportResult: { successCount: number; failureCount: number } | null = null;

  activityTarget: AlertTarget = {};
  activityNotifier: AlertInstance;
  logs: ImageMigrationActivityLog[] = [];
  selectedTemplate: PageContent | null = null;
  creationMode: ExternalAlbumCreationMode = ExternalAlbumCreationMode.DEFAULT;
  protected readonly ExternalAlbumCreationMode = ExternalAlbumCreationMode;

  previewPhotos: { id: string; thumbnailUrl: string; title: string }[] = [];
  splitPreview: SplitAlbumPreviewEntry[] = [];

  ngOnInit(): void {
    this.activityNotifier = this.notifierService.createAlertInstance(this.activityTarget);

    this.webSocketClientService.connect().then(() => {
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.PROGRESS).subscribe((data: any) => {
          const message = data?.message || JSON.stringify(data);
          this.addLog("info", message);
          this.activityNotifier.warning(message);
        })
      );
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.ERROR).subscribe((error: any) => {
          const message = error?.message || JSON.stringify(error);
          if (error?.context === "split-preview" && error?.albumId) {
            this.updateAlbumSplitPreviewState(error.albumId, null, false, message);
          } else {
            this.addLog("error", message);
            this.activityNotifier.error({ title: "Error", message });
            this.fetching = false;
            this.importing = false;
          }
        })
      );
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.COMPLETE).subscribe((data: any) => {
          const message = data?.message || JSON.stringify(data);
          this.addLog("complete", message);
          this.activityNotifier.success({ title: "Complete", message });

          if (data?.splitPreview && data?.albumId) {
            this.updateAlbumSplitPreviewState(data.albumId, data.splitPreview, false, "");
          } else if (data?.albumMetadata) {
            this.albumMetadata = data.albumMetadata;
            this.previewPhotos = this.albumMetadata.photos.slice(0, 12).map(p => ({
              id: p.id,
              thumbnailUrl: p.thumbnailUrl,
              title: p.title
            }));
            this.albumTitle = this.albumMetadata.title;
            this.suggestTargetPath();
            this.updateSplitPreview();
            this.fetching = false;
          } else if (data?.userAlbumsMetadata) {
            this.userAlbumsMetadata = data.userAlbumsMetadata;
            this.userAlbumsMetadata.albums.forEach(album => {
              album.selected = false;
              album.targetPath = `${this.basePath}/${this.stringUtils.kebabCase(album.title)}`;
            });
            this.fetching = false;
          } else if (data?.importResult) {
            this.importResult = data.importResult;
            this.importing = false;
            this.importComplete.emit(this.importResult);
          } else if (data?.bulkImportResult) {
            this.bulkImportResult = data.bulkImportResult;
            this.importing = false;
          }
        })
      );
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  fetchPreview(): void {
    if (!this.albumUrl || this.fetching) {
      return;
    }

    this.fetching = true;
    this.albumMetadata = null;
    this.userAlbumsMetadata = null;
    this.importResult = null;
    this.bulkImportResult = null;
    this.previewPhotos = [];
    this.logs = [];

    if (this.importMode === ExternalAlbumImportMode.SINGLE) {
      this.addLog("info", `Fetching album from ${this.albumUrl}`);
      this.webSocketClientService.sendMessage(EventType.EXTERNAL_ALBUM_FETCH, {
        albumUrl: this.albumUrl,
        source: this.selectedSource?.value
      });
    } else {
      this.addLog("info", `Fetching user albums from ${this.albumUrl}`);
      this.webSocketClientService.sendMessage(EventType.EXTERNAL_USER_ALBUMS_FETCH, {
        userAlbumsUrl: this.albumUrl,
        source: this.selectedSource?.value
      });
    }
  }

  runSingleImport(): void {
    if (!this.targetPath || !this.albumMetadata || this.importing) {
      return;
    }

    this.importing = true;
    this.importResult = null;
    this.addLog("info", `Starting import to ${this.targetPath}`);

    const createdBy = this.memberLoginService.loggedInMember()?.memberId || "unknown";

    this.webSocketClientService.sendMessage(EventType.EXTERNAL_ALBUM_IMPORT, {
      source: this.selectedSource?.value,
      albumUrl: this.albumUrl,
      targetPath: this.targetPath,
      albumTitle: this.albumTitle || this.albumMetadata.title,
      albumSubtitle: this.albumSubtitle,
      splitByPhotoTitle: this.splitByPhotoTitle,
      splitAlbumPaths: this.selectedSplitPaths(),
      albumMetadata: this.albumMetadata,
      createdBy
    });
  }

  runBulkImport(): void {
    if (!this.userAlbumsMetadata || this.selectedAlbumsCount() === 0 || this.importing) {
      return;
    }

    this.importing = true;
    this.bulkImportResult = null;
    this.addLog("info", `Starting bulk import of ${this.selectedAlbumsCount()} albums`);

    const createdBy = this.memberLoginService.loggedInMember()?.memberId || "unknown";

    this.webSocketClientService.sendMessage(EventType.EXTERNAL_BULK_ALBUM_IMPORT, {
      source: this.selectedSource?.value,
      userId: this.userAlbumsMetadata.userId,
      basePath: this.basePath,
      albums: this.userAlbumsMetadata.albums,
      createdBy,
      useTemplate: this.creationMode === ExternalAlbumCreationMode.TEMPLATE,
      templatePath: this.selectedTemplate?.path,
      splitByPhotoTitle: this.splitByPhotoTitle
    });
  }

  selectAllAlbums(): void {
    if (this.userAlbumsMetadata) {
      this.userAlbumsMetadata.albums.forEach(album => {
        album.selected = true;
        this.updateAlbumTargetPath(album);
      });
    }
  }

  deselectAllAlbums(): void {
    if (this.userAlbumsMetadata) {
      this.userAlbumsMetadata.albums.forEach(album => {
        album.selected = false;
      });
    }
  }

  selectedAlbumsCount(): number {
    if (!this.userAlbumsMetadata) {
      return 0;
    }
    return this.userAlbumsMetadata.albums.filter(a => a.selected).length;
  }

  updateAlbumTargetPath(album: ExternalAlbumSummary): void {
    if (album.selected) {
      album.targetPath = `${this.basePath}/${this.stringUtils.kebabCase(album.title)}`;
    }
  }

  onBasePathChange(): void {
    this.basePath = this.normalisePathInput(this.basePath);
    if (this.userAlbumsMetadata) {
      this.userAlbumsMetadata.albums.forEach(album => {
        if (album.selected) {
          album.targetPath = `${this.basePath}/${this.stringUtils.kebabCase(album.title)}`;
        }
      });
    }
  }

  onAlbumChanged(album: ExternalAlbumSummary): void {
    if (album.selected && !album.targetPath) {
      album.targetPath = `${this.basePath}/${this.stringUtils.kebabCase(album.title)}`;
    }
    this.logger.debug("Album changed:", album.title, "selected:", album.selected);
  }

  onSplitPreviewRequested(album: ExternalAlbumSummary): void {
    if (!this.userAlbumsMetadata?.userId) {
      this.updateAlbumSplitPreviewState(album.id, null, false, "User ID unavailable for preview");
    } else if (!album.targetPath) {
      this.updateAlbumSplitPreviewState(album.id, null, false, "Target path is required for preview");
    } else {
      this.updateAlbumSplitPreviewState(album.id, null, true, "");
      this.webSocketClientService.sendMessage(EventType.EXTERNAL_ALBUM_SPLIT_PREVIEW, {
        source: this.selectedSource?.value,
        userId: this.userAlbumsMetadata.userId,
        albumId: album.id,
        targetPath: album.targetPath
      });
    }
  }

  onBulkSplitToggle(): void {
    if (this.splitByPhotoTitle) {
    } else if (!this.userAlbumsMetadata) {
    } else {
      this.userAlbumsMetadata.albums.forEach(album => {
        album.splitPreview = [];
        album.splitPreviewLoading = false;
        album.splitPreviewError = "";
        album.splitAlbumPaths = [];
      });
    }
  }

  onTargetPathChange(): void {
    this.targetPath = this.normalisePathInput(this.targetPath);
    this.updateSplitPreview();
  }

  onTemplateSelected(event: TemplateSelectEvent): void {
    this.selectedTemplate = event.template;
    this.addLog("info", `Template selected: ${event.template.path}`);
  }

  onTemplateSelectionChanged(template: PageContent | null): void {
    this.selectedTemplate = template;
    if (template) {
      this.addLog("info", `Template selected: ${template.path}`);
    }
  }

  private suggestTargetPath(): void {
    if (!this.targetPath && this.albumMetadata) {
      this.targetPath = `gallery/${this.stringUtils.kebabCase(this.albumMetadata.title)}`;
    }
  }

  updateSplitPreview(): void {
    if (!this.splitByPhotoTitle || !this.albumMetadata) {
      this.splitPreview = [];
    } else if (!this.targetPath) {
      this.targetPath = this.normalisePathInput(`gallery/${this.stringUtils.kebabCase(this.albumMetadata.title)}`);
      const existingIncluded = this.existingSplitSelections();
      this.splitPreview = this.buildSplitPreview(this.targetPath, existingIncluded);
    } else {
      const existingIncluded = this.existingSplitSelections();
      this.splitPreview = this.buildSplitPreview(this.targetPath, existingIncluded);
    }
  }

  updateSplitSelection(): void {
    this.splitPreview = this.splitPreview.map(entry => ({
      ...entry,
      included: entry.included !== false
    }));
  }

  private normalisePathInput(value: string): string {
    const raw = value || "";
    const reformatted = this.urlService.reformatLocalHref(raw);
    if (reformatted && reformatted.startsWith("/")) {
      return reformatted.replace(/^\/+/, "");
    } else {
      return reformatted;
    }
  }

  private existingSplitSelections(): Record<string, boolean> {
    return this.splitPreview.reduce((acc, entry) => {
      return { ...acc, [entry.title]: entry.included };
    }, {} as Record<string, boolean>);
  }

  private buildSplitPreview(basePath: string, existingIncluded: Record<string, boolean>): SplitAlbumPreviewEntry[] {
    if (!this.albumMetadata) {
      return [];
    }
    const grouped = groupBy(this.albumMetadata.photos, photo => (photo.title || "").trim() || "Untitled");
    const order = this.albumMetadata.photos.reduce((acc, photo) => {
      const title = (photo.title || "").trim() || "Untitled";
      return acc.includes(title) ? acc : acc.concat(title);
    }, [] as string[]);

    const initial = { paths: [] as string[], previews: [] as SplitAlbumPreviewEntry[] };
    const result = order.reduce((acc, title) => {
      const slug = this.stringUtils.kebabCase(title);
      const base = slug ? `${basePath}/${slug}` : `${basePath}/untitled`;
      const matching = acc.paths.filter(path => path === base || path.startsWith(`${base}-`)).length;
      const path = matching > 0 ? `${base}-${matching + 1}` : base;
      const nextPreview: SplitAlbumPreviewEntry = {
        title,
        count: grouped[title]?.length || 0,
        path,
        included: existingIncluded[title] !== false,
        previewPhotos: (grouped[title] || []).slice(0, 12)
      };
      return {
        paths: acc.paths.concat(path),
        previews: acc.previews.concat(nextPreview)
      };
    }, initial);

    return result.previews;
  }

  private updateAlbumSplitPreviewState(albumId: string, splitPreview: SplitAlbumPreviewEntry[] | null, loading: boolean, errorMessage: string): void {
    if (!this.userAlbumsMetadata) {
    } else {
      const album = this.userAlbumsMetadata.albums.find(item => item.id === albumId);
      if (!album) {
      } else {
        album.splitPreviewLoading = loading;
        album.splitPreviewError = errorMessage;
        if (splitPreview) {
          const updatedPreview = splitPreview.map(entry => ({ ...entry, included: entry.included !== false }));
          album.splitPreview = updatedPreview;
          album.splitAlbumPaths = updatedPreview.filter(entry => entry.included).map(entry => entry.path);
        } else if (!loading && errorMessage) {
          album.splitPreview = [];
          album.splitAlbumPaths = [];
        }
      }
    }
  }

  private selectedSplitPaths(): string[] | undefined {
    if (!this.splitByPhotoTitle) {
      return undefined;
    }
    const included = this.splitPreview.filter(entry => entry.included).map(entry => entry.path);
    return included.length > 0 ? included : [];
  }

  private addLog(status: string, message: string): void {
    const now = this.dateUtils.dateTimeNowAsValue();
    this.logs = [{
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      status,
      time: now,
      message
    }, ...this.logs];
  }
}
