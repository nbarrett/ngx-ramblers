import {Component, EventEmitter, inject, Input, Output} from "@angular/core";
import {CommonModule} from "@angular/common";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faChevronDown, faChevronRight, faPaperclip, faReply, faReplyAll, faShare, faEye, faDownload} from "@fortawesome/free-solid-svg-icons";
import {TooltipDirective} from "ngx-bootstrap/tooltip";
import {BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective} from "ngx-bootstrap/dropdown";
import {InboxMessage, InboxMessageDirection, InboxAddress, InboxAttachment} from "../../../models/inbox.model";
import {UIDateFormat} from "../../../models/date-format.model";
import {formatInboxAddress} from "../../../functions/inbox-thread";
import {NumberUtilsService} from "../../../services/number-utils.service";
import {InboxMessageRenderingService} from "../../../services/inbox/inbox-message-rendering.service";
import {AttachmentPreviewComponent} from "../../../modules/common/attachment-preview/attachment-preview";
import {HtmlFrameComponent} from "../../../modules/common/html-frame/html-frame.component";
import {InboxCalendarInviteComponent} from "./inbox-calendar-invite";

@Component({
  selector: "app-inbox-message",
  imports: [CommonModule, FontAwesomeModule, TooltipDirective, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, AttachmentPreviewComponent, HtmlFrameComponent, InboxCalendarInviteComponent],
  styleUrls: ["./inbox-message.sass"],
  styles: [`
    :host
      display: contents
  `],
  template: `
              <div class="inbox-message" [attr.data-message-id]="message.messageId" [class.outbound]="message.direction === InboxMessageDirection.OUTBOUND" [class.collapsed]="!isMessageExpanded()">
                <div class="inbox-message-headers inbox-message-toggle d-flex align-items-start gap-2" (click)="toggleMessage()">
                  <fa-icon [icon]="isMessageExpanded() ? faChevronDown : faChevronRight" class="mt-1 text-muted"/>
                  <div class="flex-grow-1 min-w-0">
                    <strong>{{ messageFromLabel(message) }}</strong>
                    &middot; {{(message.receivedAt ?? message.sentAt) | date: UIDateFormat.MONTH_DAY_YEAR_ABBREVIATED_TIME_WITH_SECONDS}}
                    @if (isMessageExpanded()) {
                      @if (messageToLabel(message); as toLabel) {
                        <div>To {{ toLabel }}</div>
                      }
                      @if (message.cc?.length) {
                        <div>Cc {{ formatAddresses(message.cc) }}</div>
                      }
                    } @else {
                      @if (messageToLabel(message); as toLabel) {
                        <div class="inbox-message-preview text-truncate">To {{ toLabel }}</div>
                      }
                      <div class="inbox-message-preview text-truncate">
                        @if (visibleAttachments(message).length) {
                          <fa-icon [icon]="faPaperclip" class="me-1 text-muted"/>
                        }{{ messagePreview(message) }}</div>
                    }
                  </div>
                  <div class="inbox-reply-actions d-flex gap-1 flex-shrink-0">
                    <button class="btn inbox-reply-btn" type="button" [disabled]="busy"
                            tooltip="Reply in email composer" placement="left" container="body" (click)="$event.stopPropagation(); reply.emit(message)">
                      <fa-icon [icon]="faReply"/>
                      <span class="inbox-reply-label">Reply</span>
                    </button>
                    @if (hasMultipleRecipients(message)) {
                      <button class="btn inbox-reply-btn" type="button" [disabled]="busy"
                              tooltip="Reply all in email composer" placement="left" container="body" (click)="$event.stopPropagation(); replyAll.emit(message)">
                        <fa-icon [icon]="faReplyAll"/>
                        <span class="inbox-reply-label">Reply all</span>
                      </button>
                    }
                    <button class="btn inbox-reply-btn" type="button" [disabled]="busy"
                            tooltip="Forward in email composer with attachments" placement="left" container="body" (click)="$event.stopPropagation(); forward.emit(message)">
                      <fa-icon [icon]="faShare"/>
                      <span class="inbox-reply-label">Forward</span>
                    </button>
                  </div>
                </div>
                @if (hasOpenedMessage()) {
                  <div class="inbox-message-content" [class.d-none]="!isMessageExpanded()">
                    <app-inbox-calendar-invite [message]="message"/>
                    @if (visibleAttachments(message).length) {
                      <div class="inbox-attachments d-flex flex-wrap gap-2 mb-3">
                        @for (attachment of visibleAttachments(message); track attachment.s3Key) {
                          <div class="btn-group" dropdown container="body" placement="bottom left">
                            <button dropdownToggle type="button" class="inbox-attachment dropdown-toggle">
                              <fa-icon [icon]="faPaperclip"/>
                              <span class="inbox-attachment-name">{{ attachment.filename }}</span>
                              <span class="text-muted">{{ numberUtils.humanFileSize(attachment.sizeBytes) }}</span>
                            </button>
                            <ul *dropdownMenu class="dropdown-menu" role="menu">
                              <li role="menuitem">
                                <button class="dropdown-item" type="button" (click)="attachmentPreview.open({filename: attachment.filename, url: attachmentUrl(attachment), contentType: attachment.contentType})">
                                  <fa-icon [icon]="faEye" class="me-2"/>Preview
                                </button>
                              </li>
                              <li role="menuitem">
                                <a class="dropdown-item" [href]="attachmentUrl(attachment)" [attr.download]="attachment.filename">
                                  <fa-icon [icon]="faDownload" class="me-2"/>Download
                                </a>
                              </li>
                            </ul>
                          </div>
                        }
                      </div>
                    }
                    <app-html-frame class="inbox-message-body" [html]="renderableBody(message)"/>
                  </div>
                }
              </div>
    <app-attachment-preview #attachmentPreview/>
  `
})
export class InboxMessageComponent {
  @Input({required: true}) message!: InboxMessage;
  @Input() busy = false;
  @Input() set initiallyExpanded(value: boolean) {
    this.expanded = value;
    this.opened = value;
  }
  @Output() reply = new EventEmitter<InboxMessage>();
  @Output() replyAll = new EventEmitter<InboxMessage>();
  @Output() forward = new EventEmitter<InboxMessage>();
  private expanded = false;
  private opened = false;
  private messageRendering = inject(InboxMessageRenderingService);
  protected numberUtils = inject(NumberUtilsService);
  protected readonly InboxMessageDirection = InboxMessageDirection;
  protected readonly UIDateFormat = UIDateFormat;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faPaperclip = faPaperclip;
  protected readonly faReply = faReply;
  protected readonly faReplyAll = faReplyAll;
  protected readonly faShare = faShare;
  protected readonly faEye = faEye;
  protected readonly faDownload = faDownload;

