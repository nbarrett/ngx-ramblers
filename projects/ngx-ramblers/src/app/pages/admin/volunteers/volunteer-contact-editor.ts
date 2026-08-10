import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgSelectComponent } from "@ng-select/ng-select";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../../models/member.model";
import {
  CreateExternalRecipientRequest,
  ExternalContactDuplicate,
  ExternalContactType,
  ExternalRecipient
} from "../../../models/external-recipient.model";
import { VolunteerParish } from "../../../models/volunteer-management.model";
import { externalContactDuplicates, externalContactTypeLabel } from "../../../functions/external-contacts";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberSelector } from "../../../shared/components/member-selector";
import { values } from "es-toolkit/compat";

@Component({
  selector: "app-volunteer-contact-editor",
  imports: [FormsModule, FontAwesomeModule, MemberSelector, NgSelectComponent],
  template: `
    <section class="contact-editor" aria-labelledby="contact-editor-heading">
      <div class="contact-editor-heading">
        <div>
          <h2 id="contact-editor-heading">{{ contact?.id ? "Edit" : "Add" }} contact</h2>
          <p class="mb-0">Organisations and people outside the supporter list, such as parish councils and local-authority offices.</p>
        </div>
      </div>
      <div class="contact-form">
        <label>Contact type
          <select class="form-select" [(ngModel)]="contactType" [disabled]="saving">
            @for (type of contactTypes; track type) {
              <option [ngValue]="type">{{ typeLabel(type) }}</option>
            }
          </select>
        </label>
        <label>Organisation
          <input class="form-control" type="text" [(ngModel)]="organisationName" [disabled]="saving" placeholder="e.g. Chartham Parish Council">
        </label>
        <label>Contact name
          <input class="form-control" type="text" [(ngModel)]="contactName" [disabled]="saving" placeholder="e.g. the parish clerk's name">
        </label>
        <label>Role or title
          <input class="form-control" type="text" [(ngModel)]="roleTitle" [disabled]="saving" placeholder="e.g. Parish Clerk">
        </label>
        <label>Email
          <input class="form-control" type="email" [(ngModel)]="email" [disabled]="saving" required>
        </label>
        <label>Telephone
          <input class="form-control" type="tel" [(ngModel)]="telephone" [disabled]="saving">
        </label>
        <label class="wide-field">Postal address
          <textarea class="form-control" rows="2" [(ngModel)]="postalAddress" [disabled]="saving"></textarea>
        </label>
        <label class="wide-field">Linked parishes
          <ng-select [items]="parishes" bindLabel="parishName" bindValue="parishCode" [multiple]="true"
                     [closeOnSelect]="false" [disabled]="saving" placeholder="Link this contact to parishes"
                     [(ngModel)]="parishCodes"/>
        </label>
        <label class="wide-field">Linked supporter
          <app-member-selector [members]="members" placeholder="Link to a supporter record if this person is also a supporter" [(selectedMember)]="supporter" [disabled]="saving"/>
        </label>
        <label class="wide-field">Notes
          <textarea class="form-control" rows="3" [(ngModel)]="notes" [disabled]="saving"></textarea>
        </label>
      </div>
      @if (duplicates.length > 0) {
        <div class="alert alert-warning d-flex align-items-start gap-3" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div>
            <strong>Possible duplicate contact</strong>
            <div>These existing contacts look like the same organisation or person. Check before saving a second record.</div>
            <ul class="mb-0 mt-2">
              @for (duplicate of duplicates; track duplicate.id) {
                <li>{{ duplicate.displayName }} ({{ duplicate.email }}) — {{ duplicate.reason }}</li>
              }
            </ul>
          </div>
        </div>
      }
      <div class="contact-actions">
        <button type="button" class="btn btn-primary" (click)="emitSave()" [disabled]="saving || !email">{{ saving ? "Saving…" : "Save contact" }}</button>
        @if (contact?.id) {
          <button type="button" class="btn btn-quiet" (click)="remove.emit(contact.id)" [disabled]="saving">Delete contact</button>
        }
        <button type="button" class="btn btn-quiet" (click)="close.emit()" [disabled]="saving"><fa-icon [icon]="faXmark" class="me-1"/>Cancel</button>
      </div>
    </section>
  `,
  styles: [`
    .contact-editor
      display: grid
      gap: var(--space-4)
      padding: var(--space-5)
      border: 1px solid var(--rsm-border)
      border-left: 8px solid var(--ramblers-colour-sunrise)
      border-radius: var(--rsm-panel-radius)
      background: var(--rsm-panel-bg)
    .contact-editor-heading
      display: flex
      align-items: start
      justify-content: space-between
      gap: var(--space-3)
    .contact-editor-heading h2
      margin: 0
      font-size: 1.25rem
    .contact-form
      display: grid
      grid-template-columns: repeat(3, minmax(0, 1fr))
      gap: var(--space-3)
    .contact-form label
      display: grid
      gap: var(--space-2)
      font-weight: 600
    .contact-form app-member-selector, .contact-form ng-select
      display: block
      min-width: 0
    .wide-field
      grid-column: 1 / -1
    .contact-actions
      display: flex
      gap: var(--space-2)
      position: sticky
      bottom: 0
      padding-top: var(--space-3)
      background: var(--rsm-panel-bg)
    @media (max-width: 767.98px)
      .contact-form
        grid-template-columns: 1fr
      .contact-editor-heading
        align-items: stretch
        flex-direction: column
      .contact-actions
        flex-direction: column
      .contact-actions .btn, .contact-editor-heading .btn
        width: 100%
  `]
})
export class VolunteerContactEditor {
  private logger: Logger = inject(LoggerFactory).createLogger("VolunteerContactEditor", NgxLoggerLevel.ERROR);
  protected readonly faXmark = faXmark;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly contactTypes = values(ExternalContactType);

