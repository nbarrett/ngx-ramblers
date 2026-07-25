import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEnvelope, faPlus, faSave, faSpinner, faTimes } from "@fortawesome/free-solid-svg-icons";
import { AdminAlertsService } from "../../../../services/admin-alerts.service";
import { StringUtilsService } from "../../../../services/string-utils.service";

@Component({
  selector: "app-admin-alert-emails",
  imports: [FormsModule, FontAwesomeModule],
  styles: [`
    .alert-email-chip
      display: inline-flex
      align-items: center
      gap: 0.4rem
      padding: 0.35rem 0.65rem
      border-radius: 999px
      background: var(--bs-secondary-bg, #e9ecef)
      border: 1px solid var(--bs-border-color, #dee2e6)
      font-size: 0.9rem
      max-width: 100%

    .alert-email-chip-label
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap

    .alert-email-chip-remove
      display: inline-flex
      align-items: center
      justify-content: center
      width: 1.5rem
      height: 1.5rem
      min-width: 1.5rem
      min-height: 1.5rem
      padding: 0
      border: none
      border-radius: 50%
      background: transparent
      color: inherit
      line-height: 1

    .alert-email-chip-remove:hover:not(:disabled)
      background: rgba(0, 0, 0, 0.08)

    .alert-email-chip-list
      display: flex
      flex-wrap: wrap
      gap: 0.5rem
      min-height: 2.5rem

    .alert-email-add-row
      display: flex
      flex-wrap: wrap
      gap: 0.5rem
      align-items: stretch

    .alert-email-add-row .form-control
      flex: 1 1 16rem
      min-width: 12rem
      min-height: 40px

    .alert-email-add-row .btn
      min-height: 40px

    .alert-email-status
      display: inline-flex
      align-items: center
      gap: 0.4rem
  `],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Admin alert emails</div>
      <div class="col-sm-12">
        <p class="mb-3">
          Platform-admin operations alerts go only to the addresses listed here. That covers scheduled-task problems
          (failed, missed, interrupted) and failed backup or restore sessions. Leave empty to log problems without
          sending mail. Stored in the database.
        </p>

        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span class="alert-email-status badge"
                [class.text-bg-success]="savedEmails.length > 0"
                [class.text-bg-secondary]="savedEmails.length === 0">
            <fa-icon [icon]="faEnvelope"/>
            @if (savedEmails.length > 0) {
              Alerts on · {{ stringUtils.pluraliseWithCount(savedEmails.length, "recipient") }}
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
            Loading alert emails...
          </p>
        } @else if (draftEmails.length === 0) {
          <div class="alert alert-warning mb-3">
            No admin alert recipients configured. Platform operations problems will be logged on the server only.
          </div>
        } @else {
          <div class="alert-email-chip-list mb-3" role="list" aria-label="Admin alert email recipients">
            @for (email of draftEmails; track email) {
              <span class="alert-email-chip" role="listitem">
                <span class="alert-email-chip-label" [title]="email">{{ email }}</span>
                <button type="button" class="alert-email-chip-remove" [disabled]="busy"
                        [attr.aria-label]="'Remove ' + email" (click)="removeEmail(email)">
                  <fa-icon [icon]="faTimes"/>
                </button>
              </span>
            }
          </div>
        }

        <div class="alert-email-add-row mb-2">
          <input id="admin-alert-email-input" class="form-control" type="email"
                 [(ngModel)]="candidateEmail" [disabled]="busy || loading"
                 placeholder="name@example.com"
                 autocomplete="email"
                 (keydown.enter)="addEmailFromInput($event)">
          <button type="button" class="btn btn-primary" [disabled]="busy || loading || !canAddCandidate"
                  (click)="addEmailFromInput()">
            <fa-icon [icon]="faPlus"/> Add
          </button>
        </div>
        @if (inputError) {
          <div class="text-danger small mb-2">{{ inputError }}</div>
        }

        <div class="d-flex flex-wrap align-items-center gap-3 mt-3">
          <button type="button" class="btn btn-primary" [disabled]="busy || loading || !dirty" (click)="save()">
            <fa-icon [icon]="busy ? faSpinner : faSave" [animation]="busy ? 'spin' : null"/>
            Save alert emails
          </button>
          <button type="button" class="btn btn-outline-secondary" [disabled]="busy || loading || !dirty"
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
  protected readonly faPlus = faPlus;
  protected readonly faSave = faSave;
  protected readonly faSpinner = faSpinner;
  protected readonly faTimes = faTimes;
  protected loading = true;
  protected busy = false;
  protected saved = false;
  protected error: string | null = null;
  protected inputError: string | null = null;
  protected candidateEmail = "";
  protected draftEmails: string[] = [];
  protected savedEmails: string[] = [];

  ngOnInit(): void {
    void this.load();
  }

  protected get dirty(): boolean {
    return this.serialised(this.draftEmails) !== this.serialised(this.savedEmails);
  }

  protected get canAddCandidate(): boolean {
    return !!this.normaliseEmail(this.candidateEmail);
  }

  private serialised(emails: string[]): string {
    return emails.map(email => email.toLowerCase()).join("\n");
  }

  private normaliseEmail(value: string): string | null {
    const email = value.trim();
    if (!email) {
      return null;
    }
    if (!email.includes("@") || email.startsWith("@") || email.endsWith("@") || email.includes(" ")) {
      return null;
    }
    return email;
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const emails = await this.service.alertEmails();
      this.savedEmails = [...emails];
      this.draftEmails = [...emails];
    } catch (error: any) {
      this.error = error?.message || "Unable to load alert emails";
    }
    this.loading = false;
  }

  protected addEmailFromInput(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.inputError = null;
    this.saved = false;
    const email = this.normaliseEmail(this.candidateEmail);
    if (!email) {
      this.inputError = "Enter a valid email address";
      return;
    }
    if (this.draftEmails.some(existing => existing.toLowerCase() === email.toLowerCase())) {
      this.inputError = "That address is already in the list";
      return;
    }
    this.draftEmails = [...this.draftEmails, email];
    this.candidateEmail = "";
  }

  protected removeEmail(email: string): void {
    this.saved = false;
    this.inputError = null;
    this.draftEmails = this.draftEmails.filter(existing => existing !== email);
  }

  protected resetDraft(): void {
    this.draftEmails = [...this.savedEmails];
    this.candidateEmail = "";
    this.inputError = null;
    this.saved = false;
    this.error = null;
  }

  protected async save(): Promise<void> {
    this.busy = true;
    this.saved = false;
    this.error = null;
    this.inputError = null;
    try {
      const emails = await this.service.setAlertEmails(this.draftEmails);
      this.savedEmails = [...emails];
      this.draftEmails = [...emails];
      this.saved = true;
    } catch (error: any) {
      this.error = error?.message || "Unable to save alert emails";
    }
    this.busy = false;
  }
}
