import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCopy, faPaste } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember, RoleType } from "../../../../models/committee.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";

@Component({
  selector: "app-inbox-visibility",
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, TooltipDirective],
  styles: [`
    .inbox-visibility-matrix
      th, td
        white-space: nowrap
      thead th
        vertical-align: bottom
      thead th.reader-column
        position: relative
        padding: 0
      thead th.reader-column::before
        content: ""
        position: absolute
        right: 100%
        bottom: 0
        width: 800px
        height: 1px
        background-color: rgba(0, 0, 0, 0.28)
        transform: rotate(30deg)
        transform-origin: right bottom
      thead th.corner-cell
        position: relative
        width: 1px
      .reader-heading
        position: absolute
        right: calc(50% + 32px)
        bottom: 10px
        line-height: 1
        transform: rotate(30deg)
        transform-origin: right bottom
        white-space: nowrap
        font-weight: 600
        font-size: 0.72rem
        text-align: right
        max-width: 720px
        overflow: hidden
        text-overflow: ellipsis
      .anno-can-be-seen
        position: absolute
        right: calc(50% + 131px)
        bottom: 66px
        line-height: 1
        transform: rotate(30deg)
        transform-origin: right bottom
        color: #697273
        font-size: 0.82rem
        font-style: italic
        white-space: nowrap
        text-shadow: 0 0 3px rgb(228, 240, 232), 0 0 3px rgb(228, 240, 232), 0 0 5px rgb(228, 240, 232), 0 0 7px rgb(228, 240, 232)
      .anno-arrow
        display: inline-block
      .anno-this-role
        position: absolute
        bottom: 5px
        left: 8px
        font-size: 0.85rem
        font-style: italic
        opacity: 0.75
        white-space: nowrap
      td.check-cell
        text-align: center
        padding: 8px 4px
        border-left: 1px solid rgba(0, 0, 0, 0.12)
      td.inbox-name
        width: 1px
        font-weight: 500
      td.inbox-name .name-label
        display: inline-block
        width: 300px
        white-space: normal
        overflow-wrap: break-word
        line-height: 1.3
      td.inbox-name .row-actions
        margin-top: 5px
        display: flex
        gap: 14px
      td.inbox-name .row-action
        cursor: pointer
        color: #9aa5a2
        font-size: 0.8rem
      td.inbox-name .row-action:hover
        color: rgb(99, 134, 110)
      td.inbox-name .row-action.active
        color: rgb(99, 134, 110)
      td.inbox-name .row-action.disabled
        opacity: 0.3
        pointer-events: none
  `],
  template: `
    @if (participatingRoles().length) {
      <p class="text-muted small mb-3">
        Each <strong>row</strong> is a role's inbox; each <strong>column</strong> is a role that could read it, so read across a row to see who can read that inbox, or down a column to see what a role can read. Leave a row on <strong>All role-holders</strong> to share it with the whole committee, or untick it to start with every role selected and then remove the ones that shouldn't read it. Set one inbox up, then use <strong>Copy</strong> and <strong>Paste</strong> to apply the same choices to another. Whoever holds a role always sees their own inbox. This applies when inbox privacy is set to <strong>Configurable</strong>; it has no effect in <strong>Private</strong> mode.
      </p>
      <div class="ngx-data-table-card">
        <table class="ngx-data-table inbox-visibility-matrix">
          <thead>
            <tr>
              <th scope="col" class="corner-cell" [style.height.px]="headerHeightPx()">
                <span class="anno-this-role">This role's emails &darr;</span>
              </th>
              <th scope="col" class="reader-column first-reader" [style.height.px]="headerHeightPx()">
                <span class="anno-can-be-seen">Can be seen by <span class="anno-arrow">&rarr;</span></span>
                <span class="reader-heading">All role-holders</span>
              </th>
              @for (reader of readerRoles(); track reader.type) {
                <th scope="col" class="reader-column" [style.height.px]="headerHeightPx()"><span class="reader-heading" [title]="roleLabel(reader)">{{ roleLabel(reader) }}</span></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (inbox of participatingRoles(); track inbox.type) {
              <tr>
                <td class="inbox-name">
                  <span class="name-label">{{ rowLabel(inbox) }}</span>
                  <div class="row-actions">
                    <fa-icon [icon]="faCopy" class="row-action"
                      [class.active]="copiedFromType === inbox.type"
                      tooltip="Copy this inbox's read access" (click)="copyRow(inbox)"></fa-icon>
                    <fa-icon [icon]="faPaste" class="row-action"
                      [class.disabled]="!copiedVisibility"
                      tooltip="Paste the copied read access onto this inbox" (click)="pasteRow(inbox)"></fa-icon>
                  </div>
                </td>
                <td class="check-cell">
                  <input type="checkbox" class="form-check-input"
                    [id]="'inbox-visible-all-' + inbox.type"
                    [checked]="visibleToAll(inbox)"
                    (change)="setVisibleToAll(inbox, $event)">
                </td>
                @for (reader of readerRoles(); track reader.type) {
                  <td class="check-cell">
                    <input type="checkbox" class="form-check-input"
                      [id]="'inbox-visible-' + inbox.type + '-' + reader.type"
                      [checked]="canRead(inbox, reader)"
                      [disabled]="cellDisabled(inbox, reader)"
                      (change)="toggleReader(inbox, reader, $event)">
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="text-muted small">Add committee roles first, then set which roles can read each inbox here.</div>
    }`
})
export class InboxVisibilityComponent {
  private logger = inject(LoggerFactory).createLogger("InboxVisibilityComponent", NgxLoggerLevel.ERROR);
  @Input() roles: CommitteeMember[] = [];
  @Output() visibilityChanged = new EventEmitter<void>();
  protected readonly faCopy = faCopy;
  protected readonly faPaste = faPaste;
  copiedVisibility: { all: boolean; types: string[] } | null = null;
  copiedFromType: string | null = null;

