import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeDocumentsData, PageContentRow } from "../../../models/content-text.model";
import { SortDirection } from "../../../models/sort.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent } from "@ng-select/ng-select";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { CommitteeDocumentsRow } from "../committee-documents/committee-documents-row";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { CommitteeDisplayService } from "../../../pages/committee/committee-display.service";
import { CommitteeFile } from "../../../models/committee.model";
import { sortBy } from "../../../functions/arrays";
import { ImageActionsDropdownComponent } from "./image-actions-dropdown";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { AwsFileData } from "../../../models/aws-object.model";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-dynamic-content-site-edit-committee-documents",
  styleUrls: ["./dynamic-content.sass"],
  template: `
    @if (row?.committeeDocuments) {
      <div class="row align-items-end mb-3 d-flex">
        <div class="col-md-9">
          <div class="form-group">
            <label [for]="'file-select-' + id">Committee Files
              ({{ row.committeeDocuments.fileIds?.length || 0 }} selected)
            </label>
            <ng-select [id]="'file-select-' + id"
                       [items]="availableFiles"
                       [multiple]="true"
                       [searchable]="true"
                       [clearable]="true"
                       dropdownPosition="bottom"
                       bindLabel="label"
                       bindValue="id"
                       placeholder="Select committee files to display..."
                       (ngModelChange)="fileIdsChanged($event)"
                       [ngModel]="row.committeeDocuments.fileIds">
            </ng-select>
          </div>
        </div>
        <div class="col-md-3">
          <div class="form-group">
            <label [for]="'sort-direction-' + id">Sort Order</label>
            <ng-select [id]="'sort-direction-' + id"
                       [items]="sortDirectionValues"
                       bindLabel="title"
                       bindValue="value"
                       [searchable]="false"
                       [clearable]="false"
                       [(ngModel)]="row.committeeDocuments.sortDirection"
                       (ngModelChange)="broadcastChange()">
            </ng-select>
          </div>
        </div>
      </div>
      @if (!row.committeeDocuments.autoFromFirstActionButton) {
        <div class="row align-items-end mb-3 d-flex">
          <div class="col-auto">
            <app-image-actions-dropdown [fullWidth]="false" [hasImage]="!!row.committeeDocuments.imageSource"
                                        (edit)="editImageActive = true"
                                        (replace)="replaceImage()"
                                        (remove)="removeImage()"/>
          </div>
          <div class="col">
            <div class="form-group mb-0">
              <label [for]="'image-source-' + id">Image Source</label>
              <input [(ngModel)]="row.committeeDocuments.imageSource"
                     (ngModelChange)="broadcastChange()"
                     [id]="'image-source-' + id"
                     type="text" class="form-control"
                     placeholder="Path to image e.g. site-content/image.jpg"/>
            </div>
          </div>
        </div>
        @if (editImageActive) {
          <div class="mt-2 mb-3">
            <app-image-cropper-and-resizer
              (quit)="editImageActive = false"
              (imageChange)="imageChanged($event)"
              (apply)="editImageActive = false"
              (save)="imageSaved($event)"
              [preloadImage]="resolvedImageSource()"
              nonDestructive
              wrapButtons/>
          </div>
        }
      }
      <div class="row align-items-end mb-3 d-flex">
        <div class="col-auto">
          <div class="form-check form-check-inline mb-0">
            <input [(ngModel)]="row.committeeDocuments.showFileActions"
                   (ngModelChange)="broadcastChange()"
                   type="checkbox" class="form-check-input"
                   [id]="'show-file-actions-' + id">
            <label class="form-check-label"
                   [for]="'show-file-actions-' + id">Show File Actions
            </label>
          </div>
        </div>
        <div class="col-auto">
          <div class="form-check form-check-inline mb-0">
            <input [(ngModel)]="row.committeeDocuments.autoFromFirstActionButton"
                   (ngModelChange)="broadcastChange()"
                   type="checkbox" class="form-check-input"
                   [id]="'auto-from-first-action-button-' + id">
            <label class="form-check-label"
                   [for]="'auto-from-first-action-button-' + id">Auto Populate From First Action Button
            </label>
          </div>
        </div>
      </div>
    }
    <app-committee-documents-row [row]="row" [rowIndex]="rowIndex"/>`,
  imports: [FormsModule, NgSelectComponent, CommitteeDocumentsRow, ImageActionsDropdownComponent, ImageCropperAndResizerComponent]
})
export class DynamicContentSiteEditCommitteeDocuments implements OnInit {
  public actions: PageContentActionsService = inject(PageContentActionsService);
  private numberUtils: NumberUtilsService = inject(NumberUtilsService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private committeeFileService = inject(CommitteeFileService);
  private display = inject(CommitteeDisplayService);
  private urlService = inject(UrlService);
  protected logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditCommitteeDocuments", NgxLoggerLevel.ERROR);

  @Input() public row: PageContentRow;
  @Input() rowIndex: number;
  id: string;
  editImageActive = false;
  public availableFiles: { id: string; label: string }[] = [];
  sortDirectionValues: { value: SortDirection; title: string }[] = [
    {value: SortDirection.ASC, title: "Ascending"},
    {value: SortDirection.DESC, title: "Descending"}
  ];

  ngOnInit() {
    this.initialiseRowForCommitteeDocuments(this.row);
    this.id = this.numberUtils.generateUid();
    this.committeeFileService.all().then((files: CommitteeFile[]) => {
      this.availableFiles = files
        .sort(sortBy("-eventDate"))
        .map(file => ({
          id: file.id,
          label: `${file.fileType} - ${this.display.fileTitle(file)}`
        }));
      this.logger.info("availableFiles:", this.availableFiles.length);
    });
  }

  broadcastChange(): void {
    this.broadcastService.broadcast(NamedEvent.named(NamedEventType.REFRESH));
  }

  fileIdsChanged(fileIds: string[]) {
    this.row.committeeDocuments.fileIds = fileIds;
    this.broadcastChange();
  }

  resolvedImageSource(): string {
    return this.row.committeeDocuments?.imageSource
      ? this.urlService.imageSource(this.row.committeeDocuments.imageSource)
      : null;
  }

  removeImage(): void {
    this.row.committeeDocuments.imageSource = null;
    this.broadcastChange();
  }

  replaceImage(): void {
    this.row.committeeDocuments.imageSource = null;
    this.editImageActive = true;
  }

  imageChanged(awsFileData: AwsFileData): void {
    this.row.committeeDocuments.imageSource = awsFileData.image;
    this.broadcastChange();
  }

  imageSaved(awsFileData: AwsFileData): void {
    this.row.committeeDocuments.imageSource = awsFileData.awsFileName;
    this.editImageActive = false;
    this.broadcastChange();
  }

  private initialiseRowForCommitteeDocuments(row: PageContentRow) {
    if (!row?.committeeDocuments) {
      const committeeDocuments: CommitteeDocumentsData = {
        fileIds: [],
        autoFromFirstActionButton: false,
        showFileActions: true,
        sortDirection: SortDirection.DESC
      };
      this.logger.info("initialiseRowForCommitteeDocuments:", committeeDocuments);
      row.committeeDocuments = committeeDocuments;
    }
  }
}
