import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgSelectModule } from "@ng-select/ng-select";
import {
  DEFAULT_NEWSLETTER_INTRO_PURPOSE,
  NEWSLETTER_INTRO_PURPOSE_OPTIONS,
  NewsletterIntroPurpose,
  NewsletterIntroPurposeOption
} from "../../../../models/ai.model";
import { ComposerDrafting, defaultComposerDrafting, NotificationConfig } from "../../../../models/mail.model";
import { introPurposeFrom } from "../../../../functions/newsletter-purpose";
import {
  defaultWalkChangeIntroFields,
  walkChangeFieldsAfterToggle,
  walkChangeFieldsFrom,
  walkChangeIntroFieldChoices
} from "../../../../functions/walk-change-intro";

@Component({
  selector: "app-composer-drafting-defaults",
  imports: [FormsModule, NgSelectModule],
  template: `
    <div class="form-check">
      <input class="form-check-input" type="checkbox" id="offer-drafted-intro"
             [checked]="drafting().offerDraftedIntro"
             (change)="setOfferDraftedIntro($any($event.target).checked)">
      <label class="form-check-label" for="offer-drafted-intro">
        <strong>Offer a drafted intro</strong> - the composer can write the opening paragraph from the events being sent. The wording stays editable.
      </label>
    </div>
    @if (drafting().offerDraftedIntro) {
      <div class="mt-3">
        <label for="config-draft-purpose">What the intro should do</label>
        <ng-select id="config-draft-purpose"
                   [items]="purposeOptions"
                   bindLabel="label"
                   bindValue="key"
                   [clearable]="false"
                   [searchable]="false"
                   [appendTo]="'body'"
                   [ngModel]="introPurposeFrom(drafting())"
                   (ngModelChange)="setIntroPurpose($event)"/>
        <div class="text-muted small mt-1">{{ purposeHint() }}</div>
      </div>
      @if (introPurposeFrom(drafting()) === NewsletterIntroPurpose.UPCOMING_EVENTS) {
        <div class="form-check mt-3">
          <input class="form-check-input" type="checkbox" id="config-only-approved-walks"
                 [checked]="drafting().onlyApprovedWalks"
                 (change)="setOnlyApprovedWalks($any($event.target).checked)">
          <label class="form-check-label" for="config-only-approved-walks">
            Only include walks that have been approved, so the draft does not mention walks still awaiting their details
          </label>
        </div>
        <div class="mt-3">
          <div class="fw-bold mb-1">Details to mention when a walk has changed</div>
          <div class="text-muted small mb-2">Set once for this email type. The intro covers the whole programme, and only the ticked fields are mentioned when a walk's details have changed.</div>
          <div class="row">
            @for (choice of fieldChoices; track choice.field) {
              <div class="col-md-6">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" [id]="'config-walk-change-field-' + $index"
                         [checked]="walkChangeFieldSelected(choice.field)"
                         (change)="setWalkChangeField(choice.field, $any($event.target).checked)">
                  <label class="form-check-label" [for]="'config-walk-change-field-' + $index">{{ choice.label }}</label>
                </div>
              </div>
            }
          </div>
        </div>
      }
    }
  `
})
export class ComposerDraftingDefaultsComponent {
  @Input({required: true}) notificationConfig!: NotificationConfig;
  protected purposeOptions: NewsletterIntroPurposeOption[] = NEWSLETTER_INTRO_PURPOSE_OPTIONS;
  protected fieldChoices = walkChangeIntroFieldChoices();
  protected readonly NewsletterIntroPurpose = NewsletterIntroPurpose;
  protected readonly introPurposeFrom = introPurposeFrom;

  protected drafting(): ComposerDrafting {
    return this.notificationConfig?.composerDrafting ?? defaultComposerDrafting();
  }

  protected purposeHint(): string {
    return this.purposeOptions.find(option => option.key === introPurposeFrom(this.drafting()))?.hint ?? "";
  }

  protected setOfferDraftedIntro(offerDraftedIntro: boolean): void {
    const walkChangeFields = offerDraftedIntro && !this.drafting().walkChangeFields?.length
      ? defaultWalkChangeIntroFields()
      : this.drafting().walkChangeFields;
    this.patch({
      offerDraftedIntro,
      introPurpose: this.drafting().introPurpose ?? DEFAULT_NEWSLETTER_INTRO_PURPOSE,
      walkChangeFields
    });
  }

  protected setIntroPurpose(introPurpose: NewsletterIntroPurpose): void {
    this.patch({
      introPurpose,
      onlyApprovedWalks: introPurpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST ? false : this.drafting().onlyApprovedWalks
    });
  }

  protected setOnlyApprovedWalks(onlyApprovedWalks: boolean): void {
    this.patch({onlyApprovedWalks});
  }

  protected walkChangeFieldSelected(field: string): boolean {
    return walkChangeFieldsFrom(this.drafting()).includes(field);
  }

  protected setWalkChangeField(field: string, selected: boolean): void {
    this.patch({
      walkChangeFields: walkChangeFieldsAfterToggle(walkChangeFieldsFrom(this.drafting()), field, selected)
    });
  }

  private patch(partial: Partial<ComposerDrafting>): void {
    this.notificationConfig.composerDrafting = {...this.drafting(), ...partial};
  }
}
