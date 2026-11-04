import {inject, Injectable} from "@angular/core";
import {DOCUMENT} from "@angular/common";
import {EmailComposerSessionService} from "./email-composer-session.service";
import {ComposerFragmentKind, EmailComposerProgramme, EmailImageLayout, ProgrammeEventFormat, PROGRAMME_EVENT_TEMPLATES} from "../../models/email-composer.model";
import {CommitteeFile} from "../../models/committee.model";
import {programmeMarkdown} from "../../functions/email-composer-programme";
import {awsImageResourcePath} from "../../functions/aws-image-paths";
import {DateUtilsService} from "../date-utils.service";
import {committeeMarkdownForEmail} from "../../functions/committee-file-email";
import {EmailComposerRenderingService} from "./email-composer-rendering.service";
import {normaliseMarkdownText} from "../../functions/markdown";
import {Subject} from "rxjs";
import {UrlService} from "../url.service";
import {PageContentService} from "../page-content.service";
import {PageContentActionsService} from "../page-content-actions.service";
import {ContentTemplateType, PageContent, PageContentType} from "../../models/content-text.model";
import {PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX} from "../../models/email-composer.model";
import {kebabCase} from "es-toolkit/compat";
import {rowsWithin} from "../../functions/map-location-markers";

@Injectable()
export class EmailComposerProgrammeService {
  readonly edited = new Subject<void>();
  private session = inject(EmailComposerSessionService);
  private dates = inject(DateUtilsService);
  private rendering = inject(EmailComposerRenderingService);
  private documentRef = inject(DOCUMENT);
  private urls = inject(UrlService);
  private pages = inject(PageContentService);
  private pageActions = inject(PageContentActionsService);
  private previewSignature = "";
  private previewDocument: CommitteeFile | null = null;

  settings(): EmailComposerProgramme {
    if (!this.session.state.programme) {
      this.session.state.programme = {
        format: ProgrammeEventFormat.LISTING,
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

  generate(): void {
    const settings = this.settings();
    const emailMarkdown = [...this.documentRef.querySelectorAll<HTMLElement>("[data-composer-event-id]")]
      .reduce((markdown, element) => ({...markdown, [element.dataset.composerEventId]: normaliseMarkdownText(element.innerHTML) || ""}), {} as Record<string, string>);
    try {
      const events = this.session.state.groupEvents.map(event => ({...event,
        image: event.image ? this.urls.absoluteUrlFor(awsImageResourcePath(event.image)) : null,
        mapUrl: event.mapUrl ? this.urls.absoluteUrlFor(event.mapUrl) : null}));
      const markdown = programmeMarkdown(events, settings, this.session.state.groupEventsFilter,
        value => this.dates.displayDate(value), emailMarkdown);
      if (markdown.trim()) {
        settings.markdown = markdown;
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

  customiseFormat(): void {
    const settings = this.settings();
    settings.customTemplate = PROGRAMME_EVENT_TEMPLATES[settings.format] || PROGRAMME_EVENT_TEMPLATES[ProgrammeEventFormat.DETAILED];
    settings.format = ProgrammeEventFormat.CUSTOM;
    this.edited.next();
  }

  applyTemplate(template: PageContent): void {
    const markdown = rowsWithin(template.rows).flatMap(row => (row.columns || []).map(column => column.contentText || "")).filter(Boolean).join("\n\n");
    if (markdown.trim()) {
      this.settings().customTemplate = markdown;
      this.settings().format = ProgrammeEventFormat.CUSTOM;
      this.edited.next();
    } else {
      this.session.notify.error({title: "Template has no event content", message: "Choose a template containing event fields and text."});
    }
  }

  async saveTemplate(name: string): Promise<boolean> {
    const path = PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX + kebabCase(name);
    const existing = await this.pages.all({criteria: {path}});
    if (existing.length > 0) {
      this.session.notify.error({title: "Template name already exists", message: "Choose a different name, or edit the existing template in Content Templates."});
      return false;
    } else {
      const row = this.pageActions.defaultRowFor(PageContentType.TEXT);
      row.columns[0].contentText = this.settings().customTemplate;
      await this.pages.create({path, rows: [row], migrationTemplate: {
        templateType: ContentTemplateType.USER_TEMPLATE, templateName: name.trim(),
        templateDescription: "Reusable event listing format for email and printed programmes"
      }});
      this.session.notify.success({title: "Event template saved", message: "The format is available in the existing Content Templates library."});
      return true;
    }
  }

  emailHtml(): string {
    return this.rendering.markdownToHtml(committeeMarkdownForEmail(this.session.state.programme?.markdown || ""), EmailImageLayout.EVENT);
  }

  document(): CommitteeFile {
    const state = this.session.state;
    const kinds = new Set((state.fragmentOrder || []).map(fragment => fragment.kind));
    const title = state.subject || "Events programme";
    const markdown = [
      `# ${title.replace(/[\r\n]+/g, " ")}`,
      kinds.has(ComposerFragmentKind.INTRO) ? state.introMarkdown : "",
      state.programme?.markdown,
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
