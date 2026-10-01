import {NgTemplateOutlet} from "@angular/common";
import {NgSelectModule} from "@ng-select/ng-select";
import {DateRangeSlider} from "../../components/date-range-slider/date-range-slider";
import {Component, inject} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {faArrowRotateLeft, faChevronDown, faChevronRight, faSpinner, faTriangleExclamation, faWandMagicSparkles} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {EmailComposerState} from "../../models/email-composer.model";
import {StringUtilsService} from "../../services/string-utils.service";
import {DurationPickerComponent} from "../../modules/common/duration-picker/duration-picker";
import {Input, Output, EventEmitter} from "@angular/core";
import {EmailComposerUpdateSettingsService} from "../../services/email-composer/email-composer-update-settings.service";
import {EmailComposerUpdateSettingsMode} from "../../models/email-composer.model";

@Component({selector: "app-email-composer-update-settings", imports: [NgTemplateOutlet, FormsModule, FontAwesomeModule, NgSelectModule, DateRangeSlider, DurationPickerComponent], styleUrls: ["./email-composer-update-settings.sass"], template: `
    @if (mode === EmailComposerUpdateSettingsMode.COMPOSE) {
      <ng-container *ngTemplateOutlet="releaseNoteUpdateComposeUi"/>
    } @else if (mode === EmailComposerUpdateSettingsMode.PREVIOUS) {
      <ng-container *ngTemplateOutlet="previousReleaseNoteUpdateUi"/>
    } @else {
      <ng-container *ngTemplateOutlet="releaseNoteUpdateSettingsUi; context: {showCreateButton: true}"/>
    }
    <ng-template #releaseNoteUpdateSettingsUi let-showCreateButton="showCreateButton">
      <fieldset class="email-composer-fieldset mt-3">
        <legend>
          <button type="button" class="btn btn-link p-0 text-decoration-none fw-bold text-reset"
                  (click)="settings.releaseNoteUpdateSettingsExpanded = !settings.releaseNoteUpdateSettingsExpanded"
                  [attr.aria-expanded]="settings.releaseNoteUpdateSettingsExpanded">
            <fa-icon [icon]="settings.releaseNoteUpdateSettingsExpanded ? faChevronDown : faChevronRight" class="me-1"/>
            Update content and date range
          </button>
        </legend>
        @if (settings.releaseNoteUpdateSettingsExpanded) {
          @if (settings.releaseNoteUpdateConfiguration.profiles.length > 1) {
            <div class="mb-3">
              <label for="release-note-update-profile">Saved configuration</label>
              <ng-select id="release-note-update-profile" [items]="settings.releaseNoteUpdateConfiguration.profiles" bindLabel="name" bindValue="id"
                         [clearable]="false" [searchable]="false" [disabled]="creatingReleaseNoteUpdate || draftingReleaseNoteUpdate"
                         [ngModel]="settings.selectedReleaseNoteUpdateProfileId" (ngModelChange)="settings.applyReleaseNoteUpdateProfile(state, currentDraftId, $event)"/>
            </div>
          }
          <ng-container *ngTemplateOutlet="releaseNoteUpdatePeriodUi"/>
          <ng-container *ngTemplateOutlet="previousReleaseNoteUpdateUi"/>
          <ng-container *ngTemplateOutlet="releaseNoteUpdateMessageChoicesUi"/>
        } @else {
          <p class="text-muted small mb-0">{{ settings.releaseNoteUpdateSettingsSummary(state, currentDraftId) }}</p>
        }
        @if (showCreateButton) {
          <div class="mt-3">
            <button type="button" class="btn btn-primary"
                    [disabled]="creatingReleaseNoteUpdate || !templateValid"
                    [title]="templateValid ? '' : validationMessage"
                    (click)="create.emit()">
              <fa-icon [icon]="creatingReleaseNoteUpdate ? faSpinner : faWandMagicSparkles" [spin]="creatingReleaseNoteUpdate" class="me-1"/>
              {{ creatingReleaseNoteUpdate ? "Generating…" : "Create update" }}
            </button>
          </div>
          @if (!templateValid) {
            <div class="text-muted small mt-2">{{ validationMessage }}</div>
          }
        }
      </fieldset>
    </ng-template>

    <ng-template #previousReleaseNoteUpdateUi>
      @if (settings.previousReleaseNoteUpdateExists(state, currentDraftId)) {
        <div class="thumbnail-heading-frame thumbnail-heading-frame-compact mt-3 mb-3">
          <div class="thumbnail-heading">Previously sent update</div>
          <p class="mb-2"><strong>{{ settings.previousReleaseNoteUpdate?.title }}</strong> was sent on {{ settings.previousReleaseNoteUpdateSentDate(state, currentDraftId) }}.</p>
          <div class="form-check mb-2">
            <input id="release-note-update-exclude-previous" class="form-check-input" type="checkbox"
                   [disabled]="creatingReleaseNoteUpdate || draftingReleaseNoteUpdate"
                   [(ngModel)]="settings.releaseNoteUpdateSettings(state, currentDraftId).excludePreviouslyIncluded">
            <label class="form-check-label" for="release-note-update-exclude-previous">Leave out release notes already covered by this update</label>
          </div>
          @if (settings.previousReleaseNoteUpdate?.includedPaths?.length) {
            <details>
              <summary>{{ stringUtils.pluraliseWithCount(settings.previousReleaseNoteUpdate!.includedPaths.length, "release note") }} previously included</summary>
              <ul class="mb-0 mt-2">
                @for (path of settings.previousReleaseNoteUpdate!.includedPaths; track path) {
                  <li><a [href]="'/' + path" target="_blank" rel="noopener noreferrer">{{ path }}</a></li>
                }
              </ul>
            </details>
          } @else {
            <p class="text-muted small mb-0">No individual release-note references were recorded for this update.</p>
          }
        </div>
      }
    </ng-template>

    <ng-template #releaseNoteUpdatePeriodUi>
      <div class="row mb-2">
        <div class="col-sm-12 col-lg-8">
          <app-duration-picker
            [amount]="settings.releaseNoteUpdateSettings(state, currentDraftId).periodAmount"
            (amountChange)="settings.onReleaseNoteUpdatePeriodAmountChange(state, currentDraftId, $event)"
            [unit]="settings.releaseNoteUpdateSettings(state, currentDraftId).periodUnit"
            (unitChange)="settings.onReleaseNoteUpdatePeriodUnitChange(state, currentDraftId, $event)"
            [units]="settings.rangeUnitOptions"
            [disabled]="creatingReleaseNoteUpdate || draftingReleaseNoteUpdate"
            amountLabel="Report on information from the last"
            unitLabel="Unit"
            idPrefix="update-period"/>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-sm-12">
          <app-date-range-slider class="w-100"
                                 [minDate]="settings.releaseNoteUpdateSliderMinDate"
                                 [maxDate]="settings.releaseNoteUpdateSliderMaxDate"
                                 [range]="settings.releaseNoteUpdateSliderRange(state, currentDraftId)"
                                 [disabled]="creatingReleaseNoteUpdate || draftingReleaseNoteUpdate"
                                 (rangeChange)="settings.onReleaseNoteUpdateDateRangeChange(state, currentDraftId, $event)"/>
        </div>
      </div>
    </ng-template>

    <ng-template #releaseNoteUpdateMessageChoicesUi>
      <div class="mt-3 mb-3">
        <h4 class="mb-3">Content for this update</h4>
        <div class="row">
          <div class="col-md-6">
            <div class="mb-1">Content to include</div>
            @for (option of settings.releaseNoteUpdateCategoryOptions; track option.value) {
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" [id]="'release-note-update-category-' + option.value"
                       [disabled]="creatingReleaseNoteUpdate || draftingReleaseNoteUpdate || settings.releaseNoteUpdateCategoryIsLastSelected(state, currentDraftId, option.value)"
                       [ngModel]="settings.releaseNoteUpdateSettings(state, currentDraftId).categories.includes(option.value)"
                       (ngModelChange)="settings.setReleaseNoteUpdateCategory(state, currentDraftId, option.value, $event)">
                <label class="form-check-label" [for]="'release-note-update-category-' + option.value">
                  <strong>{{ option.label }}</strong>
                  <span class="d-block text-muted small">{{ option.hint }}</span>
                </label>
              </div>
            }
          </div>
          <div class="col-md-6 mt-3 mt-md-0">
            <label for="release-note-update-coverage">Coverage</label>
            <ng-select id="release-note-update-coverage" [items]="settings.releaseNoteUpdateCoverageOptions" bindLabel="label" bindValue="value"
                       [clearable]="false" [searchable]="false" [disabled]="creatingReleaseNoteUpdate || draftingReleaseNoteUpdate"
                       [(ngModel)]="settings.releaseNoteUpdateSettings(state, currentDraftId).coverage"/>
            <div class="text-muted small mt-1">{{ settings.releaseNoteUpdateCoverageHint(state, currentDraftId) }}</div>
          </div>
        </div>
        <div class="form-check mt-3">
          <input id="release-note-update-include-images" class="form-check-input" type="checkbox"
                 [disabled]="creatingReleaseNoteUpdate || draftingReleaseNoteUpdate"
                 [(ngModel)]="settings.releaseNoteUpdateSettings(state, currentDraftId).includeImages">
          <label class="form-check-label" for="release-note-update-include-images">
            <strong>Include suitable release-note images</strong>
            <span class="d-block text-muted small">Add a relevant image to a subject when one is available in its supporting release notes.</span>
          </label>
        </div>
      </div>
    </ng-template>

    <ng-template #releaseNoteUpdateComposeUi>
      <ng-container *ngTemplateOutlet="releaseNoteUpdateSettingsUi"/>
      <div class="mb-2 d-flex align-items-center flex-wrap gap-2">
        <button type="button" class="btn btn-primary btn-sm"
                [disabled]="draftingReleaseNoteUpdate"
                (click)="draft.emit()">
          <fa-icon [icon]="draftingReleaseNoteUpdate ? faSpinner : faWandMagicSparkles" [spin]="draftingReleaseNoteUpdate" class="me-1"/>
          {{ draftingReleaseNoteUpdate ? "Drafting…" : undoAvailable ? "Draft it again" : "Draft the update" }}
        </button>
        @if (undoAvailable) {
          <button type="button" class="btn btn-quiet btn-sm" (click)="undo.emit()">
            <fa-icon [icon]="faArrowRotateLeft" class="me-1"/>Undo draft
          </button>
        }
        <span class="text-muted small">Read it over before you send. Nothing goes out until you do.</span>
      </div>
    </ng-template>

  `})
export class EmailComposerUpdateSettingsComponent {
  @Input({required: true}) state!: EmailComposerState;
  @Input() currentDraftId: string | null = null;
  @Input() mode = EmailComposerUpdateSettingsMode.SETUP;
  @Input() creatingReleaseNoteUpdate = false;
  @Input() draftingReleaseNoteUpdate = false;
  @Input() templateValid = true;
  @Input() validationMessage = "";
  @Input() undoAvailable = false;
  @Output() create = new EventEmitter<void>();
  @Output() draft = new EventEmitter<void>();
  @Output() undo = new EventEmitter<void>();
  protected readonly EmailComposerUpdateSettingsMode = EmailComposerUpdateSettingsMode;
  protected settings = inject(EmailComposerUpdateSettingsService);
  protected stringUtils = inject(StringUtilsService);
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faSpinner = faSpinner;
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faArrowRotateLeft = faArrowRotateLeft;
}
