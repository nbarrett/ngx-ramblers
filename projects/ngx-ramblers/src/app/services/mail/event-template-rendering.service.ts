import {inject, Injectable} from "@angular/core";
import {GroupEventsFilter, GroupEventSummary} from "../../models/committee.model";
import {EmailComposerProgramme, EmailImageLayout, EVENT_EMAIL_IMAGE_HEIGHT} from "../../models/email-composer.model";
import {BrandingMode, EMAIL_COMPOSER_BODY_PLACEHOLDER, EmailTemplateName, NotificationConfig, TemplateRenderRequest} from "../../models/mail.model";
import {MailMessagingService} from "./mail-messaging.service";
import {programmeMarkdown} from "../../functions/email-composer-programme";
import {awsImageResourcePath} from "../../functions/aws-image-paths";
import {committeeMarkdownForEmail} from "../../functions/committee-file-email";
import {DateUtilsService} from "../date-utils.service";
import {UrlService} from "../url.service";
import {EmailComposerRenderingService} from "../email-composer/email-composer-rendering.service";

@Injectable({providedIn: "root"})
export class EventTemplateRenderingService {
  private mail = inject(MailMessagingService);
  private dates = inject(DateUtilsService);
  private urls = inject(UrlService);
  private rendering = inject(EmailComposerRenderingService);

  markdown(events: GroupEventSummary[], settings: EmailComposerProgramme, filter: GroupEventsFilter | null, emailMarkdown: Record<string, string> = {}): string {
    const resolved = events.map(event => ({...event,
      image: event.image ? this.urls.absoluteUrlFor(awsImageResourcePath(event.image)) : null,
      mapUrl: event.mapUrl ? this.urls.absoluteUrlFor(event.mapUrl) : null}));
    return programmeMarkdown(resolved, settings, filter, value => this.dates.displayDate(value), emailMarkdown);
  }

  emailHtml(markdown: string, imageHeight = EVENT_EMAIL_IMAGE_HEIGHT): string {
    return this.rendering.tableSection(this.rendering.markdownToHtml(committeeMarkdownForEmail(markdown), EmailImageLayout.EVENT, imageHeight));
  }

  embeddedEmailHtml(markdown: string, imageHeight = EVENT_EMAIL_IMAGE_HEIGHT): string {
    return this.embedInEmailBody(this.emailHtml(markdown, imageHeight));
  }

  embedInEmailBody(html: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;background:#ffffff;">${html}</body></html>`;
  }

  previewRequest(html: string, config: NotificationConfig | null = null, brandingMode = BrandingMode.BRANDED): TemplateRenderRequest {
    const configured = config || this.mail.currentConfig()?.notificationConfigs?.find(item => item.templateName === EmailTemplateName.RAMBLERS_CAMPAIGN) || null;
    return {templateName: EmailTemplateName.RAMBLERS_CAMPAIGN, templateOverrides: configured?.templateOverrides,
      body: EMAIL_COMPOSER_BODY_PLACEHOLDER, htmlContent: html, brandingMode, showTitle: false,
      params: this.mail.createSendSmtpEmailParams(null, configured, html, "Event format preview", "")};
  }

}
