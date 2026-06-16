import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import { ComposerExternalRecipient, RecipientField, RecipientFieldConfig } from "../../../models/email-composer.model";
import { ExternalRecipient } from "../../../models/external-recipient.model";
import { DateUtilsService } from "../../../services/date-utils.service";

@Component({
  selector: "app-recipient-field",
  imports: [FormsModule, FontAwesomeModule, TooltipDirective],
  styleUrl: "./recipient-field.sass",
  template: `
    <div class="recipient-field">
      @for (field of fields; track field.key) {
        @if (isVisible(field.key)) {
          <div class="recipient-line"
               [class.is-active]="activeField === field.key"
               (dragover)="onDragOver($event)"
               (drop)="onDrop(field.key, $event)">
            <span class="recipient-line-label">{{ field.label }}</span>
            <div class="recipient-line-tokens">
              @for (recipient of valueFor(field.key); track recipient.email; let idx = $index) {
                <span class="recipient-chip"
                      [class.is-editing]="isEditing(field.key, idx)"
                      draggable="true"
                      (dragstart)="onDragStart(field.key, recipient)"
                      (dragend)="onDragEnd()"
                      [tooltip]="recipient.email"
                      placement="bottom">
                  <button type="button" class="recipient-chip-label" (click)="openEditor(field.key, idx)">{{ recipient.name || recipient.email }}</button>
                  <button type="button" class="recipient-chip-remove"
                          (click)="remove(field.key, idx); $event.stopPropagation()"
                          [attr.aria-label]="'Remove ' + recipient.email">
                    <fa-icon [icon]="faXmark"/>
                  </button>
                </span>
              }
              <input type="email"
                     class="recipient-input"
                     [ngModel]="draft[field.key]"
                     (ngModelChange)="onDraftChange(field.key, $event)"
                     (keydown.enter)="onEnter(field.key, $event)"
                     (keydown.arrowdown)="onSuggestionNav(field.key, 1, $event)"
                     (keydown.arrowup)="onSuggestionNav(field.key, -1, $event)"
                     (keydown.escape)="onSuggestionEscape()"
                     (focus)="onFocus(field.key)"
                     (blur)="onBlur(field.key)"
                     [placeholder]="valueFor(field.key).length ? 'Add…' : 'Add people…'">
            </div>
            @if (editing?.field === field.key && editingRecipient(); as edited) {
              <div class="recipient-editor-backdrop" (click)="closeEditor()"></div>
              <div class="recipient-editor">
                <div class="recipient-editor-address">{{ edited.email }}</div>
                <label class="recipient-editor-row">
                  <span class="recipient-editor-caption">Name</span>
                  <input type="text" class="recipient-editor-input"
                         [ngModel]="edited.name || ''"
                         (ngModelChange)="renameEditing($event)"
                         placeholder="Display name">
                </label>
                <div class="recipient-editor-row">
                  <span class="recipient-editor-caption">Field</span>
                  <div class="recipient-editor-switch">
                    @for (target of fields; track target.key) {
                      <button type="button"
                              [class.is-current]="editing?.field === target.key"
                              (click)="moveEditingTo(target.key)">{{ target.label }}</button>
                    }
                  </div>
                </div>
                @if (isSavedContact(edited)) {
                  <p class="recipient-editor-saved"><fa-icon [icon]="faCheck"/> Already in your saved addresses</p>
                } @else {
                  <label class="recipient-editor-check">
                    <input type="checkbox" class="form-check-input" [ngModel]="edited.saveForReuse" (ngModelChange)="toggleEditingSave($event)">
                    Save this address for re-use
                  </label>
                }
                <button type="button" class="recipient-editor-remove" (click)="removeEditing()">
                  <fa-icon [icon]="faXmark"/> Remove from this email
                </button>
              </div>
            }
            @if (field.key === RecipientField.TO) {
              <div class="recipient-line-aux">
                @if (!isVisible(RecipientField.CC)) {
                  <button type="button" class="recipient-reveal" (click)="revealCc()">Cc</button>
                }
                @if (!isVisible(RecipientField.BCC)) {
                  <button type="button" class="recipient-reveal" (click)="revealBcc()">Bcc</button>
                }
              </div>
            }
            @if (showSuggestions(field.key)) {
              <ul class="recipient-suggestions" (mousedown)="$event.preventDefault()">
                <li class="recipient-suggestions-heading">Previously saved</li>
                @for (suggestion of suggestions(field.key); track suggestion.id || suggestion.email; let i = $index) {
                  <li>
                    <button type="button" class="recipient-suggestion"
                            [class.is-active]="activeSuggestionIndex === i"
                            (mouseenter)="activeSuggestionIndex = i"
                            (click)="chooseSuggestion(field.key, suggestion)">
                      <span class="recipient-suggestion-main">
                        <strong>{{ suggestion.name || suggestion.email }}</strong>
                        @if (suggestion.name) { <span class="recipient-suggestion-email">{{ suggestion.email }}</span> }
                      </span>
                      <span class="recipient-suggestion-meta">{{ lastUsedDescription(suggestion) }}</span>
                    </button>
                  </li>
                }
              </ul>
            }
            @if (field.hint) {
              <span class="recipient-line-hint">{{ field.hint }}</span>
            }
          </div>
          @if (error[field.key]) {
            <p class="recipient-error">{{ error[field.key] }}</p>
          }
        }
      }
      <label class="recipient-save">
        <input type="checkbox" class="form-check-input"
               [ngModel]="saveForReuse"
               (ngModelChange)="onSaveForReuseChange($event)">
        Save new addresses for re-use in future sends
      </label>
    </div>
  `
})
export class RecipientFieldComponent {

