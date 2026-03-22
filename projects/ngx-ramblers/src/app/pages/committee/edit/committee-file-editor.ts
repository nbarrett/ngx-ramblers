import { HttpErrorResponse } from "@angular/common/http";
import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgClass, NgStyle } from "@angular/common";
import { first } from "es-toolkit/compat";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { CommitteeFile } from "../../../models/committee.model";
import { DateValue } from "../../../models/date.model";
import { AwsFileUploadResponseData } from "../../../models/aws-object.model";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { CommitteeDisplayService } from "../committee-display.service";
import { DatePicker } from "../../../date-and-time/date-picker";

@Component({
  selector: "app-committee-file-editor",
  template: `
    <div class="row mb-3">
      <div class="col-md-6">
        <app-date-picker startOfDay [label]="'File or Event Date'"
                         [size]="'md'"
                         (change)="eventDateChanged($event)"
                         [value]="eventDate">
        </app-date-picker>
      </div>
      <div class="col-md-6">
        <label for="fileType">File Type</label>
        <select [(ngModel)]="committeeFile.fileType" id="fileType" class="form-control input-md">
          @for (fileType of display.fileTypes(); track fileType) {
            <option [ngValue]="fileType.description"
                    [textContent]="fileType.description">
          }
        </select>
      </div>
    </div>
    <div class="row">
      <div class="col-md-6">
        <input type="submit" [disabled]="notifyTarget.busy"
               value="Browse for attachment"
               (click)="browseToFile(fileElement)"
               class="btn btn-primary w-100">
      </div>
      <div class="col-md-6">
        @if (committeeFile?.fileNameData) {
          <input [disabled]="notifyTarget.busy" type="submit"
                 value="Remove attachment" (click)="removeAttachment()"
                 class="btn btn-secondary w-100">
        }
        <input #fileElement class="d-none"
               type="file"
               ng2FileSelect (onFileSelected)="onFileSelect($event)" [uploader]="uploader">
      </div>
      <div class="col-md-12 mb-3">
        <div ng2FileDrop [ngClass]="{'file-over': hasFileOver}"
             (fileOver)="fileOver($event)"
             (onFileDrop)="fileDropped($event)"
             [uploader]="uploader"
             class="drop-zone">Or drop file here
        </div>
      </div>
      <div class="col-md-12 mb-3">
        @if (notifyTarget.busy) {
          <div class="progress">
            <div class="progress-bar" role="progressbar"
                 [ngStyle]="{ 'width': uploader.progress + '%' }">
              uploading {{ uploader.progress }}%
            </div>
          </div>
        }
      </div>
      @if (committeeFile?.fileNameData) {
        <div class="col-md-12">
          Originally uploaded as <span>{{ committeeFile.fileNameData.originalFileName }}</span>
        </div>
        <div class="col-md-12 mb-3">
          <label for="attachment">Display Title</label>
          <input [(ngModel)]="committeeFile.fileNameData.title"
                 [disabled]="notifyTarget.busy"
                 type="text"
                 id="attachment"
                 class="form-control input-md"
                 placeholder="Enter a title for this file">
        </div>
        <div class="col-md-12 mb-3">
          <label>Link Preview: <a target="_blank" [href]="display.fileUrl(committeeFile)">
            {{ display.fileTitle(committeeFile) }}</a>
          </label>
        </div>
      }
    </div>
    @if (showAlertMessage()) {
      <div class="alert {{notifyTarget.alert.class}} mb-3">
        <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
        @if (notifyTarget.alertTitle) {
          <strong>{{ notifyTarget.alertTitle }}: </strong>
        }
        {{ notifyTarget.alertMessage }}
      </div>
    }
    <div class="d-flex gap-2">
      <input type="submit" value="Save File"
             [disabled]="notifyTarget.busy"
             (click)="save()"
             class="btn btn-primary">
      <input type="submit" value="Cancel"
             [disabled]="notifyTarget.busy"
             (click)="cancelled.emit()"
             class="btn btn-secondary">
    </div>`,
  imports: [DatePicker, FormsModule, NgClass, FileUploadModule, NgStyle, FontAwesomeModule]
})
export class CommitteeFileEditor implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeFileEditor", NgxLoggerLevel.ERROR);
  private fileUploadService = inject(FileUploadService);
  display = inject(CommitteeDisplayService);
  private committeeFileService = inject(CommitteeFileService);
  private notifierService = inject(NotifierService);
  protected dateUtils = inject(DateUtilsService);
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public hasFileOver = false;
  public eventDate: DateValue;
  private existingTitle: string;
  public uploader: FileUploader;
  private subscriptions: Subscription[] = [];

  @Input() committeeFile: CommitteeFile;
  @Output() saved = new EventEmitter<CommitteeFile>();
  @Output() cancelled = new EventEmitter<void>();

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.eventDate = this.dateUtils.asDateValue(this.committeeFile?.eventDate);
    this.existingTitle = this.committeeFile?.fileNameData?.title;
    this.notify.hide();
    this.uploader = this.fileUploadService.createUploaderFor("committeeFiles");
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
      const awsFileUploadResponseData: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
      this.committeeFile.fileNameData = awsFileUploadResponseData.fileNameData;
      this.committeeFile.fileNameData.title = this.existingTitle;
      this.notify.success({title: "File uploaded", message: this.committeeFile.fileNameData.originalFileName});
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  save() {
    this.notify.setBusy();
    this.committeeFileService.createOrUpdate(this.committeeFile)
      .then(savedFile => {
        this.notify.clearBusy();
        this.saved.emit(savedFile);
      })
      .catch(errorResponse => {
        this.notify.error({
          title: "Save failed",
          message: errorResponse?.error?.message || errorResponse?.message || "An unexpected error occurred"
        });
        this.notify.clearBusy();
      });
  }

  showAlertMessage(): boolean {
    return this.notifyTarget.busy || this.notifyTarget.showAlert;
  }

  eventDateChanged(dateValue: DateValue) {
    if (dateValue) {
      this.committeeFile.eventDate = dateValue.value;
    }
  }

  browseToFile(fileElement: HTMLInputElement) {
    this.existingTitle = this.committeeFile?.fileNameData?.title;
    fileElement.click();
  }

  removeAttachment() {
    this.committeeFile.fileNameData = undefined;
  }

  onFileSelect($file: File[]) {
    this.notify.setBusy();
    this.notify.progress({title: "Attachment upload", message: `uploading ${first($file).name} - please wait...`});
  }

  fileOver(event: boolean): void {
    this.hasFileOver = event;
  }

  fileDropped($event: File[]) {
    this.logger.debug("fileDropped:", $event);
  }
}
