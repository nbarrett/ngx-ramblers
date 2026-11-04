import {Component, inject} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faCircleExclamation, faFileLines, faRotate, faXmark, faPencil, faSave} from "@fortawesome/free-solid-svg-icons";
import {values} from "es-toolkit/compat";
import {MergeFieldGroup, ProgrammeEventFormat, ProgrammeEventToken, PROGRAMME_EVENT_FORMATS, PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX} from "../../models/email-composer.model";
import {TemplateSelectorComponent} from "../../modules/common/dynamic-content/template-selector";
import {TemplateSelectEvent} from "../../models/content-text.model";
import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {EmailComposerProgrammeService} from "../../services/email-composer/email-composer-programme.service";
import {TiptapMarkdownEditor} from "../../modules/common/tiptap-editor/tiptap-markdown-editor";
import {CommitteeDocumentEditor} from "../committee/document/committee-document-editor";
import {LoggerFactory} from "../../services/logger-factory.service";
import {NgxLoggerLevel} from "ngx-logger";

@Component({
  selector: "app-email-composer-programme",
  imports: [FormsModule, FontAwesomeModule, TiptapMarkdownEditor, CommitteeDocumentEditor, TemplateSelectorComponent],
  template: `
    <div class="thumbnail-heading-frame mt-3">
      <div class="thumbnail-heading">Editable programme</div>
      <p>Prepare a programme from the events selected above. Edit it here for the email, or preview the document to print or save as PDF. The document also includes your introduction and sign-off.</p>
      <div class="row g-3 mb-3">
        <div class="col-md-4">
          <label for="programme-event-format" class="form-label">Default event format</label>
          <select id="programme-event-format" class="form-select" [(ngModel)]="programme.settings().format">
            @for (format of formats; track format.value) {
              <option [ngValue]="format.value">{{ format.label }}</option>
            }
          </select>
        </div>
        <div class="col-md-8 d-flex align-items-end">
          <button type="button" class="btn btn-quiet" (click)="programme.customiseFormat()"
                  [disabled]="programme.settings().format === ProgrammeEventFormat.CUSTOM">
            <fa-icon [icon]="faPencil" class="me-2"/>Customise this format
          </button>
        </div>
      </div>
      @if (programme.settings().format === ProgrammeEventFormat.CUSTOM || hasCustomEvents()) {
        <app-template-selector #templateLibrary label="Saved event listing templates"
                               [pathPrefix]="templatePathPrefix" [showAppendAction]="false"
                               (templateSelected)="applyTemplate($event)"/>
        <p class="small text-muted mt-2">Use Replace to load a saved event format. Edit the layout below and use Merge fields to insert event details. Grid references open the website's locator.</p>
        <app-tiptap-markdown-editor [value]="programme.settings().customTemplate"
                                   (valueChange)="programme.settings().customTemplate = $event"
                                   [showMergeFields]="true" [mergeFieldCatalogue]="eventFields"
                                   placeholder="Design the format for one event…"/>
        <div class="row g-2 align-items-end my-3">
          <div class="col-md-7">
            <label for="programme-template-name" class="form-label">Save as a reusable event template</label>
            <input id="programme-template-name" class="form-control" [(ngModel)]="templateName" placeholder="Template name">
          </div>
          <div class="col-md-5">
            <button type="button" class="btn btn-primary" [disabled]="savingTemplate || !templateName.trim() || !programme.settings().customTemplate.trim()"
                    (click)="saveTemplate(templateLibrary)">
              <fa-icon [icon]="faSave" class="me-2"/>{{ savingTemplate ? 'Saving…' : 'Save to template library' }}
            </button>
          </div>
        </div>
      }
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button type="button" class="btn btn-primary" [disabled]="!hasSelectedEvents()"
                (click)="requestGeneration()">
          <fa-icon [icon]="faFileLines" class="me-2"/>
          {{ programme.generated() ? 'Regenerate programme' : 'Generate editable programme' }}
        </button>
        @if (programme.generated()) {
          <button type="button" class="btn btn-quiet" (click)="confirmLiveEvents = true">
            <fa-icon [icon]="faRotate" class="me-2"/>Use live event list instead
          </button>
        }
      </div>
      @if (confirmRegenerate || confirmLiveEvents) {
        <div class="alert alert-warning d-flex align-items-start gap-2">
          <fa-icon [icon]="faCircleExclamation"/>
          <div>
            <strong class="d-block">Replace the edited programme?</strong>
            <p>Edits to the generated programme will be replaced. Your introduction and sign-off will be kept.</p>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-primary" (click)="confirmReplacement()">
                <fa-icon [icon]="faRotate" class="me-2"/>{{ confirmLiveEvents ? 'Use live event list' : 'Regenerate' }}
              </button>
              <button type="button" class="btn btn-quiet" (click)="cancelReplacement()">
                <fa-icon [icon]="faXmark" class="me-2"/>Cancel
              </button>
            </div>
          </div>
        </div>
      }
      @if (programme.generated()) {
        <p class="small text-muted">This edited programme replaces the automatic event list in the email. Changes to event selection or formats take effect when you regenerate. Save the email draft to keep your programme and format choices.</p>
        <app-committee-document-editor [committeeFile]="programme.document()"
                                       [value]="session.state.programme?.markdown || ''"
                                       (valueChange)="programme.updateMarkdown($event)"/>
      }
    </div>
  `
})
export class EmailComposerProgrammeComponent {
  protected programme = inject(EmailComposerProgrammeService);
  protected session = inject(EmailComposerSessionService);
  private logger = inject(LoggerFactory).createLogger("EmailComposerProgramme", NgxLoggerLevel.ERROR);
  protected confirmRegenerate = false;
  protected confirmLiveEvents = false;
  protected readonly formats = PROGRAMME_EVENT_FORMATS;
  protected readonly tokens = values(ProgrammeEventToken);
  protected readonly eventFields: MergeFieldGroup[] = [{group: "Event details", fields: values(ProgrammeEventToken).map(token => ({
    token: `{{${token}}}`, label: token.replace(/-/g, " ")
  }))}];
  protected readonly templatePathPrefix = PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX;
  protected templateName = "";
  protected savingTemplate = false;
  protected readonly ProgrammeEventFormat = ProgrammeEventFormat;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faFileLines = faFileLines;
  protected readonly faRotate = faRotate;
  protected readonly faXmark = faXmark;
  protected readonly faPencil = faPencil;
  protected readonly faSave = faSave;

