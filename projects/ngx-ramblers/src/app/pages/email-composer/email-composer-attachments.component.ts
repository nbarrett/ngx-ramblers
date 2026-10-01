import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {Component, EventEmitter, inject, Input, OnDestroy, Output} from "@angular/core";
import {FileUploadModule, FileUploader} from "ng2-file-upload";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faPaperclip, faSpinner, faXmark} from "@fortawesome/free-solid-svg-icons";
import {TooltipDirective} from "ngx-bootstrap/tooltip";
import {EmailAttachment} from "../../models/mail.model";
import {SendingChannel} from "../../models/email-composer.model";
import {RootFolder} from "../../models/system.model";
import {BREVO_SUPPORTED_ATTACHMENT_EXTENSIONS} from "../../models/mail.model";
import {FileUploadService} from "../../services/file-upload.service";
import {NotifierService} from "../../services/notifier.service";
import {AlertTarget} from "../../models/alert-target.model";
import {NumberUtilsService} from "../../services/number-utils.service";
import {LoggerFactory} from "../../services/logger-factory.service";
import {NgxLoggerLevel} from "ngx-logger";
import {AttachmentPreviewComponent} from "../../modules/common/attachment-preview/attachment-preview";

@Component({
  selector: "app-email-composer-attachments",
  imports: [FileUploadModule, FontAwesomeModule, TooltipDirective, AttachmentPreviewComponent],
  styleUrls: ["./email-composer-attachments.sass"],
  template: `
    <div class="thumbnail-heading-frame">
      <div class="thumbnail-heading">Attachments</div>
      <div class="d-flex flex-wrap align-items-center gap-2">
        @for (attachment of attachments; track attachment.url; let index = $index) {
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
        <input #attachmentFileElement class="d-none" type="file" multiple ng2FileSelect [uploader]="uploader">
        <button type="button" class="btn btn-quiet" [disabled]="uploader.isUploading" (click)="attachmentFileElement.value = ''; attachmentFileElement.click()">
          <fa-icon [icon]="uploader.isUploading ? faSpinner : faPaperclip" [animation]="uploader.isUploading ? 'spin' : null" class="me-1"/>
          {{ uploader.isUploading ? 'Uploading…' : 'Add attachment' }}
        </button>
      </div>
      @if (channel === SendingChannel.CAMPAIGN && attachments.length > 1) {
        <small class="text-muted d-block mt-1">Emails sent to an entire list include only the first attachment — send to selected members or external recipients to include them all.</small>
      }
    </div>
    <app-attachment-preview #attachmentPreview/>
  `
})
export class EmailComposerAttachmentsComponent implements OnDestroy {
  @Input() attachments: EmailAttachment[] = [];
  @Input() channel: SendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
  @Output() attachmentsChange = new EventEmitter<EmailAttachment[]>();
  private uploadService = inject(FileUploadService);
  private logger = inject(LoggerFactory).createLogger("EmailComposerAttachmentsComponent", NgxLoggerLevel.ERROR);
  protected numberUtils = inject(NumberUtilsService);
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

  private createUploader(): FileUploader {
    const uploader = this.uploadService.createUploaderFor(RootFolder.emailAttachments, true);
    uploader.options.itemAlias = "file";
    uploader.options.filters = [...(uploader.options.filters ?? []), {
      name: "supportedEmailAttachment",
      fn: item => BREVO_SUPPORTED_ATTACHMENT_EXTENSIONS.includes(item.name.split(".").pop()?.toLowerCase() ?? "")
    }];
    uploader.onWhenAddingFileFailed = item => {
      this.warning = `${item.name} can't be sent by email. Zip the file and attach the zip instead.`;
    };
    uploader.onSuccessItem = (item, response) => {
      const parsed = this.uploadService.handleAwsFileUploadResponse(response, this.notify, this.logger);
      const attachment = this.uploadService.emailAttachmentFromUpload(parsed, item.file.name, item.file.size);
      if (attachment) {
        this.attachments = [...this.attachments, attachment];
        this.attachmentsChange.emit(this.attachments);
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

  protected removeAttachment(index: number): void {
    this.attachments = this.attachments.filter((_attachment, attachmentIndex) => attachmentIndex !== index);
    this.attachmentsChange.emit(this.attachments);
  }

  protected attachmentContentType(name: string): string | null {
    const lower = (name || "").toLowerCase();
    return lower.endsWith(".pdf") ? "application/pdf" : lower.endsWith(".ics") ? "text/calendar" : null;
  }

  ngOnDestroy(): void {
    this.uploader.cancelAll();
  }
}