  participatingRoles(): CommitteeMember[] {
    return (this.roles ?? []).filter(role => role.type && !role.vacant);
  }

  readerRoles(): CommitteeMember[] {
    return this.participatingRoles().filter(role => role.roleType !== RoleType.SYSTEM_ROLE);
  }

  roleLabel(role: CommitteeMember): string {
    return role.description || role.fullName || role.type;
  }

  rowLabel(role: CommitteeMember): string {
    const description = role.description;
    const name = role.fullName;
    return description && name && description !== name ? `${description} (${name})` : (description || name || role.type);
  }

  headerHeightPx(): number {
    const charPx = 6.3;
    const maxWidthPx = 720;
    const riseFor = (text: string, bottomPx: number): number => bottomPx + Math.min(text.length * charPx, maxWidthPx) / 2;
    const labelRises = ["All role-holders", ...this.readerRoles().map(role => this.roleLabel(role))].map(text => riseFor(text, 10));
    return Math.round(Math.max(riseFor("Can be seen by →", 66), ...labelRises) + 24);
  }

  visibleToAll(inboxRole: CommitteeMember): boolean {
    return inboxRole.inboxVisibleToAllRoles !== false;
  }

  canRead(inboxRole: CommitteeMember, readerRole: CommitteeMember): boolean {
    return inboxRole.type === readerRole.type
      || this.visibleToAll(inboxRole)
      || (inboxRole.inboxVisibleToRoleTypes ?? []).includes(readerRole.type);
  }

  cellDisabled(inboxRole: CommitteeMember, readerRole: CommitteeMember): boolean {
    return inboxRole.type === readerRole.type || this.visibleToAll(inboxRole);
  }

  setVisibleToAll(inboxRole: CommitteeMember, event: Event): void {
    const everyone = (event.target as HTMLInputElement).checked;
    inboxRole.inboxVisibleToAllRoles = everyone;
    inboxRole.inboxVisibleToRoleTypes = everyone
      ? []
      : this.readerRoles().map(role => role.type).filter(type => type !== inboxRole.type);
    this.logger.info("visibleToAll", inboxRole.type, everyone);
    this.visibilityChanged.emit();
  }

  toggleReader(inboxRole: CommitteeMember, readerRole: CommitteeMember, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = inboxRole.inboxVisibleToRoleTypes ?? [];
    inboxRole.inboxVisibleToRoleTypes = checked
      ? [...new Set([...current, readerRole.type])]
      : current.filter(type => type !== readerRole.type);
    this.visibilityChanged.emit();
  }

  copyRow(inboxRole: CommitteeMember): void {
    this.copiedVisibility = {
      all: inboxRole.inboxVisibleToAllRoles !== false,
      types: [...(inboxRole.inboxVisibleToRoleTypes ?? [])]
    };
    this.copiedFromType = inboxRole.type;
    this.logger.info("copyRow", inboxRole.type, this.copiedVisibility);
  }

  pasteRow(inboxRole: CommitteeMember): void {
    if (!this.copiedVisibility) {
      return;
    }
    inboxRole.inboxVisibleToAllRoles = this.copiedVisibility.all;
    inboxRole.inboxVisibleToRoleTypes = [...this.copiedVisibility.types];
    this.logger.info("pasteRow", inboxRole.type, this.copiedVisibility);
    this.visibilityChanged.emit();
  }
}
