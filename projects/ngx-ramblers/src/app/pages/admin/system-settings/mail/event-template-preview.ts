import {ChangeDetectorRef, Component, inject, Input, OnInit, OnDestroy} from "@angular/core";
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {values} from "es-toolkit/compat";
import {FormsModule} from "@angular/forms";
import {NgSelectModule} from "@ng-select/ng-select";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faCircleExclamation, faEnvelope, faFilePdf, faRotate, faSpinner} from "@fortawesome/free-solid-svg-icons";
import {CommitteeFile, GroupEventsFilter, GroupEventSummary, GroupEventTypes} from "../../../../models/committee.model";
import {EVENT_EMAIL_IMAGE_HEIGHT, EventListingPreview, ProgrammeEventFormat} from "../../../../models/email-composer.model";
import {ProgrammeOverviewStatus} from "../../../../models/walk-programme.model";
import {SectionToggleTab} from "../../../../models/section-toggle.model";
import {StoredValue} from "../../../../models/ui-actions";
import {CommitteeQueryService} from "../../../../services/committee/committee-query.service";
import {DateUtilsService} from "../../../../services/date-utils.service";
import {EventTemplateRenderingService} from "../../../../services/mail/event-template-rendering.service";
import {EmailPreviewComponent} from "../../../../modules/common/email-preview/email-preview.component";
import {CommitteeDocumentEditor} from "../../../committee/document/committee-document-editor";
import {SectionToggle} from "../../../../shared/components/section-toggle";

