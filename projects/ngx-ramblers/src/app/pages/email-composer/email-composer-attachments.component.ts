import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {Component, EventEmitter, inject, Input, OnDestroy, Output} from "@angular/core";
import {FileUploadModule, FileUploader} from "ng2-file-upload";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faCircleExclamation, faFileZipper, faPaperclip, faSpinner, faXmark} from "@fortawesome/free-solid-svg-icons";
import {TooltipDirective} from "ngx-bootstrap/tooltip";
import {EmailAttachment, emailAttachmentSupported} from "../../models/mail.model";
import {SendingChannel} from "../../models/email-composer.model";
import {RootFolder} from "../../models/system.model";
import {UIDateFormat} from "../../models/date-format.model";
import {FileUploadService} from "../../services/file-upload.service";
import {NotifierService} from "../../services/notifier.service";
import {AlertTarget} from "../../models/alert-target.model";
import {NumberUtilsService} from "../../services/number-utils.service";
import {DateUtilsService} from "../../services/date-utils.service";
import {LoggerFactory} from "../../services/logger-factory.service";
import {NgxLoggerLevel} from "ngx-logger";
import {AttachmentPreviewComponent} from "../../modules/common/attachment-preview/attachment-preview";
import {storedZipFile} from "../../functions/zip-store";

@Component({
  selector: "app-email-composer-attachments",
  imports: [FileUploadModule, FontAwesomeModule, TooltipDirective, AttachmentPreviewComponent],
  styleUrls: ["./email-composer-attachments.sass"],
  template: `
    <div [class.thumbnail-heading-frame]="showHeading">
      @if (showHeading) {
        <div class="thumbnail-heading">Attachments</div>
      }
      <div class="d-flex flex-wrap align-items-center gap-2">
        @for (attachment of listedAttachments; track attachment.url; let index = $index) {
          <span class="composer-attachment">
            <button type="button" class="composer-attachment-open" [tooltip]="attachment.name" container="body"
                    (click)="attachmentPreview.open({filename: attachment.name, url: attachment.url, contentType: attachmentContentType(attachment.name)})">
              <fa-icon [icon]="faPaperclip" class="composer-attachment-icon"/>
              <span class="composer-attachment-name">{{ attachment.name }}</span>
              <span class="composer-attachment-size text-muted">{{ numberUtils.humanFileSize(attachment.sizeBytes) }}</span>
            </button>
            <button type="button" class="composer-attachment-remove" tooltip="Remove attachment" container="body" (click)="removeAttachment(index)">
              <fa-icon [icon]="faXmark"/>
            </button>
          </span>
        }
        <input #attachmentFileElement class="d-none" type="file" multiple ng2FileSelect [uploader]="uploader"
               (onFileSelected)="onFilesSelected($event)">
        <button type="button" class="btn btn-quiet" [disabled]="uploader.isUploading || zipping" (click)="attachmentFileElement.value = ''; attachmentFileElement.click()">
          <fa-icon [icon]="uploader.isUploading || zipping ? faSpinner : faPaperclip" [animation]="uploader.isUploading || zipping ? 'spin' : null" class="me-1"/>
          {{ uploader.isUploading || zipping ? 'Uploading…' : 'Add attachment' }}
        </button>
      </div>
      @if (pendingZipFiles.length > 0) {
        <div class="alert alert-warning d-flex align-items-start mt-2 mb-0" role="status">
          <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
          <div>
            <strong class="d-block">Zip these files to attach them</strong>
            <p class="mb-2">The mail platform cannot send {{ pendingZipNames() }} as-is. Zip {{ pendingZipFiles.length === 1 ? "it" : "them" }} into {{ pendingZipFileName() }} and attach that?</p>
            <div class="d-flex flex-wrap gap-2">
              <button type="button" class="btn btn-primary" [disabled]="zipping" (click)="confirmZipPending()">
                <fa-icon [icon]="zipping ? faSpinner : faFileZipper" [animation]="zipping ? 'spin' : null" class="me-1"/>
                Zip and attach
              </button>
              <button type="button" class="btn btn-quiet" [disabled]="zipping" (click)="cancelZipPending()">
                <fa-icon [icon]="faXmark" class="me-1"/>Don't attach
              </button>
            </div>
          </div>
        </div>
      }
      @if (channel === SendingChannel.CAMPAIGN && listedAttachments.length > 1) {
        <small class="text-muted d-block mt-1">Emails sent to an entire list include only the first attachment — send to selected members or external recipients to include them all.</small>
      }
    </div>
    <app-attachment-preview #attachmentPreview/>
  `
})
export class EmailComposerAttachmentsComponent implements OnDestroy {
  @Input() set attachments(value: EmailAttachment[]) {
    if (this.uploader?.isUploading) {
      this.listedAttachments = this.uploadService.unionEmailAttachments(this.listedAttachments, value ?? []);
    } else {
      this.listedAttachments = value ?? [];
    }
  }
  @Input() showHeading = true;
  @Input() channel: SendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
  @Output() attachmentsChange = new EventEmitter<EmailAttachment[]>();
  protected listedAttachments: EmailAttachment[] = [];
  private uploadService = inject(FileUploadService);
  private logger = inject(LoggerFactory).createLogger("EmailComposerAttachmentsComponent", NgxLoggerLevel.ERROR);
  protected numberUtils = inject(NumberUtilsService);
  private dateUtils = inject(DateUtilsService);
  protected pendingZipFiles: File[] = [];
  protected zipping = false;
  private notifyTarget: AlertTarget = {};
  private notify = inject(NotifierService).createAlertInstance(this.notifyTarget);
  private session = inject(EmailComposerSessionService);
  private get warning(): string | null {
    return this.session.attachmentWarning;
  }
  private set warning(value: string | null) {
    this.session.attachmentWarning = value;
  }
  protected readonly uploader: FileUploader = this.createUploader();
  protected readonly SendingChannel = SendingChannel;
  protected readonly faPaperclip = faPaperclip;
  protected readonly faSpinner = faSpinner;
  protected readonly faXmark = faXmark;
  protected readonly faFileZipper = faFileZipper;
  protected readonly faCircleExclamation = faCircleExclamation;