  private dateUtils = inject(DateUtilsService);

  @Input() to: ComposerExternalRecipient[] = [];
  @Input() cc: ComposerExternalRecipient[] = [];
  @Input() bcc: ComposerExternalRecipient[] = [];
  @Input() savedRecipients: ExternalRecipient[] = [];
  @Input() saveForReuse = true;

  @Output() toChange = new EventEmitter<ComposerExternalRecipient[]>();
  @Output() ccChange = new EventEmitter<ComposerExternalRecipient[]>();
  @Output() bccChange = new EventEmitter<ComposerExternalRecipient[]>();
  @Output() saveForReuseChange = new EventEmitter<boolean>();

  protected readonly RecipientField = RecipientField;
  protected readonly faXmark = faXmark;
  protected readonly faCheck = faCheck;

  protected readonly fields: RecipientFieldConfig[] = [
    { key: RecipientField.TO, label: "To", hint: "" },
    { key: RecipientField.CC, label: "Cc", hint: "visible to all recipients" },
    { key: RecipientField.BCC, label: "Bcc", hint: "hidden from other recipients" }
  ];

  protected showCc = false;
  protected showBcc = false;
  protected draft: Record<RecipientField, string> = { to: "", cc: "", bcc: "" };
  protected error: Record<RecipientField, string | null> = { to: null, cc: null, bcc: null };
  protected activeField: RecipientField | null = null;
  protected activeSuggestionIndex = -1;
  private suggestionsSuppressed = false;
  protected editing: { field: RecipientField; index: number } | null = null;
  private dragItem: ComposerExternalRecipient | null = null;
  private dragFrom: RecipientField | null = null;

  protected isVisible(field: RecipientField): boolean {
    switch (field) {
      case RecipientField.TO: return true;
      case RecipientField.CC: return this.showCc || this.cc.length > 0;
      case RecipientField.BCC: return this.showBcc || this.bcc.length > 0;
    }
  }

  protected revealCc(): void {
    this.showCc = true;
  }

  protected revealBcc(): void {
    this.showBcc = true;
  }

  protected valueFor(field: RecipientField): ComposerExternalRecipient[] {
    switch (field) {
      case RecipientField.TO: return this.to;
      case RecipientField.CC: return this.cc;
      case RecipientField.BCC: return this.bcc;
    }
  }