  protected applyTemplate(event: TemplateSelectEvent): void {
    this.programme.applyTemplate(event.template);
  }

  protected async saveTemplate(library: TemplateSelectorComponent): Promise<void> {
    this.savingTemplate = true;
    try {
      if (await this.programme.saveTemplate(this.templateName)) {
        await library.refresh();
      }
    } catch (error) {
      this.logger.error("Event template saving failed", error);
      this.session.notify.error({title: "Could not save the event template", message: "Please try saving the template again."});
    } finally {
      this.savingTemplate = false;
    }
  }

  protected hasSelectedEvents(): boolean {
    return this.session.state.groupEvents.some(event => event.selected && !event.deleted);
  }

  protected hasCustomEvents(): boolean {
    return values(this.programme.settings().eventFormats).includes(ProgrammeEventFormat.CUSTOM);
  }

  protected requestGeneration(): void {
    if (this.programme.generated()) {
      this.confirmRegenerate = true;
    } else {
      this.programme.generate();
    }
  }

  protected confirmReplacement(): void {
    if (this.confirmLiveEvents) {
      this.programme.useLiveEvents();
    } else {
      this.programme.generate();
    }
    this.cancelReplacement();
  }

  protected cancelReplacement(): void {
    this.confirmLiveEvents = false;
    this.confirmRegenerate = false;
  }

}