  protected isMessageExpanded(): boolean {
    return this.expanded;
  }

  protected hasOpenedMessage(): boolean {
    return this.opened;
  }

  protected toggleMessage(): void {
    this.expanded = !this.expanded;
    this.opened = this.opened || this.expanded;
  }

  protected hasMultipleRecipients(message: InboxMessage): boolean {
    return ((message.to?.length ?? 0) + (message.cc?.length ?? 0)) > 1;
  }

  private formatAddress(address: InboxAddress): string {
    return formatInboxAddress(address);
  }

  private formatAddresses(addresses: InboxAddress[]): string {
    return (addresses ?? []).map(address => this.formatAddress(address)).join(", ");
  }

  recipientSummary(message: InboxMessage): string {
    return [...(message.to ?? []), ...(message.cc ?? [])]
      .map(address => address.email?.trim())
      .filter(email => email)
      .join(", ");
  }

  messagePreview(message: InboxMessage): string {
    return this.messageRendering.messagePreview(message);
  }

  messageFromLabel(message: InboxMessage): string {
    return message.direction === InboxMessageDirection.OUTBOUND
      ? "Sent - " + this.formatAddress(message.from)
      : "From " + this.formatAddress(message.from);
  }

  messageToLabel(message: InboxMessage): string | null {
    return message.to?.length
      ? this.formatAddresses(message.to)
      : (this.recipientSummary(message) || null);
  }

  renderableBody(message: InboxMessage): string {
    return this.messageRendering.renderableBody(message);
  }

  protected visibleAttachments(message: InboxMessage): InboxAttachment[] {
    return this.messageRendering.visibleAttachments(message);
  }

  protected attachmentUrl(attachment: InboxAttachment): string {
    return this.messageRendering.attachmentUrl(attachment);
  }
}
