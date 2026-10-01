import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, inject, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { faCheck, faUserPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  ComposerExternalRecipient,
  ParsedMailbox,
  RecipientDraftOutcomeKind,
  RecipientField,
  RecipientFieldConfig
} from "../../../models/email-composer.model";
import { ExternalRecipient } from "../../../models/external-recipient.model";
import { Member } from "../../../models/member.model";
import { MemberSelection } from "../../../models/mail.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { ListSubscriberCountComponent } from "../mail/list-subscriber-count";
import { interpretRecipientDraft, isValidEmailAddress } from "../../../functions/email-addresses";
import { memberDisambiguatedLabel } from "../../../functions/member-names";
import { committeeAudienceChipQualifier, combinedMemberChipQualifier } from "../../../functions/member-chip-qualifier";
import { MemberBulkLoadDateMap } from "../../../models/member.model";
import { composerRecipientIsExpandableSet } from "../../../functions/email-composer";

@Component({
  selector: "app-recipient-field",
  imports: [FormsModule, FontAwesomeModule, TooltipDirective, ListSubscriberCountComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./recipient-field.sass",
  template: `
    <div class="recipient-field" [class.is-plain]="plain" [class.is-unframed]="unframed">
      @for (field of fields; track field.key) {
        @if (isVisible(field.key)) {
          <div class="recipient-line"
               [attr.data-recipient-field]="field.key"
               [class.is-active]="activeField === field.key"
               [class.has-chips]="valueFor(field.key).length > 0"
               [class.is-drop-target]="dropTarget === field.key"
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
                      (pointerdown)="onChipPointerDown($event, field.key, recipient)"
                      (dragstart)="onDragStart(field.key, recipient)"
                      (dragend)="onDragEnd()"
                      [tooltip]="chipTooltip(recipient)"
                      placement="bottom">
                  <button type="button" class="recipient-chip-label" (click)="expandableSet(recipient) ? expandList.emit({field: field.key, recipient}) : openEditor(field.key, idx)">
                    <span class="recipient-chip-name">{{ recipient.name || recipient.email }}</span>
                    @if (recipient.listId) {
                      <span class="recipient-chip-qualifier">everyone on this list</span>
                    } @else if (expandableSet(recipient)) {
                      <span class="recipient-chip-qualifier">everyone in this set</span>
                    } @else if (chipQualifier(recipient); as qualifier) {
                      <span class="recipient-chip-qualifier">{{ qualifier }}</span>
                    }
                  </button>
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
                     autocomplete="off"
                     autocorrect="off"
                     autocapitalize="off"
                     spellcheck="false"
                     inputmode="text"
                     [attr.name]="'recipient-' + field.key"
                     [ngModel]="draft[field.key]"
                     (ngModelChange)="onDraftChange(field.key, $event)"
                     (paste)="onPaste(field.key, $event)"
                     (keydown.enter)="onEnter(field.key, $event)"
                     (keydown.backspace)="onBackspace(field.key, $event)"
                     (keydown.delete)="onBackspace(field.key, $event)"
                     (keydown.arrowdown)="onSuggestionNav(field.key, 1, $event)"
                     (keydown.arrowup)="onSuggestionNav(field.key, -1, $event)"
                     (keydown.escape)="onSuggestionEscape()"
                     (focus)="onFocus(field.key)"
                     (blur)="onBlur(field.key, $event)"
                     [placeholder]="valueFor(field.key).length ? 'Add…' : listRecipients.length ? 'Add members or committee lists…' : 'Add members…'">
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
                         autocomplete="off"
                         autocorrect="off"
                         autocapitalize="off"
                         spellcheck="false"
                         inputmode="text"
                         name="recipient-editor-email">
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
                @if (!pending && edited.email) {
                  <button type="button" class="recipient-editor-open" (click)="openRecord(edited)">
                    {{ memberFor(edited) ? "Open member" : "Edit saved address" }}
                  </button>
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
                @if (visibleMemberSuggestions.length) {
                  <li class="recipient-suggestions-heading">{{ listRecipients.length ? "Members and committee lists" : "Group members" }}</li>
                  @for (suggestion of visibleMemberSuggestions; track suggestion.email; let i = $index) {
                    <li>
                      <button type="button" class="recipient-suggestion"
                              [class.is-active]="activeSuggestionIndex === i"
                              (mouseenter)="activeSuggestionIndex = i"
                              (click)="chooseSuggestion(field.key, suggestion)">
                        <span class="recipient-suggestion-main">
                          <strong>{{ suggestion.name || suggestion.email }}</strong>
                          @if (suggestion.listId) {
                            <app-list-subscriber-count [listId]="suggestion.listId" [members]="members"/>
                          } @else if (suggestion.name) {
                            <span class="recipient-suggestion-email">{{ suggestion.email }}</span>
                          }
                        </span>
                      </button>
                    </li>
                  }
                }
                @if (!knownOnly && visibleSavedSuggestions.length) {
                  <li class="recipient-suggestions-heading">Previously saved</li>
                  @for (suggestion of visibleSavedSuggestions; track suggestion.id || suggestion.email; let i = $index) {
                    <li>
                      <button type="button" class="recipient-suggestion"
                              [class.is-active]="activeSuggestionIndex === visibleMemberSuggestions.length + i"
                              (mouseenter)="activeSuggestionIndex = visibleMemberSuggestions.length + i"
                              (click)="chooseSuggestion(field.key, suggestion)">
                        <span class="recipient-suggestion-main">
                          <strong>{{ suggestion.name || suggestion.email }}</strong>
                          @if (suggestion.name) { <span class="recipient-suggestion-email">{{ suggestion.email }}</span> }
                        </span>
                        @if (lastUsedDescription(suggestion); as used) {
                          <span class="recipient-suggestion-meta">{{ used }}</span>
                        }
                      </button>
                    </li>
                  }
                }
              </ul>
            }
            <div class="recipient-line-end">
              <div class="recipient-line-actions">
                @if (valueFor(field.key).length > 0) {
                  <button type="button" class="recipient-line-clear"
                          (click)="clearField(field.key)"
                          tooltip="Remove all"
                          placement="bottom"
                          [attr.aria-label]="'Remove all from ' + field.label">
                    <fa-icon [icon]="faXmark"/>
                  </button>
                }
                @if (bulkSourceName) {
                  <button type="button" class="recipient-line-clear"
                          (click)="addAll.emit(field.key)"
                          [tooltip]="'Add all from ' + bulkSourceName"
                          placement="bottom"
                          [attr.aria-label]="'Add all from ' + bulkSourceName">
                    <fa-icon [icon]="faUserPlus"/>
                  </button>
                }
              </div>
              @if (field.hint) {
                <span class="recipient-line-hint">{{ field.hint }}</span>
              }
            </div>
          </div>
          @if (error[field.key]) {
            <p class="recipient-error">{{ error[field.key] }}</p>
          }
        }
      }
      @if (!plain && !knownOnly) {
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
export class RecipientFieldComponent implements OnChanges, OnDestroy {

  private dateUtils = inject(DateUtilsService);
  private changeDetector = inject(ChangeDetectorRef);
  private host = inject(ElementRef);
  @ViewChild("editorEmailInput") private editorEmailInput: ElementRef<HTMLInputElement>;

  @Input() to: ComposerExternalRecipient[] = [];
  @Input() cc: ComposerExternalRecipient[] = [];
  @Input() bcc: ComposerExternalRecipient[] = [];
  @Input() savedRecipients: ExternalRecipient[] = [];
  @Input() members: Member[] = [];
  @Input() committeeAddresses: ComposerExternalRecipient[] = [];
  @Input() listRecipients: ComposerExternalRecipient[] = [];
  @Input() ccAllowedEmails: string[] | null = null;
  @Input() audienceFilter: MemberSelection | null = null;
  @Input() memberBulkLoadDateMap: MemberBulkLoadDateMap | null = null;
  @Input() saveForReuse = true;
  plain = false;
  unframed = false;
  knownOnly = false;

  @Input("plain") set plainValue(value: boolean) {
    this.plain = coerceBooleanProperty(value);
  }

  @Input("unframed") set unframedValue(value: boolean) {
    this.unframed = coerceBooleanProperty(value);
  }

  @Input("knownOnly") set knownOnlyValue(value: boolean) {
    this.knownOnly = coerceBooleanProperty(value);
  }

  @Output() toChange = new EventEmitter<ComposerExternalRecipient[]>();
  @Output() ccChange = new EventEmitter<ComposerExternalRecipient[]>();
  @Output() bccChange = new EventEmitter<ComposerExternalRecipient[]>();
  @Output() saveForReuseChange = new EventEmitter<boolean>();
  @Output() openMember = new EventEmitter<Member>();
  @Output() openSavedAddress = new EventEmitter<ComposerExternalRecipient>();
  @Output() activeFieldChange = new EventEmitter<RecipientField | null>();
  @Input() bulkSourceName: string | null = null;
  @Output() addAll = new EventEmitter<RecipientField>();
  @Output() expandList = new EventEmitter<{field: RecipientField; recipient: ComposerExternalRecipient}>();

  protected readonly RecipientField = RecipientField;
  protected readonly faXmark = faXmark;
  protected readonly faUserPlus = faUserPlus;
  protected readonly faCheck = faCheck;

  protected readonly fields: RecipientFieldConfig[] = [
    { key: RecipientField.TO, label: "To", hint: "" },
    { key: RecipientField.CC, label: "Cc", hint: "visible to all recipients" },
    { key: RecipientField.BCC, label: "Bcc", hint: "hidden from other recipients" }
  ];

  protected showCc = true;
  protected showBcc = true;
  protected draft: Record<RecipientField, string> = { to: "", cc: "", bcc: "" };
  protected error: Record<RecipientField, string | null> = { to: null, cc: null, bcc: null };
  protected activeField: RecipientField | null = null;
  protected activeSuggestionIndex = -1;

  private suggestionsSuppressed = false;
  protected editing: { field: RecipientField; index: number } | null = null;
  protected pending: { field: RecipientField; name: string; email: string; saveForReuse: boolean } | null = null;
  protected editorError: string | null = null;
  private dragItem: ComposerExternalRecipient | null = null;
  protected dropTarget: RecipientField | null = null;
  private touchDrag: {
    pointerId: number;
    startX: number;
    startY: number;
    field: RecipientField;
    recipient: ComposerExternalRecipient;
    dragging: boolean;
  } | null = null;
  private suppressChipClick = false;
  private dragFrom: RecipientField | null = null;
  private memberByEmail = new Map<string, Member>();
  private memberById = new Map<string, Member>();
  private qualifierByEmail = new Map<string, string>();
  private cachedMemberEntries: ComposerExternalRecipient[] = [];
  protected visibleMemberSuggestions: ComposerExternalRecipient[] = [];
  protected visibleSavedSuggestions: ExternalRecipient[] = [];

  ngOnDestroy(): void {
    this.clearTouchDrag();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["members"] || changes["committeeAddresses"] || changes["listRecipients"] || changes["savedRecipients"] || changes["to"] || changes["cc"] || changes["bcc"] || changes["audienceFilter"] || changes["memberBulkLoadDateMap"]) {
      if (changes["members"] || changes["committeeAddresses"] || changes["listRecipients"] || changes["audienceFilter"] || changes["memberBulkLoadDateMap"]) {
        this.rebuildMemberIndex();
      }
      this.refreshVisibleSuggestions();
    }
  }

  protected isVisible(field: RecipientField): boolean {
    switch (field) {
      case RecipientField.TO: return true;
      case RecipientField.CC: return this.cc.length > 0 || (!this.plain && this.showCc);
      case RecipientField.BCC: return this.bcc.length > 0 || (!this.plain && this.showBcc);
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

  private canPlaceOnCc(recipient: ComposerExternalRecipient): boolean {
    if (this.ccAllowedEmails === null) {
      return true;
    } else {
      const email = (recipient.email || "").toLowerCase();
      return this.ccAllowedEmails.some(allowed => allowed.toLowerCase() === email);
    }
  }

  private rejectNonCommitteeCc(field: RecipientField, recipient: ComposerExternalRecipient): boolean {
    if (field === RecipientField.CC && !this.canPlaceOnCc(recipient)) {
      this.error[RecipientField.CC] = "Only committee members can be copied. Other recipients would see their address.";
      this.showCc = true;
      this.changeDetector.markForCheck();
      return true;
    } else {
      return false;
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
    const outcome = interpretRecipientDraft(this.draft[field], this.nameDirectory());
    if (outcome.kind === RecipientDraftOutcomeKind.EMPTY) {
      this.error[field] = "Enter an email address";
    } else if (outcome.kind === RecipientDraftOutcomeKind.INVALID) {
      this.error[field] = "Enter a valid email address";
    } else if (outcome.kind === RecipientDraftOutcomeKind.PENDING_NAME) {
      if (this.knownOnly) {
        this.error[field] = "Choose a group member or a committee address";
      } else {
        this.openPendingEditor(field, outcome.name, outcome.email);
      }
    } else {
      const existing = new Set(this.valueFor(field).map(item => item.email.toLowerCase()));
      const additions = outcome.mailboxes.reduce<ComposerExternalRecipient[]>((acc, item) => {
        const email = item.email.toLowerCase();
        if (existing.has(email) || (this.knownOnly && !this.isKnownAddress(email))) {
          return acc;
        } else {
          existing.add(email);
          return [...acc, this.entryFor(item)];
        }
      }, []);
      const allowedAdditions = field === RecipientField.CC
        ? additions.filter(item => this.canPlaceOnCc(item))
        : additions;
      if (allowedAdditions.length === 0) {
        this.error[field] = field === RecipientField.CC && additions.length > 0
          ? "Only committee members can be copied. Other recipients would see their address."
          : this.knownOnly
            ? "Choose a group member or a committee address"
            : "This address is already in the list";
      } else {
        this.emit(field, [...this.valueFor(field), ...allowedAdditions]);
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
    if (this.suppressChipClick) {
      this.suppressChipClick = false;
    } else {
      this.pending = null;
      this.editorError = null;
      this.editing = this.isEditing(field, index) ? null : { field, index };
    }
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
    if (this.pending) {
      this.pending = {...this.pending, name};
    } else {
      this.updateEditing({ name: name || undefined });
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
    if (pending && isValidEmailAddress(pending.email) && (!this.knownOnly || this.isKnownAddress(pending.email))) {
      const email = pending.email.toLowerCase();
      const alreadyPresent = this.valueFor(pending.field).some(item => item.email.toLowerCase() === email);
      if (!alreadyPresent) {
        this.emit(pending.field, [...this.valueFor(pending.field), this.entryFor({name: pending.name, email: pending.email})]);
      }
      this.pending = null;
      this.editorError = null;
      this.error[pending.field] = null;
    } else if (pending && this.knownOnly) {
      this.editorError = "Choose a group member or a committee address";
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
        if (recipient && this.rejectNonCommitteeCc(target, recipient)) {
        } else if (recipient) {
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

  protected expandableSet(recipient: ComposerExternalRecipient): boolean {
    return composerRecipientIsExpandableSet(recipient);
  }

  protected chipTooltip(recipient: ComposerExternalRecipient): string {
    if (this.expandableSet(recipient)) {
      return "Click to show each member so you can remove individuals";
    } else {
      return recipient.email;
    }
  }

  protected chipQualifier(recipient: ComposerExternalRecipient): string {
    if (recipient.listId || this.expandableSet(recipient)) {
      return "";
    } else {
      const email = (recipient.email || "").trim().toLowerCase();
      const mapped = this.qualifierByEmail.get(email);
      if (mapped) {
        return mapped;
      } else if ((this.committeeAddresses || []).some(address => (address.email || "").toLowerCase() === email)) {
        const holder = (recipient.memberId && this.memberByEmail.get(email)) || this.memberFor(recipient);
        return committeeAudienceChipQualifier(
          holder,
          this.dateUtils.dateTimeNowNoTime().toMillis(),
          millis => this.dateUtils.displayDate(millis),
          this.audienceFilter,
          holder?.membershipNumber ? this.memberBulkLoadDateMap?.[holder.membershipNumber] ?? null : null
        );
      } else {
        return "external";
      }
    }
  }

  protected memberFor(recipient: ComposerExternalRecipient): Member | null {
    if (recipient.memberId && this.memberById.get(recipient.memberId)) {
      return this.memberById.get(recipient.memberId) ?? null;
    } else {
      return this.memberByEmail.get((recipient.email || "").trim().toLowerCase()) ?? null;
    }
  }

  protected openRecord(recipient: ComposerExternalRecipient): void {
    if (!this.expandableSet(recipient)) {
      const member = this.memberFor(recipient);
      if (member) {
        this.openMember.emit(member);
      } else {
        this.openSavedAddress.emit(recipient);
      }
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
    this.refreshVisibleSuggestions();
    setTimeout(() => this.fitSuggestionsToViewport());
  }

  protected onFocus(field: RecipientField): void {
    this.activeField = field;
    this.activeSuggestionIndex = -1;
    this.suggestionsSuppressed = false;
    this.refreshVisibleSuggestions();
    this.activeFieldChange.emit(field);
    this.changeDetector.markForCheck();
    setTimeout(() => this.fitSuggestionsToViewport());
  }

  private fitSuggestionsToViewport(): void {
    const list = this.host.nativeElement.querySelector(".recipient-suggestions") as HTMLElement | null;
    const line = this.host.nativeElement.querySelector(".recipient-line.is-active") as HTMLElement | null;
    if (list && line) {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const spaceBelow = Math.floor(viewportHeight - line.getBoundingClientRect().bottom - 12);
      list.style.maxHeight = `${Math.max(120, spaceBelow)}px`;
    }
  }

  protected onBlur(field: RecipientField, event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement | null;
    const stayingInField = next && this.host.nativeElement.contains(next) && next.classList.contains("recipient-input");
    if (!stayingInField && this.activeField === field) {
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

  protected onBackspace(field: RecipientField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const draftEmpty = !(this.draft[field] || "").trim();
    const cursorAtStart = (input.selectionStart ?? 0) === 0 && (input.selectionEnd ?? 0) === 0;
    const chips = this.valueFor(field);
    if (draftEmpty && cursorAtStart && chips.length > 0) {
      event.preventDefault();
      this.remove(field, chips.length - 1);
    }
  }

  protected clearField(field: RecipientField): void {
    this.emit(field, []);
    this.draft[field] = "";
    this.error[field] = null;
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

  protected memberSuggestions(field: RecipientField): ComposerExternalRecipient[] {
    return this.activeField === field ? this.visibleMemberSuggestions : [];
  }

  protected savedSuggestions(field: RecipientField): ExternalRecipient[] {
    return this.activeField === field ? this.visibleSavedSuggestions : [];
  }

  protected suggestions(field: RecipientField): ComposerExternalRecipient[] {
    return this.activeField === field ? [...this.visibleMemberSuggestions, ...this.visibleSavedSuggestions] : [];
  }

  protected suggestionIndex(field: RecipientField, email: string): number {
    return this.suggestions(field).findIndex(item => item.email.toLowerCase() === email.toLowerCase());
  }

  protected chooseSuggestion(field: RecipientField, recipient: ComposerExternalRecipient): void {
    const saved = this.savedRecipients.find(item => item.email.toLowerCase() === recipient.email.toLowerCase());
    const entry: ComposerExternalRecipient = {
      email: recipient.email,
      name: recipient.name,
      existingId: saved?.id,
      saveForReuse: false,
      memberId: recipient.memberId,
      listId: recipient.listId,
      listCount: recipient.listCount
    };
    if (this.rejectNonCommitteeCc(field, entry)) {
    } else if (!this.valueFor(field).some(item => item.email.toLowerCase() === entry.email.toLowerCase())) {
      this.emit(field, [...this.valueFor(field), entry]);
    }
    this.draft[field] = "";
    this.error[field] = null;
    this.activeField = field;
    this.suggestionsSuppressed = false;
    this.refreshVisibleSuggestions();
    this.activeSuggestionIndex = this.suggestions(field).length > 0 ? 0 : -1;
    this.changeDetector.markForCheck();
    setTimeout(() => this.fitSuggestionsToViewport());
  }

  protected onSaveForReuseChange(value: boolean): void {
    this.saveForReuse = value;
    this.saveForReuseChange.emit(value);
  }

  protected lastUsedDescription(recipient: ExternalRecipient): string {
    return recipient.lastUsedAt ? `Last sent ${this.dateUtils.displayDate(recipient.lastUsedAt)}` : "Not sent yet";
  }

  private matchingSuggestions<T extends {email: string; name?: string}>(field: RecipientField, source: T[]): T[] {
    const query = (this.draft[field] || "").trim().toLowerCase();
    const chosen = new Set([...this.to, ...this.cc, ...this.bcc].map(item => item.email.toLowerCase()));
    return source
      .filter(item => !chosen.has(item.email.toLowerCase()))
      .filter(item => !query
        || item.email.toLowerCase().includes(query)
        || (item.name || "").toLowerCase().includes(query))
      .slice(0, 50);
  }

  private refreshVisibleSuggestions(): void {
    const field = this.activeField;
    if (!field) {
      this.visibleMemberSuggestions = [];
      this.visibleSavedSuggestions = [];
    } else {
      this.visibleMemberSuggestions = this.matchingSuggestions(field, this.cachedMemberEntries);
      const memberEmails = new Set(this.cachedMemberEntries.map(item => item.email.toLowerCase()));
      this.visibleSavedSuggestions = this.knownOnly
        ? []
        : this.matchingSuggestions(field, this.savedRecipients.filter(item => !memberEmails.has(item.email.toLowerCase())));
    }
  }

  private bulkLoadDateFor(member: Member | null | undefined): number | null {
    const membershipNumber = member?.membershipNumber;
    if (!membershipNumber) {
      return null;
    } else {
      return this.memberBulkLoadDateMap?.[membershipNumber] ?? null;
    }
  }

  private qualifierForMember(member: Member): string {
    return combinedMemberChipQualifier(
      member,
      this.dateUtils.dateTimeNowNoTime().toMillis(),
      millis => this.dateUtils.displayDate(millis),
      this.audienceFilter,
      this.bulkLoadDateFor(member)
    );
  }

  private rebuildMemberIndex(): void {
    const now = this.dateUtils.dateTimeNowNoTime().toMillis();
    const displayDate = (millis: number) => this.dateUtils.displayDate(millis);
    const membersById = new Map((this.members || []).filter(member => member.id).map(member => [member.id as string, member]));
    this.memberById = new Map((this.members || []).filter(member => member.id).map(member => [member.id as string, member]));
    this.memberByEmail = new Map((this.members || [])
      .filter(member => (member.email || "").trim())
      .map(member => [(member.email || "").trim().toLowerCase(), member]));
    this.qualifierByEmail = new Map([...this.memberByEmail.entries()].map(([email, member]) => [email, this.qualifierForMember(member)]));
    (this.committeeAddresses || []).forEach(address => {
      const email = (address.email || "").trim().toLowerCase();
      const holder = (address.memberId && membersById.get(address.memberId)) || this.memberByEmail.get(email);
      if (email) {
        this.qualifierByEmail.set(email, committeeAudienceChipQualifier(holder, now, displayDate, this.audienceFilter, this.bulkLoadDateFor(holder)));
        if (holder) {
          this.memberByEmail.set(email, holder);
        }
      }
    });
    this.cachedMemberEntries = (this.listRecipients || []).reduce((list, recipient) => {
      if (list.some(item => item.email.toLowerCase() === recipient.email.toLowerCase())) {
        return list;
      } else {
        return [...list, recipient];
      }
    }, [] as ComposerExternalRecipient[]);
    this.cachedMemberEntries = [...this.memberByEmail.values()].reduce((list: ComposerExternalRecipient[], member) => {
      const email = (member.email || "").trim();
      if (list.some(item => item.email.toLowerCase() === email.toLowerCase())) {
        return list;
      } else {
        return [...list, {email, name: memberDisambiguatedLabel(member)}];
      }
    }, this.cachedMemberEntries);
    this.cachedMemberEntries = (this.committeeAddresses || []).reduce((list, address) => {
      const email = (address.email || "").trim();
      if (!email || list.some(item => item.email.toLowerCase() === email.toLowerCase())) {
        return list;
      } else {
        return [...list, {email, name: address.name, saveForReuse: false, memberId: address.memberId}];
      }
    }, this.cachedMemberEntries);
  }

  private isKnownAddress(email: string): boolean {
    const wanted = (email || "").trim().toLowerCase();
    return !!wanted && this.cachedMemberEntries.some(item => item.email.toLowerCase() === wanted);
  }

  private memberEntries(): ComposerExternalRecipient[] {
    return this.cachedMemberEntries;
  }

  private nameDirectory(): {name?: string; email: string}[] {
    return [...this.memberEntries(), ...this.savedRecipients];
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
      const field = (event.currentTarget as HTMLElement).getAttribute("data-recipient-field") as RecipientField;
      if (field === RecipientField.CC && !this.canPlaceOnCc(this.dragItem)) {
        this.error[RecipientField.CC] = "Only committee members can be copied. Other recipients would see their address.";
        this.showCc = true;
      } else {
        event.preventDefault();
      }
    }
  }

  protected onDrop(field: RecipientField, event: DragEvent): void {
    event.preventDefault();
    const recipient = this.dragItem;
    const from = this.dragFrom;
    this.dragItem = null;
    this.dragFrom = null;
    if (!recipient || from === null || from === field) {
    } else if (this.rejectNonCommitteeCc(field, recipient)) {
    } else {
      this.moveRecipient(from, field, recipient);
    }
  }

  protected onChipPointerDown(event: PointerEvent, field: RecipientField, recipient: ComposerExternalRecipient): void {
    const target = event.target as HTMLElement;
    if (event.pointerType === "mouse" || event.button !== 0 || target.closest(".recipient-chip-remove")) {
    } else {
      this.touchDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        field,
        recipient,
        dragging: false
      };
      window.addEventListener("pointermove", this.onChipPointerMove, {passive: false});
      window.addEventListener("pointerup", this.onChipPointerUp);
      window.addEventListener("pointercancel", this.onChipPointerUp);
    }
  }

  private onChipPointerMove = (event: PointerEvent): void => {
    if (!this.touchDrag || event.pointerId !== this.touchDrag.pointerId) {
    } else {
      const dx = event.clientX - this.touchDrag.startX;
      const dy = event.clientY - this.touchDrag.startY;
      if (!this.touchDrag.dragging && (dx * dx + dy * dy) > 100) {
        this.touchDrag.dragging = true;
        this.dragItem = this.touchDrag.recipient;
        this.dragFrom = this.touchDrag.field;
      }
      if (this.touchDrag.dragging) {
        event.preventDefault();
        const under = document.elementFromPoint(event.clientX, event.clientY);
        const line = under?.closest("[data-recipient-field]");
        const target = line ? line.getAttribute("data-recipient-field") as RecipientField : null;
        this.dropTarget = target === RecipientField.CC && this.dragItem && !this.canPlaceOnCc(this.dragItem)
          ? null
          : target;
        this.changeDetector.markForCheck();
      }
    }
  };

  private onChipPointerUp = (event: PointerEvent): void => {
    if (!this.touchDrag || event.pointerId !== this.touchDrag.pointerId) {
    } else {
      if (this.touchDrag.dragging && this.dropTarget) {
        this.suppressChipClick = true;
        if (!this.rejectNonCommitteeCc(this.dropTarget, this.touchDrag.recipient)) {
          this.moveRecipient(this.touchDrag.field, this.dropTarget, this.touchDrag.recipient);
        }
      }
      this.clearTouchDrag();
    }
  };

  private moveRecipient(from: RecipientField, field: RecipientField, recipient: ComposerExternalRecipient): void {
    if (from === field) {
    } else {
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
  }

  private clearTouchDrag(): void {
    window.removeEventListener("pointermove", this.onChipPointerMove);
    window.removeEventListener("pointerup", this.onChipPointerUp);
    window.removeEventListener("pointercancel", this.onChipPointerUp);
    this.touchDrag = null;
    this.dragItem = null;
    this.dragFrom = null;
    this.dropTarget = null;
    this.changeDetector.markForCheck();
  }

  private reuseNewAddresses(): boolean {
    return !this.plain && this.saveForReuse;
  }

  private entryFor(parsed: ParsedMailbox): ComposerExternalRecipient {
    const email = parsed.email.toLowerCase();
    const matched = this.savedRecipients.find(item => item.email.toLowerCase() === email);
    const member = this.memberEntries().find(item => item.email.toLowerCase() === email);
    const name = parsed.name || matched?.name || member?.name || this.nameFromEmail(email);
    if (matched) {
      return {email: matched.email, name: name || undefined, existingId: matched.id, saveForReuse: false};
    } else {
      return {email, name: name || undefined, saveForReuse: member ? false : this.reuseNewAddresses()};
    }
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