  private emit(field: RecipientField, next: ComposerExternalRecipient[]): void {
    switch (field) {
      case RecipientField.TO: this.to = next; this.toChange.emit(next); break;
      case RecipientField.CC: this.cc = next; this.ccChange.emit(next); break;
      case RecipientField.BCC: this.bcc = next; this.bccChange.emit(next); break;
    }
  }

  protected add(field: RecipientField): void {
    const email = (this.draft[field] || "").trim().toLowerCase();
    if (!email) {
      this.error[field] = "Enter an email address";
      return;
    }
    if (!this.isValidEmail(email)) {
      this.error[field] = "Enter a valid email address";
      return;
    }
    if (this.valueFor(field).some(item => item.email.toLowerCase() === email)) {
      this.error[field] = "This address is already in the list";
      return;
    }
    const matched = this.savedRecipients.find(item => item.email.toLowerCase() === email);
    const entry: ComposerExternalRecipient = matched
      ? { email: matched.email, name: matched.name || this.nameFromEmail(email), existingId: matched.id, saveForReuse: false }
      : { email, name: this.nameFromEmail(email) || undefined, saveForReuse: this.saveForReuse };
    this.emit(field, [...this.valueFor(field), entry]);
    this.draft[field] = "";
    this.error[field] = null;
  }

  protected remove(field: RecipientField, index: number): void {
    if (this.isEditing(field, index)) {
      this.editing = null;
    }
    this.emit(field, this.valueFor(field).filter((_, idx) => idx !== index));
  }

  protected isEditing(field: RecipientField, index: number): boolean {
    return !!this.editing && this.editing.field === field && this.editing.index === index;
  }

  protected openEditor(field: RecipientField, index: number): void {
    this.editing = this.isEditing(field, index) ? null : { field, index };
  }

  protected closeEditor(): void {
    this.editing = null;
  }

  protected editingRecipient(): ComposerExternalRecipient | null {
    return this.editing ? this.valueFor(this.editing.field)[this.editing.index] ?? null : null;
  }

  protected renameEditing(name: string): void {
    const trimmed = (name || "").trim();
    this.updateEditing({ name: trimmed || undefined });
  }

  protected toggleEditingSave(value: boolean): void {
    this.updateEditing({ saveForReuse: value });
  }

  private updateEditing(patch: Partial<ComposerExternalRecipient>): void {
    if (!this.editing) {
      return;
    }
    const { field, index } = this.editing;
    this.emit(field, this.valueFor(field).map((item, idx) => idx === index ? { ...item, ...patch } : item));
  }

  protected moveEditingTo(target: RecipientField): void {
    if (!this.editing || this.editing.field === target) {
      return;
    }
    const recipient = this.editingRecipient();
    if (!recipient) {
      return;
    }
    const { field: from, index } = this.editing;
    if (target === RecipientField.CC) {
      this.showCc = true;
    }
    if (target === RecipientField.BCC) {
      this.showBcc = true;
    }
    this.emit(from, this.valueFor(from).filter((_, idx) => idx !== index));
    const alreadyPresent = this.valueFor(target).some(item => item.email.toLowerCase() === recipient.email.toLowerCase());
    if (alreadyPresent) {
      this.editing = null;
    } else {
      this.emit(target, [...this.valueFor(target), recipient]);
      this.editing = { field: target, index: this.valueFor(target).length - 1 };
    }
  }

  protected removeEditing(): void {
    if (this.editing) {
      this.remove(this.editing.field, this.editing.index);
    }
  }

  protected isSavedContact(recipient: ComposerExternalRecipient): boolean {
    return !!recipient.existingId
      || this.savedRecipients.some(item => item.email.toLowerCase() === recipient.email.toLowerCase());
  }

  protected onDraftChange(field: RecipientField, value: string): void {
    this.draft[field] = value ?? "";
    this.activeSuggestionIndex = -1;
    this.suggestionsSuppressed = false;
    if (this.error[field]) {
      this.error[field] = null;
    }
  }

  protected onFocus(field: RecipientField): void {
    this.activeField = field;
    this.activeSuggestionIndex = -1;
    this.suggestionsSuppressed = false;
  }

