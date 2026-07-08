import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgClass, NgStyle } from "@angular/common";
import { first, isUndefined } from "es-toolkit/compat";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { CommitteeFile, CommitteeFileKind } from "../../../models/committee.model";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { DateValue } from "../../../models/date.model";
import { AwsFileUploadResponseData, CONVERTIBLE_DOCUMENT_EXTENSIONS } from "../../../models/aws-object.model";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { DocumentConversionService } from "../../../services/committee/document-conversion.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { CommitteeDisplayService } from "../committee-display.service";
import { DatePicker } from "../../../date-and-time/date-picker";
import { TiptapMarkdownEditor } from "../../../modules/common/tiptap-editor/tiptap-markdown-editor";
import { CommitteeDocumentView } from "../document/committee-document-view";

@Component({
  selector: "app-committee-file-editor",
  template: `
    <app-section-toggle
      [tabs]="kindTabs"
      [selectedTab]="kind"
      (selectedTabChange)="selectKind($event)"/>
    <div class="row mb-3">
      <div class="col-md-6">
        <div class="form-group">
          <label for="event-date">File or Event Date</label>
          <app-date-picker startOfDay
                           id="event-date"
                           [size]="'md'"
                           (change)="eventDateChanged($event)"
                           [value]="eventDate">
          </app-date-picker>
        </div>
      </div>
      <div class="col-md-6">
        <div class="form-group">
          <label for="fileType">File Type</label>
          <select [(ngModel)]="committeeFile.fileType" id="fileType" class="form-control input-md">
            @for (fileType of display.fileTypes(); track fileType) {
              <option [ngValue]="fileType.description"
                      [textContent]="fileType.description">
            }
          </select>
        </div>
      </div>
    </div>
    @if (kind === CommitteeFileKind.ATTACHMENT) {
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
            <label>Link Preview: <a target="_blank" rel="noopener" [href]="display.viewUrl(committeeFile)">
              {{ display.fileTitle(committeeFile) }}</a>
            </label>
          </div>
        }
      </div>
    } @else {
      <div class="row">
        <div class="col-md-12 mb-3">
          <label for="document-title">Document Title</label>
          <input [(ngModel)]="committeeFile.document.title"
                 [disabled]="notifyTarget.busy"
                 type="text"
                 id="document-title"
                 class="form-control input-md"
                 placeholder="Enter a title for this document">
        </div>
      </div>
      <div #editorActions class="committee-file-editor-actions">
        <div class="d-flex gap-2 flex-wrap">
            <input type="submit" value="Save File"
                   [disabled]="notifyTarget.busy"
                   (click)="save()"
                   class="btn btn-primary">
            <input type="submit" value="Cancel"
                   [disabled]="notifyTarget.busy"
                   (click)="cancelled.emit()"
                   class="btn btn-secondary">
            <input type="submit" [disabled]="notifyTarget.busy"
                   value="Start from a file"
                   title="Pre-fill the editor from an existing Word or PDF document"
                   (click)="browseToConversionFile(conversionFileElement)"
                   class="btn btn-sunset">
            <input #conversionFileElement class="d-none"
                   type="file"
                   [accept]="conversionAccept"
                   (change)="onConversionFileSelected($event)">
            <button type="button" [disabled]="notifyTarget.busy"
                    (click)="togglePreview()"
                    class="btn btn-secondary">
              <fa-icon [icon]="previewing ? faEyeSlash : faEye" class="me-1"/>
              {{ previewing ? "Hide Preview" : "Preview" }}
            </button>
        </div>
      </div>
      <div class="row">
        <div class="col-md-12 mb-3">
          @if (!previewing) {
            <div class="committee-document-editing">
              <app-tiptap-markdown-editor
                showPageBreak
                [value]="committeeFile.document.markdown"
                placeholder="Write your document here…"
                (valueChange)="markdownChanged($event)"/>
            </div>
          } @else {
            <div class="border rounded">
              <app-committee-document-view [committeeFile]="committeeFile"/>
            </div>
          }
        </div>
      </div>
    }
    @if (showAlertMessage()) {
      <div class="alert {{notifyTarget.alert.class}} mb-3">
        <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
        @if (notifyTarget.alertTitle) {
          <strong>{{ notifyTarget.alertTitle }}: </strong>
        }
        {{ notifyTarget.alertMessage }}
      </div>
    }
    @if (kind === CommitteeFileKind.ATTACHMENT) {
      <div class="d-flex gap-2">
        <input type="submit" value="Save File"
               [disabled]="notifyTarget.busy"
               (click)="save()"
               class="btn btn-primary">
        <input type="submit" value="Cancel"
               [disabled]="notifyTarget.busy"
               (click)="cancelled.emit()"
               class="btn btn-secondary">
      </div>
    }`,
  imports: [DatePicker, FormsModule, NgClass, FileUploadModule, NgStyle, FontAwesomeModule, TiptapMarkdownEditor, CommitteeDocumentView, SectionToggle]
})
export class CommitteeFileEditor implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeFileEditor", NgxLoggerLevel.ERROR);
  private fileUploadService = inject(FileUploadService);
  display = inject(CommitteeDisplayService);
  private committeeFileService = inject(CommitteeFileService);
  private documentConversionService = inject(DocumentConversionService);
  private notifierService = inject(NotifierService);
  protected dateUtils = inject(DateUtilsService);
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public hasFileOver = false;
  public eventDate: DateValue;
  private existingTitle: string;
  public uploader: FileUploader;
  public kind: CommitteeFileKind = CommitteeFileKind.ATTACHMENT;
  protected readonly kindTabs: SectionToggleTab[] = [
    {value: CommitteeFileKind.ATTACHMENT, label: "Upload attachment"},
    {value: CommitteeFileKind.COMPOSED, label: "Compose document"}
  ];
  protected readonly conversionAccept = CONVERTIBLE_DOCUMENT_EXTENSIONS.map(extension => `.${extension}`).join(",");
  public previewing = false;
  private subscriptions: Subscription[] = [];
  protected readonly CommitteeFileKind = CommitteeFileKind;
  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;

  @Input() committeeFile: CommitteeFile;
  @Output() saved = new EventEmitter<CommitteeFile>();
  @Output() cancelled = new EventEmitter<void>();
  private hostRef = inject(ElementRef);
  private actionsResizeObserver: ResizeObserver | null = isUndefined(ResizeObserver) ? null : new ResizeObserver(entries => {
    const actionsBar = entries[0]?.target as HTMLElement;
    this.hostRef.nativeElement.style.setProperty("--committee-editor-actions-offset", `${Math.ceil(actionsBar?.offsetHeight ?? 0)}px`);
  });

  @ViewChild("editorActions") set editorActions(ref: ElementRef<HTMLDivElement> | undefined) {
    this.actionsResizeObserver?.disconnect();
    if (ref?.nativeElement && this.actionsResizeObserver) {
      this.actionsResizeObserver.observe(ref.nativeElement);
    } else {
      this.hostRef.nativeElement.style.setProperty("--committee-editor-actions-offset", "0px");
    }
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.eventDate = this.dateUtils.asDateValue(this.committeeFile?.eventDate);
    this.existingTitle = this.committeeFile?.fileNameData?.title;
    this.notify.hide();
    this.kind = this.committeeFile?.document ? CommitteeFileKind.COMPOSED : CommitteeFileKind.ATTACHMENT;
    this.uploader = this.fileUploadService.createUploaderFor("committeeFiles");
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
      const awsFileUploadResponseData: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
      this.committeeFile.fileNameData = awsFileUploadResponseData.fileNameData;
      this.committeeFile.fileNameData.title = this.existingTitle;
      this.notify.success({title: "File uploaded", message: this.committeeFile.fileNameData.originalFileName});
    }));
  }

  ngOnDestroy(): void {
    this.actionsResizeObserver?.disconnect();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  selectKind(kind: CommitteeFileKind) {
    this.kind = kind;
    this.previewing = false;
    if (kind === CommitteeFileKind.COMPOSED && !this.committeeFile.document) {
      this.committeeFile.document = {title: this.committeeFile?.fileNameData?.title || "", markdown: ""};
    }
  }

  markdownChanged(markdown: string) {
    this.committeeFile.document.markdown = markdown;
  }

  togglePreview() {
    this.previewing = !this.previewing;
  }

  browseToConversionFile(fileElement: HTMLInputElement) {
    fileElement.value = "";
    fileElement.click();
  }

  async onConversionFileSelected(event: Event) {
    const file = first(Array.from((event.target as HTMLInputElement).files || []));
    if (file) {
      this.notify.setBusy();
      this.notify.progress({title: "Document conversion", message: `converting ${file.name} - please wait...`});
      try {
        const conversion = await this.documentConversionService.convertFile(file);
        this.committeeFile.document.markdown = conversion.markdown;
        if (!this.committeeFile.document.title && conversion.suggestedTitle) {
          this.committeeFile.document.title = conversion.suggestedTitle;
        }
        this.notify.success({title: "Document converted", message: `${file.name} converted - review and tidy the content before saving`});
      } catch (error) {
        this.notify.error({title: "Conversion failed", message: error?.error?.error || error?.message || "An unexpected error occurred"});
      } finally {
        this.notify.clearBusy();
      }
    }
  }

  save() {
    this.notify.setBusy();
    this.committeeFileService.createOrUpdate(this.fileToSave())
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

  private fileToSave(): CommitteeFile {
    if (this.kind === CommitteeFileKind.COMPOSED && this.composedContentPresent()) {
      return {...this.committeeFile, fileNameData: null};
    } else if (this.kind === CommitteeFileKind.ATTACHMENT && this.committeeFile.fileNameData) {
      return {...this.committeeFile, document: null};
    } else {
      return {...this.committeeFile, document: this.composedContentPresent() ? this.committeeFile.document : null};
    }
  }

  private composedContentPresent(): boolean {
    return !!(this.committeeFile?.document?.title || this.committeeFile?.document?.markdown);
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
