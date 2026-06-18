import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowDownWideShort, faArrowUpWideShort, faBell, faBellSlash, faChevronDown, faChevronRight, faEnvelope, faEnvelopeOpen, faFilter, faInbox, faListCheck, faReply, faReplyAll, faRotateRight, faSearch, faTableColumns, faTableList, faTrash, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { isUndefined, kebabCase, values } from "es-toolkit/compat";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { InboxService } from "../../../services/inbox/inbox.service";
import { InboxReplyHandoffService } from "../../../services/inbox/inbox-reply-handoff.service";
import { InboxPushSubscriptionService } from "../../../services/inbox/inbox-push-subscription.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { MessageType } from "../../../models/websocket.model";
import {
  InboxAddress,
  InboxMessage,
  InboxMessageDirection,
  InboxNewMessageEvent,
  InboxAliasConfigView,
  InboxReplyComposeResponse,
  InboxThread,
  InboxThreadFolder,
  InboxViewScope,
  InboxReadFilter,
  isInboxGeneralRoleType
} from "../../../models/inbox.model";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { BrandingMode } from "../../../models/mail.model";
import { EmailComposerStepKey } from "../../../models/email-composer.model";
import { StoredValue } from "../../../models/ui-actions";
import { AlertTarget } from "../../../models/alert-target.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PageComponent } from "../../../page/page.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { HtmlFrameComponent } from "../../../modules/common/html-frame/html-frame.component";
import { ResizerComponent } from "../../../modules/common/resizer/resizer";
import { MaximisablePanelComponent } from "../../../modules/common/maximisable-panel/maximisable-panel";

