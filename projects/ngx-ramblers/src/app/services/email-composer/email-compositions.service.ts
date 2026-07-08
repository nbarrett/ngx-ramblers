import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ComposerExternalRecipient, ComposerFragment, EmailComposerState, EmailComposition, EmailCompositionDocumentDto, EmailCompositionListResponse, EmailCompositionSingleResponse, EmailCompositionStatus, EmailCompositionSummary, EmailCompositionSummaryDto, EmailCompositionSummaryListResponse } from "../../models/email-composer.model";
import { EmailAttachment } from "../../models/mail.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({ providedIn: "root" })
export class EmailCompositionsService {
  private readonly logger: Logger = inject(LoggerFactory).createLogger(EmailCompositionsService, NgxLoggerLevel.OFF);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private readonly BASE_URL = "/api/database/email-compositions";

  async list(status?: EmailCompositionStatus): Promise<EmailComposition[]> {
    const url = status ? `${this.BASE_URL}?status=${status}` : this.BASE_URL;
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<EmailCompositionListResponse>(url));
    const docs = apiResponse.response ?? [];
    return docs.map((d: EmailCompositionDocumentDto) => this.toComposition(d));
  }

  async listSummaries(status?: EmailCompositionStatus): Promise<EmailCompositionSummary[]> {
    const separator = status ? "&" : "?";
    const url = status ? `${this.BASE_URL}?status=${status}` : this.BASE_URL;
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<EmailCompositionSummaryListResponse>(`${url}${separator}summary=true`));
    const docs = apiResponse.response ?? [];
    return docs.map((d: EmailCompositionSummaryDto) => this.toCompositionSummary(d));
  }

  async load(id: string): Promise<EmailComposition | null> {
    try {
      const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<EmailCompositionSingleResponse>(`${this.BASE_URL}/${id}`));
      return apiResponse.response ? this.toComposition(apiResponse.response) : null;
    } catch (error) {
      this.logger.error("load composition failed:", error);
      return null;
    }
  }

  async save(state: EmailComposerState, existingId?: string | null, shared?: boolean): Promise<EmailComposition> {
    const body: any = { title: this.titleFor(state), state: this.serialiseStateForStorage(state) };
    if (shared !== undefined) body.shared = shared;
    if (existingId) {
      const apiResponse = await this.http.put<EmailCompositionSingleResponse>(`${this.BASE_URL}/${existingId}`, body).toPromise();
      return this.toComposition(apiResponse.response);
    }
    const apiResponse = await this.http.post<EmailCompositionSingleResponse>(this.BASE_URL, body).toPromise();
    return this.toComposition(apiResponse.response);
  }

  serialiseStateForStorage(state: EmailComposerState): any {
    const safeArticleBlocks = (state.articleBlocks ?? []).map(block => ({
      id: block.id,
      position: block.position,
      order: block.order,
      title: block.title,
      markdown: block.markdown,
      image: block.image ? {
        src: block.image.src,
        alt: block.image.alt,
        width: block.image.width,
        alignment: block.image.alignment,
        cropperPosition: block.image.cropperPosition
      } : null,
      buttonText: block.buttonText,
      buttonUrl: block.buttonUrl,
      dividerAfter: block.dividerAfter
    }));
    const filter = state.groupEventsFilter ? {
      search: state.groupEventsFilter.search ?? null,
      selectAll: state.groupEventsFilter.selectAll ?? true,
      fromDate: state.groupEventsFilter.fromDate ? { value: state.groupEventsFilter.fromDate.value } : null,
      toDate: state.groupEventsFilter.toDate ? { value: state.groupEventsFilter.toDate.value } : null,
      includeImage: state.groupEventsFilter.includeImage ?? false,
      includeDescription: state.groupEventsFilter.includeDescription ?? false,
      includeLocation: state.groupEventsFilter.includeLocation ?? false,
      includeContact: state.groupEventsFilter.includeContact ?? false,
      includeWalks: state.groupEventsFilter.includeWalks ?? false,
      includeSocialEvents: state.groupEventsFilter.includeSocialEvents ?? false,
      includeCommitteeEvents: state.groupEventsFilter.includeCommitteeEvents ?? false,
      eventIds: state.groupEventsFilter.eventIds ? [...state.groupEventsFilter.eventIds] : null,
      sortBy: state.groupEventsFilter.sortBy ?? null
    } : null;
    return {
      context: state.context ? { ...state.context } : null,
      brandingMode: state.brandingMode,
      unbrandedSenderRoleType: state.unbrandedSenderRoleType ?? null,
      recipientMode: state.recipientMode,
      selectedListId: state.selectedListId,
      narrowListId: state.narrowListId,
      selectedMemberIds: [...(state.selectedMemberIds ?? [])],
      externalRecipients: this.serialiseExternalRecipients(state.externalRecipients),
      ccRecipients: this.serialiseExternalRecipients(state.ccRecipients),
      bccRecipients: this.serialiseExternalRecipients(state.bccRecipients),
      preFilterKey: state.preFilterKey,
      notificationConfig: state.notificationConfig?.id ? { id: state.notificationConfig.id } : null,
      notificationConfigListing: null,
      bannerId: state.bannerId,
      subject: state.subject ?? "",
      addresseeType: state.addresseeType,
      introMarkdown: state.introMarkdown ?? "",
      signoffTextMarkdown: state.signoffTextMarkdown ?? "",
      signoffRoles: [...(state.signoffRoles ?? [])],
      articleBlocks: safeArticleBlocks,
      attachmentUrl: state.attachmentUrl,
      attachmentFilename: state.attachmentFilename,
      attachments: this.serialiseAttachments(state.attachments),
      sendingChannel: state.sendingChannel,
      eventInclusion: state.eventInclusion,
      groupEventsFilter: filter,
      groupEvents: [],
      singleEvent: state.singleEvent?.id ? { id: state.singleEvent.id } : null,
      introDividerAfter: state.introDividerAfter,
      eventsDividerAfter: state.eventsDividerAfter,
      signoffDividerAfter: state.signoffDividerAfter,
      betweenArticlesDivider: state.betweenArticlesDivider,
      betweenEventsDivider: state.betweenEventsDivider,
      fragmentOrder: (state.fragmentOrder ?? []).map(f => this.serialiseFragment(f)),
      selectedGroupEventIds: (state.groupEvents ?? [])
        .filter(event => (event as any).selected)
        .map(event => event.id)
        .filter((id): id is string => !!id),
      groupEventMediaIndexById: (state.groupEvents ?? [])
        .filter(event => (event as any).selected && !!event.id && ((event as any).selectedMediaIndex ?? 0) > 0)
        .reduce((indexById, event) => ({ ...indexById, [event.id!]: (event as any).selectedMediaIndex }), {} as Record<string, number>)
    };
  }

  private serialiseExternalRecipients(recipients: ComposerExternalRecipient[] | undefined): ComposerExternalRecipient[] {
    return (recipients ?? []).map(recipient => ({
      email: recipient.email,
      ...(recipient.name ? { name: recipient.name } : {}),
      ...(recipient.existingId ? { existingId: recipient.existingId } : {})
    }));
  }

  private serialiseAttachments(attachments: EmailAttachment[] | undefined): EmailAttachment[] {
    return (attachments ?? []).map(attachment => ({
      name: attachment.name,
      url: attachment.url,
      ...(attachment.sizeBytes !== undefined ? { sizeBytes: attachment.sizeBytes } : {})
    }));
  }

  private serialiseFragment(fragment: ComposerFragment): ComposerFragment {
    return {
      kind: fragment.kind,
      id: fragment.id,
      dividerAfter: fragment.dividerAfter,
      ...(fragment.columnGapPx !== undefined ? { columnGapPx: fragment.columnGapPx } : {}),
      ...(fragment.columns ? { columns: fragment.columns.map(column => column.map(columnFragment => this.serialiseFragment(columnFragment))) } : {}),
      ...(fragment.committeeFileIds ? { committeeFileIds: [...fragment.committeeFileIds] } : {})
    };
  }

  async markSent(id: string, sentRecipientCount?: number): Promise<EmailComposition> {
    const body = { status: EmailCompositionStatus.Sent, sentRecipientCount };
    const apiResponse = await this.http.put<EmailCompositionSingleResponse>(`${this.BASE_URL}/${id}`, body).toPromise();
    return this.toComposition(apiResponse.response);
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(`${this.BASE_URL}/${id}`).toPromise();
  }

  private toCompositionSummary(doc: EmailCompositionSummaryDto): EmailCompositionSummary {
    return {
      id: doc.id,
      ownerMemberId: doc.ownerMemberId,
      status: doc.status,
      shared: doc.shared ?? false,
      title: doc.title,
      savedAt: doc.updatedAt,
      sentAt: doc.sentAt,
      sentRecipientCount: doc.sentRecipientCount
    };
  }

  private toComposition(doc: EmailCompositionDocumentDto): EmailComposition {
    return {
      ...this.toCompositionSummary(doc),
      state: doc.state
    };
  }

  private titleFor(state: EmailComposerState): string {
    const subject = state?.subject?.trim();
    if (subject) return subject;
    const intro = state?.introMarkdown?.trim();
    if (intro) return intro.slice(0, 60).replace(/\s+/g, " ");
    return "Untitled";
  }

}
