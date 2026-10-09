import {Component, inject, Input, OnInit} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faAlignCenter, faAlignLeft, faArrowRotateLeft, faListUl, faSpinner, faWandMagicSparkles} from "@fortawesome/free-solid-svg-icons";
import {NgSelectModule} from "@ng-select/ng-select";
import {EmailComposerDraftingMode, EmailComposerUpdateSettingsMode, NewsletterStartMode} from "../../models/email-composer.model";
import {RESEND_WITHIN_PERIOD_LABEL} from "../../functions/newsletter-purpose";
import {EmailComposerDraftingService} from "../../services/email-composer/email-composer-drafting.service";
import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {EmailComposerEventSelectionService} from "../../services/email-composer/email-composer-event-selection.service";
import {EmailComposerUpdateSettingsComponent} from "./email-composer-update-settings.component";
import {ButtonDropdownComponent} from "../../modules/common/button-dropdown/button-dropdown";
import {ButtonDropdownItem} from "../../models/button-dropdown.model";
import {NEWSLETTER_INTRO_DETAIL_OPTIONS, NewsletterIntroDetail} from "../../models/ai.model";

@Component({
  selector: "app-email-composer-drafting",
  imports: [FormsModule, FontAwesomeModule, NgSelectModule, EmailComposerUpdateSettingsComponent, ButtonDropdownComponent],
  template: `
    @switch (mode) {
      @case (EmailComposerDraftingMode.INTRO) {
                    @if (session.releaseNoteUpdateMode()) {
                      <app-email-composer-update-settings [state]="session.state" [currentDraftId]="session.currentDraftId"
                                                          [creatingReleaseNoteUpdate]="drafting.creatingReleaseNoteUpdate"
                                                          [draftingReleaseNoteUpdate]="drafting.draftingReleaseNoteUpdate"
                                                          [templateValid]="templateValid"
                                                          [validationMessage]="validationMessage"
                                                          [undoAvailable]="drafting.introDraftUndoAvailable()"
                                                          (create)="drafting.createReleaseNoteUpdate()"
                                                          (draft)="drafting.draftReleaseNoteUpdate()" (undo)="drafting.undoDraftedIntro()"
                                                          [mode]="EmailComposerUpdateSettingsMode.COMPOSE"/>
                    } @else if (drafting.availableStartModes().length) {
                      <div class="mb-3">
                        <p class="text-muted small mb-3">{{ drafting.startModeHint() }}</p>
                        <div class="row mb-3">
                          <div class="col-sm-12">
                            @for (startMode of drafting.availableStartModes(); track startMode) {
                              <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" [id]="'composer-start-' + startMode" name="composer-start-mode"
                                       [checked]="drafting.effectiveStartMode() === startMode"
                                       (change)="drafting.newsletterStartMode = startMode">
                                <label class="form-check-label" [for]="'composer-start-' + startMode">{{ drafting.startModeLabel(startMode) }}</label>
                              </div>
                            }
                          </div>
                        </div>
                        @if (drafting.effectiveStartMode() === NewsletterStartMode.UPDATE) {
                          <app-email-composer-update-settings [state]="session.state" [currentDraftId]="session.currentDraftId"
                                                              [creatingReleaseNoteUpdate]="drafting.creatingReleaseNoteUpdate"
                                                              [draftingReleaseNoteUpdate]="drafting.draftingReleaseNoteUpdate"
                                                              [templateValid]="templateValid"
                                                              [validationMessage]="validationMessage"
                                                              [undoAvailable]="drafting.introDraftUndoAvailable()"
                                                              (create)="drafting.createReleaseNoteUpdate()" (draft)="drafting.draftReleaseNoteUpdate()"
                                                              (undo)="drafting.undoDraftedIntro()"/>
                        } @else {
                          <div class="row align-items-end">
                            @if (drafting.effectiveStartMode() === NewsletterStartMode.PERIOD) {
                              <div class="col-sm-6 col-lg-4">
                                <label for="newsletter-start-period-select">{{ drafting.periodSelectLabel() }}</label>
                                <ng-select id="newsletter-start-period-select"
                                           [items]="drafting.newsletterPeriodOptions"
                                           bindLabel="periodLabel"
                                           bindValue="key"
                                           [clearable]="false"
                                           [searchable]="false"
                                           [ngModel]="drafting.newsletterStartPeriod"
                                           (ngModelChange)="drafting.onNewsletterStartPeriodChange($event)"/>
                              </div>
                            } @else {
                              <div class="col-sm-8 col-lg-6">
                                <label for="newsletter-free-text">{{ drafting.walkLeaderRequest() ? "Describe the dates you want to cover:" : "Describe the newsletter you want:" }}</label>
                                <input id="newsletter-free-text" type="text" class="form-control"
                                       [placeholder]="drafting.walkLeaderRequest() ? 'all the empty Sunday slots for the rest of the year' : 'everything up to the end of September, and mention the coach trip'"
                                       [(ngModel)]="drafting.newsletterFreeText">
                              </div>
                              <div class="col-sm-4 mt-3 mt-sm-0">
                                <button type="button" class="btn btn-primary"
                                        [disabled]="drafting.creatingNewsletter || !templateValid"
                                        [title]="templateValid ? '' : validationMessage"
                                        (click)="drafting.createNewsletter()">
                                  <fa-icon [icon]="drafting.creatingNewsletter ? faSpinner : faWandMagicSparkles" [spin]="drafting.creatingNewsletter" class="me-1"/>
                                  {{ drafting.createActionLabel() }}
                                </button>
                              </div>
                            }
                          </div>
                          @if (!templateValid) {
                            <div class="text-muted small mt-2">{{ validationMessage }}</div>
                          }
                          @if (drafting.creatingNewsletter && drafting.effectiveStartMode() === NewsletterStartMode.PERIOD) {
                            <div class="text-muted small mt-2">Selecting the events for that period…</div>
                          }
                        }
                      </div>
                    }
                    @if (drafting.introDraftOffered()) {
                      <div class="text-muted small mb-2">{{ drafting.draftPurposeHint() }}</div>
                      <div class="mb-2 d-flex align-items-center flex-wrap gap-2">
                        @if (drafting.walkLeaderRequest()) {
                          <button type="button" class="btn btn-primary btn-sm"
                                  [disabled]="drafting.draftingIntro || events.selectedGroupEventCount() === 0"
                                  (click)="drafting.draftNewsletterIntro()">
                            <fa-icon [icon]="drafting.draftingIntro ? faSpinner : faWandMagicSparkles" [spin]="drafting.draftingIntro" class="me-1"/>
                            {{ drafting.draftingIntro ? "Drafting…" : drafting.introDraftUndoAvailable() ? "Draft it again" : "Draft the intro" }}
                          </button>
                        } @else {
                          <div class="d-inline-flex">
                            <app-button-dropdown [label]="drafting.draftingIntro ? 'Drafting…' : drafting.introDraftUndoAvailable() ? 'Draft it again' : 'Draft the intro'"
                                                 [icon]="drafting.draftingIntro ? faSpinner : faWandMagicSparkles"
                                                 [iconSpin]="drafting.draftingIntro"
                                                 buttonClass="btn btn-primary btn-sm"
                                                 tooltip="Choose how much detail to include"
                                                 [items]="introDetailItems()"
                                                 [defaultItemId]="drafting.introDetail"
                                                 [disabled]="drafting.draftingIntro || events.selectedGroupEventCount() === 0"
                                                 (itemSelect)="drafting.onIntroDetailSelect($event)"/>
                          </div>
                        }
                        @if (drafting.introDraftUndoAvailable()) {
                          <button type="button" class="btn btn-quiet btn-sm" (click)="drafting.undoDraftedIntro()">
                            <fa-icon [icon]="faArrowRotateLeft" class="me-1"/>Undo draft
                          </button>
                        }
                        @let draftEventCount = drafting.eventsForDraftPurpose().length;
                        <span class="text-muted small">
                          @if (draftEventCount === 0) {
                            @let copy = drafting.emptyDraftPurposeCopy();
                            {{ copy.before }}
                            @if (copy.after) {
                              <button type="button" class="btn btn-link p-0 align-baseline" (click)="drafting.ignorePreviousNewsletter()">{{ resendWithinPeriodLabel }}</button>{{ copy.after }}
                            }
                          } @else {
                            Written from {{ draftEventCount }} of the {{ events.selectedGroupEventCount() }} selected {{ events.selectedGroupEventCount() === 1 ? "event" : "events" }}. Read it before you send.
                          }
                        </span>
                      </div>
                    }

      }
      @case (EmailComposerDraftingMode.EVENT_SETTINGS) {

      <div class="row mb-3">
        <div class="col-sm-4">
          <label for="newsletter-cadence">How often this newsletter goes out:</label>
          <ng-select id="newsletter-cadence"
                     [items]="drafting.newsletterCadenceOptions"
                     bindLabel="label"
                     bindValue="key"
                     [clearable]="false"
                     [searchable]="false"
                     [ngModel]="session.state.newsletter!.cadence"
                     (ngModelChange)="drafting.onNewsletterCadenceChange($event)"/>
        </div>
        <div class="col-sm-8 d-flex align-items-end">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="newsletter-mark-new"
                   [(ngModel)]="session.state.newsletter!.markNewEvents"
                   (ngModelChange)="drafting.onMarkNewEventsChanged()">
            <label class="form-check-label" for="newsletter-mark-new">
              Point out which events are new since the last newsletter
            </label>
          </div>
        </div>
      </div>

      }

    }
  `
})
export class EmailComposerDraftingComponent implements OnInit {
  @Input({required: true}) mode!: EmailComposerDraftingMode;
  @Input() templateValid = false;
  @Input() validationMessage = "";
  protected session = inject(EmailComposerSessionService);
  protected drafting = inject(EmailComposerDraftingService);
  protected events = inject(EmailComposerEventSelectionService);

  ngOnInit(): void {
    if (this.mode === EmailComposerDraftingMode.INTRO) {
      this.drafting.ensurePeriodEvents();
    }
  }

  protected introDetailItems(): ButtonDropdownItem[] {
    return NEWSLETTER_INTRO_DETAIL_OPTIONS.map(option => ({
      id: option.key,
      label: option.label,
      extraLabel: option.extraLabel,
      icon: option.key === NewsletterIntroDetail.LESS
        ? faAlignLeft
        : option.key === NewsletterIntroDetail.MORE
          ? faListUl
          : faAlignCenter,
      selected: this.drafting.introDetail === option.key
    }));
  }

  protected readonly EmailComposerDraftingMode = EmailComposerDraftingMode;
  protected readonly EmailComposerUpdateSettingsMode = EmailComposerUpdateSettingsMode;
  protected readonly NewsletterStartMode = NewsletterStartMode;
  protected readonly faSpinner = faSpinner;
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
  protected readonly faArrowRotateLeft = faArrowRotateLeft;
  protected readonly resendWithinPeriodLabel = RESEND_WITHIN_PERIOD_LABEL;
}
