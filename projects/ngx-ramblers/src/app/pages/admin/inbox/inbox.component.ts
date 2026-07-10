import { Component, HostListener, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowDownWideShort, faArrowLeft, faArrowUpWideShort, faBell, faBellSlash, faChevronDown, faChevronRight, faCompress, faDownload, faEnvelope, faEnvelopeOpen, faExpand, faEye, faFilter, faInbox, faLayerGroup, faListCheck, faPaperclip, faPenToSquare, faReply, faReplyAll, faRotateRight, faSearch, faShare, faTableColumns, faTableList, faTrash, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { AdminSettingsPath, AdminPath } from "../../../models/admin-route-paths.model";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { isUndefined, kebabCase, values } from "es-toolkit/compat";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { InboxService } from "../../../services/inbox/inbox.service";
import { InboxReplyHandoffService } from "../../../services/inbox/inbox-reply-handoff.service";
import { InboxPushSubscriptionService } from "../../../services/inbox/inbox-push-subscription.service";
import { InboxNotificationService } from "../../../services/inbox/inbox-notification.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { MessageType } from "../../../models/websocket.model";
import {
  InboxAddress,
  InboxAttachment,
  InboxMessage,
  InboxMessageDirection,
  InboxNewMessageEvent,
  InboxAliasConfigView,
  InboxReplyComposeResponse,
  InboxThread,
  InboxThreadFolder,
  InboxViewScope,
  InboxReadFilter,
  InboxReaderProvider,
  isInboxGeneralRoleType
} from "../../../models/inbox.model";
import { BrandingMode } from "../../../models/mail.model";
import { EmailComposerStepKey } from "../../../models/email-composer.model";
import { StoredValue } from "../../../models/ui-actions";
import { DeviceSize } from "../../../models/page.model";
import { UrlService } from "../../../services/url.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { PageComponent } from "../../../page/page.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { AttachmentPreviewComponent } from "../../../modules/common/attachment-preview/attachment-preview";
import { HtmlFrameComponent } from "../../../modules/common/html-frame/html-frame.component";
import { ResizerComponent, ResizerOrientation, ResizerVariant } from "../../../modules/common/resizer/resizer";
import { MaximisablePanelComponent } from "../../../modules/common/maximisable-panel/maximisable-panel";

@Component({
  selector: "app-inbox",
  imports: [CommonModule, FormsModule, FontAwesomeModule, PageComponent, DatePipe, TooltipDirective, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, HtmlFrameComponent, ResizerComponent, RouterLink, MaximisablePanelComponent, AttachmentPreviewComponent],
  styleUrls: ["./inbox.component.sass"],
  template: `
    <app-page pageTitle="Email inbox" [showTitle]="!mobile" [showBreadcrumb]="!mobile">
      <app-maximisable-panel #panel="maximisablePanel" [showToggleButton]="false">
      <div panelControls class="d-flex gap-2 align-items-center flex-grow-1 inbox-toolbar">
          <div class="d-flex align-items-center gap-2 flex-shrink-0 inbox-toolbar-brand">
            <fa-icon [icon]="faInbox" class="ramblers" size="lg"></fa-icon>
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
                <option [ngValue]="alias.roleType">{{ aliasLabel(alias) }}</option>
              }
              @if (canReadJunk) {
                <option [ngValue]="InboxThreadFolder.JUNK">Junk mail</option>
              }
            </select>
          }
          <div class="ms-auto d-flex align-items-center gap-2 inbox-toolbar-actions">
          <button class="btn btn-primary d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="openComposer()" tooltip="Start a new email in the Email Composer">
            <fa-icon [icon]="faPenToSquare"/>Compose
          </button>
          @if (mobile && mobileShowDetail) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="backToList()" tooltip="Back to inbox">
              <fa-icon [icon]="faArrowLeft"/>Inbox
            </button>
          }
          @if (threads.length > 0) {
            <button type="button" class="btn btn-quiet inbox-filter-toggle d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" [class.active]="readFilter === InboxReadFilter.UNREAD"
                    (click)="toggleUnreadFilter()"
                    [tooltip]="readFilter === InboxReadFilter.UNREAD ? 'Showing unread only — click to show all' : 'Show unread only'">
              <fa-icon [icon]="faFilter"/>{{ readFilter === InboxReadFilter.UNREAD ? threadListUnreadCount + ' unread' : 'All messages' }}
            </button>
          }
          @if (threads.length > 0) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="toggleMessageSort()"
                    [tooltip]="messageSortDescending ? 'Showing newest first — click for oldest first' : 'Showing oldest first — click for newest first'">
              <fa-icon [icon]="messageSortDescending ? faArrowDownWideShort : faArrowUpWideShort"/>{{ messageSortDescending ? 'Newest first' : 'Oldest first' }}
            </button>
          }
          @if (!mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="toggleLayout()" [tooltip]="stackedLayout ? 'Switch to side-by-side view' : 'Switch to stacked view'">
              <fa-icon [icon]="stackedLayout ? faTableColumns : faTableList"/>
              {{ stackedLayout ? 'Side-by-side' : 'Stacked' }}
            </button>
          }
          @if ((pushStatus$ | async); as pushStatus) {
            @if (pushStatus.supported) {
              @if (pushStatus.subscribed) {
                <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="disableBrowserNotifications()" [disabled]="busy" tooltip="Stop showing browser notifications for new inbox messages">
                  <fa-icon [icon]="faBellSlash"/>Notifications
                </button>
              } @else if (pushStatus.permission !== 'denied') {
                <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="enableBrowserNotifications()" [disabled]="busy" tooltip="Get a desktop or phone notification when new inbox mail arrives">
                  <fa-icon [icon]="faBell"/>Notifications
                </button>
              }
            }
          }
          <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="refresh()" [disabled]="busy" tooltip="Refresh the inbox">
            <fa-icon [icon]="faRotateRight"/>Refresh
          </button>
          @if (!mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="panel.toggle()" [tooltip]="panel.maximised ? panel.restoreTooltip : panel.maximiseTooltip">
              <fa-icon [icon]="panel.maximised ? faCompress : faExpand"/>{{ panel.maximised ? 'Restore' : 'Maximise' }}
            </button>
          }
          </div>
      </div>
      @if (!loadedOnce) {
        <div class="alert alert-warning inbox-alert d-flex align-items-center">
          <fa-icon [icon]="faRotateRight" [animation]="'spin'"/>
          <strong class="ms-2">Loading your inbox&hellip;</strong>
        </div>
      } @else if (aliases.length === 0) {
        <div class="alert alert-warning inbox-alert">
          <fa-icon [icon]="faTriangleExclamation"/>
          @if (internalInbox) {
            <strong class="ms-2">No committee roles with addresses -</strong>
            <span class="ms-1">This site delivers mail straight to the inbox. Add committee roles with email addresses in Committee Settings and they'll appear here automatically.</span>
          } @else {
            <strong class="ms-2">No role mailboxes connected -</strong>
            <span class="ms-1">An administrator can connect a mailbox in <a [routerLink]="['/' + adminSettingsSystemSettingsPath]" [queryParams]="mailSettingsQueryParams">System Settings &rarr; External Systems &rarr; Mail</a>, then point each committee role's Inbound Forwarding at it. Roles forwarding to a connected mailbox appear here automatically.</span>
          }
        </div>
      }
      @if (selectedAlias(); as alias) {
        <div class="alert alert-success py-2 inbox-alert">
          <fa-icon [icon]="faEnvelope" class="me-2"/>
          <strong>Viewing mail for {{aliasLabel(alias)}}</strong>
          @if (!internalInbox && !alias.mailboxConnection?.hasRefreshToken) {
            <span class="ms-1">This mailbox is not connected yet.</span>
          }
        </div>
      }
      <div class="inbox-layout" [class.stacked]="stackedLayout"
           [style.grid-template-columns]="gridTemplateColumns"
           [style.grid-template-rows]="gridTemplateRows">
        @if (!mobile || !mobileShowDetail) {
        <div class="thumbnail-heading-frame-compact inbox-pane" [class.inbox-list-flush]="mobile">
          @if (!mobile) {
            <div class="thumbnail-heading">Conversations</div>
          }
          @if (threads.length > 0 || conversationSearchTerm) {
            <div class="p-2">
              <div class="input-group input-group-sm">
                <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                <input type="text" class="form-control" [(ngModel)]="conversationSearchTerm"
                       placeholder="Search conversations...">
              </div>
              @if (!mobile || conversationSearchTerm) {
                <div class="small text-muted mt-1">
                  {{filteredThreads.length}} of {{stringUtils.pluraliseWithCount(threads.length, "conversation")}}
                </div>
              }
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
                 [class.unread]="conversationUnread(thread)"
                 [attr.data-thread-id]="threadIdOf(thread)"
                 (click)="selectThread(thread)">
              <input type="checkbox" class="form-check-input flex-shrink-0 m-0"
                     [checked]="conversationSelected(thread)"
                     (click)="$event.stopPropagation(); toggleThreadSelection(thread)">
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-items-center gap-2">
                  @if (conversationUnread(thread)) {
                    <span class="inbox-unread-dot flex-shrink-0" aria-label="Unread"></span>
                  }
                  <div class="inbox-thread-from flex-grow-1 text-truncate">{{thread.externalAddress.name ?? thread.externalAddress.email}}</div>
                  @if (conversationThreadCount(thread) > 1) {
                    <span class="small text-muted flex-shrink-0" tooltip="Grouped across {{conversationThreadCount(thread)}} role inboxes">
                      <fa-icon [icon]="faLayerGroup"/> {{conversationThreadCount(thread)}}
                    </span>
                  }
                  <div class="inbox-thread-time flex-shrink-0">{{thread.lastSeenAt | date: "short"}}</div>
                </div>
                <div class="inbox-thread-subject text-truncate">{{thread.subject || thread.normalisedSubject || "(no subject)"}}</div>
                @if (recipientForThread(thread); as roleEmail) {
                  <div class="inbox-thread-recipient text-truncate">to {{roleEmail}}</div>
                }
              </div>
            </div>
          }
          </div>
        </div>
        }
        @if (!mobile) {
          <app-resizer [variant]="ResizerVariant.BAR"
                       [orientation]="stackedLayout ? ResizerOrientation.VERTICAL : ResizerOrientation.HORIZONTAL"
                       [size]="listSize"
                       [minSize]="minListSize"
                       [maxSize]="maxListSize"
                       (sizeChange)="listSize = $event"
                       (resizeEnd)="persistListSize()"/>
        }
        @if (!mobile || mobileShowDetail) {
        <div class="thumbnail-heading-frame-compact inbox-pane inbox-pane-messages">
          @if (selectedThread) {
            <div class="d-flex align-items-start gap-2 mb-3 inbox-detail-header">
              <div class="me-auto">
                <h5 class="mb-1">{{selectedThread.subject || selectedThread.normalisedSubject || "(no subject)"}}</h5>
                <small class="text-muted d-block">From {{ formatAddress(selectedThread.externalAddress) }}</small>
                @if (selectedThreadRecipient(); as recipient) {
                  <small class="text-muted d-block">To {{recipient}}</small>
                }
              </div>
              @if (selectedThread.folder === InboxThreadFolder.JUNK) {
                <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" [disabled]="busy" (click)="moveSelectedToInbox()">
                  <fa-icon [icon]="faInbox" class="me-1"></fa-icon>
                  Not junk
                </button>
                <button class="btn btn-sm btn-grey-danger text-nowrap flex-shrink-0" type="button" [disabled]="busy" (click)="deleteCurrentThread()">
                  <fa-icon [icon]="faTrash" class="me-1"></fa-icon>
                  Delete
                </button>
              }
            </div>
          }
          <div class="inbox-detail">
          @if (!selectedThread) {
            <div class="text-muted">Select a conversation to read it.</div>
          } @else if (loadingThread) {
            <div class="text-muted">Loading conversation...</div>
          } @else {
            @for (message of displayMessages; track message.messageId) {
              <div class="inbox-message" [class.outbound]="message.direction === InboxMessageDirection.OUTBOUND" [class.collapsed]="!isMessageExpanded(message)">
                <div class="inbox-message-headers inbox-message-toggle d-flex align-items-start gap-2" (click)="toggleMessage(message)">
                  <fa-icon [icon]="isMessageExpanded(message) ? faChevronDown : faChevronRight" class="mt-1 text-muted"/>
                  <div class="flex-grow-1 min-w-0">
                    <strong>{{message.direction === InboxMessageDirection.OUTBOUND ? "Sent from Email Composer — " + formatAddress(message.from) : formatAddress(message.from)}}</strong>
                    &middot; {{(message.receivedAt ?? message.sentAt) | date: "medium"}}
                    @if (isMessageExpanded(message)) {
                      @if (message.cc?.length) {
                        <div>Cc: {{ formatAddresses(message.cc) }}</div>
                      }
                    } @else {
                      @if (message.to?.length || message.cc?.length) {
                        <div class="inbox-message-preview text-truncate">to {{ recipientSummary(message) }}</div>
                      }
                      <div class="inbox-message-preview text-truncate">
                        @if (visibleAttachments(message).length) {
                          <fa-icon [icon]="faPaperclip" class="me-1 text-muted"/>
                        }{{ messagePreview(message) }}</div>
                    }
                  </div>
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
                    <button class="btn inbox-reply-btn" type="button" [disabled]="busy"
                            tooltip="Forward in email composer with attachments" placement="left" container="body" (click)="$event.stopPropagation(); prepareForward(message)">
                      <fa-icon [icon]="faShare"/>
                      <span class="inbox-reply-label">Forward</span>
                    </button>
                  </div>
                </div>
                @if (isMessageExpanded(message)) {
                  @if (visibleAttachments(message).length) {
                    <div class="inbox-attachments d-flex flex-wrap gap-2 mb-3">
                      @for (attachment of visibleAttachments(message); track attachment.s3Key) {
                        <div class="btn-group" dropdown>
                          <button dropdownToggle type="button" class="inbox-attachment dropdown-toggle">
                            <fa-icon [icon]="faPaperclip"/>
                            <span class="inbox-attachment-name">{{ attachment.filename }}</span>
                            <span class="text-muted">{{ numberUtils.humanFileSize(attachment.sizeBytes) }}</span>
                          </button>
                          <ul *dropdownMenu class="dropdown-menu" role="menu">
                            <li role="menuitem">
                              <button class="dropdown-item" type="button" (click)="attachmentPreview.open({filename: attachment.filename, url: attachmentUrl(attachment), contentType: attachment.contentType})">
                                <fa-icon [icon]="faEye" class="me-2"/>Preview
                              </button>
                            </li>
                            <li role="menuitem">
                              <a class="dropdown-item" [href]="attachmentUrl(attachment)" [attr.download]="attachment.filename">
                                <fa-icon [icon]="faDownload" class="me-2"/>Download
                              </a>
                            </li>
                          </ul>
                        </div>
                      }
                    </div>
                  }
                  <app-html-frame class="inbox-message-body" [html]="renderableBody(message)"/>
                }
              </div>
            }
          }
          </div>
        </div>
        }
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
      <app-attachment-preview #attachmentPreview/>
    </app-page>
  `
})
export class InboxComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("InboxComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  private inboxReplyHandoff = inject(InboxReplyHandoffService);
  private pushSubscriptionService = inject(InboxPushSubscriptionService);
  private inboxNotificationService = inject(InboxNotificationService);
  protected readonly mailSettingsQueryParams = {[StoredValue.TAB]: "external-systems", [StoredValue.SUB_TAB]: "mail"};
  protected readonly pushStatus$ = this.pushSubscriptionService.status$;
  protected readonly faBell = faBell;
  protected readonly faBellSlash = faBellSlash;
  private webSocketClientService = inject(WebSocketClientService);
  private systemConfigService = inject(SystemConfigService);
  protected internalInbox = false;
  private notifierService = inject(NotifierService);
  protected stringUtils = inject(StringUtilsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private urlService = inject(UrlService);
  protected numberUtils = inject(NumberUtilsService);
  protected readonly faInbox = faInbox;
  protected readonly faLayerGroup = faLayerGroup;
  protected readonly faPenToSquare = faPenToSquare;
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
  protected readonly faPaperclip = faPaperclip;
  protected readonly faEye = faEye;
  protected readonly faDownload = faDownload;
  protected readonly faReplyAll = faReplyAll;
  protected readonly faShare = faShare;
  protected readonly faArrowDownWideShort = faArrowDownWideShort;
  protected readonly faArrowUpWideShort = faArrowUpWideShort;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faExpand = faExpand;
  protected readonly faCompress = faCompress;
  public messageSortDescending = true;
  protected readonly InboxMessageDirection = InboxMessageDirection;
  protected readonly InboxViewScope = InboxViewScope;
  protected readonly InboxReadFilter = InboxReadFilter;
  protected readonly InboxThreadFolder = InboxThreadFolder;
  protected readonly ResizerOrientation = ResizerOrientation;
  protected readonly ResizerVariant = ResizerVariant;
  protected readonly isInboxGeneralRoleType = isInboxGeneralRoleType;

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
  public canReadJunk = false;
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
  public loadedOnce = false;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};

  public stackedLayout = false;
  public mobile = false;
  public mobileShowDetail = false;
  public listSize = 352;
  public readonly minListSize = 140;
  private static readonly LAYOUT_KEY = "inbox-layout";
  private static readonly SIZE_KEY = "inbox-list-size";

  adminSettingsSystemSettingsPath = AdminSettingsPath.SYSTEM_SETTINGS;
  private subscriptions: Subscription[] = [];
  private openThreadRequestId = 0;
  private mailboxViewInitialised = false;

  @HostListener("window:resize")
  onResize(): void {
    this.updateMobile();
  }

  private updateMobile(): void {
    this.mobile = !isUndefined(window) && (window.innerWidth < DeviceSize.MEDIUM
      || (window.innerWidth > window.innerHeight && window.innerHeight < DeviceSize.SMALL));
  }

  async ngOnInit(): Promise<void> {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(config =>
      this.internalInbox = config?.inbox?.provider === InboxReaderProvider.CLOUDFLARE_INGRESS));
    this.updateMobile();
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

  get gridTemplateColumns(): string {
    return this.mobile
      ? "minmax(0, 1fr)"
      : this.stackedLayout ? "minmax(0, 1fr)" : `${this.listSize}px 8px minmax(0, 1fr)`;
  }

  get gridTemplateRows(): string {
    return this.mobile
      ? "minmax(0, 1fr)"
      : this.stackedLayout ? `${this.listSize}px 8px minmax(0, 1fr)` : "minmax(0, 1fr)";
  }

  selectThread(thread: InboxThread): void {
    if (this.mobile) {
      this.mobileShowDetail = true;
    }
    void this.openThread(thread);
  }

  backToList(): void {
    this.mobileShowDetail = false;
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
      const [aliases, canReadJunk] = await Promise.all([this.inboxService.listAliases(), this.inboxService.junkAccessible()]);
      this.aliases = aliases;
      this.canReadJunk = canReadJunk;
      if (!this.mailboxViewInitialised) {
        this.applyMailboxViewFromUrl();
        this.applyReadFilterFromUrl();
        this.mailboxViewInitialised = true;
      }
      if (this.viewingJunk && this.canReadJunk) {
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
        if (this.mobile && requestedThread) {
          this.mobileShowDetail = true;
        }
        await this.openThread(requestedThread ?? this.threads[0], false);
      }
    } catch (error) {
      this.notify.error({title: "Inbox", message: (error as Error).message});
      this.logger.error("Failed to refresh inbox:", error);
    } finally {
      this.busy = false;
      this.loadedOnce = true;
      void this.inboxNotificationService.resync();
    }
  }

  selectedAlias(): InboxAliasConfigView | null {
    return this.aliases.find(alias => alias.roleType === this.selectedMailboxView) ?? null;
  }

  aliasLabel(alias: InboxAliasConfigView): string {
    return isInboxGeneralRoleType(alias.roleType) ? "Other inbox mail" : alias.roleEmail;
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

  siblingConversationThreads(thread: InboxThread): InboxThread[] {
    const key = thread.conversationKey;
    return key ? this.threads.filter(candidate => candidate.conversationKey === key) : [thread];
  }

  private representativeThread(threads: InboxThread[]): InboxThread {
    return threads.reduce((latest, candidate) =>
      (candidate.lastSeenAt ?? candidate.firstSeenAt ?? 0) > (latest.lastSeenAt ?? latest.firstSeenAt ?? 0) ? candidate : latest);
  }

  private conversationRepresentatives(threads: InboxThread[]): InboxThread[] {
    const byKey = new Map<string, InboxThread[]>();
    const singles: InboxThread[] = [];
    threads.forEach(thread => {
      if (thread.conversationKey) {
        byKey.set(thread.conversationKey, [...(byKey.get(thread.conversationKey) ?? []), thread]);
      } else {
        singles.push(thread);
      }
    });
    const grouped = Array.from(byKey.values()).map(group => this.representativeThread(group));
    return [...grouped, ...singles];
  }

  conversationUnread(thread: InboxThread): boolean {
    return this.siblingConversationThreads(thread).some(candidate => candidate.unread);
  }

  conversationThreadCount(thread: InboxThread): number {
    return this.siblingConversationThreads(thread).length;
  }

  conversationSelected(thread: InboxThread): boolean {
    return this.siblingConversationThreads(thread).every(candidate => this.selectedThreadIds.has(this.threadIdOf(candidate)));
  }

  private conversationMatchesTerm(thread: InboxThread, term: string): boolean {
    return (thread.normalisedSubject ?? "").toLowerCase().includes(term)
      || (thread.externalAddress?.name ?? "").toLowerCase().includes(term)
      || (thread.externalAddress?.email ?? "").toLowerCase().includes(term)
      || (thread.roleType ?? "").toLowerCase().includes(term);
  }

  get filteredThreads(): InboxThread[] {
    const representatives = this.conversationRepresentatives(this.threads);
    const byReadState = representatives.filter(representative =>
      this.readFilter === InboxReadFilter.ALL
      || this.siblingConversationThreads(representative).some(candidate =>
        this.readFilter === InboxReadFilter.UNREAD ? candidate.unread : !candidate.unread));
    const term = this.conversationSearchTerm?.trim().toLowerCase();
    const matched = !term ? byReadState : byReadState.filter(representative =>
      this.siblingConversationThreads(representative).some(candidate => this.conversationMatchesTerm(candidate, term)));
    return [...matched].sort((left, right) => {
      const leftAt = left.lastSeenAt ?? left.firstSeenAt ?? 0;
      const rightAt = right.lastSeenAt ?? right.firstSeenAt ?? 0;
      return this.messageSortDescending ? rightAt - leftAt : leftAt - rightAt;
    });
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
    const siblings = this.siblingConversationThreads(thread);
    const currentlySelected = siblings.every(candidate => this.selectedThreadIds.has(this.threadIdOf(candidate)));
    siblings.forEach(candidate => {
      const id = this.threadIdOf(candidate);
      if (currentlySelected) {
        this.selectedThreadIds.delete(id);
      } else {
        this.selectedThreadIds.add(id);
      }
    });
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
      this.mobileShowDetail = false;
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
      this.mobileShowDetail = false;
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

  private syncThreadToUrl(thread: InboxThread | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.THREAD]: thread ? this.threadSlug(thread) : null},
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
    const siblings = this.siblingConversationThreads(thread);
    const representative = this.representativeThread(siblings);
    const threadId = this.threadIdOf(representative);
    const requestId = this.openThreadRequestId + 1;
    this.openThreadRequestId = requestId;
    this.selectedThreadId = threadId;
    this.selectedThread = representative;
    this.selectedMessages = [];
    this.loadingThread = true;
    this.syncThreadToUrl(representative);
    try {
      const responses = await Promise.all(siblings.map(sibling => this.inboxService.getThread(this.threadIdOf(sibling))));
      if (requestId !== this.openThreadRequestId) {
        return;
      }
      const representativeResponse = responses.find(response => this.threadIdOf(response.thread) === threadId) ?? responses[0];
      this.selectedThread = representativeResponse.thread;
      this.selectedMessages = this.collapseSends(responses.flatMap(response => response.messages));
      const newestMessage = this.selectedMessages.length
        ? this.selectedMessages.reduce((latest, candidate) =>
          (candidate.receivedAt ?? candidate.sentAt ?? 0) > (latest.receivedAt ?? latest.sentAt ?? 0) ? candidate : latest)
        : null;
      this.expandedMessageIds = new Set(newestMessage ? [newestMessage.messageId] : []);
      this.loadingThread = false;
      const unreadSiblings = markRead ? siblings.filter(sibling => sibling.unread) : [];
      if (unreadSiblings.length > 0) {
        unreadSiblings.forEach(sibling => sibling.unread = false);
        this.threadListUnreadCount = Math.max(0, this.threadListUnreadCount - unreadSiblings.length);
        Promise.all(unreadSiblings.map(sibling => this.inboxService.markThreadRead(this.threadIdOf(sibling))))
          .then(() => this.inboxNotificationService.resync())
          .catch(error => this.logger.error("mark-read failed:", error));
      }
    } catch (error) {
      if (requestId !== this.openThreadRequestId) {
        return;
      }
      this.loadingThread = false;
      if (this.threadNoLongerExists(error)) {
        this.selectedThreadId = null;
        this.selectedThread = null;
        this.selectedMessages = [];
        this.syncThreadToUrl(null);
        return;
      }
      this.notify.error({title: "Open thread", message: (error as Error).message});
      this.logger.error("Failed to open thread:", error);
    }
  }

  private threadNoLongerExists(error: unknown): boolean {
    const status = (error as { status?: number; error?: { status?: number } })?.status
      ?? (error as { error?: { status?: number } })?.error?.status;
    return status === 404 || /:\s*404\b/.test((error as Error)?.message || "");
  }

  async prepareReplyAll(message: InboxMessage): Promise<void> {
    await this.prepareOutboundCompose(message, {replyAll: true});
  }

  openComposer(): void {
    const maximised = this.route.snapshot.queryParams[StoredValue.MAXIMISE] === "true";
    void this.router.navigate(["/" + AdminPath.EMAIL_COMPOSER], {
      queryParams: maximised ? {[StoredValue.MAXIMISE]: "true"} : {}
    });
  }

  async prepareReply(message?: InboxMessage, replyAll = false): Promise<void> {
    await this.prepareOutboundCompose(message, {replyAll});
  }

  async prepareForward(message: InboxMessage): Promise<void> {
    await this.prepareOutboundCompose(message, {forward: true});
  }

  private async prepareOutboundCompose(message: InboxMessage | undefined, options: { replyAll?: boolean; forward?: boolean }): Promise<void> {
    const actionTitle = options.forward ? "Forward" : "Reply";
    if (!this.selectedThread || this.selectedMessages.length === 0) {
      return;
    }
    const target = message ?? this.selectedMessages[this.selectedMessages.length - 1];
    if (!target) {
      this.notify.warning({title: actionTitle, message: `No message on this thread to ${actionTitle.toLowerCase()}`});
      return;
    }
    try {
      const threadId = this.selectedThreadId ?? "";
      const reply = await this.inboxService.composeReply(threadId, {threadId, messageId: target.messageId, forward: options.forward});
      if (options.replyAll) {
        reply.cc = this.replyAllRecipients(reply, target);
        reply.replyAll = true;
      }
      this.inboxReplyHandoff.queue(reply);
      this.logger.info(actionTitle, "queued, navigating to composer:", reply);
      const maximised = this.route.snapshot.queryParams[StoredValue.MAXIMISE] === "true";
      await this.router.navigate(["/" + AdminPath.EMAIL_COMPOSER], {
        queryParams: {
          [StoredValue.BRANDING]: BrandingMode.UNBRANDED,
          [StoredValue.TAB]: EmailComposerStepKey.COMPOSE,
          ...(maximised ? {[StoredValue.MAXIMISE]: "true"} : {})
        }
      });
    } catch (error) {
      this.notify.error({title: actionTitle, message: (error as Error).message});
      this.logger.error("Failed to prepare", actionTitle.toLowerCase(), ":", error);
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
    return (addresses ?? []).map(address => this.formatAddress(address)).join(", ");
  }

  formatAddress(address: InboxAddress): string {
    if (address?.name && address.name.trim() && address.name.trim().toLowerCase() !== address.email?.toLowerCase()) {
      return `${address.name.trim()} <${address.email}>`;
    } else {
      return address?.email ?? "";
    }
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
    return cleaned.replace(/\s+/g, " ").trim().slice(0, 500);
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
    if (isInboxGeneralRoleType(this.selectedThread.roleType)) {
      return "Other inbox mail";
    }
    const firstInbound = this.selectedMessages.find(message => message.direction === InboxMessageDirection.INBOUND);
    return firstInbound?.to?.length ? this.formatAddresses(firstInbound.to) : null;
  }

  renderableBody(message: InboxMessage): string {
    if (message.bodyHtml) {
      return this.resolveInlineImages(message.bodyHtml, message.attachments);
    }
    if (message.bodyText) {
      return `<pre>${message.bodyText}</pre>`;
    }
    return "<em>(empty message body)</em>";
  }

  protected visibleAttachments(message: InboxMessage): InboxAttachment[] {
    const bodyHtml = (message.bodyHtml || "").toLowerCase();
    return (message.attachments ?? []).filter(attachment => attachment.s3Key
      && !(attachment.contentId && bodyHtml.includes(`cid:${attachment.contentId.trim().toLowerCase()}`)));
  }

  protected attachmentUrl(attachment: InboxAttachment): string {
    return this.urlService.resourceRelativePathForAWSFileName(attachment.s3Key);
  }

  private resolveInlineImages(html: string, attachments: InboxAttachment[]): string {
    const inlineImages = (attachments ?? []).filter(attachment => attachment.contentId && attachment.s3Key);
    if (inlineImages.length === 0) {
      return html;
    }
    return html.replace(/(["'])cid:([^"']+)\1/gi, (match, quote, cid) => {
      const target = cid.trim().toLowerCase();
      const attachment = inlineImages.find(candidate => candidate.contentId?.toLowerCase() === target);
      return attachment ? `${quote}${this.urlService.resourceRelativePathForAWSFileName(attachment.s3Key)}${quote}` : match;
    });
  }

  private async handleNewMessageEvent(event: InboxNewMessageEvent): Promise<void> {
    this.logger.info("Inbox websocket event:", event);
    await this.refresh();
    if (event.messageId && this.selectedThreadId === event.threadId) {
      await this.openThread({...this.selectedThread!, id: this.selectedThreadId} as InboxThread);
    }
  }
}
