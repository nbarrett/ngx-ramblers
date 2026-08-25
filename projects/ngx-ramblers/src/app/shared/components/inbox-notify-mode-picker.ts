import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { InboxAliasRecipientView, InboxNotifyMode, inboxNotifyModeFor } from "../../models/inbox.model";
import { emailIsOnDomain } from "../../functions/strings";

@Component({
  selector: "app-inbox-notify-mode-picker",
  template: `
    @if (recipient) {
      <div class="form-check">
        <input class="form-check-input" type="radio" [name]="idPrefix"
               [id]="idPrefix + '-none'"
               [checked]="mode() === InboxNotifyMode.NONE"
               (change)="setMode(InboxNotifyMode.NONE)">
        <label class="form-check-label" [for]="idPrefix + '-none'">No notification</label>
      </div>
      @if (memberOptionVisible()) {
        <div class="form-check">
          <input class="form-check-input" type="radio" [name]="idPrefix"
                 [id]="idPrefix + '-member'"
                 [checked]="mode() === InboxNotifyMode.MEMBER"
                 (change)="setMode(InboxNotifyMode.MEMBER)">
          <label class="form-check-label" [for]="idPrefix + '-member'">
            Notify {{memberLabel}}@if (recipient.memberEmail) { ({{recipient.memberEmail}})}
          </label>
        </div>
      }
      <div class="form-check">
        <input class="form-check-input" type="radio" [name]="idPrefix"
               [id]="idPrefix + '-override'"
               [checked]="mode() === InboxNotifyMode.OVERRIDE"
               (change)="setMode(InboxNotifyMode.OVERRIDE)">
        <label class="form-check-label" [for]="idPrefix + '-override'">Notify a different address</label>
      </div>
      @if (mode() === InboxNotifyMode.OVERRIDE) {
        <input type="email" class="form-control form-control-sm mt-1" style="max-width: 22rem"
               [id]="idPrefix + '-email'"
               placeholder="personal email"
               [(ngModel)]="recipient.email"
               (change)="emitChange(InboxNotifyMode.OVERRIDE)">
      }
    }
  `,
  imports: [FormsModule]
})
export class InboxNotifyModePicker {

  protected readonly InboxNotifyMode = InboxNotifyMode;

  protected recipientInternal: InboxAliasRecipientView | null = null;
  @Input() idPrefix = "inbox-notify";
  @Input() memberLabel = "the member";
  @Input() showMemberOption = true;
  @Input() groupDomain: string | null = null;
  @Output() recipientChange = new EventEmitter<InboxNotifyMode>();

  private selected: InboxNotifyMode | null = null;

  @Input() set recipient(recipient: InboxAliasRecipientView | null) {
    this.recipientInternal = recipient;
    this.selected = null;
  }

  get recipient(): InboxAliasRecipientView | null {
    return this.recipientInternal;
  }

  memberOptionVisible(): boolean {
    if (!this.showMemberOption || !this.recipientInternal?.memberEmail) {
      return false;
    } else if (!this.groupDomain) {
      return true;
    } else {
      return !emailIsOnDomain(this.recipientInternal.memberEmail, this.groupDomain);
    }
  }

  mode(): InboxNotifyMode {
    const resolved = this.selected ?? inboxNotifyModeFor(this.recipientInternal, this.memberOptionVisible());
    if (resolved === InboxNotifyMode.MEMBER && !this.memberOptionVisible()) {
      return InboxNotifyMode.OVERRIDE;
    } else {
      return resolved;
    }
  }

  setMode(mode: InboxNotifyMode): void {
    if (this.recipientInternal) {
      this.selected = mode;
      this.recipientInternal.notify = mode !== InboxNotifyMode.NONE;
      if (mode !== InboxNotifyMode.OVERRIDE) {
        this.recipientInternal.email = null;
      }
      this.emitChange(mode);
    }
  }

  protected emitChange(mode: InboxNotifyMode): void {
    this.recipientChange.emit(mode);
  }
}