  private createUploader(): FileUploader {
    const uploader = this.uploadService.createUploaderFor(RootFolder.emailAttachments, true);
    uploader.options.itemAlias = "file";
    uploader.options.filters = [...(uploader.options.filters ?? []), {
      name: "supportedEmailAttachment",
      fn: item => emailAttachmentSupported(item.name)
    }];
    uploader.onWhenAddingFileFailed = () => undefined;
    uploader.onSuccessItem = (item, response) => {
      const parsed = this.uploadService.handleAwsFileUploadResponse(response, this.notify, this.logger);
      const additions = this.uploadService.emailAttachmentsFromUpload(parsed, item.file.name, item.file.size);
      if (additions.length > 0) {
        this.replaceAttachments(this.uploadService.unionEmailAttachments(this.listedAttachments, additions));
      } else {
        this.warning = `${item.file.name} failed to upload`;
      }
    };
    const handleError = uploader.onErrorItem;
    uploader.onErrorItem = (item, response, status, headers) => {
      handleError(item, response, status, headers);
      this.warning = `${item.file.name} failed to upload — please try again`;
    };
    return uploader;
  }

  protected onFilesSelected(files: File[]): void {
    this.warning = null;
    this.pendingZipFiles = Array.from(files ?? []).filter(file => !emailAttachmentSupported(file.name));
  }

  protected pendingZipNames(): string {
    return this.pendingZipFiles.map(file => file.name).join(", ");
  }

  protected pendingZipFileName(): string {
    if (this.pendingZipFiles.length === 1) {
      return `${this.pendingZipFiles[0].name}.zip`;
    } else {
      return `attachments-${this.dateUtils.asString(this.dateUtils.dateTimeNow(), undefined, UIDateFormat.FILE_TIMESTAMP_COMPACT)}.zip`;
    }
  }

  protected cancelZipPending(): void {
    this.pendingZipFiles = [];
    this.zipping = false;
  }

  protected async confirmZipPending(): Promise<void> {
    const files = this.pendingZipFiles;
    if (files.length === 0) {
    } else {
      this.zipping = true;
      try {
        const entries = await Promise.all(files.map(async file => ({
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer())
        })));
        const zipFile = storedZipFile(entries, this.pendingZipFileName());
        this.pendingZipFiles = [];
        this.uploader.addToQueue([zipFile]);
      } catch (error) {
        this.logger.error("zip pending attachments failed", error);
        this.warning = "The files could not be zipped. Try again, or zip them yourself and attach the zip.";
      } finally {
        this.zipping = false;
      }
    }
  }

  protected removeAttachment(index: number): void {
    this.replaceAttachments(this.listedAttachments.filter((_attachment, attachmentIndex) => attachmentIndex !== index));
  }

  private replaceAttachments(next: EmailAttachment[]): void {
    this.listedAttachments = next;
    this.attachmentsChange.emit(next);
  }

  protected attachmentContentType(name: string): string | null {
    const lower = (name || "").toLowerCase();
    return lower.endsWith(".pdf") ? "application/pdf" : lower.endsWith(".ics") ? "text/calendar" : null;
  }

  ngOnDestroy(): void {
    this.uploader.cancelAll();
  }
}
