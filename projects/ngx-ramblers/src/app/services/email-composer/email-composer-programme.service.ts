import {inject, Injectable} from "@angular/core";
import {DOCUMENT} from "@angular/common";
import {EmailComposerSessionService} from "./email-composer-session.service";
import {ComposerFragmentKind, EmailComposerProgramme, ProgrammeEventFormat, PROGRAMME_EVENT_TEMPLATES} from "../../models/email-composer.model";
import {CommitteeFile} from "../../models/committee.model";
import {normaliseMarkdownText} from "../../functions/markdown";
import {Subject} from "rxjs";
import {TemplateRenderRequest} from "../../models/mail.model";
import {PageContent} from "../../models/content-text.model";
import {EventTemplateRenderingService} from "../mail/event-template-rendering.service";
import {EventTemplateService} from "../mail/event-template.service";

@Injectable()
export class EmailComposerProgrammeService {
  readonly edited = new Subject<void>();
  private session = inject(EmailComposerSessionService);
  private rendering = inject(EventTemplateRenderingService);
  private documentRef = inject(DOCUMENT);
  private templates = inject(EventTemplateService);
  private previewSignature = "";
  private previewDocument: CommitteeFile | null = null;

  settings(): EmailComposerProgramme {
    if (!this.session.state.programme) {
      this.session.state.programme = {
        templateId: null,
        format: ProgrammeEventFormat.EMAIL,
        customTemplate: PROGRAMME_EVENT_TEMPLATES[ProgrammeEventFormat.CUSTOM],
        eventFormats: {},
        markdown: null
      };
    }
    return this.session.state.programme;
  }

  generated(): boolean {
    return this.session.state.programme?.markdown !== null && this.session.state.programme?.markdown !== undefined;
  }

  formatted(): boolean {
    return !!this.session.state.programme && this.session.state.programme.format !== ProgrammeEventFormat.EMAIL;
  }

  formatChanged(): void {
    this.settings().eventFormats = {};
    this.useLiveEvents();
  }

  async selectFormat(): Promise<void> {
    const format = this.settings().format;
    this.settings().templateId = null;
    this.formatChanged();
    if (format !== ProgrammeEventFormat.EMAIL && format !== ProgrammeEventFormat.CUSTOM) {
      try {
        const saved = (await this.templates.available()).find(template => template.path.endsWith(`/${format}`) && template.id);
        if (saved && this.settings().format === format) {
          this.applyTemplate(saved, format);
        }
      } catch (error) {
        this.session.notify.error({title: "Could not load the saved event format", message: error.message});
      }
    }
  }

  private liveMarkdown(firstEventOnly = false): string {
    const emailMarkdown = [...this.documentRef.querySelectorAll<HTMLElement>("[data-composer-event-id]")]
      .reduce((markdown, element) => ({...markdown, [element.dataset.composerEventId]: normaliseMarkdownText(element.innerHTML) || ""}), {} as Record<string, string>);
    const selected = this.session.state.groupEvents.filter(event => event.selected && !event.deleted)
      .sort((left, right) => left.eventDate - right.eventDate);
    const events = firstEventOnly ? selected.slice(0, 1) : selected;
    return this.rendering.markdown(events, this.settings(), this.session.state.groupEventsFilter,
      events.reduce((result, event) => ({...result, [event.id]: emailMarkdown[event.id] || ""}), {} as Record<string, string>));
  }

  contentMarkdown(): string {
    return this.session.state.programme?.markdown ?? this.liveMarkdown();
  }

  previewHtml(): string {
    if (this.settings().format === ProgrammeEventFormat.EMAIL) {
      const firstEvent = this.session.state.groupEvents.filter(event => event.selected && !event.deleted)
        .sort((left, right) => left.eventDate - right.eventDate)[0];
      return [...this.documentRef.querySelectorAll<HTMLElement>("[data-composer-event-id]")]
        .find(element => element.dataset.composerEventId === firstEvent?.id)?.innerHTML || "";
    } else {
      return this.rendering.emailHtml(this.liveMarkdown(true), this.settings().imageHeight);
    }
  }

  previewRequest(): TemplateRenderRequest {
    return this.rendering.previewRequest(this.previewHtml(), this.session.state.notificationConfig, this.session.state.brandingMode);
  }

  generate(): void {
    try {
      const markdown = this.liveMarkdown();
      if (markdown.trim()) {
        this.settings().markdown = markdown;
        this.edited.next();
        this.session.contentChanged.next();
      } else {
        this.session.notify.error({title: "Programme is empty", message: "Select at least one event and use a template containing event content."});
      }
    } catch (error) {
      this.session.notify.error({title: "Could not generate the programme", message: error.message});
    }
  }

  updateMarkdown(value: string): void {
    this.settings().markdown = value;
    this.edited.next();
    this.session.contentChanged.next();
  }

  useLiveEvents(): void {
    this.settings().markdown = null;
    this.edited.next();
    this.session.contentChanged.next();
  }

  applyTemplate(template: PageContent, format = ProgrammeEventFormat.CUSTOM): void {
    const markdown = this.templates.content(template);
    if (markdown.trim()) {
      this.settings().templateId = template.id ?? null;
      this.settings().customTemplate = markdown;
      this.settings().format = format;
      this.settings().imageHeight = this.templates.imageHeight(template);
      this.formatChanged();
    } else {
      this.session.notify.error({title: "Template has no event content", message: "Choose a template containing event fields and text."});
    }
  }

  emailHtml(): string {
    return this.rendering.emailHtml(this.contentMarkdown(), this.settings().imageHeight);
  }

  document(): CommitteeFile {
    const state = this.session.state;
    const kinds = new Set((state.fragmentOrder || []).map(fragment => fragment.kind));
    const title = state.subject || "Events programme";
    const markdown = [
      `# ${title.replace(/[\r\n]+/g, " ")}`,
      kinds.has(ComposerFragmentKind.INTRO) ? state.introMarkdown : "",
      this.contentMarkdown(),
      kinds.has(ComposerFragmentKind.SIGNOFF) ? state.signoffTextMarkdown : ""
    ].filter(Boolean).join("\n\n");
    const signature = JSON.stringify([title, markdown]);
    if (signature !== this.previewSignature) {
      this.previewSignature = signature;
      this.previewDocument = {fileType: "Events programme", document: {title, markdown}};
    }
    return this.previewDocument;
  }
}
