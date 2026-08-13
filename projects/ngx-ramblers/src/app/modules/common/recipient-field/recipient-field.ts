import { Component, ElementRef, EventEmitter, inject, Input, Output, ViewChild } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  ComposerExternalRecipient,
  ParsedMailbox,
  RecipientDraftOutcomeKind,
  RecipientField,
  RecipientFieldConfig
} from "../../../models/email-composer.model";
import { ExternalRecipient } from "../../../models/external-recipient.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { capitalisePersonName, interpretRecipientDraft, isValidEmailAddress } from "../../../functions/email-addresses";

@Component({
  selector: "app-recipient-field",
  imports: [FormsModule, FontAwesomeModule, TooltipDirective],
  styleUrl: "./recipient-field.sass",
  template: `
    <div class="recipient-field" [class.is-plain]="plain">
      @for (field of fields; track field.key) {
        @if (isVisible(field.key)) {
          <div class="recipient-line"
               [class.is-active]="activeField === field.key"
               (dragover)="onDragOver($event)"
               (drop)="onDrop(field.key, $event)">
            @if (!plain) {
              <span class="recipient-line-label">{{ field.label }}</span>
            }
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
              @if (pending?.field === field.key) {
                <span class="recipient-chip is-editing">
                  <button type="button" class="recipient-chip-label">{{ pending?.name }}</button>
                  <button type="button" class="recipient-chip-remove"
                          (click)="discardPending(); $event.stopPropagation()"
                          [attr.aria-label]="'Remove ' + pending?.name">
                    <fa-icon [icon]="faXmark"/>
                  </button>
                </span>
              }
              <input type="text"
                     class="recipient-input"
                     autocomplete="email"
                     inputmode="email"
                     [ngModel]="draft[field.key]"
                     (ngModelChange)="onDraftChange(field.key, $event)"
                     (paste)="onPaste(field.key, $event)"
                     (keydown.enter)="onEnter(field.key, $event)"
                     (keydown.arrowdown)="onSuggestionNav(field.key, 1, $event)"
                     (keydown.arrowup)="onSuggestionNav(field.key, -1, $event)"
                     (keydown.escape)="onSuggestionEscape()"
                     (focus)="onFocus(field.key)"
                     (blur)="onBlur(field.key)"
                     [placeholder]="valueFor(field.key).length ? 'Add…' : 'Add people…'">
            </div>
            @if (editorField() === field.key && editorSubject(); as edited) {
              <div class="recipient-editor-backdrop" (click)="closeEditor()"></div>
              <div class="recipient-editor">
                <label class="recipient-editor-row">
                  <span class="recipient-editor-caption">Name</span>
                  <input type="text" class="recipient-editor-input"
                         [ngModel]="edited.name || ''"
                         (ngModelChange)="renameEditing($event)"
                         placeholder="Display name">
                </label>
                <label class="recipient-editor-row">
                  <span class="recipient-editor-caption">Email</span>
                  <input #editorEmailInput type="text" class="recipient-editor-input"
                         [class.is-invalid]="!!editorError"
                         [ngModel]="edited.email || ''"
                         (ngModelChange)="changeEditingEmail($event)"
                         (keydown.enter)="confirmEditingEmail($event)"
                         placeholder="Email address"
                         autocomplete="email"
                         inputmode="email">
                </label>
                @if (editorError) {
                  <p class="recipient-editor-error">{{ editorError }}</p>
                } @else if (pending?.field === field.key && !edited.email) {
                  <p class="recipient-editor-prompt">Enter an email address for {{ edited.name }}</p>
                }
                @if (!plain) {
                  <div class="recipient-editor-row">
                    <span class="recipient-editor-caption">Field</span>
                    <div class="recipient-editor-switch">
                      @for (target of fields; track target.key) {
                        <button type="button"
                                [class.is-current]="editorField() === target.key"
                                (click)="moveEditingTo(target.key)">{{ target.label }}</button>
                      }
                    </div>
                  </div>
                }
                @if (isSavedContact(edited)) {
                  <p class="recipient-editor-saved"><fa-icon [icon]="faCheck"/> Already in your saved addresses</p>
                } @else if (!plain) {
                  <label class="recipient-editor-check">
                    <input type="checkbox" class="form-check-input" [ngModel]="edited.saveForReuse" (ngModelChange)="toggleEditingSave($event)">
                    Save this address for re-use
                  </label>
                }
                <button type="button" class="recipient-editor-remove" (click)="removeEditing()">
                  <fa-icon [icon]="faXmark"/> {{ pending ? "Cancel" : "Remove from this email" }}
                </button>
              </div>
            }
            @if (!plain && field.key === RecipientField.TO) {
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
      @if (!plain) {
        <label class="recipient-save">
          <input type="checkbox" class="form-check-input"
                 [ngModel]="saveForReuse"
                 (ngModelChange)="onSaveForReuseChange($event)">
          Save new addresses for re-use in future sends
        </label>
      }
    </div>
  `
})
export class RecipientFieldComponent {

