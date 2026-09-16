import { Component, inject, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faEnvelope, faSave, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { AdminAlertsService } from "../../../../services/admin-alerts.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { RecipientFieldComponent } from "../../../../modules/common/recipient-field/recipient-field";
import { ComposerExternalRecipient } from "../../../../models/email-composer.model";
import { AdminAlertRecipient } from "../../../../models/admin-alerts.model";

@Component({
  selector: "app-admin-alert-emails",
  imports: [FontAwesomeModule, RecipientFieldComponent],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Admin alert emails</div>
      <div class="col-sm-12">
        <p class="mb-3">
          Platform-admin operations alerts go only to the people listed here. That covers scheduled-task problems
          (failed, missed, interrupted) and failed backup or restore sessions. Leave empty to log problems without
          sending mail. Stored in the database.
        </p>
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span class="badge d-inline-flex align-items-center gap-1"
                [class.text-bg-success]="savedRecipients.length > 0"
                [class.text-bg-secondary]="savedRecipients.length === 0">
            <fa-icon [icon]="faEnvelope"/>
            @if (savedRecipients.length > 0) {
              Alerts on · {{ stringUtils.pluraliseWithCount(savedRecipients.length, "recipient") }}
            } @else {
              Alerts off · no recipients
            }
          </span>
          @if (dirty) {
            <span class="badge text-bg-warning">Unsaved changes</span>
          }
        </div>
        @if (loading) {
          <p class="text-muted mb-3">
            <fa-icon [icon]="faSpinner" animation="spin" class="me-2"/>
            Loading alert recipients...
          </p>
        } @else {
          @if (draftRecipients.length === 0) {
            <div class="alert alert-warning d-flex align-items-start mb-3">
              <fa-icon [icon]="faCircleExclamation" class="me-2"/>
              <div><strong>No alert recipients</strong><p class="mb-0">Platform operations problems will be logged on the server only.</p></div>
            </div>
          }
          <app-recipient-field [to]="draftRecipients" (toChange)="recipientsChanged($event)" [plain]="true"/>
        }
        <div class="d-flex flex-wrap align-items-center gap-3 mt-3">
          <button type="button" class="btn btn-primary" [disabled]="busy || loading || !dirty" (click)="save()">
            <fa-icon [icon]="busy ? faSpinner : faSave" [animation]="busy ? 'spin' : null"/>
            Save alert emails
          </button>
          <button type="button" class="btn btn-quiet" [disabled]="busy || loading || !dirty"
                  (click)="resetDraft()">
            Discard changes
          </button>
          @if (saved) {
            <span class="text-success">Saved</span>
          }
          @if (error) {
            <span class="text-danger">{{ error }}</span>
          }
        </div>
      </div>
    </div>
  `
})
export class AdminAlertEmailsComponent implements OnInit {
  private service = inject(AdminAlertsService);
  protected stringUtils = inject(StringUtilsService);
  protected readonly faEnvelope = faEnvelope;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faSave = faSave;
  protected readonly faSpinner = faSpinner;
  protected loading = true;
  protected busy = false;
  protected saved = false;
  protected error: string | null = null;
  protected draftRecipients: ComposerExternalRecipient[] = [];
  protected savedRecipients: AdminAlertRecipient[] = [];

  ngOnInit(): void {
    void this.load();
  }

  protected get dirty(): boolean {
    return this.serialised(this.draftRecipients) !== this.serialised(this.savedRecipients);
  }

  private serialised(recipients: ComposerExternalRecipient[]): string {
    return recipients.map(recipient => `${recipient.email.toLowerCase()}|${recipient.name || ""}`).join("\n");
  }

  private showSaved(recipients: AdminAlertRecipient[]): void {
    this.savedRecipients = recipients;
    this.draftRecipients = recipients.map(recipient => ({...recipient}));
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.showSaved(await this.service.recipients());
    } catch (error: any) {
      this.error = error?.message || "Unable to load alert recipients";
    }
    this.loading = false;
  }

  protected recipientsChanged(recipients: ComposerExternalRecipient[]): void {
    this.saved = false;
    this.draftRecipients = recipients;
  }

  protected resetDraft(): void {
    this.showSaved(this.savedRecipients);
    this.saved = false;
    this.error = null;
  }

  protected async save(): Promise<void> {
    this.busy = true;
    this.saved = false;
    this.error = null;
    try {
      this.showSaved(await this.service.setRecipients(this.draftRecipients.map(recipient => ({email: recipient.email, name: recipient.name || ""}))));
      this.saved = true;
    } catch (error: any) {
      this.error = error?.message || "Unable to save alert recipients";
    }
    this.busy = false;
  }
}