@Component({
  selector: "app-event-template-preview",
  imports: [FormsModule, NgSelectModule, FontAwesomeModule, EmailPreviewComponent, CommitteeDocumentEditor, SectionToggle],
  template: `
    <div class="thumbnail-heading-frame mt-3">
      <div class="thumbnail-heading">Live preview — real site events</div>
      @if (loading) {
        <p><fa-icon [icon]="faSpinner" animation="spin" class="me-2"/>Loading events…</p>
      } @else if (error) {
        <div class="alert alert-warning d-flex align-items-start gap-2">
          <fa-icon [icon]="faCircleExclamation"/><div><strong class="d-block">Events could not be loaded</strong>{{ error }}</div>
        </div>
        <button type="button" class="btn btn-primary" (click)="load()"><fa-icon [icon]="faRotate" class="me-2"/>Retry</button>
      } @else {
        <p>Choose events from the past month and next six months. The preview shows the repeating event block as it appears inside an email, not a complete message. Editing the template updates it immediately; the events themselves are unchanged.</p>
        <label for="template-preview-type" class="form-label">Event type</label>
        <ng-select dropdownPosition="bottom" [clearable]="true" [searchable]="false" [multiple]="true" [closeOnSelect]="false"
                   appendTo="body" labelForId="template-preview-type" class="mb-3" [items]="eventTypes"
                   bindLabel="description" bindValue="eventType" placeholder="Not selected"
                   [(ngModel)]="selectedTypeKeys" (ngModelChange)="eventTypeChanged($event)">
        </ng-select>
        <label for="template-preview-events" class="form-label">Preview events</label>
        <ng-select dropdownPosition="bottom" labelForId="template-preview-events" [items]="availableEvents" bindLabel="title" bindValue="id"
                   [multiple]="true" [closeOnSelect]="false" appendTo="body" [(ngModel)]="selectedIds" (ngModelChange)="savePreviewChoice()" placeholder="Choose real events…">
          <ng-template ng-option-tmp let-item="item">{{ dates.displayDate(item.eventDate) }} — {{ item.title }}</ng-template>
        </ng-select>
        <div class="form-check my-3">
          <input id="template-preview-images" type="checkbox" class="form-check-input" [(ngModel)]="filter.includeImage" (ngModelChange)="savePreviewChoice()">
          <label for="template-preview-images" class="form-check-label">Include event images</label>
        </div>
        <app-section-toggle [tabs]="previewTabs" [selectedTab]="preview" [queryParamKey]="StoredValue.EVENT_PREVIEW" (selectedTabChange)="preview = $event"/>
        @if (!selectedIds.length) {
          <div class="alert alert-warning d-flex align-items-start gap-2 mt-3">
            <fa-icon [icon]="faCircleExclamation"/><div><strong class="d-block">No preview events selected</strong>Choose events above to see the current template with real data.</div>
          </div>
        } @else if (preview === EventListingPreview.EMAIL) {
          <app-email-preview class="d-block mt-3" [html]="listingHtml()"/>
        } @else {
          <app-committee-document-editor [committeeFile]="document()" [editable]="false"/>
        }
      }
    </div>
  `
})
export class EventTemplatePreviewComponent implements OnInit, OnDestroy {
  @Input() template = "";
  @Input() imageHeight = EVENT_EMAIL_IMAGE_HEIGHT;
  private changes = inject(ChangeDetectorRef);
  private query = inject(CommitteeQueryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subscriptions: Subscription[] = [];
  private rendering = inject(EventTemplateRenderingService);
  protected dates = inject(DateUtilsService);
  protected events: GroupEventSummary[] = [];
  protected availableEvents: GroupEventSummary[] = [];
  protected selectedIds: string[] = [];
  protected selectedTypeKeys: string[] = [];
  protected loading = true;
  protected error: string | null = null;
  protected preview = EventListingPreview.EMAIL;
  protected filter: GroupEventsFilter;
  private previewDocument: CommitteeFile | null = null;
  private signature = "";
  protected readonly eventTypes = values(GroupEventTypes);
  protected readonly EventListingPreview = EventListingPreview;
  protected readonly StoredValue = StoredValue;
  protected readonly faSpinner = faSpinner;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faRotate = faRotate;
  protected readonly previewTabs: SectionToggleTab[] = [
    {value: EventListingPreview.EMAIL, label: "Email", icon: faEnvelope},
    {value: EventListingPreview.PDF, label: "PDF", icon: faFilePdf}
  ];

  ngOnInit(): void {
    const today = this.dates.dateTimeNowNoTime();
    this.filter = {fromDate: this.dates.asDateValue(today.minus({months: 1}).toMillis()),
      toDate: this.dates.asDateValue(today.plus({months: 6}).toMillis()), search: null, selectAll: true,
      includeImage: true, includeContact: true, includeDescription: true, includeLocation: true,
      includeWalks: true, includeSocialEvents: true, includeCommitteeEvents: true};
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => this.restoreSelection(params)));
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.events = (await this.query.groupEvents(this.filter)).filter(event => !event.deleted);
      this.restoreSelection(this.route.snapshot.queryParamMap, true);
    } catch (error) {
      this.error = error.message;
    } finally {
      this.loading = false;
      this.changes.markForCheck();
    }
  }

  protected selectDefaults(): void {
    const events = [...this.availableEvents].sort((left, right) => left.eventDate - right.eventDate);
    const today = this.dates.dateTimeNowNoTime().toMillis();
    const upcoming = events.filter(event => event.eventDate >= today);
    const ready = upcoming.filter(event => ![ProgrammeOverviewStatus.AWAITING_LEADER, ProgrammeOverviewStatus.AWAITING_WALK_DETAILS,
      ProgrammeOverviewStatus.CANCELLED, ProgrammeOverviewStatus.DRAFT].includes(event.programmeStatus));
    const candidates = ready.length ? ready : upcoming.length ? upcoming : events.slice().reverse();
    this.selectedIds = candidates.slice(0, 3).map(event => event.id);
    this.selectedTypeKeys = this.typesForSelectedEvents();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private restoreSelection(params: ParamMap, loadingEvents = false): void {
    const requestedTypes = (params.get(StoredValue.EVENT_TYPE) || "").split(",").filter(key => this.eventTypes.some(type => type.eventType === key));
    this.selectedTypeKeys = requestedTypes;
    this.updateAvailableEvents();
    this.filter.includeImage = params.get(StoredValue.EVENT_PREVIEW_IMAGES) !== "false";
    if (params.has(StoredValue.EVENT_IDS)) {
      const ids = (params.get(StoredValue.EVENT_IDS) || "").split(",");
      const selected = ids.filter(id => this.availableEvents.some(event => event.id === id));
      if (loadingEvents && !selected.length) {
        this.selectDefaults();
      } else if (selected.length !== this.selectedIds.length || selected.some((id, index) => id !== this.selectedIds[index])) {
        this.selectedIds = selected;
      }
    } else {
      this.selectDefaults();
    }
    if (!requestedTypes.length) {
      this.selectedTypeKeys = this.typesForSelectedEvents();
    }
    this.changes.markForCheck();
  }

  private typesForSelectedEvents(): string[] {
    return this.eventTypes.map(type => type.eventType)
      .filter(key => this.availableEvents.some(event => this.selectedIds.includes(event.id) && event.eventType?.eventType === key));
  }

  private updateAvailableEvents(): void {
    const events = this.events.filter(event => !this.selectedTypeKeys.length || this.selectedTypeKeys.includes(event.eventType?.eventType));
    if (events.length !== this.availableEvents.length || events.some((event, index) => event !== this.availableEvents[index])) {
      this.availableEvents = events;
    }
  }

  protected eventTypeChanged(selectedTypeKeys: string[]): void {
    this.selectedTypeKeys = selectedTypeKeys || [];
    this.updateAvailableEvents();
    this.selectedIds = this.selectedIds.filter(id => this.availableEvents.some(event => event.id === id));
    if (!this.selectedIds.length) {
      this.selectDefaults();
    }
    this.savePreviewChoice();
  }

  protected savePreviewChoice(): void {
    void this.router.navigate([], {relativeTo: this.route, queryParamsHandling: "merge", replaceUrl: true,
      queryParams: {[StoredValue.EVENT_TYPE]: this.selectedTypeKeys.join(",") || null,
        [StoredValue.EVENT_IDS]: this.selectedIds.join(","), [StoredValue.EVENT_PREVIEW_IMAGES]: this.filter.includeImage ? null : "false"}});
  }

  private markdown(): string {
    const events = this.availableEvents.filter(event => this.selectedIds.includes(event.id)).map(event => ({...event, selected: true}));
    return this.rendering.markdown(events, {format: ProgrammeEventFormat.CUSTOM, customTemplate: this.template, eventFormats: {}, markdown: null, imageHeight: this.imageHeight}, this.filter);
  }

  protected listingHtml(): string {
    return this.rendering.embeddedEmailHtml(this.markdown(), this.imageHeight);
  }

  protected document(): CommitteeFile {
    const markdown = this.markdown();
    if (markdown !== this.signature || !this.previewDocument) {
      this.signature = markdown;
      this.previewDocument = {fileType: "Event template preview", document: {title: "Event template preview", markdown}};
    }
    return this.previewDocument;
  }
}
