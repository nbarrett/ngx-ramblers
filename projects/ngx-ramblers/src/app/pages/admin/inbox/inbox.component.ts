import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faBell, faBellSlash, faEnvelope, faEnvelopeOpen, faInbox, faListCheck, faReply, faRotateRight, faSearch, faTableColumns, faTableList, faTrash, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
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
  InboxThread,
  InboxThreadFolder,
  InboxViewScope,
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

@Component({
  selector: "app-inbox",
  imports: [CommonModule, FormsModule, FontAwesomeModule, PageComponent, DatePipe, TooltipDirective, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, HtmlFrameComponent, ResizerComponent, RouterLink],
  styles: [`
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
    .inbox-thread-row
      padding: 0.75rem 1rem
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
    .inbox-message
      border-bottom: 1px solid #f0f0f0
      padding-bottom: 1rem
      margin-bottom: 1rem
    .inbox-message-headers
      font-size: 0.85rem
      color: #555
      margin-bottom: 0.5rem
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
      min-width: 18rem
  `],
  template: `
    <app-page pageTitle="Email inbox">
      <div class="row mb-3">
        <div class="col-sm-12 d-flex gap-2 align-items-center">
          <div class="me-auto d-flex align-items-center gap-2">
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
        <div class="alert alert-warning">
          <fa-icon [icon]="faTriangleExclamation"/>
          <strong class="ms-2">No role mailboxes connected -</strong>
          <span class="ms-1">An administrator can connect a mailbox in <a [routerLink]="['/admin/system-settings']" [queryParams]="{tab: 'external-systems', 'sub-tab': 'mail'}">System Settings &rarr; External Systems &rarr; Mail</a>, then point each committee role's Inbound Forwarding at it. Roles forwarding to a connected mailbox appear here automatically.</span>
        </div>
      }
      @if (selectedAlias(); as alias) {
        <div class="alert alert-success py-2">
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
            </div>
          }
          <div class="inbox-thread-list">
          @if (threads.length === 0) {
            <div class="p-3 text-muted">No conversations yet. Once an alias is connected and synced, threads will appear here.</div>
          }
          @if (threads.length > 0 && filteredThreads.length === 0) {
            <div class="p-3 text-muted">No conversations match "{{conversationSearchTerm}}".</div>
          }
          @for (thread of filteredThreads; track threadIdOf(thread)) {
            <div class="inbox-thread-row d-flex align-items-center gap-2"
                 [class.active]="threadIdOf(thread) === selectedThreadId"
                 [class.unread]="thread.unread"
                 (click)="openThread(thread)">
              <input type="checkbox" class="form-check-input flex-shrink-0 m-0"
                     [checked]="selectedThreadIds.has(threadIdOf(thread))"
                     (click)="$event.stopPropagation(); toggleThreadSelection(thread)">
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-items-center gap-2">
                  @if (thread.unread) {
                    <span class="inbox-unread-dot" aria-label="Unread"></span>
                  }
                  <div class="inbox-thread-from flex-grow-1">{{thread.externalAddress.name ?? thread.externalAddress.email}}</div>
                </div>
                <div class="inbox-thread-subject">{{thread.subject || thread.normalisedSubject || "(no subject)"}}</div>
                @if (recipientForThread(thread); as roleEmail) {
                  <div class="inbox-thread-subject">to {{roleEmail}}</div>
                }
                <div class="inbox-thread-time">{{thread.lastSeenAt | date: "short"}}</div>
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
              @if (selectedThread.folder === InboxThreadFolder.JUNK) {
                <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" [disabled]="busy" (click)="moveSelectedToInbox()">
                  <fa-icon [icon]="faInbox" class="me-1"></fa-icon>
                  Not junk
                </button>
                <button class="btn btn-sm inbox-action-btn text-nowrap flex-shrink-0" type="button" [disabled]="busy" (click)="deleteCurrentThread()">
                  <fa-icon [icon]="faTrash" class="me-1"></fa-icon>
                  Delete
                </button>
              } @else {
                <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" [disabled]="busy" (click)="prepareReply()">
                  <fa-icon [icon]="faReply" class="me-1"></fa-icon>
                  Reply
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
            @for (message of selectedMessages; track message.messageId) {
              <div class="inbox-message" [class.outbound]="message.direction === InboxMessageDirection.OUTBOUND">
                <div class="inbox-message-headers">
                  <strong>{{message.direction === InboxMessageDirection.OUTBOUND ? "Sent from this group" : (message.from.name ?? message.from.email)}}</strong>
                  &middot; {{(message.receivedAt ?? message.sentAt) | date: "medium"}}
                  <div>From: {{ formatAddresses([message.from]) }}</div>
                  @if (message.to?.length) {
                    <div>To: {{ formatAddresses(message.to) }}</div>
                  }
                  @if (message.cc?.length) {
                    <div>Cc: {{ formatAddresses(message.cc) }}</div>
                  }
                </div>
                <app-html-frame class="inbox-message-body" [html]="renderableBody(message)"/>
              </div>
            }
          }
          </div>
        </div>
      </div>
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
  protected readonly faListCheck = faListCheck;
  protected readonly InboxMessageDirection = InboxMessageDirection;
  protected readonly InboxViewScope = InboxViewScope;
  protected readonly InboxThreadFolder = InboxThreadFolder;
  protected readonly isInboxGeneralRoleType = isInboxGeneralRoleType;

  get isInboxAdmin(): boolean {
    return this.memberLoginService.allowMemberAdminEdits();
  }

  get viewingJunk(): boolean {
    return this.selectedMailboxView === InboxThreadFolder.JUNK;
  }

  public aliases: InboxAliasConfigView[] = [];
  public threads: InboxThread[] = [];
  public conversationSearchTerm = "";
  public selectedThreadIds = new Set<string>();
  public threadListUnreadCount = 0;
  public selectedThread: InboxThread | null = null;
  public selectedThreadId: string | null = null;
  public selectedMessages: InboxMessage[] = [];
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
      if (this.viewingJunk && this.isInboxAdmin) {
        const junkResponse = await this.inboxService.listThreads(null, null, false, null, InboxThreadFolder.JUNK);
        this.threads = junkResponse.threads;
        this.threadListUnreadCount = 0;
        if (!this.selectedThreadId && this.threads.length > 0) {
          await this.openThread(this.threads[0]);
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
        await this.openThread(requestedThread ?? this.threads[0]);
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
    await this.refresh();
  }

  threadIdOf(thread: InboxThread): string {
    return (thread.id ?? (thread as unknown as {_id: {toString(): string}})._id ?? "").toString();
  }

  get filteredThreads(): InboxThread[] {
    const term = this.conversationSearchTerm?.trim().toLowerCase();
    if (!term) {
      return this.threads;
    }
    return this.threads.filter(thread =>
      (thread.normalisedSubject ?? "").toLowerCase().includes(term)
      || (thread.externalAddress?.name ?? "").toLowerCase().includes(term)
      || (thread.externalAddress?.email ?? "").toLowerCase().includes(term)
      || (thread.roleType ?? "").toLowerCase().includes(term));
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

  async openThread(thread: InboxThread): Promise<void> {
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
      this.selectedMessages = response.messages;
      this.loadingThread = false;
      if (thread.unread) {
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

  async prepareReply(): Promise<void> {
    if (!this.selectedThread || this.selectedMessages.length === 0) {
      return;
    }
    const lastInbound = [...this.selectedMessages].reverse().find(msg => msg.direction === InboxMessageDirection.INBOUND);
    if (!lastInbound) {
      this.notify.warning({title: "Reply", message: "No inbound message on this thread to reply to"});
      return;
    }
    try {
      const threadId = this.selectedThreadId ?? "";
      const reply = await this.inboxService.composeReply(threadId, {threadId, messageId: lastInbound.messageId});
      this.inboxReplyHandoff.queue(reply);
      this.logger.info("Reply queued, navigating to composer:", reply);
      await this.router.navigate(["/admin/email-composer"], {
        queryParams: {[StoredValue.BRANDING]: BrandingMode.UNBRANDED, [StoredValue.TAB]: EmailComposerStepKey.COMPOSE}
      });
    } catch (error) {
      this.notify.error({title: "Reply", message: (error as Error).message});
      this.logger.error("Failed to prepare reply:", error);
    }
  }

  formatAddresses(addresses: InboxAddress[]): string {
    return (addresses ?? []).map(address => address.name ? `${address.name} <${address.email}>` : address.email).join(", ");
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
    if (this.selectedThreadId === event.threadId) {
      await this.openThread({...this.selectedThread!, id: this.selectedThreadId} as InboxThread);
    }
  }
}
