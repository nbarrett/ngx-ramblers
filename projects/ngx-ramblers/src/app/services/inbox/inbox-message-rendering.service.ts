import { inject, Injectable } from "@angular/core";
import { InboxMessage, InboxAttachment } from "../../models/inbox.model";
import { StringUtilsService } from "../string-utils.service";
import { UrlService } from "../url.service";
@Injectable()
export class InboxMessageRenderingService {
  private stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);
  private messagePreviewById = new Map<string, string>();
  private visibleAttachmentsById = new Map<string, InboxAttachment[]>();
  private renderableBodyById = new Map<string, string>();
  prepare(messages: InboxMessage[]): void {
    this.messagePreviewById = new Map(messages.map(message => [message.messageId, this.buildMessagePreview(message)]));
    this.visibleAttachmentsById = new Map(messages.map(message => [message.messageId, this.buildVisibleAttachments(message)]));
    this.renderableBodyById = new Map(messages.map(message => [message.messageId, this.buildRenderableBody(message)]));
  }
  messagePreview(message: InboxMessage): string {
    return this.messagePreviewById.get(message.messageId) ?? this.buildMessagePreview(message);
  }
  private buildMessagePreview(message: InboxMessage): string {
    const raw = message.bodyHtml?.trim() ? message.bodyHtml : (message.bodyText ?? "");
    const cleaned = this.stringUtils.htmlToPlainText(raw)
      .replace(/[^{}]*\{[^{}]*:[^{}]*\}/g, " ");
    return cleaned.replace(/\s+/g, " ").trim().slice(0, 500);
  }
  renderableBody(message: InboxMessage): string {
    return this.renderableBodyById.get(message.messageId) ?? this.buildRenderableBody(message);
  }
  private buildRenderableBody(message: InboxMessage): string {
    if (message.bodyHtml) {
      return this.resolveInlineImages(message.bodyHtml, message.attachments);
    }
    else {
      if (message.bodyText) {
        return `<pre>${message.bodyText}</pre>`;
      }
      else {
        return "<em>(empty message body)</em>";
      }
    }
  }
  visibleAttachments(message: InboxMessage): InboxAttachment[] {
    return this.visibleAttachmentsById.get(message.messageId) ?? this.buildVisibleAttachments(message);
  }
  private buildVisibleAttachments(message: InboxMessage): InboxAttachment[] {
    const bodyHtml = (message.bodyHtml || "").toLowerCase();
    return (message.attachments ?? []).filter(attachment => attachment.s3Key
      && !(attachment.contentId && bodyHtml.includes(`cid:${attachment.contentId.trim().toLowerCase()}`)));
  }
  attachmentUrl(attachment: InboxAttachment): string {
    return this.urlService.resourceRelativePathForAWSFileName(attachment.s3Key);
  }
  private resolveInlineImages(html: string, attachments: InboxAttachment[]): string {
    const inlineImages = (attachments ?? []).filter(attachment => attachment.contentId && attachment.s3Key);
    if (inlineImages.length === 0) {
      return html;
    }
    else {
      return html.replace(/(["'])cid:([^"']+)\1/gi, (match, quote, cid) => {
        const target = cid.trim().toLowerCase();
        const attachment = inlineImages.find(candidate => candidate.contentId?.toLowerCase() === target);
        return attachment ? `${quote}${this.urlService.resourceRelativePathForAWSFileName(attachment.s3Key)}${quote}` : match;
      });
    }
  }
}