  @Input() members: Member[] = [];
  @Input() parishes: VolunteerParish[] = [];
  @Input() existingContacts: ExternalRecipient[] = [];
  @Input() saving = false;
  @Input() set editing(contact: ExternalRecipient | null) {
    this.contact = contact;
    this.contactType = contact?.contactType ?? ExternalContactType.PARISH_COUNCIL;
    this.organisationName = contact?.organisationName ?? "";
    this.contactName = contact?.contactName ?? "";
    this.roleTitle = contact?.roleTitle ?? "";
    this.email = contact?.email ?? "";
    this.telephone = contact?.telephone ?? "";
    this.postalAddress = contact?.postalAddress ?? "";
    this.parishCodes = contact?.parishCodes ?? [];
    this.supporter = contact?.supporterId ? this.members.find(member => member.id === contact.supporterId) ?? null : null;
    this.notes = contact?.notes ?? "";
    this.logger.debug("editing contact:", contact?.id);
  }

  @Output() save = new EventEmitter<CreateExternalRecipientRequest>();
  @Output() remove = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  protected contact: ExternalRecipient | null = null;
  protected contactType = ExternalContactType.PARISH_COUNCIL;
  protected organisationName = "";
  protected contactName = "";
  protected roleTitle = "";
  protected email = "";
  protected telephone = "";
  protected postalAddress = "";
  protected parishCodes: string[] = [];
  protected supporter: Member | null = null;
  protected notes = "";

  protected typeLabel(contactType: ExternalContactType): string {
    return externalContactTypeLabel(contactType);
  }

  protected get duplicates(): ExternalContactDuplicate[] {
    return externalContactDuplicates(this.contactRequest(), this.existingContacts);
  }

  protected emitSave(): void {
    this.save.emit(this.contactRequest());
  }

  private contactRequest(): ExternalRecipient {
    return {
      id: this.contact?.id,
      email: this.email.trim(),
      organisationName: this.organisationName.trim(),
      contactName: this.contactName.trim(),
      roleTitle: this.roleTitle.trim(),
      telephone: this.telephone.trim(),
      postalAddress: this.postalAddress.trim(),
      contactType: this.contactType,
      parishCodes: this.parishCodes,
      supporterId: this.supporter?.id || null,
      notes: this.notes.trim(),
      createdBy: this.contact?.createdBy,
      createdAt: this.contact?.createdAt
    };
  }
}