@Component({
  selector: "app-inbox",
  imports: [CommonModule, FormsModule, FontAwesomeModule, PageComponent, DatePipe, TooltipDirective, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, HtmlFrameComponent, ResizerComponent, RouterLink, MaximisablePanelComponent],
  styles: [`
    .maximised .inbox-alert
      display: none
    .maximised .inbox-layout
      height: auto
      flex: 1 1 auto
      min-height: 0
      margin-top: 0.5rem
    .inbox-layout
      display: grid
      gap: 0
      height: 72vh
      margin-top: 1.75rem
    .inbox-pane
      min-width: 0
      min-height: 0
      display: flex
      flex-direction: column
      overflow: hidden
      padding-top: 2.25rem
    .inbox-pane-messages
      padding-top: 1rem
    .inbox-layout .inbox-pane
      margin: 0
    .inbox-thread-list
      flex: 1 1 auto
      min-height: 0
      overflow-y: auto
    .inbox-thread-list:focus
      outline: none
    .inbox-thread-row
      padding: 0.45rem 0.75rem
      border-bottom: 1px solid #e9ecef
      border-left: 4px solid transparent
      cursor: pointer
    .inbox-thread-row:nth-child(even)
      background-color: #fafafa
    .inbox-thread-row:hover
      background-color: rgba(155, 200, 171, 0.15)
    .inbox-thread-row.active
      background-color: rgba(155, 200, 171, 0.28)
      border-left-color: #5e9c76
    .inbox-thread-row.active .inbox-thread-from,
    .inbox-thread-row.active .inbox-thread-subject
      font-weight: 700
      color: #2f5e43
    .inbox-thread-row.unread
      background-color: rgba(249, 177, 4, 0.08)
      border-left-color: #f9b104
    .inbox-thread-row.unread:nth-child(even)
      background-color: rgba(249, 177, 4, 0.12)
    .inbox-thread-row.unread .inbox-thread-from
      font-weight: 700
      color: #1f2933
    .inbox-thread-row.unread .inbox-thread-subject
      font-weight: 600
      color: #1f2933
    .inbox-unread-dot
      display: inline-block
      width: 0.55rem
      height: 0.55rem
      border-radius: 50%
      background-color: #f9b104
      box-shadow: 0 0 0 1px rgba(31, 41, 51, 0.15)
      flex-shrink: 0
    .inbox-thread-from
      font-size: 0.95rem
      font-weight: 400
      color: #555
    .inbox-thread-subject
      font-size: 0.85rem
      color: #777
      font-weight: 400
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap
    .inbox-thread-time
      font-size: 0.75rem
      color: #888
      white-space: nowrap
    .inbox-thread-recipient
      font-size: 0.78rem
      color: #8a8a8a
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap
    .min-w-0
      min-width: 0
    .inbox-list-toolbar
      cursor: default
    .inbox-action-btn
      color: #888
      border: 1px solid #d0d0d0
      background-color: transparent
    .inbox-action-btn:hover, .inbox-action-btn:focus
      color: #fff
      background-color: #dc3545
      border-color: #dc3545
    .inbox-detail-header
      padding-bottom: 0.75rem
      border-bottom: 1px solid #e9ecef
    .inbox-detail
      flex: 1 1 auto
      min-height: 0
      overflow: auto
      padding-right: 0.75rem
    .inbox-message
      border-bottom: 1px solid #f0f0f0
      padding-bottom: 1rem
      margin-bottom: 1rem
    .inbox-message-headers
      font-size: 0.85rem
      color: #555
      margin-bottom: 0.5rem
    .inbox-message-toggle
      cursor: pointer
      border-radius: 4px
      padding: 0.25rem 0.35rem
      margin: -0.25rem -0.35rem 0.5rem
    .inbox-message-toggle:hover
      background-color: rgba(155, 200, 171, 0.15)
    .inbox-message.collapsed
      padding-bottom: 0.5rem
      margin-bottom: 0.5rem
    .inbox-message-preview
      color: #777
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap
    .inbox-reply-actions
      margin-top: 0.4rem
      margin-right: 0.4rem
      margin-left: 0.5rem
      transition: opacity 0.12s ease-in-out
    .inbox-message.collapsed .inbox-reply-actions
      opacity: 0
    .inbox-message.collapsed:hover .inbox-reply-actions
      opacity: 1
    .inbox-filter-btn
      width: 1.8rem
      height: 1.8rem
      min-width: 1.8rem
      min-height: 1.8rem
      max-height: 1.8rem
      flex: 0 0 auto
      padding: 0
      line-height: 1
      font-size: 0.8rem
      display: inline-flex
      align-items: center
      justify-content: center
    .inbox-reply-btn
      width: 1.8rem
      height: 1.8rem
      min-width: 1.8rem
      min-height: 1.8rem
      max-height: 1.8rem
      flex: 0 0 auto
      padding: 0
      line-height: 1
      font-size: 0.8rem
      display: inline-flex
      align-items: center
      justify-content: center
      color: #404143
      background-color: #e9ecef
      border: none
    .inbox-reply-btn:hover, .inbox-reply-btn:focus
      background-color: #f9b104
      color: #212529
    .inbox-reply-label
      display: none
    @media (min-width: 1200px)
      .inbox-reply-btn
        width: auto
        min-width: 0
        height: auto
        max-height: none
        padding: 0.2rem 0.6rem
        gap: 0.3rem
      .inbox-reply-label
        display: inline
    .inbox-message-body
      font-size: 0.95rem
      overflow-wrap: anywhere
    .inbox-message-body ::ng-deep img
      max-width: 100%
      height: auto
    .inbox-message-body ::ng-deep table
      max-width: 100%
    .inbox-message-body ::ng-deep pre
      white-space: pre-wrap
      overflow-wrap: anywhere
    .inbox-role-select
      flex: 1 1 auto
      min-width: 8rem
      font-size: 0.8rem
    .inbox-detail-header .btn
      font-size: 0.8rem
      padding: 0.35rem 0.65rem
      min-height: 0
    @media (max-width: 575.98px)
      .inbox-toolbar
        flex-direction: column
        align-items: stretch
      .inbox-toolbar .ms-auto
        flex-direction: column
        align-items: stretch
        width: 100%
        margin-left: 0
      .inbox-toolbar .btn,
      .inbox-toolbar .inbox-role-select
        width: 100%
        margin-right: 0
      .inbox-toolbar .inbox-role-select
        min-width: 0
  `],
  template: `
    <app-page pageTitle="Email inbox">
      <app-maximisable-panel #panel="maximisablePanel">
      <div panelControls class="d-flex flex-nowrap gap-2 align-items-center flex-grow-1 inbox-toolbar">
          <div class="d-flex align-items-center gap-2 flex-shrink-0">
            <fa-icon [icon]="faInbox" class="ramblers" size="lg"></fa-icon>
            @if (threadListUnreadCount > 0) {
              <span class="badge bg-warning text-dark">{{threadListUnreadCount}} unread</span>
            }
          </div>
          @if (aliases.length > 0) {
            <label class="visually-hidden" for="inbox-role">Inbox view</label>
            <select id="inbox-role" class="form-select inbox-role-select"
                    [(ngModel)]="selectedMailboxView"
                    (ngModelChange)="roleMailboxChanged()">
              @if (aliases.length > 1) {
                <option [ngValue]="InboxViewScope.ALL_ACCESSIBLE">Show all inbox messages</option>
                <option [ngValue]="InboxViewScope.ASSIGNED_ROLES">Show my inbox messages</option>
              }
              @for (alias of aliases; track alias.id) {
                <option [ngValue]="alias.roleType">{{ isInboxGeneralRoleType(alias.roleType) ? "Other inbox mail" : alias.roleEmail }}</option>
              }
              @if (isInboxAdmin) {
                <option [ngValue]="InboxThreadFolder.JUNK">Junk mail</option>
              }
            </select>
          }
          <div class="ms-auto d-flex align-items-center gap-2 flex-shrink-0">
          <button class="btn btn-quiet text-nowrap flex-shrink-0" type="button" (click)="toggleLayout()" [tooltip]="stackedLayout ? 'Switch to side-by-side view' : 'Switch to stacked view'">
            <fa-icon [icon]="stackedLayout ? faTableColumns : faTableList" class="me-1"/>
            {{ stackedLayout ? 'Side-by-side' : 'Stacked' }}
          </button>
          @if ((pushStatus$ | async); as pushStatus) {
            @if (pushStatus.supported) {
              @if (pushStatus.subscribed) {
                <button class="btn btn-quiet text-nowrap flex-shrink-0" type="button" (click)="disableBrowserNotifications()" [disabled]="busy" tooltip="Stop showing browser notifications for new inbox messages">
                  <fa-icon [icon]="faBellSlash" class="me-1"></fa-icon>
                  Disable notifications
                </button>
              } @else if (pushStatus.permission !== 'denied') {
                <button class="btn btn-quiet text-nowrap flex-shrink-0" type="button" (click)="enableBrowserNotifications()" [disabled]="busy" tooltip="Get a desktop or phone notification when new inbox mail arrives">
                  <fa-icon [icon]="faBell" class="me-1"></fa-icon>
                  Enable notifications
                </button>
              }
            }
          }
          <button class="btn btn-quiet text-nowrap flex-shrink-0" type="button" (click)="refresh()" [disabled]="busy">
            <fa-icon [icon]="faRotateRight" class="me-1"></fa-icon>
            Refresh
          </button>
          </div>
      </div>
      @if (aliases.length === 0) {
        <div class="alert alert-warning inbox-alert">
          <fa-icon [icon]="faTriangleExclamation"/>
          <strong class="ms-2">No role mailboxes connected -</strong>
          <span class="ms-1">An administrator can connect a mailbox in <a [routerLink]="['/admin/system-settings']" [queryParams]="{tab: 'external-systems', 'sub-tab': 'mail'}">System Settings &rarr; External Systems &rarr; Mail</a>, then point each committee role's Inbound Forwarding at it. Roles forwarding to a connected mailbox appear here automatically.</span>
        </div>
      }
      @if (selectedAlias(); as alias) {
        <div class="alert alert-success py-2 inbox-alert">
          <fa-icon [icon]="faEnvelope" class="me-2"/>
          <strong>Viewing mail for {{alias.roleEmail}}</strong>
          @if (!alias.mailboxConnection?.hasRefreshToken) {
            <span class="ms-1">This mailbox is not connected yet.</span>
          }
        </div>
      }
      <div class="inbox-layout" [class.stacked]="stackedLayout"
           [style.grid-template-columns]="stackedLayout ? 'minmax(0, 1fr)' : (listSize + 'px 8px minmax(0, 1fr)')"
           [style.grid-template-rows]="stackedLayout ? (listSize + 'px 8px minmax(0, 1fr)') : 'minmax(0, 1fr)'">
        <div class="thumbnail-heading-frame-compact inbox-pane">
          <div class="thumbnail-heading">Conversations</div>
          @if (threads.length > 0 || conversationSearchTerm) {
            <div class="px-2 pb-2">
              <div class="input-group input-group-sm">
                <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                <input type="text" class="form-control" [(ngModel)]="conversationSearchTerm"
                       placeholder="Search conversations...">
              </div>
              <div class="small text-muted mt-1">
                {{filteredThreads.length}} of {{stringUtils.pluraliseWithCount(threads.length, "conversation")}}
              </div>
            </div>
          }
          @if (threads.length > 0) {
            <div class="d-flex align-items-center gap-2 px-2 pb-2 inbox-list-toolbar">
              <input type="checkbox" class="form-check-input mt-0" id="inbox-select-all"
                     [checked]="allSelected()"
                     [indeterminate]="selectedThreadIds.size > 0 && !allSelected()"
                     (change)="toggleSelectAll()">
              @if (selectedThreadIds.size > 0) {
                <div class="btn-group" dropdown [isDisabled]="busy">
                  <button dropdownToggle type="button" class="btn btn-sm btn-primary dropdown-toggle text-nowrap" [disabled]="busy">
                    <fa-icon [icon]="faListCheck" class="me-2"/>{{selectedThreadIds.size}} selected
                  </button>
                  <ul *dropdownMenu class="dropdown-menu" role="menu">
                    <li role="menuitem"><button class="dropdown-item" type="button" (click)="markSelected(false)"><fa-icon [icon]="faEnvelopeOpen" class="me-2"/>Mark as read</button></li>
                    <li role="menuitem"><button class="dropdown-item" type="button" (click)="markSelected(true)"><fa-icon [icon]="faEnvelope" class="me-2"/>Mark as unread</button></li>
                    @if (viewingJunk) {
                      <li role="menuitem"><button class="dropdown-item" type="button" (click)="moveSelectedJunk()"><fa-icon [icon]="faInbox" class="me-2"/>Not junk — move to inbox</button></li>
                    }
                    <li><hr class="dropdown-divider"></li>
                    <li role="menuitem"><button class="dropdown-item text-danger" type="button" (click)="deleteSelected()"><fa-icon [icon]="faTrash" class="me-2"/>Delete</button></li>
                  </ul>
                </div>
              } @else {
                <label class="text-muted small mb-0" for="inbox-select-all">Select all</label>
              }
              <button type="button" class="btn btn-quiet inbox-filter-btn ms-auto" [class.active]="readFilter === InboxReadFilter.UNREAD"
                      (click)="toggleUnreadFilter()"
                      [tooltip]="readFilter === InboxReadFilter.UNREAD ? 'Showing unread only — click to show all' : 'Show unread only'">
                <fa-icon [icon]="faFilter"></fa-icon>
              </button>
            </div>
          }
          <div class="inbox-thread-list" tabindex="0" (keydown)="onThreadListKeydown($event)">
          @if (threads.length === 0) {
            <div class="p-3 text-muted">No conversations yet. Once an alias is connected and synced, threads will appear here.</div>
          }
          @if (threads.length > 0 && filteredThreads.length === 0) {
            @if (conversationSearchTerm) {
              <div class="p-3 text-muted">No conversations match "{{conversationSearchTerm}}".</div>
            } @else {
              <div class="p-3 text-muted">No {{readFilter === InboxReadFilter.ALL ? "" : readFilter + " "}}conversations.</div>
            }
          }
          @for (thread of filteredThreads; track threadIdOf(thread)) {
            <div class="inbox-thread-row d-flex align-items-center gap-2"
                 [class.active]="threadIdOf(thread) === selectedThreadId"
                 [class.unread]="thread.unread"
                 [attr.data-thread-id]="threadIdOf(thread)"
                 (click)="openThread(thread)">
              <input type="checkbox" class="form-check-input flex-shrink-0 m-0"
                     [checked]="selectedThreadIds.has(threadIdOf(thread))"
                     (click)="$event.stopPropagation(); toggleThreadSelection(thread)">
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-items-center gap-2">
                  @if (thread.unread) {
                    <span class="inbox-unread-dot flex-shrink-0" aria-label="Unread"></span>
                  }
                  <div class="inbox-thread-from flex-grow-1 text-truncate">{{thread.externalAddress.name ?? thread.externalAddress.email}}</div>
                  <div class="inbox-thread-time flex-shrink-0">{{thread.lastSeenAt | date: "short"}}</div>
                </div>
                <div class="inbox-thread-subject">{{thread.subject || thread.normalisedSubject || "(no subject)"}}</div>
                @if (recipientForThread(thread); as roleEmail) {
                  <div class="inbox-thread-recipient">to {{roleEmail}}</div>
                }
              </div>
            </div>
          }
          </div>
        </div>
        <app-resizer variant="bar"
                     [orientation]="stackedLayout ? 'vertical' : 'horizontal'"
                     [size]="listSize"
                     [minSize]="minListSize"
                     [maxSize]="maxListSize"
                     (sizeChange)="listSize = $event"
                     (resizeEnd)="persistListSize()"/>
        <div class="thumbnail-heading-frame-compact inbox-pane inbox-pane-messages">
          @if (selectedThread) {
            <div class="d-flex align-items-start gap-2 mb-3 inbox-detail-header">
              <div class="me-auto">
                <h5 class="mb-1">{{selectedThread.subject || selectedThread.normalisedSubject || "(no subject)"}}</h5>
                <small class="text-muted d-block">From {{selectedThread.externalAddress.name ?? selectedThread.externalAddress.email}}</small>
                @if (selectedThreadRecipient(); as recipient) {
                  <small class="text-muted d-block">To {{recipient}}</small>
                }
              </div>
              @if (selectedMessages.length > 1) {
                <button class="btn btn-sm btn-quiet text-nowrap flex-shrink-0" type="button" (click)="toggleMessageSort()"
                        placement="left" container="body"
                        [tooltip]="messageSortDescending ? 'Showing newest first - click for oldest first' : 'Showing oldest first - click for newest first'">
                  <fa-icon [icon]="messageSortDescending ? faArrowDownWideShort : faArrowUpWideShort" class="me-1"/>
                  {{ messageSortDescending ? 'Newest first' : 'Oldest first' }}
                </button>
              }
              @if (selectedThread.folder === InboxThreadFolder.JUNK) {
                <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" [disabled]="busy" (click)="moveSelectedToInbox()">
                  <fa-icon [icon]="faInbox" class="me-1"></fa-icon>
                  Not junk
                </button>
                <button class="btn btn-sm inbox-action-btn text-nowrap flex-shrink-0" type="button" [disabled]="busy" (click)="deleteCurrentThread()">
                  <fa-icon [icon]="faTrash" class="me-1"></fa-icon>
                  Delete
                </button>
              }
            </div>
          }
          <div class="inbox-detail">
          @if (!selectedThread) {
            <div class="text-muted">Select a conversation on the left to see its messages.</div>
          } @else if (loadingThread) {
            <div class="text-muted">Loading conversation...</div>
          } @else {
            @for (message of displayMessages; track message.messageId) {
              <div class="inbox-message" [class.outbound]="message.direction === InboxMessageDirection.OUTBOUND" [class.collapsed]="!isMessageExpanded(message)">
                <div class="inbox-message-headers inbox-message-toggle d-flex align-items-start gap-2" (click)="toggleMessage(message)">
                  <fa-icon [icon]="isMessageExpanded(message) ? faChevronDown : faChevronRight" class="mt-1 text-muted"/>
                  <div class="flex-grow-1 min-w-0">
                    <strong>{{message.direction === InboxMessageDirection.OUTBOUND ? "Sent from this group" : (message.from.name ?? message.from.email)}}</strong>
                    &middot; {{(message.receivedAt ?? message.sentAt) | date: "medium"}}
                    @if (isMessageExpanded(message)) {
                      @if (message.cc?.length) {
                        <div>Cc: {{ formatAddresses(message.cc) }}</div>
                      }
                    } @else {
                      @if (message.to?.length || message.cc?.length) {
                        <div class="inbox-message-preview">to {{ recipientSummary(message) }}</div>
                      }
                      <div class="inbox-message-preview">{{ messagePreview(message) }}</div>
                    }
                  </div>
                  @if (message.direction === InboxMessageDirection.INBOUND) {
                    <div class="inbox-reply-actions d-flex gap-1 flex-shrink-0">
                      <button class="btn inbox-reply-btn" type="button" [disabled]="busy"
                              tooltip="Reply in email composer" placement="left" container="body" (click)="$event.stopPropagation(); prepareReply(message)">
                        <fa-icon [icon]="faReply"/>
                        <span class="inbox-reply-label">Reply</span>
                      </button>
                      @if (hasMultipleRecipients(message)) {
                        <button class="btn inbox-reply-btn" type="button" [disabled]="busy"
                                tooltip="Reply all in email composer" placement="left" container="body" (click)="$event.stopPropagation(); prepareReplyAll(message)">
                          <fa-icon [icon]="faReplyAll"/>
                          <span class="inbox-reply-label">Reply all</span>
                        </button>
                      }
                    </div>
                  }
                </div>
                @if (isMessageExpanded(message)) {
                  <app-html-frame class="inbox-message-body" [html]="renderableBody(message)"/>
                }
              </div>
            }
          }
          </div>
        </div>
      </div>
      </app-maximisable-panel>
      @if (notifyTarget.showAlert) {
        <div class="row mt-3">
          <div class="col-sm-12">
            <div class="alert" [ngClass]="notifyTarget.alertClass">
              <fa-icon [icon]="notifyTarget.alert.icon"/>
              @if (notifyTarget.alertTitle) {
                <strong class="ms-2">{{notifyTarget.alertTitle}}:</strong>
              }
              <span class="ms-1">{{notifyTarget.alertMessage}}</span>
            </div>
          </div>
        </div>
      }
    </app-page>
  `
})
export class InboxComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("InboxComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  private inboxReplyHandoff = inject(InboxReplyHandoffService);
  private pushSubscriptionService = inject(InboxPushSubscriptionService);
  protected readonly pushStatus$ = this.pushSubscriptionService.status$;
  protected readonly faBell = faBell;
  protected readonly faBellSlash = faBellSlash;
  private webSocketClientService = inject(WebSocketClientService);
  private notifierService = inject(NotifierService);
  protected stringUtils = inject(StringUtilsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private memberLoginService = inject(MemberLoginService);

  protected readonly faInbox = faInbox;
  protected readonly faReply = faReply;
  protected readonly faRotateRight = faRotateRight;
  protected readonly faEnvelope = faEnvelope;
  protected readonly faEnvelopeOpen = faEnvelopeOpen;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faTableColumns = faTableColumns;
  protected readonly faTableList = faTableList;
  protected readonly faTrash = faTrash;
  protected readonly faSearch = faSearch;
  protected readonly faFilter = faFilter;
  protected readonly faListCheck = faListCheck;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faReplyAll = faReplyAll;
  protected readonly faArrowDownWideShort = faArrowDownWideShort;
  protected readonly faArrowUpWideShort = faArrowUpWideShort;
  public messageSortDescending = true;
  protected readonly InboxMessageDirection = InboxMessageDirection;
  protected readonly InboxViewScope = InboxViewScope;
  protected readonly InboxReadFilter = InboxReadFilter;
  protected readonly InboxThreadFolder = InboxThreadFolder;
  protected readonly isInboxGeneralRoleType = isInboxGeneralRoleType;

  get isInboxAdmin(): boolean {
    return this.memberLoginService.allowMemberAdminEdits();
  }

  get displayMessages(): InboxMessage[] {
    return [...this.selectedMessages].sort((left, right) => {
      const leftAt = left.receivedAt ?? left.sentAt ?? 0;
      const rightAt = right.receivedAt ?? right.sentAt ?? 0;
      return this.messageSortDescending ? rightAt - leftAt : leftAt - rightAt;
    });
  }

  toggleMessageSort(): void {
    this.messageSortDescending = !this.messageSortDescending;
  }

  hasMultipleRecipients(message: InboxMessage): boolean {
    return ((message.to?.length ?? 0) + (message.cc?.length ?? 0)) > 1;
  }

  get viewingJunk(): boolean {
    return this.selectedMailboxView === InboxThreadFolder.JUNK;
  }

  public aliases: InboxAliasConfigView[] = [];
  public threads: InboxThread[] = [];
  public conversationSearchTerm = "";
  public readFilter: InboxReadFilter = InboxReadFilter.ALL;
  public selectedThreadIds = new Set<string>();
  public threadListUnreadCount = 0;
  public selectedThread: InboxThread | null = null;
  public selectedThreadId: string | null = null;
  public selectedMessages: InboxMessage[] = [];
  public expandedMessageIds = new Set<string>();
  public loadingThread = false;
  public selectedMailboxView: string = InboxViewScope.ALL_ACCESSIBLE;
  public busy = false;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};

  public stackedLayout = false;
  public listSize = 352;
  public readonly minListSize = 140;
  private static readonly LAYOUT_KEY = "inbox-layout";
  private static readonly SIZE_KEY = "inbox-list-size";

  private subscriptions: Subscription[] = [];
  private openThreadRequestId = 0;
  private mailboxViewInitialised = false;

  async ngOnInit(): Promise<void> {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.restoreLayout();
    await this.refresh();
    await this.pushSubscriptionService.refresh();
    await this.webSocketClientService.connect();
    this.subscriptions.push(this.webSocketClientService.receiveMessages<InboxNewMessageEvent>(MessageType.INBOX_NEW_MESSAGE)
      .subscribe(event => this.handleNewMessageEvent(event)));
    this.subscriptions.push(this.webSocketClientService.receiveMessages<InboxNewMessageEvent>(MessageType.INBOX_THREAD_UPDATED)
      .subscribe(event => this.handleNewMessageEvent(event)));
  }

  async enableBrowserNotifications(): Promise<void> {
    this.busy = true;
    try {
      await this.pushSubscriptionService.enable();
      this.notify.success({title: "Notifications", message: "Browser notifications enabled for new inbox messages"});
    } catch (error) {
      this.notify.error({title: "Notifications", message: (error as Error).message});
    } finally {
      this.busy = false;
    }
  }

  async disableBrowserNotifications(): Promise<void> {
    this.busy = true;
    try {
      await this.pushSubscriptionService.disable();
      this.notify.success({title: "Notifications", message: "Browser notifications turned off"});
    } catch (error) {
      this.notify.error({title: "Notifications", message: (error as Error).message});
    } finally {
      this.busy = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get maxListSize(): number {
    if (isUndefined(window)) {
      return Number.POSITIVE_INFINITY;
    }
    return (this.stackedLayout ? window.innerHeight : window.innerWidth) * 0.7;
  }

  persistListSize(): void {
    if (!isUndefined(window)) {
      window.localStorage.setItem(InboxComponent.SIZE_KEY, String(Math.round(this.listSize)));
    }
  }

  private restoreLayout(): void {
    if (isUndefined(window)) {
      return;
    }
    this.stackedLayout = window.localStorage.getItem(InboxComponent.LAYOUT_KEY) === "stacked";
    const storedSize = Number(window.localStorage.getItem(InboxComponent.SIZE_KEY));
    this.listSize = Number.isFinite(storedSize) && storedSize >= this.minListSize ? storedSize : this.defaultListSize();
  }

  private defaultListSize(): number {
    return this.stackedLayout ? 240 : 352;
  }

  toggleLayout(): void {
    this.stackedLayout = !this.stackedLayout;
    this.listSize = this.defaultListSize();
    if (!isUndefined(window)) {
      window.localStorage.setItem(InboxComponent.LAYOUT_KEY, this.stackedLayout ? "stacked" : "side-by-side");
      window.localStorage.setItem(InboxComponent.SIZE_KEY, String(this.listSize));
    }
  }

  async refresh(): Promise<void> {
    this.busy = true;
    try {
      this.aliases = await this.inboxService.listAliases();
      if (!this.mailboxViewInitialised) {
        this.applyMailboxViewFromUrl();
        this.applyReadFilterFromUrl();
        this.mailboxViewInitialised = true;
      }
      if (this.viewingJunk && this.isInboxAdmin) {
        const junkResponse = await this.inboxService.listThreads(null, null, false, null, InboxThreadFolder.JUNK);
        this.threads = junkResponse.threads;
        this.threadListUnreadCount = 0;
        if (!this.selectedThreadId && this.threads.length > 0) {
          await this.openThread(this.threads[0], false);
        }
        return;
      }
      if (this.aliases.length === 1) {
        this.selectedMailboxView = this.aliases[0].roleType;
      } else if (!values(InboxViewScope).includes(this.selectedMailboxView as InboxViewScope)
        && !this.aliases.some(alias => alias.roleType === this.selectedMailboxView)) {
        this.selectedMailboxView = InboxViewScope.ALL_ACCESSIBLE;
      }
      const roleType = this.selectedRoleType();
      const scope = roleType ? null : this.selectedMailboxView as InboxViewScope;
      const listResponse = await this.inboxService.listThreads(roleType, scope);
      this.threads = listResponse.threads;
      this.threadListUnreadCount = listResponse.unreadCount;
      if (!this.selectedThreadId && this.threads.length > 0) {
        const requestedSlug = this.route.snapshot.queryParams[StoredValue.THREAD];
        const requestedThread = requestedSlug
          ? this.threads.find(thread => this.threadSlug(thread) === requestedSlug || this.threadIdOf(thread) === requestedSlug)
          : null;
        await this.openThread(requestedThread ?? this.threads[0], false);
      }
    } catch (error) {
      this.notify.error({title: "Inbox", message: (error as Error).message});
      this.logger.error("Failed to refresh inbox:", error);
    } finally {
      this.busy = false;
    }
  }

  selectedAlias(): InboxAliasConfigView | null {
    return this.aliases.find(alias => alias.roleType === this.selectedMailboxView) ?? null;
  }

  selectedRoleType(): string | null {
    return values(InboxViewScope).includes(this.selectedMailboxView as InboxViewScope)
      ? null
      : this.selectedMailboxView;
  }

  async roleMailboxChanged(): Promise<void> {
    this.selectedThread = null;
    this.selectedThreadId = null;
    this.selectedMessages = [];
    this.loadingThread = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.MAILBOX_VIEW]: this.mailboxViewParam()},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
    await this.refresh();
  }

  private mailboxViewParam(): string {
    if (values(InboxViewScope).includes(this.selectedMailboxView as InboxViewScope)) {
      return this.selectedMailboxView;
    }
    const alias = this.aliases.find(candidate => candidate.roleType === this.selectedMailboxView);
    return alias ? alias.roleEmail.split("@")[0] : this.selectedMailboxView;
  }

  private applyMailboxViewFromUrl(): void {
    const param = this.route.snapshot.queryParams[StoredValue.MAILBOX_VIEW];
    if (!param) {
      return;
    }
    if (values(InboxViewScope).includes(param as InboxViewScope)) {
      this.selectedMailboxView = param;
    } else {
      const alias = this.aliases.find(candidate => candidate.roleEmail.split("@")[0] === param);
      if (alias) {
        this.selectedMailboxView = alias.roleType;
      }
    }
  }

  threadIdOf(thread: InboxThread): string {
    return (thread.id ?? (thread as unknown as {_id: {toString(): string}})._id ?? "").toString();
  }

  get filteredThreads(): InboxThread[] {
    const byReadState = this.threads.filter(thread =>
      this.readFilter === InboxReadFilter.ALL || (this.readFilter === InboxReadFilter.UNREAD ? thread.unread : !thread.unread));
    const term = this.conversationSearchTerm?.trim().toLowerCase();
    if (!term) {
      return byReadState;
    }
    return byReadState.filter(thread =>
      (thread.normalisedSubject ?? "").toLowerCase().includes(term)
      || (thread.externalAddress?.name ?? "").toLowerCase().includes(term)
      || (thread.externalAddress?.email ?? "").toLowerCase().includes(term)
      || (thread.roleType ?? "").toLowerCase().includes(term));
  }

  toggleUnreadFilter(): void {
    this.readFilter = this.readFilter === InboxReadFilter.UNREAD ? InboxReadFilter.ALL : InboxReadFilter.UNREAD;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.INBOX_FILTER]: this.readFilter === InboxReadFilter.ALL ? null : this.readFilter},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  private applyReadFilterFromUrl(): void {
    const param = this.route.snapshot.queryParams[StoredValue.INBOX_FILTER] as InboxReadFilter;
    if (param === InboxReadFilter.UNREAD || param === InboxReadFilter.READ) {
      this.readFilter = param;
    }
  }

  toggleThreadSelection(thread: InboxThread): void {
    const id = this.threadIdOf(thread);
    if (this.selectedThreadIds.has(id)) {
      this.selectedThreadIds.delete(id);
    } else {
      this.selectedThreadIds.add(id);
    }
  }

  allSelected(): boolean {
    return this.threads.length > 0 && this.threads.every(thread => this.selectedThreadIds.has(this.threadIdOf(thread)));
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedThreadIds.clear();
    } else {
      this.selectedThreadIds = new Set(this.threads.map(thread => this.threadIdOf(thread)));
    }
  }

  async deleteSelected(): Promise<void> {
    const ids = [...this.selectedThreadIds];
    if (ids.length === 0) {
      return;
    }
    this.busy = true;
    try {
      await Promise.all(ids.map(id => this.inboxService.deleteThread(id)));
      if (this.selectedThreadId && ids.includes(this.selectedThreadId)) {
        this.selectedThread = null;
        this.selectedThreadId = null;
        this.selectedMessages = [];
        this.loadingThread = false;
      }
      this.selectedThreadIds.clear();
      await this.refresh();
      this.notify.success({title: "Inbox", message: `${this.stringUtils.pluraliseWithCount(ids.length, "conversation")} deleted`});
    } catch (error) {
      this.notify.error({title: "Delete", message: (error as Error).message});
      this.logger.error("Failed to delete conversations:", error);
    } finally {
      this.busy = false;
    }
  }

  async markSelected(unread: boolean): Promise<void> {
    const ids = [...this.selectedThreadIds];
    if (ids.length === 0) {
      return;
    }
    this.busy = true;
    try {
      await Promise.all(ids.map(id => unread ? this.inboxService.markThreadUnread(id) : this.inboxService.markThreadRead(id)));
      this.selectedThreadIds.clear();
      await this.refresh();
      this.notify.success({title: "Inbox", message: `${this.stringUtils.pluraliseWithCount(ids.length, "conversation")} marked as ${unread ? "unread" : "read"}`});
    } catch (error) {
      this.notify.error({title: unread ? "Mark as unread" : "Mark as read", message: (error as Error).message});
      this.logger.error("Failed to mark conversations:", error);
    } finally {
      this.busy = false;
    }
  }

  async moveSelectedJunk(): Promise<void> {
    const ids = [...this.selectedThreadIds];
    if (ids.length === 0) {
      return;
    }
    this.busy = true;
    try {
      await Promise.all(ids.map(id => this.inboxService.moveThreadToInbox(id)));
      if (this.selectedThreadId && ids.includes(this.selectedThreadId)) {
        this.selectedThread = null;
        this.selectedThreadId = null;
        this.selectedMessages = [];
      }
      this.selectedThreadIds.clear();
      await this.refresh();
      this.notify.success({title: "Inbox", message: `${this.stringUtils.pluraliseWithCount(ids.length, "conversation")} moved out of junk into the inbox`});
    } catch (error) {
      this.notify.error({title: "Not junk", message: (error as Error).message});
      this.logger.error("Failed to move conversations out of junk:", error);
    } finally {
      this.busy = false;
    }
  }

  async moveSelectedToInbox(): Promise<void> {
    if (!this.selectedThreadId) {
      return;
    }
    const threadId = this.selectedThreadId;
    this.busy = true;
    try {
      await this.inboxService.moveThreadToInbox(threadId);
      this.selectedThread = null;
      this.selectedThreadId = null;
      this.selectedMessages = [];
      await this.refresh();
      this.notify.success({title: "Inbox", message: "Moved out of junk into the inbox"});
    } catch (error) {
      this.notify.error({title: "Not junk", message: (error as Error).message});
      this.logger.error("Failed to move thread to inbox:", error);
    } finally {
      this.busy = false;
    }
  }

  async deleteCurrentThread(): Promise<void> {
    if (!this.selectedThreadId) {
      return;
    }
    const threadId = this.selectedThreadId;
    this.busy = true;
    try {
      await this.inboxService.deleteThread(threadId);
      this.selectedThread = null;
      this.selectedThreadId = null;
      this.selectedMessages = [];
      this.selectedThreadIds.delete(threadId);
      await this.refresh();
      this.notify.success({title: "Inbox", message: "Conversation deleted"});
    } catch (error) {
      this.notify.error({title: "Delete", message: (error as Error).message});
      this.logger.error("Failed to delete conversation:", error);
    } finally {
      this.busy = false;
    }
  }

  threadSlug(thread: InboxThread): string {
    const sanitised = (thread.normalisedSubject || "").replace(/\p{Extended_Pictographic}/gu, "");
    return kebabCase(sanitised) || String(thread.firstSeenAt ?? thread.lastSeenAt ?? "");
  }

  private syncThreadToUrl(thread: InboxThread): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.THREAD]: this.threadSlug(thread)},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  onThreadListKeydown(event: KeyboardEvent): void {
    if (event.key === "Delete" || event.key === "Backspace") {
      if (this.selectedThreadId) {
        event.preventDefault();
        void this.deleteFocusedThread(event.currentTarget as HTMLElement);
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const list = this.filteredThreads;
    if (list.length === 0) {
      return;
    }
    event.preventDefault();
    const currentIndex = list.findIndex(thread => this.threadIdOf(thread) === this.selectedThreadId);
    const nextIndex = currentIndex === -1
      ? (event.key === "ArrowDown" ? 0 : list.length - 1)
      : Math.min(list.length - 1, Math.max(0, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
    const nextThread = list[nextIndex];
    if (nextThread && this.threadIdOf(nextThread) !== this.selectedThreadId) {
      const listElement = event.currentTarget as HTMLElement;
      void this.openThread(nextThread).then(() => this.scrollThreadRowIntoView(listElement, this.threadIdOf(nextThread)));
    }
  }

  private scrollThreadRowIntoView(listElement: HTMLElement, threadId: string): void {
    listElement.querySelector(`[data-thread-id="${threadId}"]`)?.scrollIntoView({block: "nearest"});
  }

  private async deleteFocusedThread(listElement: HTMLElement): Promise<void> {
    const threadId = this.selectedThreadId;
    if (!threadId) {
      return;
    }
    const list = this.filteredThreads;
    const currentIndex = list.findIndex(thread => this.threadIdOf(thread) === threadId);
    const nextThread = list[currentIndex + 1] ?? list[currentIndex - 1] ?? null;
    this.busy = true;
    try {
      await this.inboxService.deleteThread(threadId);
      this.selectedThreadIds.delete(threadId);
      this.selectedThreadId = nextThread ? this.threadIdOf(nextThread) : null;
      this.selectedThread = nextThread;
      this.selectedMessages = [];
      await this.refresh();
      const refreshed = nextThread ? this.filteredThreads.find(thread => this.threadIdOf(thread) === this.threadIdOf(nextThread)) : null;
      if (refreshed) {
        await this.openThread(refreshed);
        this.scrollThreadRowIntoView(listElement, this.threadIdOf(refreshed));
      } else if (!nextThread) {
        this.selectedThread = null;
        this.selectedThreadId = null;
      }
      this.notify.success({title: "Inbox", message: "Conversation deleted"});
    } catch (error) {
      this.notify.error({title: "Delete", message: (error as Error).message});
      this.logger.error("Failed to delete conversation:", error);
    } finally {
      this.busy = false;
    }
  }

  async openThread(thread: InboxThread, markRead = true): Promise<void> {
    const threadId = this.threadIdOf(thread);
    const requestId = this.openThreadRequestId + 1;
    this.openThreadRequestId = requestId;
    this.selectedThreadId = threadId;
    this.selectedThread = thread;
    this.selectedMessages = [];
    this.loadingThread = true;
    this.syncThreadToUrl(thread);
    try {
      const response = await this.inboxService.getThread(threadId);
      if (requestId !== this.openThreadRequestId) {
        return;
      }
      this.selectedThread = response.thread;
      this.selectedMessages = this.collapseSends(response.messages);
      this.expandedMessageIds = new Set(this.selectedMessages.length ? [this.selectedMessages[this.selectedMessages.length - 1].messageId] : []);
      this.loadingThread = false;
      if (markRead && thread.unread) {
        thread.unread = false;
        this.threadListUnreadCount = Math.max(0, this.threadListUnreadCount - 1);
        this.inboxService.markThreadRead(threadId)
          .catch(error => this.logger.error("mark-read failed:", error));
      }
    } catch (error) {
      if (requestId !== this.openThreadRequestId) {
        return;
      }
      this.loadingThread = false;
      this.notify.error({title: "Open thread", message: (error as Error).message});
      this.logger.error("Failed to open thread:", error);
    }
  }

  async prepareReplyAll(message: InboxMessage): Promise<void> {
    await this.prepareReply(message, true);
  }

  async prepareReply(message?: InboxMessage, replyAll = false): Promise<void> {
    if (!this.selectedThread || this.selectedMessages.length === 0) {
      return;
    }
    const target = message?.direction === InboxMessageDirection.INBOUND
      ? message
      : [...this.selectedMessages].reverse().find(msg => msg.direction === InboxMessageDirection.INBOUND);
    if (!target) {
      this.notify.warning({title: "Reply", message: "No inbound message on this thread to reply to"});
      return;
    }
    try {
      const threadId = this.selectedThreadId ?? "";
      const reply = await this.inboxService.composeReply(threadId, {threadId, messageId: target.messageId});
      if (replyAll) {
        reply.cc = this.replyAllRecipients(reply, target);
        reply.replyAll = true;
      }
      this.inboxReplyHandoff.queue(reply);
      this.logger.info("Reply queued, navigating to composer:", reply);
      const maximised = this.route.snapshot.queryParamMap.get(StoredValue.MAXIMISE) === "true";
      await this.router.navigate(["/admin/email-composer"], {
        queryParams: {[StoredValue.BRANDING]: BrandingMode.UNBRANDED, [StoredValue.TAB]: EmailComposerStepKey.COMPOSE, [StoredValue.MAXIMISE]: maximised ? "true" : null}
      });
    } catch (error) {
      this.notify.error({title: "Reply", message: (error as Error).message});
      this.logger.error("Failed to prepare reply:", error);
    }
  }

  private replyAllRecipients(reply: InboxReplyComposeResponse, target: InboxMessage): InboxAddress[] {
    const excluded = new Set([reply.to.email.toLowerCase(), ...this.aliases.map(alias => alias.roleEmail.toLowerCase())]);
    const seen = new Set<string>();
    return [...(reply.cc ?? []), ...(target.to ?? []), ...(target.cc ?? [])].filter(address => {
      const email = address.email.toLowerCase();
      if (excluded.has(email) || seen.has(email)) {
        return false;
      }
      seen.add(email);
      return true;
    });
  }

  formatAddresses(addresses: InboxAddress[]): string {
    return (addresses ?? []).map(address => address.name ? `${address.name} <${address.email}>` : address.email).join(", ");
  }

  isMessageExpanded(message: InboxMessage): boolean {
    return this.expandedMessageIds.has(message.messageId);
  }

  toggleMessage(message: InboxMessage): void {
    if (this.expandedMessageIds.has(message.messageId)) {
      this.expandedMessageIds.delete(message.messageId);
    } else {
      this.expandedMessageIds.add(message.messageId);
    }
  }

  private dedupeMessages(messages: InboxMessage[]): InboxMessage[] {
    const seen = new Set<string>();
    return messages.filter(message => {
      const key = message.externalId ?? message.messageId;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  recipientSummary(message: InboxMessage): string {
    return [...(message.to ?? []), ...(message.cc ?? [])]
      .map(address => address.name ? address.name.split(" ")[0] : address.email.split("@")[0])
      .join(", ");
  }

  private collapseSends(messages: InboxMessage[]): InboxMessage[] {
    const windowMs = 5 * 60 * 1000;
    return this.dedupeMessages(messages).reduce<InboxMessage[]>((groups, message) => {
      const at = message.receivedAt ?? message.sentAt ?? 0;
      const group = groups.find(existing => this.sendKey(existing) === this.sendKey(message)
        && existing.direction === message.direction
        && Math.abs((existing.receivedAt ?? existing.sentAt ?? 0) - at) <= windowMs);
      if (group) {
        group.to = this.unionAddresses(group.to, message.to);
        group.cc = this.unionAddresses(group.cc, message.cc);
        return groups;
      }
      return groups.concat({...message, to: [...(message.to ?? [])], cc: [...(message.cc ?? [])]});
    }, []);
  }

  private sendKey(message: InboxMessage): string {
    const subject = (message.subject ?? "").replace(/^(?:re|fwd?|aw)\s*:\s*/gi, "").trim().toLowerCase();
    return `${(message.from?.email ?? "").toLowerCase()}|${subject}`;
  }

  private unionAddresses(existing: InboxAddress[], incoming: InboxAddress[]): InboxAddress[] {
    const seen = new Set((existing ?? []).map(address => address.email.toLowerCase()));
    return (incoming ?? []).reduce((merged, address) => {
      if (seen.has(address.email.toLowerCase())) {
        return merged;
      }
      seen.add(address.email.toLowerCase());
      return merged.concat(address);
    }, [...(existing ?? [])]);
  }

  messagePreview(message: InboxMessage): string {
    const raw = message.bodyText?.trim() ? message.bodyText : (message.bodyHtml ?? "");
    const cleaned = raw
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, "\"");
    return cleaned.replace(/\s+/g, " ").trim().slice(0, 140);
  }

  recipientForThread(thread: InboxThread): string | null {
    const alias = this.aliases.find(candidate => candidate.roleType === thread.roleType);
    return alias && !isInboxGeneralRoleType(alias.roleType) ? alias.roleEmail : null;
  }

  selectedThreadRecipient(): string | null {
    if (!this.selectedThread) {
      return null;
    }
    const aliasEmail = this.recipientForThread(this.selectedThread);
    if (aliasEmail) {
      return aliasEmail;
    }
    const firstInbound = this.selectedMessages.find(message => message.direction === InboxMessageDirection.INBOUND);
    return firstInbound?.to?.length ? this.formatAddresses(firstInbound.to) : null;
  }

  renderableBody(message: InboxMessage): string {
    if (message.bodyHtml) {
      return message.bodyHtml;
    }
    if (message.bodyText) {
      return `<pre>${message.bodyText}</pre>`;
    }
    return "<em>(empty message body)</em>";
  }

  private async handleNewMessageEvent(event: InboxNewMessageEvent): Promise<void> {
    this.logger.info("Inbox websocket event:", event);
    await this.refresh();
    if (event.messageId && this.selectedThreadId === event.threadId) {
      await this.openThread({...this.selectedThread!, id: this.selectedThreadId} as InboxThread);
    }
  }
}