  protected onBlur(field: RecipientField): void {
    if (this.activeField === field) {
      this.activeField = null;
    }
  }

  protected showSuggestions(field: RecipientField): boolean {
    return this.activeField === field && !this.suggestionsSuppressed && this.suggestions(field).length > 0;
  }

  protected onSuggestionNav(field: RecipientField, delta: number, event: Event): void {
    const list = this.suggestions(field);
    if (list.length === 0) {
      return;
    }
    event.preventDefault();
    this.suggestionsSuppressed = false;
    const next = this.activeSuggestionIndex + delta;
    this.activeSuggestionIndex = next < 0 ? -1 : Math.min(next, list.length - 1);
  }

  protected onEnter(field: RecipientField, event: Event): void {
    const list = this.suggestions(field);
    if (!this.suggestionsSuppressed && this.activeSuggestionIndex >= 0 && this.activeSuggestionIndex < list.length) {
      event.preventDefault();
      this.chooseSuggestion(field, list[this.activeSuggestionIndex]);
      return;
    }
    this.add(field);
  }

  protected onSuggestionEscape(): void {
    this.suggestionsSuppressed = true;
    this.activeSuggestionIndex = -1;
  }

  protected suggestions(field: RecipientField): ExternalRecipient[] {
    const query = (this.draft[field] || "").trim().toLowerCase();
    const chosen = new Set([...this.to, ...this.cc, ...this.bcc].map(item => item.email.toLowerCase()));
    return this.savedRecipients
      .filter(item => !chosen.has(item.email.toLowerCase()))
      .filter(item => !query
        || item.email.toLowerCase().includes(query)
        || (item.name || "").toLowerCase().includes(query))
      .slice(0, 6);
  }

  protected chooseSuggestion(field: RecipientField, recipient: ExternalRecipient): void {
    const entry: ComposerExternalRecipient = { email: recipient.email, name: recipient.name, existingId: recipient.id, saveForReuse: false };
    if (!this.valueFor(field).some(item => item.email.toLowerCase() === entry.email.toLowerCase())) {
      this.emit(field, [...this.valueFor(field), entry]);
    }
    this.draft[field] = "";
    this.error[field] = null;
    this.activeSuggestionIndex = -1;
  }

  protected onSaveForReuseChange(value: boolean): void {
    this.saveForReuse = value;
    this.saveForReuseChange.emit(value);
  }

  protected lastUsedDescription(recipient: ExternalRecipient): string {
    return recipient.lastUsedAt ? `Last sent ${this.dateUtils.displayDate(recipient.lastUsedAt)}` : "Not sent yet";
  }

  protected onDragStart(field: RecipientField, recipient: ComposerExternalRecipient): void {
    this.dragItem = recipient;
    this.dragFrom = field;
  }

  protected onDragEnd(): void {
    this.dragItem = null;
    this.dragFrom = null;
  }

  protected onDragOver(event: DragEvent): void {
    if (this.dragItem) {
      event.preventDefault();
    }
  }

  protected onDrop(field: RecipientField, event: DragEvent): void {
    event.preventDefault();
    const recipient = this.dragItem;
    const from = this.dragFrom;
    this.dragItem = null;
    this.dragFrom = null;
    if (!recipient || from === null || from === field) {
      return;
    }
    if (field === RecipientField.CC) {
      this.showCc = true;
    }
    if (field === RecipientField.BCC) {
      this.showBcc = true;
    }
    this.emit(from, this.valueFor(from).filter(item => item.email.toLowerCase() !== recipient.email.toLowerCase()));
    if (!this.valueFor(field).some(item => item.email.toLowerCase() === recipient.email.toLowerCase())) {
      this.emit(field, [...this.valueFor(field), recipient]);
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  private nameFromEmail(email: string): string {
    const localPart = email.split("@")[0] ?? "";
    if (!localPart) {
      return "";
    }
    const stripped = localPart.replace(/\d+$/, "");
    const tokens = stripped.split(/[._\-+]+/).filter(token => token.length > 0);
    return tokens
      .map(token => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
      .join(" ");
  }
}