  private dateUtils = inject(DateUtilsService);
  @ViewChild("editorEmailInput") private editorEmailInput: ElementRef<HTMLInputElement>;

  @Input() to: ComposerExternalRecipient[] = [];
  @Input() cc: ComposerExternalRecipient[] = [];
  @Input() bcc: ComposerExternalRecipient[] = [];
  @Input() savedRecipients: ExternalRecipient[] = [];
  @Input() saveForReuse = true;
  plain = false;

  @Input("plain") set plainValue(value: boolean) {
    this.plain = coerceBooleanProperty(value);
  }

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
  protected pending: { field: RecipientField; name: string; email: string; saveForReuse: boolean } | null = null;
  protected editorError: string | null = null;
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
    const outcome = interpretRecipientDraft(this.draft[field], this.savedRecipients);
    if (outcome.kind === RecipientDraftOutcomeKind.EMPTY) {
      this.error[field] = "Enter an email address";
    } else if (outcome.kind === RecipientDraftOutcomeKind.INVALID) {
      this.error[field] = "Enter a valid email address";
    } else if (outcome.kind === RecipientDraftOutcomeKind.PENDING_NAME) {
      this.openPendingEditor(field, outcome.name, outcome.email);
    } else {
      const existing = new Set(this.valueFor(field).map(item => item.email.toLowerCase()));
      const additions = outcome.mailboxes.reduce<ComposerExternalRecipient[]>((acc, item) => {
        const email = item.email.toLowerCase();
        if (existing.has(email)) {
          return acc;
        } else {
          existing.add(email);
          return [...acc, this.entryFor(item)];
        }
      }, []);
      if (additions.length === 0) {
        this.error[field] = "This address is already in the list";
      } else {
        this.emit(field, [...this.valueFor(field), ...additions]);
        this.draft[field] = "";
        this.error[field] = null;
      }
    }
  }

  protected onPaste(field: RecipientField, event: ClipboardEvent): void {
    const text = event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "";
    if (text.trim()) {
      event.preventDefault();
      this.draft[field] = text;
      this.add(field);
    }
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

  protected editorField(): RecipientField | null {
    return this.pending?.field || this.editing?.field || null;
  }

  protected editorSubject(): ComposerExternalRecipient | null {
    if (this.pending) {
      return {email: this.pending.email, name: this.pending.name, saveForReuse: this.pending.saveForReuse};
    } else if (this.editing) {
      return this.valueFor(this.editing.field)[this.editing.index] ?? null;
    } else {
      return null;
    }
  }

  protected openEditor(field: RecipientField, index: number): void {
    this.pending = null;
    this.editorError = null;
    this.editing = this.isEditing(field, index) ? null : { field, index };
  }

  protected closeEditor(): void {
    if (this.pending && isValidEmailAddress(this.pending.email)) {
      this.commitPending();
    } else {
      this.pending = null;
      this.editing = null;
      this.editorError = null;
    }
  }

  protected discardPending(): void {
    this.pending = null;
    this.editorError = null;
  }

  protected renameEditing(name: string): void {
    const capitalised = capitalisePersonName(name);
    if (this.pending) {
      this.pending = {...this.pending, name: capitalised};
    } else {
      this.updateEditing({ name: capitalised || undefined });
    }
  }

  protected changeEditingEmail(email: string): void {
    this.editorError = null;
    if (this.pending) {
      this.pending = {...this.pending, email: (email || "").trim()};
    } else {
      this.updateEditing({ email: (email || "").trim() });
    }
  }

  protected confirmEditingEmail(event: Event): void {
    event.preventDefault();
    if (this.pending) {
      this.commitPending();
    }
  }

  protected toggleEditingSave(value: boolean): void {
    if (this.pending) {
      this.pending = {...this.pending, saveForReuse: value};
    } else {
      this.updateEditing({ saveForReuse: value });
    }
  }

  private openPendingEditor(field: RecipientField, name: string, email: string): void {
    this.pending = {field, name, email, saveForReuse: this.reuseNewAddresses()};
    this.editing = null;
    this.editorError = null;
    this.draft[field] = "";
    this.error[field] = null;
    setTimeout(() => this.editorEmailInput?.nativeElement.focus());
  }

  private commitPending(): void {
    const pending = this.pending;
    if (pending && isValidEmailAddress(pending.email)) {
      const email = pending.email.toLowerCase();
      const alreadyPresent = this.valueFor(pending.field).some(item => item.email.toLowerCase() === email);
      if (!alreadyPresent) {
        this.emit(pending.field, [...this.valueFor(pending.field), this.entryFor({name: pending.name, email: pending.email})]);
      }
      this.pending = null;
      this.editorError = null;
      this.error[pending.field] = null;
    } else if (pending) {
      this.editorError = "Enter a valid email address";
    }
  }

  private updateEditing(patch: Partial<ComposerExternalRecipient>): void {
    if (this.editing) {
      const { field, index } = this.editing;
      this.emit(field, this.valueFor(field).map((item, idx) => idx === index ? { ...item, ...patch } : item));
    }
  }

  protected moveEditingTo(target: RecipientField): void {
    if (this.editorField() !== target) {
      if (target === RecipientField.CC) {
        this.showCc = true;
      }
      if (target === RecipientField.BCC) {
        this.showBcc = true;
      }
      if (this.pending) {
        this.pending = {...this.pending, field: target};
      } else if (this.editing) {
        const recipient = this.editorSubject();
        const { field: from, index } = this.editing;
        if (recipient) {
          this.emit(from, this.valueFor(from).filter((_, idx) => idx !== index));
          const alreadyPresent = this.valueFor(target).some(item => item.email.toLowerCase() === recipient.email.toLowerCase());
          if (alreadyPresent) {
            this.editing = null;
          } else {
            this.emit(target, [...this.valueFor(target), recipient]);
            this.editing = { field: target, index: this.valueFor(target).length - 1 };
          }
        }
      }
    }
  }

  protected removeEditing(): void {
    if (this.pending) {
      this.discardPending();
    } else if (this.editing) {
      this.remove(this.editing.field, this.editing.index);
    }
  }

  protected isSavedContact(recipient: ComposerExternalRecipient): boolean {
    return !!recipient.email && (!!recipient.existingId
      || this.savedRecipients.some(item => item.email.toLowerCase() === recipient.email.toLowerCase()));
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
    return this.activeField === field && !this.pending && !this.suggestionsSuppressed && this.suggestions(field).length > 0;
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

  private reuseNewAddresses(): boolean {
    return !this.plain && this.saveForReuse;
  }

  private entryFor(parsed: ParsedMailbox): ComposerExternalRecipient {
    const email = parsed.email.toLowerCase();
    const matched = this.savedRecipients.find(item => item.email.toLowerCase() === email);
    const name = parsed.name || matched?.name || this.nameFromEmail(email);
    return matched
      ? {email: matched.email, name: name || undefined, existingId: matched.id, saveForReuse: false}
      : {email, name: name || undefined, saveForReuse: this.reuseNewAddresses()};
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
