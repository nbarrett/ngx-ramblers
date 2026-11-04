import {NgSelectModule} from "@ng-select/ng-select";
import {ChangeDetectorRef, Component, inject, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {FormsModule} from "@angular/forms";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faCircleCheck, faCircleExclamation, faCopy, faSave, faSpinner} from "@fortawesome/free-solid-svg-icons";
import {PageContent} from "../../../../models/content-text.model";
import {EVENT_EMAIL_IMAGE_HEIGHT, MergeFieldGroup, PROGRAMME_EVENT_MERGE_FIELDS} from "../../../../models/email-composer.model";
import {StoredValue} from "../../../../models/ui-actions";
import {TiptapMarkdownEditor} from "../../../../modules/common/tiptap-editor/tiptap-markdown-editor";
import {EventTemplateService} from "../../../../services/mail/event-template.service";
import {EventTemplatePreviewComponent} from "./event-template-preview";

@Component({
  selector: "app-event-template-settings",
  imports: [NgSelectModule, FormsModule, FontAwesomeModule, TiptapMarkdownEditor, EventTemplatePreviewComponent],
  template: `
    <div class="thumbnail-heading-frame">
      <div class="thumbnail-heading">Event templates — one repeated item</div>
      <p>Email Configurations controls the whole email. Event templates control each walk or social-event item, including its image, in emails and printed programmes.</p>
      @if (loading) {
        <p><fa-icon [icon]="faSpinner" animation="spin" class="me-2"/>Loading event formats…</p>
      } @else if (selected) {
        <label for="event-template-format" class="form-label">Existing format</label>
        <ng-select dropdownPosition="bottom" [clearable]="false" [searchable]="true" appendTo="body" labelForId="event-template-format" class="mb-3"
                   [(ngModel)]="selectedPath" (ngModelChange)="select()" placeholder="Search or choose a format">
          @for (template of available; track template.path) {
            <ng-option [value]="template.path">{{ template.migrationTemplate?.templateName || template.path }}</ng-option>
          }
        </ng-select>
        <label for="event-template-name" class="form-label">Format name</label>
        <input id="event-template-name" type="text" class="form-control mb-3" [(ngModel)]="name" placeholder="Name for this format">
        <p>Choose a format to edit. Save changes updates that format. To keep the original, change the name and use Save as new.</p>
        <app-tiptap-markdown-editor [value]="markdown" (valueChange)="markdown = $event"
                                   [showMergeFields]="true" [mergeFieldCatalogue]="eventFields"
                                   [(eventImageHeight)]="imageHeight"/>
        <div class="d-flex flex-wrap gap-2 mt-3">
          <button type="button" class="btn btn-primary" [disabled]="busy || !markdown.trim() || !name.trim()" (click)="save()">
            <fa-icon [icon]="faSave" class="me-2"/>{{ busy ? 'Saving…' : 'Save changes' }}
          </button>
          <button type="button" class="btn btn-quiet" [disabled]="busy || !markdown.trim() || !name.trim()" (click)="saveAsNew()">
            <fa-icon [icon]="faCopy" class="me-2"/>Save as new
          </button>
        </div>
        <app-event-template-preview [template]="markdown" [imageHeight]="imageHeight"/>
      }
      @if (message) {
        <div class="alert d-flex align-items-start gap-2 mt-3" [class.alert-danger]="failed" [class.alert-success]="!failed">
          <fa-icon [icon]="failed ? faCircleExclamation : faCircleCheck"/>
          <div><strong class="d-block">{{ failed ? 'Event format problem' : 'Event format saved' }}</strong>{{ message }}</div>
        </div>
      }
    </div>
  `
})
export class EventTemplateSettingsComponent implements OnInit {
  private changes = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private templates = inject(EventTemplateService);
  protected available: PageContent[] = [];
  protected selected: PageContent | null = null;
  protected selectedPath = "";
  protected name = "";
  protected markdown = "";
  protected imageHeight = EVENT_EMAIL_IMAGE_HEIGHT;
  protected loading = true;
  protected busy = false;
  protected failed = false;
  protected message = "";
  protected readonly eventFields: MergeFieldGroup[] = [{group: "Event details and image", fields: PROGRAMME_EVENT_MERGE_FIELDS}];
  protected readonly faSave = faSave;
  protected readonly faCopy = faCopy;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faSpinner = faSpinner;

  async ngOnInit(): Promise<void> {
    try {
      this.available = await this.templates.available();
      const requested = this.route.snapshot.queryParamMap.get(StoredValue.EVENT_FORMAT);
      this.selectedPath = this.available.some(template => template.path === requested) ? requested : this.available[0]?.path || "";
      this.select(false);
    } catch (error) {
      this.failed = true;
      this.message = error.message;
    } finally {
      this.loading = false;
      this.changes.markForCheck();
    }
  }

  protected select(remember = true): void {
    this.selected = this.available.find(template => template.path === this.selectedPath) || null;
    this.markdown = this.selected ? this.templates.content(this.selected) : "";
    this.imageHeight = this.templates.imageHeight(this.selected);
    this.name = this.selected?.migrationTemplate?.templateName || this.selected?.path || "";
    this.message = "";
    if (remember) {
      this.rememberSelection();
    }
  }

  protected save(): void {
    void this.persist(this.name.trim(), this.selected, "This format is available in the email composer for email and PDF output.");
  }

  protected saveAsNew(): void {
    const name = this.name.trim();
    const current = this.selected?.migrationTemplate?.templateName || this.selected?.path || "";
    if (name === current) {
      this.failed = true;
      this.message = "Enter a new name to save a copy, or use Save changes to update this format.";
      this.changes.markForCheck();
    } else {
      void this.persist(name, null, "The new format is available in the email composer. The original is unchanged.");
    }
  }

  private async persist(name: string, existing: PageContent | null, success: string): Promise<void> {
    this.busy = true;
    this.message = "";
    try {
      const saved = await this.templates.save(name, this.markdown, existing, this.imageHeight);
      if (this.available.some(template => template.path === saved.path)) {
        this.available = this.available.map(template => template.path === saved.path ? saved : template);
      } else {
        this.available = [...this.available, saved];
      }
      this.selectedPath = saved.path;
      this.selected = saved;
      this.name = saved.migrationTemplate?.templateName || name;
      this.failed = false;
      this.message = success;
      this.rememberSelection();
    } catch (error) {
      this.failed = true;
      this.message = error.message;
    } finally {
      this.busy = false;
      this.changes.markForCheck();
    }
  }

  private rememberSelection(): void {
    void this.router.navigate([], {relativeTo: this.route, queryParamsHandling: "merge", replaceUrl: true,
      queryParams: {[StoredValue.EVENT_FORMAT]: this.selectedPath || null}});
  }
}
