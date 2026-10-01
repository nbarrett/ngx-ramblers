import {Component, inject, Input} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faArrowRotateLeft, faSpinner, faWandMagicSparkles} from "@fortawesome/free-solid-svg-icons";
import {NgSelectModule} from "@ng-select/ng-select";
import {EmailComposerDraftingMode, EmailComposerUpdateSettingsMode, NewsletterStartMode} from "../../models/email-composer.model";
import {EmailComposerDraftingService} from "../../services/email-composer/email-composer-drafting.service";
import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {EmailComposerEventSelectionService} from "../../services/email-composer/email-composer-event-selection.service";
import {EmailComposerUpdateSettingsComponent} from "./email-composer-update-settings.component";

@Component({
  selector: "app-email-composer-drafting",
  imports: [FormsModule, FontAwesomeModule, NgSelectModule, EmailComposerUpdateSettingsComponent],
  template: `
    @switch (mode) {
      @case (EmailComposerDraftingMode.START) {

      <div class="mt-3 pt-3 border-top">
        @if (session.releaseNoteUpdateMode() && !drafting.creatingReleaseNoteUpdate) {
          <app-email-composer-update-settings [state]="session.state" [currentDraftId]="session.currentDraftId"
                                              [creatingReleaseNoteUpdate]="drafting.creatingReleaseNoteUpdate"
                                              [draftingReleaseNoteUpdate]="drafting.draftingReleaseNoteUpdate"
                                              [templateValid]="templateValid"
                                              [validationMessage]="validationMessage"
                                              [undoAvailable]="drafting.introDraftUndoAvailable()"
                                              (create)="drafting.createReleaseNoteUpdate()" (draft)="drafting.draftReleaseNoteUpdate()"
                                              (undo)="drafting.undoDraftedIntro()"
                                              [mode]="EmailComposerUpdateSettingsMode.PREVIOUS"/>
        } @else {
          <p class="text-muted small mb-3">{{ drafting.startModeHint() }}</p>
          <div class="row mb-3">
            <div class="col-sm-12">
              @for (mode of drafting.availableStartModes(); track mode) {
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" [id]="'composer-start-' + mode" name="composer-start-mode"
                         [checked]="drafting.effectiveStartMode() === mode"
                         (change)="drafting.newsletterStartMode = mode">
                  <label class="form-check-label" [for]="'composer-start-' + mode">{{ drafting.startModeLabel(mode) }}</label>
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
                  <label for="newsletter-start-period-select">Create a newsletter covering:</label>
                  <ng-select id="newsletter-start-period-select"
                             [items]="drafting.newsletterPeriodOptions"
                             bindLabel="periodLabel"
                             bindValue="key"
                             [clearable]="false"
                             [searchable]="false"
                             [(ngModel)]="drafting.newsletterStartPeriod"/>
                </div>
              } @else {
                <div class="col-sm-8 col-lg-6">
                  <label for="newsletter-free-text">Describe the newsletter you want:</label>
                  <input id="newsletter-free-text" type="text" class="form-control"
                         placeholder="everything up to the end of September, and mention the coach trip"
                         [(ngModel)]="drafting.newsletterFreeText">
                </div>
              }
              <div class="col-sm-4 mt-3 mt-sm-0">
                <button type="button" class="btn btn-primary"
                        [disabled]="drafting.creatingNewsletter || !templateValid"
                        [title]="templateValid ? '' : validationMessage"
                        (click)="drafting.createNewsletter()">
                  <fa-icon [icon]="drafting.creatingNewsletter ? faSpinner : faWandMagicSparkles" [spin]="drafting.creatingNewsletter" class="me-1"/>
                  {{ drafting.creatingNewsletter ? "Creating…" : "Create newsletter" }}
                </button>
              </div>
            </div>
            @if (!templateValid) {
              <div class="text-muted small mt-2">{{ validationMessage }}</div>
            }
          }
        }
      </div>

      }
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
                    }
                    @if (session.newsletterMode()) {
                      <div class="mb-2">
                        <div class="form-check">
                          <input class="form-check-input" type="checkbox" id="composer-offer-drafted-intro"
                                 [checked]="drafting.composerDrafting().offerDraftedIntro"
                                 (change)="drafting.setOfferDraftedIntro($any($event.target).checked)">
                          <label class="form-check-label" for="composer-offer-drafted-intro">
                            <strong>Offer a drafted intro</strong> — the coming walks and social events are pulled in for you, with an intro drafted from them. Everything stays editable afterwards.
                          </label>
                        </div>
                        @if (drafting.composerDrafting().offerDraftedIntro) {
                          <div class="form-check ms-4 mt-1">
                            <input class="form-check-input" type="checkbox" id="composer-only-approved-walks"
                                   [checked]="drafting.composerDrafting().onlyApprovedWalks"
                                   (change)="drafting.setOnlyApprovedWalks($any($event.target).checked)">
                            <label class="form-check-label" for="composer-only-approved-walks">
                              Only include walks that have been approved, so the draft does not mention walks still awaiting their details
                            </label>
                          </div>
                        }
                      </div>
                      @if (drafting.composerDrafting().offerDraftedIntro) {
                        <div class="row mb-2">
                          <div class="col-sm-6 col-lg-4">
                            <label for="draft-purpose">What should the intro do?</label>
                            <ng-select id="draft-purpose"
                                       [items]="drafting.draftPurposeOptions"
                                       bindLabel="label"
                                       bindValue="key"
                                       [clearable]="false"
                                       [searchable]="false"
                                       [(ngModel)]="drafting.draftPurpose"/>
                            <div class="text-muted small mt-1">{{ drafting.draftPurposeHint() }}</div>
                          </div>
                        </div>
                        <div class="mb-2 d-flex align-items-center flex-wrap gap-2">
                          <button type="button" class="btn btn-primary btn-sm"
                                  [disabled]="drafting.draftingIntro || events.selectedGroupEventCount() === 0"
                                  (click)="drafting.draftNewsletterIntro()">
                            <fa-icon [icon]="drafting.draftingIntro ? faSpinner : faWandMagicSparkles" [spin]="drafting.draftingIntro" class="me-1"/>
                            {{ drafting.draftingIntro ? "Drafting…" : drafting.introDraftUndoAvailable() ? "Draft it again" : "Draft the intro" }}
                          </button>
                          @if (drafting.introDraftUndoAvailable()) {
                            <button type="button" class="btn btn-quiet btn-sm" (click)="drafting.undoDraftedIntro()">
                              <fa-icon [icon]="faArrowRotateLeft" class="me-1"/>Undo draft
                            </button>
                          }
                          @let draftEventCount = drafting.eventsForDraftPurpose().length;
                          <span class="text-muted small">
                            @if (draftEventCount === 0) {
                              Nothing on the Events step matches {{ drafting.draftPurposeLabel() }} yet.
                            } @else {
                              Written from {{ draftEventCount }} of the {{ events.selectedGroupEventCount() }} selected {{ events.selectedGroupEventCount() === 1 ? "event" : "events" }}. Read it before you send.
                            }
                          </span>
                        </div>
                      }
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
export class EmailComposerDraftingComponent {
  @Input({required: true}) mode!: EmailComposerDraftingMode;
  @Input() templateValid = false;
  @Input() validationMessage = "";
  protected session = inject(EmailComposerSessionService);
  protected drafting = inject(EmailComposerDraftingService);
  protected events = inject(EmailComposerEventSelectionService);
  protected readonly EmailComposerDraftingMode = EmailComposerDraftingMode;
  protected readonly EmailComposerUpdateSettingsMode = EmailComposerUpdateSettingsMode;
  protected readonly NewsletterStartMode = NewsletterStartMode;
  protected readonly faSpinner = faSpinner;
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
  protected readonly faArrowRotateLeft = faArrowRotateLeft;
}
