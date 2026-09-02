import { AfterViewInit, Component, ElementRef, HostBinding, HostListener, inject, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowDownWideShort, faArrowLeft, faArrowUpWideShort, faBan, faBars, faBell, faBellSlash, faChevronDown, faChevronLeft, faChevronRight, faCircleCheck, faCompress, faDownload, faEnvelope, faEnvelopeOpen, faExpand, faEye, faFilter, faGripLines, faIdBadge, faInbox, faLayerGroup, faListCheck, faPaperclip, faPaperPlane, faPenToSquare, faReply, faReplyAll, faRotateRight, faSearch, faShare, faSliders, faSpinner, faTableColumns, faTableList, faTrash, faTriangleExclamation, faUndo, faUser, faXmark } from "@fortawesome/free-solid-svg-icons";
import { AdminSettingsPath, AdminPath } from "../../../models/admin-route-paths.model";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { isUndefined, kebabCase, uniqBy, values } from "es-toolkit/compat";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { InboxService } from "../../../services/inbox/inbox.service";
import { InboxReplyHandoffService } from "../../../services/inbox/inbox-reply-handoff.service";
import { aliasMailboxAddresses, aliasMailboxExtraCaption, aliasMailboxHeading, aliasMailboxLabel, collapseInboxSends, inboxThreadHeaderFrom, inboxThreadHeaderTo, inboxThreadId, inboxThreadRoleLine, inboxThreadRowFrom, inboxThreadRowTo, inboxThreadSlug, replyAllRecipients } from "../../../functions/inbox-thread";
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
  InboxPendingDelete,
  InboxAliasConfigView,
  InboxReplyComposeResponse,
  InboxThread,
  InboxThreadFolder,
  InboxViewScope,
  InboxMailboxLabelMode,
  InboxGroupingMode,
  InboxReadFilter,
  InboxReaderProvider,
  hiddenInboxFolders,
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
import { InboxCalendarInviteComponent } from "./inbox-calendar-invite";
import { InboxOrphanedThreadsComponent } from "./inbox-orphaned-threads.component";
import { HtmlFrameComponent } from "../../../modules/common/html-frame/html-frame.component";
import { ResizerComponent, ResizerOrientation, ResizerVariant } from "../../../modules/common/resizer/resizer";
import { MaximisablePanelComponent } from "../../../modules/common/maximisable-panel/maximisable-panel";
import { UIDateFormat } from "../../../models/date-format.model";

@Component({
  selector: "app-inbox",
  imports: [CommonModule, FormsModule, FontAwesomeModule, PageComponent, DatePipe, TooltipDirective, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, HtmlFrameComponent, ResizerComponent, RouterLink, MaximisablePanelComponent, AttachmentPreviewComponent, InboxCalendarInviteComponent, InboxOrphanedThreadsComponent, SectionToggle],
  styleUrls: ["./inbox.component.sass"],
  template: `
    <app-page pageTitle="Mail" [showTitle]="false" [showBreadcrumb]="!mobile">
      <app-maximisable-panel #panel="maximisablePanel" class="inbox-scroll-contained"
                             [showHeader]="!readingOnMobile || !compactDetailHeader"
                             [showToggleButton]="false">
      <div panelControls class="d-flex gap-2 align-items-center flex-grow-1 inbox-toolbar">
          @if (!readingOnMobile) {
            <div class="d-flex align-items-center gap-2 flex-shrink-0 inbox-toolbar-brand">
              @if (mobile) {
                <button class="inbox-nav-toggle flex-shrink-0" type="button" aria-label="Show folders" (click)="mobileNavOpen = true">
                  <fa-icon [icon]="faBars"/>
                </button>
              }
              <fa-icon [icon]="faInbox" class="ramblers" size="lg"></fa-icon>
              @if (!mobile) {
                <span class="inbox-toolbar-title">Mail</span>
              }
              @if (!mobile) {
                <button class="inbox-nav-toggle flex-shrink-0" type="button" (click)="toggleNavCollapsed()"
                        [class.active]="!navCollapsed" [attr.aria-pressed]="!navCollapsed"
                        [tooltip]="navCollapsed ? 'Show folders' : 'Hide folders'">
                  <fa-icon [icon]="navCollapsed ? faBars : faTableColumns"/>
                </button>
              }
            </div>
          }
          @if (aliases.length > 0 && !readingOnMobile) {
            <label class="visually-hidden" for="inbox-role">Inbox view</label>
            <select id="inbox-role" class="form-select inbox-role-select"
                    [(ngModel)]="selectedMailboxView"
                    (ngModelChange)="roleMailboxChanged()">
              @if (aliases.length > 1) {
                <option [ngValue]="InboxViewScope.ALL_ACCESSIBLE">Show all inbox messages</option>
                <option [ngValue]="InboxViewScope.ASSIGNED_ROLES">Show my inbox messages</option>
              }
              @for (alias of aliases; track alias.id || alias.roleEmail) {
                <option [ngValue]="alias.roleType">{{ aliasDisplayLabel(alias) }}</option>
              }
              <option [ngValue]="InboxThreadFolder.SENT">Sent</option>
              @if (canReadJunk) {
                <option [ngValue]="InboxThreadFolder.JUNK">Junk mail</option>
              }
              <option [ngValue]="InboxThreadFolder.DELETED">Deleted</option>
            </select>
          }
          <div class="ms-auto d-flex align-items-center gap-2 inbox-toolbar-actions" [class.inbox-reading-actions]="readingOnMobile">
          @if (!readingOnMobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="openComposer()" tooltip="Start a new email in the Email Composer">
              <fa-icon [icon]="faPenToSquare"/>Compose
            </button>
            @if (mobile) {
              <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="mobileFiltersOpen = !mobileFiltersOpen">
                <fa-icon [icon]="faSliders"/>Filter and sort
              </button>
            }
          }
          @if (mobile && mobileShowDetail) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="backToList()" tooltip="Back to inbox">
              <fa-icon [icon]="faArrowLeft"/>Inbox
            </button>
            <button class="btn btn-grey-danger d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="deleteCurrentThread()" [disabled]="busy" tooltip="Delete this conversation and show the next one">
              <fa-icon [icon]="faTrash"/>Delete
            </button>
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="openAdjacentConversation(-1)" [disabled]="!hasAdjacentConversation(-1)" tooltip="Previous conversation">
              <fa-icon [icon]="faChevronLeft"/>Previous
            </button>
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="openAdjacentConversation(1)" [disabled]="!hasAdjacentConversation(1)" tooltip="Next conversation">
              Next<fa-icon [icon]="faChevronRight"/>
            </button>
            @if (nextUnreadConversation()) {
              <button class="btn btn-quiet inbox-next-unread d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="openNextUnread()" tooltip="Next unread conversation">
                <fa-icon [icon]="faEnvelope"/>Next unread
              </button>
            }
          }
          @if (threadListTotalCount > 0 && !mobile) {
            <button type="button" class="btn btn-quiet inbox-filter-toggle d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" [class.active]="readFilter === InboxReadFilter.UNREAD"
                    (click)="toggleUnreadFilter()"
                    [tooltip]="readFilter === InboxReadFilter.UNREAD ? 'Showing unread only — click to show all' : 'Show unread only'">
              <fa-icon [icon]="faFilter"/>{{ readFilter === InboxReadFilter.UNREAD ? threadListUnreadCount + ' unread' : 'All' }}
            </button>
          }
          @if (threads.length > 0 && !mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="toggleMessageSort()"
                    [tooltip]="messageSortDescending ? 'Showing newest first — click for oldest first' : 'Showing oldest first — click for newest first'">
              <fa-icon [icon]="messageSortDescending ? faArrowDownWideShort : faArrowUpWideShort"/>{{ messageSortDescending ? 'Newest' : 'Oldest' }}
            </button>
          }
          @if (!mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="toggleLayout()" [tooltip]="stackedLayout ? 'Switch to side-by-side view' : 'Switch to stacked view'">
              <fa-icon [icon]="stackedLayout ? faTableColumns : faTableList"/>
              {{ stackedLayout ? 'Split' : 'Stacked' }}
            </button>
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="toggleDensity()" [tooltip]="compactList ? 'Switch to comfortable rows with subject and preview lines' : 'Switch to compact single-line rows'">
              <fa-icon [icon]="compactList ? faTableList : faGripLines"/>
              {{ compactList ? 'Roomy' : 'Compact' }}
            </button>
          }
          @if ((pushStatus$ | async); as pushStatus) {
            @if (pushStatus.supported && !mobile) {
              @if (pushStatus.subscribed) {
                <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="disableBrowserNotifications()" [disabled]="busy" tooltip="Stop showing browser notifications for new inbox messages">
                  <fa-icon [icon]="faBellSlash"/>Alerts
                </button>
              } @else if (pushStatus.permission !== 'denied') {
                <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="enableBrowserNotifications()" [disabled]="busy" tooltip="Get a desktop or phone notification when new inbox mail arrives">
                  <fa-icon [icon]="faBell"/>Alerts
                </button>
              }
            }
          }
          @if (!mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="syncAndRefresh()" [disabled]="busy" tooltip="Reload conversations and the open message, and fetch any new mail from connected mailboxes">
              <fa-icon [icon]="faRotateRight"/>Refresh
            </button>
          }
          @if (!mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="panel.toggle()" [tooltip]="panel.maximised ? panel.restoreTooltip : panel.maximiseTooltip">
              <fa-icon [icon]="panel.maximised ? faCompress : faExpand"/>{{ panel.maximised ? 'Restore' : 'Maximise' }}
            </button>
          }
          </div>
      </div>
      @if (mobile && mobileFiltersOpen && !mobileShowDetail) {
        <div class="inbox-mobile-filters">
          <button type="button" class="btn btn-quiet inbox-filter-toggle" [class.active]="readFilter === InboxReadFilter.UNREAD" (click)="toggleUnreadFilter()">
            <fa-icon [icon]="faFilter" class="me-1"/>{{readFilter === InboxReadFilter.UNREAD ? threadListUnreadCount + ' unread' : 'All'}}
          </button>
          <button type="button" class="btn btn-quiet" (click)="toggleMessageSort()">
            <fa-icon [icon]="messageSortDescending ? faArrowDownWideShort : faArrowUpWideShort" class="me-1"/>{{messageSortDescending ? 'Newest' : 'Oldest'}}
          </button>
          <button type="button" class="btn btn-quiet" (click)="toggleDensity()">
            <fa-icon [icon]="compactList ? faTableList : faGripLines" class="me-1"/>{{ compactList ? 'Roomy' : 'Compact' }}
          </button>
          <button type="button" class="btn btn-quiet" (click)="syncAndRefresh()" [disabled]="busy">
            <fa-icon [icon]="faRotateRight" class="me-1"/>Refresh
          </button>
          @if ((pushStatus$ | async); as pushStatus) {
            @if (pushStatus.supported && pushStatus.subscribed) {
              <button type="button" class="btn btn-quiet" (click)="disableBrowserNotifications()" [disabled]="busy">
                <fa-icon [icon]="faBellSlash" class="me-1"/>Disable notifications
              </button>
            } @else if (pushStatus.supported && pushStatus.permission !== 'denied') {
              <button type="button" class="btn btn-quiet" (click)="enableBrowserNotifications()" [disabled]="busy">
                <fa-icon [icon]="faBell" class="me-1"/>Enable notifications
              </button>
            }
          }
        </div>
      }
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
      <app-inbox-orphaned-threads (remapped)="refresh()"/>
      @if (selectedAlias(); as alias) {
        @if (mailboxAlertVisible) {
          <div class="alert alert-success py-2 inbox-alert d-flex align-items-start">
            <fa-icon [icon]="faEnvelope" class="me-2 mt-1"/>
            <div class="flex-grow-1">
              <strong>Viewing mail for {{aliasHeading(alias)}}</strong>
              @if (aliasExtraCaption(alias); as extras) {
                <span class="ms-1">Mail to {{extras}} also appears in this inbox.</span>
              }
              @if (!internalInbox && !alias.mailboxConnection?.hasRefreshToken) {
                <span class="ms-1">This mailbox is not connected yet.</span>
              }
            </div>
            <button class="inbox-nav-toggle flex-shrink-0 ms-2" type="button" aria-label="Dismiss" (click)="dismissMailboxAlert()">
              <fa-icon [icon]="faXmark"/>
            </button>
          </div>
        }
      }
      <div #inboxShell class="inbox-shell">
        @if (!mobile && !navCollapsed && aliases.length > 0) {
          <div class="thumbnail-heading-frame-compact inbox-pane inbox-nav" [style.flex]="'0 0 ' + navSize + 'px'">
            <div class="thumbnail-heading">Folders</div>
            <ng-container [ngTemplateOutlet]="folderNavContent"/>
          </div>
          <app-resizer [variant]="ResizerVariant.BAR"
                       [orientation]="ResizerOrientation.HORIZONTAL"
                       [size]="navSize"
                       [minSize]="minNavSize"
                       [maxSize]="maxNavSize"
                       (sizeChange)="onNavSizeChange($event)"
                       (resizeEnd)="persistNavSize()"/>
        }
        @if (mobile && mobileNavOpen) {
          <div class="inbox-drawer-backdrop" (click)="mobileNavOpen = false"></div>
          <div class="inbox-drawer" role="dialog" aria-label="Mail folders">
            <div class="inbox-drawer-header">
              <span class="inbox-toolbar-title">Mail</span>
              <button class="inbox-nav-toggle" type="button" aria-label="Close folders" (click)="mobileNavOpen = false">
                <fa-icon [icon]="faXmark"/>
              </button>
            </div>
            <ng-container [ngTemplateOutlet]="folderNavContent"/>
          </div>
        }
        <ng-template #folderNavContent>
            <div class="inbox-nav-mode">
              <app-section-toggle small
                [tabs]="mailboxLabelTabs"
                [selectedTab]="mailboxLabelMode"
                [queryParamKey]="StoredValue.MAILBOX_LABELS"
                (selectedTabChange)="onMailboxLabelModeChange($event)"/>
            </div>
            <div class="inbox-nav-tree">
              <div class="inbox-nav-row">
                <button class="inbox-nav-twisty" type="button" (click)="inboxNodeExpanded = !inboxNodeExpanded"
                        [attr.aria-expanded]="inboxNodeExpanded" aria-label="Expand inbox mailboxes">
                  <fa-icon [icon]="inboxNodeExpanded ? faChevronDown : faChevronRight"/>
                </button>
                <button class="inbox-nav-node" type="button" [class.active]="inboxNodeActive"
                        (click)="selectMailboxView(InboxViewScope.ALL_ACCESSIBLE)">
                  <fa-icon [icon]="faInbox" class="me-2"/><span class="inbox-nav-label">Inbox</span>
                  @if (unreadTotal > 0) {
                    <span class="inbox-nav-count">{{ unreadTotal }}</span>
                  }
                </button>
              </div>
              @if (inboxNodeExpanded) {
                @if (aliases.length > 1) {
                  <button class="inbox-nav-node inbox-nav-child" type="button"
                          [class.active]="selectedMailboxView === InboxViewScope.ASSIGNED_ROLES"
                          (click)="selectMailboxView(InboxViewScope.ASSIGNED_ROLES)">
                    <fa-icon [icon]="faUser" class="inbox-nav-node-icon"/>
                    <span class="inbox-nav-label">My mailboxes</span>
                  </button>
                }
                @for (alias of aliases; track alias.id || alias.roleEmail) {
                  <button class="inbox-nav-node inbox-nav-child" type="button"
                          [class.active]="selectedMailboxView === alias.roleType"
                          [tooltip]="aliasLabel(alias)" [placement]="panel.maximised ? 'right' : 'left'" container="body"
                          (click)="selectMailboxView(alias.roleType)">
                    <fa-icon [icon]="faEnvelope" class="inbox-nav-node-icon"/>
                    <span class="inbox-nav-label">{{ aliasDisplayLabel(alias) }}</span>
                    @if (unreadForRole(alias.roleType) > 0) {
                      <span class="inbox-nav-count">{{ unreadForRole(alias.roleType) }}</span>
                    }
                  </button>
                }
              }
              <div class="inbox-nav-row">
                <span class="inbox-nav-twisty"></span>
                <button class="inbox-nav-node" type="button" [class.active]="viewingSent"
                        (click)="selectMailboxView(InboxThreadFolder.SENT)">
                  <fa-icon [icon]="faPaperPlane" class="me-2"/><span class="inbox-nav-label">Sent</span>
                </button>
              </div>
              @if (canReadJunk) {
                <div class="inbox-nav-row">
                  <span class="inbox-nav-twisty"></span>
                  <button class="inbox-nav-node" type="button" [class.active]="viewingJunk"
                          (click)="selectMailboxView(InboxThreadFolder.JUNK)">
                    <fa-icon [icon]="faBan" class="me-2"/><span class="inbox-nav-label">Junk</span>
                  </button>
                </div>
              }
              <div class="inbox-nav-row">
                <span class="inbox-nav-twisty"></span>
                <button class="inbox-nav-node" type="button" [class.active]="viewingDeleted"
                        (click)="selectMailboxView(InboxThreadFolder.DELETED)">
                  <fa-icon [icon]="faTrash" class="me-2"/><span class="inbox-nav-label">Deleted</span>
                </button>
              </div>
            </div>
        </ng-template>
      <div #inboxLayout class="inbox-layout" [class.stacked]="stackedLayout"
           [style.grid-template-columns]="gridTemplateColumns"
           [style.grid-template-rows]="gridTemplateRows">
        @if (!mobile || !mobileShowDetail) {
        <div class="thumbnail-heading-frame-compact inbox-pane" [class.inbox-list-flush]="mobile">
          <div class="thumbnail-heading">{{ conversationCountCaption }}</div>
          @if (threadListTotalCount > 0 || conversationSearchTerm) {
            <div class="p-2">
              <div class="d-flex align-items-center gap-2">
                <app-section-toggle small class="inbox-grouping-mode flex-shrink-0"
                  [tabs]="groupingTabs"
                  [selectedTab]="groupingMode"
                  [queryParamKey]="StoredValue.MAIL_GROUPING"
                  (selectedTabChange)="onGroupingModeChange($event)"/>
                <div class="input-group input-group-sm flex-grow-1">
                  <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                  <input type="text" class="form-control" [ngModel]="conversationSearchTerm"
                         (ngModelChange)="onConversationSearchChange($event)"
                         [disabled]="selectingAllConversations"
                         placeholder="Search conversations...">
                </div>
              </div>
            </div>
          } @else {
            <div class="p-2">
              <app-section-toggle small class="inbox-grouping-mode"
                [tabs]="groupingTabs"
                [selectedTab]="groupingMode"
                [queryParamKey]="StoredValue.MAIL_GROUPING"
                (selectedTabChange)="onGroupingModeChange($event)"/>
            </div>
          }
          @if (threads.length > 0) {
            <div class="d-flex align-items-center gap-2 pe-2 pb-2 inbox-list-toolbar">
              <input type="checkbox" class="form-check-input mt-0" id="inbox-select-all"
                     [checked]="allSelected()"
                     [indeterminate]="selectedConversationCount > 0 && !allSelected()"
                     (change)="toggleSelectAll()">
              @if (selectedConversationCount > 0) {
                <div class="btn-group" dropdown container="body" placement="bottom left" [isDisabled]="busy">
                  <button dropdownToggle type="button" class="btn btn-sm btn-primary dropdown-toggle text-nowrap" [disabled]="busy">
                    @if (deletingSelected) {
                      <fa-icon [icon]="faSpinner" animation="spin" class="me-2"/>Deleting {{selectedConversationCount}}…
                    } @else {
                      <fa-icon [icon]="faListCheck" class="me-2"/>{{selectedConversationCount}} selected
                    }
                  </button>
                  <ul *dropdownMenu class="dropdown-menu" role="menu">
                    <li role="menuitem"><button class="dropdown-item" type="button" (click)="markSelected(false)"><fa-icon [icon]="faEnvelopeOpen" class="me-2"/>Mark as read</button></li>
                    <li role="menuitem"><button class="dropdown-item" type="button" (click)="markSelected(true)"><fa-icon [icon]="faEnvelope" class="me-2"/>Mark as unread</button></li>
                    @if (viewingJunk) {
                      <li role="menuitem"><button class="dropdown-item" type="button" (click)="moveSelectedJunk()"><fa-icon [icon]="faInbox" class="me-2"/>Not junk — move to inbox</button></li>
                    }
                    @if (viewingDeleted) {
                      <li role="menuitem"><button class="dropdown-item" type="button" (click)="restoreSelectedDeleted()"><fa-icon [icon]="faInbox" class="me-2"/>Restore to inbox</button></li>
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
          @if ((allSelected() || selectingAllConversations) && (canLoadMoreConversations || selectingAllConversations)) {
            <div class="alert alert-warning d-flex align-items-start gap-2 mx-2 mb-2 px-2 py-2">
              <fa-icon [icon]="faTriangleExclamation" class="mt-1"/>
              <div class="flex-grow-1">
                <strong class="d-block">{{selectedConversationCount}} visible {{conversationSearchTerm.trim() ? (selectedConversationCount === 1 ? "match" : "matches") : (selectedConversationCount === 1 ? "conversation" : "conversations")}} selected</strong>
                @if (conversationSearchTerm.trim()) {
                  More conversations have not been loaded yet and may also match this search.
                } @else {
                  {{threadListTotalCount - selectedConversationCount}} more conversations are available in this view.
                }
                <button type="button" class="btn btn-link p-0 align-baseline" [disabled]="selectingAllConversations" (click)="selectAllAvailableConversations()">
                  @if (selectingAllConversations) {
                    <fa-icon [icon]="faSpinner" animation="spin" class="me-1"/>Finding conversations…
                  } @else {
                    {{conversationSearchTerm.trim() ? "Select all matches" : "Select all " + threadListTotalCount}}
                  }
                </button>
              </div>
            </div>
          }
          @if (allAvailableSelected) {
            <div class="alert alert-success d-flex align-items-start gap-2 mx-2 mb-2 px-2 py-2">
              <fa-icon [icon]="faCircleCheck" class="mt-1"/>
              @if (conversationSearchTerm.trim()) {
                <div><strong class="d-block">All matching conversations selected</strong>{{selectedConversationCount}} {{selectedConversationCount === 1 ? "conversation matches" : "conversations match"}} “{{conversationSearchTerm.trim()}}”.</div>
              } @else {
                <div><strong class="d-block">All conversations selected</strong>{{selectedConversationCount}} conversations in this view are selected.</div>
              }
            </div>
          }
          <div class="inbox-thread-list" [class.inbox-list-compact]="compactList" tabindex="0" (keydown)="onThreadListKeydown($event)" (scroll)="rememberListPosition($event)">
          @if (threadListTotalCount === 0) {
            <div class="p-3 text-muted">No conversations yet. Once an alias is connected and synced, threads will appear here.</div>
          } @else if (filteredThreads.length === 0) {
            @if (conversationSearchTerm) {
              <div class="p-3 text-muted">No conversations match "{{conversationSearchTerm}}".</div>
            } @else if (readFilter === InboxReadFilter.UNREAD) {
              <div class="p-3 text-muted">
                Nothing unread here. {{stringUtils.pluraliseWithCount(threadListTotalCount, "conversation")}} in this mailbox —
                <button type="button" class="btn btn-link p-0 align-baseline" (click)="toggleUnreadFilter()">show all</button>.
              </div>
            } @else {
              <div class="p-3 text-muted">No conversations.</div>
            }
          }
          @for (thread of filteredThreads; track threadRowKey(thread)) {
            <div class="inbox-thread-row d-flex align-items-center gap-2"
                 [class.active]="threadRowActive(thread)"
                 [class.unread]="conversationUnread(thread)"
                 [attr.data-thread-id]="threadIdOf(thread)"
                 (touchstart)="startThreadSwipe($event)"
                 (touchend)="finishThreadSwipe($event, thread)"
                 (click)="selectThread(thread)">
              <input type="checkbox" class="form-check-input flex-shrink-0 m-0"
                     [checked]="conversationSelected(thread)"
                     (click)="$event.stopPropagation(); toggleThreadSelection(thread)">
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-items-center gap-2">
                  @if (conversationUnread(thread)) {
                    <span class="inbox-unread-dot flex-shrink-0" aria-label="Unread"></span>
                  }
                  <div class="inbox-thread-from flex-grow-1 text-truncate">{{ viewingSent ? sentFromLabel(thread) : (threadRowFrom(thread) || 'No external address') }}</div>
                  <div class="inbox-thread-time flex-shrink-0">{{(viewingSent ? thread.lastOutboundAt || thread.lastSeenAt : thread.lastSeenAt) | date: UIDateFormat.MONTH_DAY_YEAR_ABBREVIATED_TIME_WITH_SECONDS}}</div>
                </div>
                <div class="inbox-thread-subject">{{thread.subject || thread.normalisedSubject || "(no subject)"}}</div>
                <div class="inbox-thread-preview">{{thread.lastDirection === InboxMessageDirection.OUTBOUND ? 'Last message sent by you' : 'Latest incoming message'}} · Swipe right to {{conversationUnread(thread) ? 'mark read' : 'mark unread'}}, left to delete</div>
                @if (threadRowTo(thread); as toLabel) {
                  <div class="inbox-thread-recipient text-truncate">to {{ toLabel }}</div>
                }
              </div>
            </div>
          }
          @if (canLoadMoreConversations && !conversationSearchTerm.trim()) {
            <div class="d-flex justify-content-center p-2">
              <button type="button" class="btn btn-quiet" [disabled]="busy" (click)="loadMoreConversations()">
                Show next {{nextConversationPageSize}}
              </button>
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
                       (sizeChange)="onListSizeChange($event)"
                       (resizeEnd)="persistListSize()"/>
        }
        @if (!mobile || mobileShowDetail) {
        <div class="thumbnail-heading-frame-compact inbox-pane inbox-pane-messages">
          @if (selectedThread) {
            <div class="d-flex align-items-start gap-2 mb-3 inbox-detail-header" [class.compact]="compactDetailHeader">
              <div class="me-auto">
                <h5 class="mb-1">{{selectedThread.subject || selectedThread.normalisedSubject || "(no subject)"}}</h5>
                @if (threadFromLabel(); as fromLabel) {
                  <small class="text-muted d-block">From {{ fromLabel }}</small>
                }
                @if (threadToLabel(); as toLabel) {
                  <small class="text-muted d-block">To {{ toLabel }}</small>
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
              @if (selectedThread.folder === InboxThreadFolder.DELETED) {
                <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" [disabled]="busy" (click)="moveSelectedToInbox()">
                  <fa-icon [icon]="faInbox" class="me-1"></fa-icon>
                  Restore
                </button>
                <button class="btn btn-sm btn-grey-danger text-nowrap flex-shrink-0" type="button" [disabled]="busy" (click)="deleteCurrentThread()">
                  <fa-icon [icon]="faTrash" class="me-1"></fa-icon>
                  Delete forever
                </button>
              }
            </div>
          }
          <div class="inbox-detail" (scroll)="onMessageScroll($event)">
          @if (!selectedThread) {
            <div class="text-muted">Select a conversation to read it.</div>
          } @else if (loadingThread) {
            <div class="text-muted">Loading conversation...</div>
          } @else {
            @for (message of displayMessages; track message.messageId) {
              <div class="inbox-message" [attr.data-message-id]="message.messageId" [class.outbound]="message.direction === InboxMessageDirection.OUTBOUND" [class.collapsed]="!isMessageExpanded(message)">
                <div class="inbox-message-headers inbox-message-toggle d-flex align-items-start gap-2" (click)="toggleMessage(message)">
                  <fa-icon [icon]="isMessageExpanded(message) ? faChevronDown : faChevronRight" class="mt-1 text-muted"/>
                  <div class="flex-grow-1 min-w-0">
                    <strong>{{ messageFromLabel(message) }}</strong>
                    &middot; {{(message.receivedAt ?? message.sentAt) | date: UIDateFormat.MONTH_DAY_YEAR_ABBREVIATED_TIME_WITH_SECONDS}}
                    @if (isMessageExpanded(message)) {
                      @if (messageToLabel(message); as toLabel) {
                        <div>To {{ toLabel }}</div>
                      }
                      @if (message.cc?.length) {
                        <div>Cc {{ formatAddresses(message.cc) }}</div>
                      }
                    } @else {
                      @if (messageToLabel(message); as toLabel) {
                        <div class="inbox-message-preview text-truncate">To {{ toLabel }}</div>
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
                @if (hasOpenedMessage(message)) {
                  <div class="inbox-message-content" [class.d-none]="!isMessageExpanded(message)">
                    <app-inbox-calendar-invite [message]="message"/>
                    @if (visibleAttachments(message).length) {
                      <div class="inbox-attachments d-flex flex-wrap gap-2 mb-3">
                        @for (attachment of visibleAttachments(message); track attachment.s3Key) {
                          <div class="btn-group" dropdown container="body" placement="bottom left">
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
                  </div>
                }
              </div>
            }
          }
          </div>
          @if (mobile && latestActionMessage(); as actionMessage) {
            <div class="inbox-sticky-actions">
              <button class="btn btn-quiet" type="button" [disabled]="busy" (click)="prepareReply(actionMessage)"><fa-icon [icon]="faReply"/> Reply</button>
              @if (hasMultipleRecipients(actionMessage)) {
                <button class="btn btn-quiet" type="button" [disabled]="busy" (click)="prepareReplyAll(actionMessage)"><fa-icon [icon]="faReplyAll"/> Reply all</button>
              }
              <button class="btn btn-quiet" type="button" [disabled]="busy" (click)="prepareForward(actionMessage)"><fa-icon [icon]="faShare"/> Forward</button>
            </div>
          }
        </div>
        }
      </div>
      </div>
      </app-maximisable-panel>
      @if (pendingDelete) {
        <div class="inbox-undo-bar" role="status">
          <span>Conversation deleted</span>
          <button class="btn btn-sm btn-primary" type="button" (click)="undoPendingDelete()"><fa-icon [icon]="faUndo" class="me-1"/>Undo</button>
        </div>
      }
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
export class InboxComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly UIDateFormat = UIDateFormat;

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
  protected readonly faBars = faBars;
  protected readonly faBan = faBan;
  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faPenToSquare = faPenToSquare;
  protected readonly faReply = faReply;
  protected readonly faRotateRight = faRotateRight;
  protected readonly faEnvelope = faEnvelope;
  protected readonly faUser = faUser;
  protected readonly faXmark = faXmark;
  protected readonly faGripLines = faGripLines;
  protected readonly faEnvelopeOpen = faEnvelopeOpen;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faTableColumns = faTableColumns;
  protected readonly faTableList = faTableList;
  protected readonly faTrash = faTrash;
  protected readonly faSearch = faSearch;
  protected readonly faFilter = faFilter;
  protected readonly faListCheck = faListCheck;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faSpinner = faSpinner;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronLeft = faChevronLeft;
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
  protected readonly faSliders = faSliders;
  protected readonly faUndo = faUndo;
  public messageSortDescending = true;
  protected readonly InboxMessageDirection = InboxMessageDirection;
  protected readonly InboxViewScope = InboxViewScope;
  protected readonly InboxMailboxLabelMode = InboxMailboxLabelMode;
  protected readonly InboxGroupingMode = InboxGroupingMode;
  protected readonly StoredValue = StoredValue;
  protected readonly mailboxLabelTabs: SectionToggleTab[] = [
    {value: InboxMailboxLabelMode.ROLE, label: "Role", icon: faIdBadge},
    {value: InboxMailboxLabelMode.PERSON, label: "Person", icon: faUser}
  ];
  protected readonly groupingTabs: SectionToggleTab[] = [
    {value: InboxGroupingMode.MESSAGES, label: "Messages", icon: faTableList},
    {value: InboxGroupingMode.CONVERSATIONS, label: "Conversations", icon: faLayerGroup}
  ];
  protected readonly InboxReadFilter = InboxReadFilter;
  protected readonly InboxThreadFolder = InboxThreadFolder;
  protected readonly ResizerOrientation = ResizerOrientation;
  protected readonly ResizerVariant = ResizerVariant;
  protected readonly isInboxGeneralRoleType = isInboxGeneralRoleType;
  public displayMessages: InboxMessage[] = [];
  private messagePreviewById = new Map<string, string>();
  private visibleAttachmentsById = new Map<string, InboxAttachment[]>();
  private renderableBodyById = new Map<string, string>();
  private siblingsByConversationKey = new Map<string, InboxThread[]>();
  private cachedFilteredThreads: InboxThread[] = [];
  private filteredThreadsDirty = true;

  private clearSelectedMessages(): void {
    this.selectedMessages = [];
    this.expandedMessageIds = new Set();
    this.openedMessageIds = new Set();
    this.rebuildDisplayMessages();
  }

  private rebuildDisplayMessages(): void {
    this.displayMessages = [...this.selectedMessages].sort((left, right) => {
      const leftAt = left.receivedAt ?? left.sentAt ?? 0;
      const rightAt = right.receivedAt ?? right.sentAt ?? 0;
      return this.messageSortDescending ? rightAt - leftAt : leftAt - rightAt;
    });
    this.messagePreviewById = new Map(
      this.displayMessages.map(message => [message.messageId, this.buildMessagePreview(message)])
    );
    this.visibleAttachmentsById = new Map(
      this.displayMessages.map(message => [message.messageId, this.buildVisibleAttachments(message)])
    );
    this.renderableBodyById = new Map(
      this.displayMessages.map(message => [message.messageId, this.buildRenderableBody(message)])
    );
  }

  toggleMessageSort(): void {
    this.messageSortDescending = !this.messageSortDescending;
    this.rebuildDisplayMessages();
    this.invalidateFilteredThreads();
  }

  onConversationSearchChange(term: string): void {
    this.conversationSearchTerm = term;
    this.selectedThreadIds.clear();
    this.allAvailableSelected = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.SEARCH]: term.trim() || null},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.searchDebounceTimer = null;
      void this.refresh(false);
    }, 300);
  }

  @HostBinding("class.inbox-reading")
  get readingOnMobile(): boolean {
    return this.mobile && this.mobileShowDetail;
  }

  private matchingThread(threads: InboxThread[], slugOrId: string): InboxThread | null {
    return threads.find(thread => this.threadSlug(thread) === slugOrId || this.threadIdOf(thread) === slugOrId) ?? null;
  }

  private async threadRequestedInUrl(roleType: string | null, scope: InboxViewScope | null): Promise<InboxThread | null> {
    const requestedSlug = this.route.snapshot.queryParams[StoredValue.THREAD];
    if (!requestedSlug) {
      return null;
    }
    const alreadyLoaded = this.matchingThread(this.threads, requestedSlug);
    if (alreadyLoaded || this.readFilter !== InboxReadFilter.UNREAD) {
      return alreadyLoaded;
    }
    const unfiltered = await this.inboxService.listThreads(roleType, scope);
    const requested = this.matchingThread(unfiltered.threads, requestedSlug);
    if (!requested) {
      return null;
    }
    const conversation = requested.conversationKey
      ? unfiltered.threads.filter(thread => thread.conversationKey === requested.conversationKey)
      : [requested];
    const absent = conversation.filter(thread => !this.matchingThread(this.threads, this.threadIdOf(thread)));
    this.threads = [...this.threads, ...absent];
    return requested;
  }

  hasMultipleRecipients(message: InboxMessage): boolean {
    return ((message.to?.length ?? 0) + (message.cc?.length ?? 0)) > 1;
  }

  get viewingJunk(): boolean {
    return this.selectedMailboxView === InboxThreadFolder.JUNK;
  }

  get viewingDeleted(): boolean {
    return this.selectedMailboxView === InboxThreadFolder.DELETED;
  }

  get viewingSent(): boolean {
    return this.selectedMailboxView === InboxThreadFolder.SENT;
  }

  get inboxNodeActive(): boolean {
    return this.selectedMailboxView === InboxViewScope.ALL_ACCESSIBLE;
  }

  selectMailboxView(view: string): void {
    this.selectedMailboxView = view;
    this.mobileNavOpen = false;
    if (this.mobile) {
      this.mobileShowDetail = false;
    }
    void this.roleMailboxChanged();
  }

  showMailboxAlert(): void {
    this.mailboxAlertVisible = true;
    if (this.mailboxAlertTimer) {
      clearTimeout(this.mailboxAlertTimer);
      this.mailboxAlertTimer = null;
    }
    if (this.mobile) {
      this.mailboxAlertTimer = setTimeout(() => {
        this.mailboxAlertVisible = false;
        this.mailboxAlertTimer = null;
      }, 4000);
    }
  }

  dismissMailboxAlert(): void {
    this.mailboxAlertVisible = false;
    if (this.mailboxAlertTimer) {
      clearTimeout(this.mailboxAlertTimer);
      this.mailboxAlertTimer = null;
    }
  }

  toggleNavCollapsed(): void {
    this.navCollapsed = !this.navCollapsed;
    if (!isUndefined(window)) {
      window.localStorage.setItem(InboxComponent.NAV_KEY, this.navCollapsed ? "collapsed" : "expanded");
    }
  }

  public aliases: InboxAliasConfigView[] = [];
  public canReadJunk = false;
  private _threads: InboxThread[] = [];
  public get threads(): InboxThread[] {
    return this._threads;
  }
  public set threads(value: InboxThread[]) {
    this._threads = value ?? [];
    this.reindexSiblings();
    this.invalidateFilteredThreads();
  }
  public conversationSearchTerm = "";
  public readFilter: InboxReadFilter = InboxReadFilter.ALL;
  public selectedThreadIds = new Set<string>();
  public threadListUnreadCount = 0;
  public threadListTotalCount = 0;
  public selectedThread: InboxThread | null = null;
  public selectedThreadId: string | null = null;
  public selectedMessages: InboxMessage[] = [];
  public expandedMessageIds = new Set<string>();
  public openedMessageIds = new Set<string>();
  public loadingThread = false;
  public selectedMailboxView: string = InboxViewScope.ALL_ACCESSIBLE;
  public busy = false;
  public deletingSelected = false;
  public selectingAllConversations = false;
  public allAvailableSelected = false;
  public loadedOnce = false;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};

  public stackedLayout = false;
  public mobile = false;
  public mobileShowDetail = false;
  public mobileFiltersOpen = false;
  public compactDetailHeader = false;
  public pendingDelete: InboxPendingDelete | null = null;
  public listSize = 352;
  public readonly minListSize = 140;
  private static readonly LAYOUT_KEY = "inbox-layout";
  private static readonly SIZE_KEY = "inbox-list-size";
  private static readonly NAV_KEY = "inbox-nav";
  private static readonly NAV_SIZE_KEY = "inbox-nav-size";
  private static readonly GROUPING_KEY = "inbox-grouping-mode";
  private static readonly DENSITY_KEY = "inbox-list-density";
  public compactList = false;
  public mailboxLabelMode: InboxMailboxLabelMode = InboxMailboxLabelMode.ROLE;
  public groupingMode: InboxGroupingMode = InboxGroupingMode.CONVERSATIONS;
  public mobileNavOpen = false;
  public mailboxAlertVisible = true;
  private mailboxAlertTimer: ReturnType<typeof setTimeout> | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  public sentFocusMessageId: string | null = null;
  public unreadTotal = 0;
  public unreadByRole = new Map<string, number>();
  public navCollapsed = false;
  public inboxNodeExpanded = true;
  public navSize = 220;
  public readonly minNavSize = 150;

  get maxNavSize(): number {
    if (isUndefined(window)) {
      return Number.POSITIVE_INFINITY;
    }
    return window.innerWidth * 0.5;
  }
  @ViewChild("inboxLayout") set inboxLayout(ref: ElementRef<HTMLElement> | null) {
    this.inboxLayoutRef = ref;
    this.observeLayoutSize();
  }

  @ViewChild("inboxShell") set inboxShell(ref: ElementRef<HTMLElement> | null) {
    this.inboxShellRef = ref;
    this.observeLayoutSize();
  }

  private inboxLayoutRef: ElementRef<HTMLElement> | null = null;
  private inboxShellRef: ElementRef<HTMLElement> | null = null;
  private zone = inject(NgZone);
  private layoutResizeObserver: ResizeObserver | null = null;
  private listRatio: number | null = null;
  private navRatio: number | null = null;
  private splitterDragging = false;
  private static readonly DELETE_UNDO_MS = 6000;
  private static readonly THREAD_PAGE_SIZE = 50;
  private static readonly SWIPE_THRESHOLD_PX = 72;
  private listScrollTop = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private suppressThreadClick = false;

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
    this.subscriptions.push(this.inboxNotificationService.total$.subscribe(total => this.unreadTotal = total));
    this.subscriptions.push(this.inboxNotificationService.breakdown$.subscribe(rows =>
      this.unreadByRole = new Map(rows.map(row => [row.roleType, row.unreadCount]))));
    this.updateMobile();
    this.restoreLayout();
    await this.refresh();
    this.showMailboxAlert();
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
    this.layoutResizeObserver?.disconnect();
    if (this.mailboxAlertTimer) {
      clearTimeout(this.mailboxAlertTimer);
    }
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    if (this.pendingDelete) {
      clearTimeout(this.pendingDelete.timer);
      void this.commitPendingDelete();
    }
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
    if (this.suppressThreadClick) {
      this.suppressThreadClick = false;
      return;
    }
    if (this.mobile) {
      this.mobileShowDetail = true;
      this.mobileFiltersOpen = false;
      this.compactDetailHeader = false;
    }
    void this.openThread(thread);
  }

  backToList(): void {
    this.mobileShowDetail = false;
    this.compactDetailHeader = false;
    if (!isUndefined(window)) {
      window.requestAnimationFrame(() => {
        const list = window.document.querySelector<HTMLElement>(".inbox-thread-list");
        if (list) {
          list.scrollTop = this.listScrollTop;
        }
      });
    }
  }

  rememberListPosition(event: Event): void {
    this.listScrollTop = (event.target as HTMLElement).scrollTop;
  }

  onMessageScroll(event: Event): void {
    this.compactDetailHeader = this.mobile && (event.target as HTMLElement).scrollTop > 32;
  }

  private currentConversationIndex(): number {
    return this.filteredThreads.findIndex(thread => this.threadIdOf(thread) === this.selectedThreadId);
  }

  hasAdjacentConversation(offset: number): boolean {
    const index = this.currentConversationIndex();
    return index >= 0 && Boolean(this.filteredThreads[index + offset]);
  }

  openAdjacentConversation(offset: number): void {
    const thread = this.filteredThreads[this.currentConversationIndex() + offset];
    if (thread) {
      this.compactDetailHeader = false;
      void this.openThread(thread);
    }
  }

  nextUnreadConversation(): InboxThread | null {
    const list = this.filteredThreads;
    const currentIndex = this.currentConversationIndex();
    return [...list.slice(currentIndex + 1), ...list.slice(0, Math.max(0, currentIndex + 1))]
      .find(thread => this.conversationUnread(thread)) ?? null;
  }

  openNextUnread(): void {
    const thread = this.nextUnreadConversation();
    if (thread) {
      this.compactDetailHeader = false;
      void this.openThread(thread);
    }
  }

  latestActionMessage(): InboxMessage | null {
    return this.selectedMessages.reduce<InboxMessage | null>((latest, message) => {
      if (!latest) {
        return message;
      }
      const latestAt = latest.receivedAt ?? latest.sentAt ?? 0;
      const messageAt = message.receivedAt ?? message.sentAt ?? 0;
      return messageAt > latestAt ? message : latest;
    }, null);
  }

  startThreadSwipe(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    this.touchStartX = touch?.clientX ?? 0;
    this.touchStartY = touch?.clientY ?? 0;
  }

  finishThreadSwipe(event: TouchEvent, thread: InboxThread): void {
    const touch = event.changedTouches[0];
    const horizontalMovement = (touch?.clientX ?? this.touchStartX) - this.touchStartX;
    const verticalMovement = Math.abs((touch?.clientY ?? this.touchStartY) - this.touchStartY);
    if (Math.abs(horizontalMovement) >= InboxComponent.SWIPE_THRESHOLD_PX && Math.abs(horizontalMovement) > verticalMovement) {
      this.suppressThreadClick = true;
      setTimeout(() => this.suppressThreadClick = false, 500);
      if (horizontalMovement < 0) {
        void this.scheduleConversationDelete(thread);
      } else {
        void this.toggleConversationReadState(thread);
      }
    }
  }

  private async toggleConversationReadState(thread: InboxThread): Promise<void> {
    const markUnread = !this.conversationUnread(thread);
    const siblings = this.siblingConversationThreads(thread);
    this.busy = true;
    try {
      await Promise.all(siblings.map(sibling => markUnread
        ? this.inboxService.markThreadUnread(this.threadIdOf(sibling))
        : this.inboxService.markThreadRead(this.threadIdOf(sibling))));
      await this.refresh(false);
      this.notify.success({title: "Inbox", message: `Conversation marked as ${markUnread ? "unread" : "read"}`});
    } catch (error) {
      this.notify.error({title: "Inbox", message: (error as Error).message});
    } finally {
      this.busy = false;
    }
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
    const span = this.layoutSpan();
    if (span > 0) {
      this.listRatio = this.listSize / span;
    }
    this.splitterDragging = false;
  }

  persistNavSize(): void {
    if (!isUndefined(window)) {
      window.localStorage.setItem(InboxComponent.NAV_SIZE_KEY, String(Math.round(this.navSize)));
    }
    const width = this.shellWidth();
    if (width > 0) {
      this.navRatio = this.navSize / width;
    }
    this.splitterDragging = false;
    this.applyPaneRatios();
  }

  ngAfterViewInit(): void {
    this.observeLayoutSize();
  }

  private observeLayoutSize(): void {
    if (!isUndefined(window) && "ResizeObserver" in window && this.inboxLayoutRef?.nativeElement) {
      this.layoutResizeObserver?.disconnect();
      this.layoutResizeObserver = new ResizeObserver(() => this.zone.run(() => this.applyPaneRatios()));
      this.layoutResizeObserver.observe(this.inboxLayoutRef.nativeElement);
      if (this.inboxShellRef?.nativeElement) {
        this.layoutResizeObserver.observe(this.inboxShellRef.nativeElement);
      }
      this.applyPaneRatios();
    }
  }

  private layoutSpan(): number {
    const rect = this.inboxLayoutRef?.nativeElement?.getBoundingClientRect();
    return rect ? (this.stackedLayout ? rect.height : rect.width) : 0;
  }

  private shellWidth(): number {
    return this.inboxShellRef?.nativeElement?.getBoundingClientRect()?.width ?? 0;
  }

  private applyPaneRatios(): void {
    if (!this.splitterDragging) {
      const width = this.shellWidth();
      if (width > 0 && !this.mobile && !this.navCollapsed) {
        if (this.navRatio === null) {
          this.navRatio = this.navSize / width;
        } else {
          this.navSize = Math.min(Math.max(Math.round(this.navRatio * width), this.minNavSize), this.maxNavSize);
        }
      }
      const span = this.layoutSpan();
      if (span > 0 && !this.mobile) {
        if (this.listRatio === null) {
          this.listRatio = this.listSize / span;
        } else {
          this.listSize = Math.min(Math.max(Math.round(this.listRatio * span), this.minListSize), this.maxListSize);
        }
      }
    }
  }

  onNavSizeChange(size: number): void {
    this.splitterDragging = true;
    this.navSize = size;
  }

  onListSizeChange(size: number): void {
    this.splitterDragging = true;
    this.listSize = size;
  }

  private restoreLayout(): void {
    if (isUndefined(window)) {
      return;
    }
    this.stackedLayout = window.localStorage.getItem(InboxComponent.LAYOUT_KEY) === "stacked";
    const storedSize = Number(window.localStorage.getItem(InboxComponent.SIZE_KEY));
    this.listSize = Number.isFinite(storedSize) && storedSize >= this.minListSize ? storedSize : this.defaultListSize();
    this.navCollapsed = window.localStorage.getItem(InboxComponent.NAV_KEY) === "collapsed";
    const storedGrouping = window.localStorage.getItem(InboxComponent.GROUPING_KEY);
    this.groupingMode = values(InboxGroupingMode).includes(storedGrouping as InboxGroupingMode) ? storedGrouping as InboxGroupingMode : InboxGroupingMode.CONVERSATIONS;
    this.compactList = window.localStorage.getItem(InboxComponent.DENSITY_KEY) === "compact";
    const storedNavSize = Number(window.localStorage.getItem(InboxComponent.NAV_SIZE_KEY));
    this.navSize = Number.isFinite(storedNavSize) && storedNavSize >= this.minNavSize ? Math.min(storedNavSize, this.maxNavSize) : this.navSize;
  }

  private defaultListSize(): number {
    return this.stackedLayout ? 240 : 352;
  }

  toggleDensity(): void {
    this.compactList = !this.compactList;
    if (!isUndefined(window)) {
      window.localStorage.setItem(InboxComponent.DENSITY_KEY, this.compactList ? "compact" : "comfortable");
    }
  }

  toggleLayout(): void {
    this.stackedLayout = !this.stackedLayout;
    this.listRatio = null;
    this.listSize = this.defaultListSize();
    if (!isUndefined(window)) {
      window.localStorage.setItem(InboxComponent.LAYOUT_KEY, this.stackedLayout ? "stacked" : "side-by-side");
      window.localStorage.setItem(InboxComponent.SIZE_KEY, String(this.listSize));
    }
  }

  async refresh(reloadAccess = true): Promise<void> {
    this.busy = true;
    try {
      if (reloadAccess || this.aliases.length === 0) {
        const [aliases, canReadJunk] = await Promise.all([this.inboxService.listAliases(), this.inboxService.junkAccessible()]);
        this.aliases = aliases;
        this.canReadJunk = canReadJunk;
      }
      if (!this.mailboxViewInitialised) {
        this.applyMailboxViewFromUrl();
        this.applyReadFilterFromUrl();
        this.applyConversationSearchFromUrl();
        this.mailboxViewInitialised = true;
      }
      if (this.viewingJunk && this.canReadJunk) {
        const junkResponse = await this.inboxService.listThreads(null, null, this.readFilter === InboxReadFilter.UNREAD, null, InboxThreadFolder.JUNK, null, this.conversationSearchTerm);
        this.threads = junkResponse.threads;
        this.threadListUnreadCount = junkResponse.unreadCount;
        this.threadListTotalCount = junkResponse.totalCount;
        await this.reloadVisibleConversation(this.threads[0] ?? null);
      } else if (this.viewingDeleted) {
        const deletedResponse = await this.inboxService.listThreads(null, InboxViewScope.ALL_ACCESSIBLE, this.readFilter === InboxReadFilter.UNREAD, null, InboxThreadFolder.DELETED, null, this.conversationSearchTerm);
        this.threads = deletedResponse.threads;
        this.threadListUnreadCount = deletedResponse.unreadCount;
        this.threadListTotalCount = deletedResponse.totalCount;
        await this.reloadVisibleConversation(this.threads[0] ?? null);
      } else if (this.viewingSent) {
        const sentResponse = await this.inboxService.listThreads(null, InboxViewScope.ALL_ACCESSIBLE, this.readFilter === InboxReadFilter.UNREAD, null, InboxThreadFolder.SENT, null, this.conversationSearchTerm);
        this.threads = sentResponse.threads;
        this.threadListUnreadCount = sentResponse.unreadCount;
        this.threadListTotalCount = sentResponse.totalCount;
        await this.reloadVisibleConversation(this.threads[0] ?? null);
      } else {
        if (this.aliases.length === 1) {
          this.selectedMailboxView = this.aliases[0].roleType;
        } else if (!values(InboxViewScope).includes(this.selectedMailboxView as InboxViewScope)
          && !this.aliases.some(alias => alias.roleType === this.selectedMailboxView)
          && this.selectedMailboxView !== InboxThreadFolder.SENT
          && this.selectedMailboxView !== InboxThreadFolder.JUNK
          && this.selectedMailboxView !== InboxThreadFolder.DELETED) {
          this.selectedMailboxView = InboxViewScope.ALL_ACCESSIBLE;
        }
        const roleType = this.selectedRoleType();
        const scope = roleType ? null : this.selectedMailboxView as InboxViewScope;
        const listResponse = await this.inboxService.listThreads(roleType, scope, this.readFilter === InboxReadFilter.UNREAD, null, null, null, this.conversationSearchTerm);
        this.threads = listResponse.threads;
        this.threadListUnreadCount = listResponse.unreadCount;
        this.threadListTotalCount = listResponse.totalCount;
        const requestedThread = await this.threadRequestedInUrl(roleType, scope);
        if (this.mobile && !this.selectedThreadId && requestedThread) {
          this.mobileShowDetail = true;
        }
        await this.reloadVisibleConversation(requestedThread);
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

  async syncAndRefresh(): Promise<void> {
    try {
      const connectionIds = Array.from(new Set(this.aliases
        .filter(alias => alias.mailboxConnection?.hasRefreshToken && alias.mailboxConnectionId)
        .map(alias => alias.mailboxConnectionId as string)));
      await Promise.all(connectionIds.map(connectionId => this.inboxService.syncConnection(connectionId)));
    } catch (error) {
      this.logger.error("Failed to synchronise inbox mailboxes:", error);
    }
    await this.refresh();
  }

  private async reloadVisibleConversation(fallback: InboxThread | null): Promise<void> {
    const selectedId = this.selectedThreadId;
    if (selectedId) {
      const updated = this.matchingThread(this.threads, selectedId);
      if (updated) {
        await this.openThread(updated, false);
      } else if (this.selectedThread) {
        await this.openThread({...this.selectedThread, id: selectedId} as InboxThread, false);
      }
    } else if (fallback || this.threads.length > 0) {
      await this.openThread(fallback ?? this.threads[0], false);
    }
  }

  get canLoadMoreConversations(): boolean {
    const available = this.readFilter === InboxReadFilter.UNREAD ? this.threadListUnreadCount : this.threadListTotalCount;
    return this.threads.length < available;
  }

  get nextConversationPageSize(): number {
    const available = this.readFilter === InboxReadFilter.UNREAD ? this.threadListUnreadCount : this.threadListTotalCount;
    return Math.min(InboxComponent.THREAD_PAGE_SIZE, Math.max(available - this.threads.length, 0));
  }

  async loadMoreConversations(): Promise<void> {
    if (!this.canLoadMoreConversations || this.busy) {
      return;
    }
    this.busy = true;
    try {
      const roleType = this.selectedRoleType();
      const scope = roleType
        ? null
        : this.viewingSent || this.viewingJunk || this.viewingDeleted
          ? InboxViewScope.ALL_ACCESSIBLE
          : this.selectedMailboxView as InboxViewScope;
      const folder = this.viewingSent
        ? InboxThreadFolder.SENT
        : this.viewingJunk
          ? InboxThreadFolder.JUNK
          : this.viewingDeleted
            ? InboxThreadFolder.DELETED
            : null;
      const response = await this.inboxService.listThreads(roleType, scope, this.readFilter === InboxReadFilter.UNREAD, InboxComponent.THREAD_PAGE_SIZE, folder, this.threads.length, this.conversationSearchTerm);
      this.threads = this.threads.concat(response.threads);
      this.threadListUnreadCount = response.unreadCount;
      this.threadListTotalCount = response.totalCount;
    } catch (error) {
      this.notify.error({title: "Inbox", message: (error as Error).message});
      this.logger.error("Failed to load more inbox conversations:", error);
    } finally {
      this.busy = false;
    }
  }

  selectedAlias(): InboxAliasConfigView | null {
    return this.aliases.find(alias => alias.roleType === this.selectedMailboxView) ?? null;
  }

  aliasLabel(alias: InboxAliasConfigView): string {
    return aliasMailboxLabel(alias);
  }

  aliasDisplayLabel(alias: InboxAliasConfigView): string {
    if (isInboxGeneralRoleType(alias.roleType)) {
      return "Other inbox mail";
    } else if (this.mailboxLabelMode === InboxMailboxLabelMode.PERSON) {
      return alias.assignedMemberName || this.stringUtils.asTitle(alias.roleType);
    } else {
      return this.stringUtils.asTitle(alias.roleType);
    }
  }

  onMailboxLabelModeChange(mode: InboxMailboxLabelMode): void {
    this.mailboxLabelMode = mode;
  }

  onGroupingModeChange(mode: InboxGroupingMode): void {
    this.groupingMode = mode;
    if (!isUndefined(window)) {
      window.localStorage.setItem(InboxComponent.GROUPING_KEY, mode);
    }
    this.invalidateFilteredThreads();
  }

  aliasHeading(alias: InboxAliasConfigView): string {
    return aliasMailboxHeading(alias);
  }

  aliasExtraCaption(alias: InboxAliasConfigView): string | null {
    return aliasMailboxExtraCaption(alias);
  }

  selectedRoleType(): string | null {
    return values(InboxViewScope).includes(this.selectedMailboxView as InboxViewScope) || this.viewingSent || this.viewingJunk || this.viewingDeleted
      ? null
      : this.selectedMailboxView;
  }

  async roleMailboxChanged(): Promise<void> {
    this.showMailboxAlert();
    this.selectedThread = null;
    this.selectedThreadId = null;
    this.clearSelectedMessages();
    this.loadingThread = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.MAILBOX_VIEW]: this.mailboxViewParam()},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
    await this.refresh(false);
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
    } else if (hiddenInboxFolders().concat(InboxThreadFolder.SENT).includes(param as InboxThreadFolder)) {
      this.selectedMailboxView = param;
    } else {
      const alias = this.aliases.find(candidate => candidate.roleEmail.split("@")[0] === param);
      if (alias) {
        this.selectedMailboxView = alias.roleType;
      }
    }
  }

  threadIdOf(thread: InboxThread): string {
    return inboxThreadId(thread);
  }

  threadRowKey(thread: InboxThread): string {
    return `${this.threadIdOf(thread)}${thread.sentMessageId ?? ""}`;
  }

  unreadForRole(roleType: string): number {
    return this.unreadByRole.get(roleType) ?? 0;
  }

  threadRowActive(thread: InboxThread): boolean {
    return this.threadIdOf(thread) === this.selectedThreadId
      && (!this.viewingSent || (thread.sentMessageId ?? null) === this.sentFocusMessageId);
  }

  siblingConversationThreads(thread: InboxThread): InboxThread[] {
    const key = thread.conversationKey;
    return key ? (this.siblingsByConversationKey.get(key) ?? [thread]) : [thread];
  }

  private reindexSiblings(): void {
    const byKey = new Map<string, InboxThread[]>();
    this._threads.forEach(thread => {
      const key = thread.conversationKey;
      if (key) {
        const group = byKey.get(key);
        if (group) {
          group.push(thread);
        } else {
          byKey.set(key, [thread]);
        }
      }
    });
    this.siblingsByConversationKey = byKey;
  }

  private invalidateFilteredThreads(): void {
    this.filteredThreadsDirty = true;
  }

  private representativeThread(threads: InboxThread[]): InboxThread {
    return threads.reduce((latest, candidate) =>
      (candidate.lastSeenAt ?? candidate.firstSeenAt ?? 0) > (latest.lastSeenAt ?? latest.firstSeenAt ?? 0) ? candidate : latest);
  }

  private conversationRepresentatives(threads: InboxThread[]): InboxThread[] {
    if (this.groupingMode === InboxGroupingMode.MESSAGES) {
      return threads;
    } else if (this.viewingSent) {
      const seenKeys = new Set<string>();
      return threads.filter(thread => {
        const key = thread.conversationKey || thread.normalisedSubject || this.threadIdOf(thread);
        if (seenKeys.has(key)) {
          return false;
        } else {
          seenKeys.add(key);
          return true;
        }
      });
    } else {
      const seenKeys = new Set<string>();
      const representatives: InboxThread[] = [];
      threads.forEach(thread => {
        const key = thread.conversationKey;
        if (!key) {
          representatives.push(thread);
        } else if (!seenKeys.has(key)) {
          seenKeys.add(key);
          representatives.push(this.representativeThread(this.siblingsByConversationKey.get(key) ?? [thread]));
        }
      });
      return representatives;
    }
  }

  conversationUnread(thread: InboxThread): boolean {
    return this.siblingConversationThreads(thread).some(candidate => candidate.unread);
  }


  conversationSelected(thread: InboxThread): boolean {
    return this.siblingConversationThreads(thread).every(candidate => this.selectedThreadIds.has(this.threadIdOf(candidate)));
  }

  get conversationCountCaption(): string {
    const shown = this.filteredThreads.length;
    const unreadOnly = this.readFilter === InboxReadFilter.UNREAD;
    const groupingNoun = this.groupingMode === InboxGroupingMode.MESSAGES ? "message" : "conversation";
    const noun = unreadOnly ? `unread ${groupingNoun}` : groupingNoun;
    const searching = !!this.conversationSearchTerm?.trim();
    const inMailbox = unreadOnly ? this.threadListUnreadCount : this.threadListTotalCount;
    const available = searching ? this.conversationRepresentatives(this.threads).length : inMailbox;
    return shown < available
      ? `${shown} of ${this.stringUtils.pluraliseWithCount(available, noun)}`
      : this.stringUtils.pluraliseWithCount(shown, noun);
  }

  get filteredThreads(): InboxThread[] {
    if (this.filteredThreadsDirty) {
      this.cachedFilteredThreads = this.computeFilteredThreads();
      this.filteredThreadsDirty = false;
    }
    return this.cachedFilteredThreads;
  }

  private computeFilteredThreads(): InboxThread[] {
    const representatives = this.conversationRepresentatives(this.threads);
    const matched = representatives.filter(representative =>
      this.readFilter === InboxReadFilter.ALL
      || this.siblingConversationThreads(representative).some(candidate =>
        this.readFilter === InboxReadFilter.UNREAD ? candidate.unread : !candidate.unread));
    return matched.sort((left, right) => {
      const leftAt = left.lastSeenAt ?? left.firstSeenAt ?? 0;
      const rightAt = right.lastSeenAt ?? right.firstSeenAt ?? 0;
      return this.messageSortDescending ? rightAt - leftAt : leftAt - rightAt;
    });
  }

  toggleUnreadFilter(): void {
    this.readFilter = this.readFilter === InboxReadFilter.UNREAD ? InboxReadFilter.ALL : InboxReadFilter.UNREAD;
    this.invalidateFilteredThreads();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.INBOX_FILTER]: this.readFilter === InboxReadFilter.ALL ? null : this.readFilter},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
    void this.refresh(false);
  }

  private applyReadFilterFromUrl(): void {
    const param = this.route.snapshot.queryParams[StoredValue.INBOX_FILTER] as InboxReadFilter;
    if (param === InboxReadFilter.UNREAD || param === InboxReadFilter.READ) {
      this.readFilter = param;
      this.invalidateFilteredThreads();
    }
  }

  private applyConversationSearchFromUrl(): void {
    this.conversationSearchTerm = String(this.route.snapshot.queryParams[StoredValue.SEARCH] ?? "");
    this.invalidateFilteredThreads();
  }

  toggleThreadSelection(thread: InboxThread): void {
    this.allAvailableSelected = false;
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
    return this.filteredThreads.length > 0 && this.filteredThreads.every(thread => this.conversationSelected(thread));
  }

  get selectedConversationCount(): number {
    return this.conversationRepresentatives(this.threads).filter(thread => this.conversationSelected(thread)).length;
  }

  toggleSelectAll(): void {
    this.allAvailableSelected = false;
    const filteredThreadIds = this.filteredThreads
      .flatMap(thread => this.siblingConversationThreads(thread))
      .map(thread => this.threadIdOf(thread));
    if (this.allSelected()) {
      filteredThreadIds.forEach(id => this.selectedThreadIds.delete(id));
    } else {
      filteredThreadIds.forEach(id => this.selectedThreadIds.add(id));
    }
  }

  async selectAllAvailableConversations(): Promise<void> {
    this.selectingAllConversations = true;
    this.busy = true;
    try {
      await this.loadEveryRemainingConversation();
      this.filteredThreads
        .flatMap(thread => this.siblingConversationThreads(thread))
        .map(thread => this.threadIdOf(thread))
        .forEach(id => this.selectedThreadIds.add(id));
      this.allAvailableSelected = true;
    } catch (error) {
      this.notify.error({title: "Select matching conversations", message: (error as Error).message});
      this.logger.error("Failed to select every matching conversation:", error);
    } finally {
      this.busy = false;
      this.selectingAllConversations = false;
    }
  }

  private async loadEveryRemainingConversation(): Promise<void> {
    const roleType = this.selectedRoleType();
    const scope = roleType
      ? null
      : this.viewingSent || this.viewingJunk || this.viewingDeleted
        ? InboxViewScope.ALL_ACCESSIBLE
        : this.selectedMailboxView as InboxViewScope;
    const folder = this.viewingSent
      ? InboxThreadFolder.SENT
      : this.viewingJunk
        ? InboxThreadFolder.JUNK
        : this.viewingDeleted
          ? InboxThreadFolder.DELETED
          : null;
    const pageSize = 200;
    const response = await this.inboxService.listThreads(roleType, scope, this.readFilter === InboxReadFilter.UNREAD, pageSize, folder, this.threads.length, this.conversationSearchTerm);
    this.threads = this.threads.concat(response.threads);
    this.threadListUnreadCount = response.unreadCount;
    this.threadListTotalCount = response.totalCount;
    if (response.threads.length === pageSize) {
      await this.loadEveryRemainingConversation();
    }
  }

  async deleteSelected(): Promise<void> {
    const ids = [...this.selectedThreadIds];
    if (ids.length === 0) {
      return;
    }
    this.deletingSelected = true;
    this.busy = true;
    try {
      if (this.viewingDeleted) {
        await this.inboxService.permanentlyDeleteThreads(ids);
      } else {
        await Promise.all(ids.map(id => this.inboxService.deleteThread(id)));
      }
      if (this.selectedThreadId && ids.includes(this.selectedThreadId)) {
        this.selectedThread = null;
        this.selectedThreadId = null;
        this.clearSelectedMessages();
        this.loadingThread = false;
      }
      this.selectedThreadIds.clear();
      this.allAvailableSelected = false;
      await this.refresh(false);
      this.notify.success({title: "Inbox", message: `${this.stringUtils.pluraliseWithCount(ids.length, "conversation")} ${this.viewingDeleted ? "permanently deleted" : "moved to Deleted"}`});
    } catch (error) {
      this.notify.error({title: "Delete", message: (error as Error).message});
      this.logger.error("Failed to delete conversations:", error);
    } finally {
      this.busy = false;
      this.deletingSelected = false;
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
      await this.refresh(false);
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
        this.clearSelectedMessages();
      }
      this.selectedThreadIds.clear();
      await this.refresh(false);
      this.notify.success({title: "Inbox", message: `${this.stringUtils.pluraliseWithCount(ids.length, "conversation")} moved out of junk into the inbox`});
    } catch (error) {
      this.notify.error({title: "Not junk", message: (error as Error).message});
      this.logger.error("Failed to move conversations out of junk:", error);
    } finally {
      this.busy = false;
    }
  }

  async restoreSelectedDeleted(): Promise<void> {
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
        this.clearSelectedMessages();
      }
      this.selectedThreadIds.clear();
      await this.refresh(false);
      this.notify.success({title: "Inbox", message: `${this.stringUtils.pluraliseWithCount(ids.length, "conversation")} restored to the inbox`});
    } catch (error) {
      this.notify.error({title: "Restore", message: (error as Error).message});
      this.logger.error("Failed to restore conversations:", error);
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
      this.clearSelectedMessages();
      this.mobileShowDetail = false;
      await this.refresh(false);
      this.notify.success({title: "Inbox", message: "Moved out of junk into the inbox"});
    } catch (error) {
      this.notify.error({title: "Not junk", message: (error as Error).message});
      this.logger.error("Failed to move thread to inbox:", error);
    } finally {
      this.busy = false;
    }
  }

  async deleteCurrentThread(): Promise<void> {
    if (!this.selectedThread) {
      return;
    }
    await this.scheduleConversationDelete(this.selectedThread);
  }

  private async scheduleConversationDelete(thread: InboxThread): Promise<void> {
    if (this.pendingDelete) {
      await this.commitPendingDelete();
    }
    const threadId = this.threadIdOf(thread);
    const list = this.filteredThreads;
    const currentIndex = list.findIndex(thread => this.threadIdOf(thread) === threadId);
    const nextThread = list[currentIndex + 1] ?? list[currentIndex - 1] ?? null;
    const insertionIndex = this.threads.findIndex(candidate => this.threadIdOf(candidate) === threadId);
    const removedThreads = this.threads.filter(candidate => this.threadIdOf(candidate) === threadId);
    const wasUnread = this.conversationUnread(thread);
    this.threads = this.threads.filter(candidate => this.threadIdOf(candidate) !== threadId);
    this.threadListTotalCount = Math.max(0, this.threadListTotalCount - 1);
    if (wasUnread) {
      this.threadListUnreadCount = Math.max(0, this.threadListUnreadCount - 1);
    }
    this.selectedThreadIds.delete(threadId);
    this.selectedThread = nextThread;
    this.selectedThreadId = nextThread ? this.threadIdOf(nextThread) : null;
    this.clearSelectedMessages();
    this.pendingDelete = {
      threadId,
      removedThreads,
      insertionIndex,
      selectedThread: thread,
      timer: setTimeout(() => void this.commitPendingDelete(), InboxComponent.DELETE_UNDO_MS)
    };
    if (nextThread) {
      await this.openThread(nextThread);
    } else {
      this.mobileShowDetail = false;
      this.syncThreadToUrl(null);
    }
  }

  undoPendingDelete(): void {
    const pending = this.pendingDelete;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    const insertionIndex = Math.max(0, pending.insertionIndex);
    this.threads = [
      ...this.threads.slice(0, insertionIndex),
      ...pending.removedThreads,
      ...this.threads.slice(insertionIndex)
    ];
    this.threadListTotalCount += 1;
    if (pending.selectedThread && this.conversationUnread(pending.selectedThread)) {
      this.threadListUnreadCount += 1;
    }
    this.pendingDelete = null;
    if (pending.selectedThread) {
      this.mobileShowDetail = this.mobile;
      void this.openThread(pending.selectedThread, false);
    }
  }

  private async commitPendingDelete(): Promise<void> {
    const pending = this.pendingDelete;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pendingDelete = null;
    try {
      await this.inboxService.deleteThread(pending.threadId);
      this.notify.success({title: "Inbox", message: this.viewingDeleted ? "Conversation permanently deleted" : "Conversation moved to Deleted"});
    } catch (error) {
      const insertionIndex = Math.max(0, pending.insertionIndex);
      this.threads = [...this.threads.slice(0, insertionIndex), ...pending.removedThreads, ...this.threads.slice(insertionIndex)];
      this.threadListTotalCount += 1;
      if (pending.selectedThread && this.conversationUnread(pending.selectedThread)) {
        this.threadListUnreadCount += 1;
      }
      this.notify.error({title: "Delete", message: (error as Error).message});
      this.logger.error("Failed to delete conversation:", error);
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

  private scrollMessageIntoView(messageId: string): void {
    setTimeout(() => document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)?.scrollIntoView({block: "start"}), 0);
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
      this.clearSelectedMessages();
      await this.refresh(false);
      const refreshed = nextThread ? this.filteredThreads.find(thread => this.threadIdOf(thread) === this.threadIdOf(nextThread)) : null;
      if (refreshed) {
        await this.openThread(refreshed);
        this.scrollThreadRowIntoView(listElement, this.threadIdOf(refreshed));
      } else if (!nextThread) {
        this.selectedThread = null;
        this.selectedThreadId = null;
      }
      this.notify.success({title: "Inbox", message: this.viewingDeleted ? "Conversation permanently deleted" : "Conversation moved to Deleted"});
    } catch (error) {
      this.notify.error({title: "Delete", message: (error as Error).message});
      this.logger.error("Failed to delete conversation:", error);
    } finally {
      this.busy = false;
    }
  }

  async openThread(thread: InboxThread, markRead = true): Promise<void> {
    this.sentFocusMessageId = this.viewingSent ? thread.sentMessageId ?? null : null;
    const siblings = uniqBy(this.siblingConversationThreads(thread), sibling => this.threadIdOf(sibling));
    const representative = this.viewingSent ? thread : this.representativeThread(siblings);
    const threadId = this.threadIdOf(representative);
    const requestId = this.openThreadRequestId + 1;
    this.openThreadRequestId = requestId;
    this.selectedThreadId = threadId;
    this.selectedThread = representative;
    this.clearSelectedMessages();
    this.loadingThread = true;
    this.syncThreadToUrl(representative);
    try {
      const responses = await Promise.all(siblings.map(sibling => this.inboxService.getThread(this.threadIdOf(sibling))));
      if (requestId !== this.openThreadRequestId) {
        return;
      }
      const representativeResponse = responses.find(response => this.threadIdOf(response.thread) === threadId) ?? responses[0];
      this.selectedThread = representativeResponse.thread;
      responses.forEach(response => {
        const listed = siblings.find(sibling => this.threadIdOf(sibling) === this.threadIdOf(response.thread));
        if (listed) {
          listed.externalAddress = response.thread.externalAddress;
        }
      });
      this.selectedMessages = collapseInboxSends(responses.flatMap(response => response.messages));
      this.rebuildDisplayMessages();
      this.alignOutboundThreadCounterparty();
      const newestMessage = this.selectedMessages.length
        ? this.selectedMessages.reduce((latest, candidate) =>
          (candidate.receivedAt ?? candidate.sentAt ?? 0) > (latest.receivedAt ?? latest.sentAt ?? 0) ? candidate : latest)
        : null;
      const sentFocus = this.sentFocusMessageId
        ? this.selectedMessages.find(message => message.messageId === this.sentFocusMessageId) ?? null
        : null;
      const outboundMessages = this.selectedMessages.filter(message => message.direction === InboxMessageDirection.OUTBOUND && !message.autoReply);
      const newestOutbound = outboundMessages.length
        ? outboundMessages.reduce((latest, candidate) =>
          (candidate.sentAt ?? candidate.receivedAt ?? 0) > (latest.sentAt ?? latest.receivedAt ?? 0) ? candidate : latest)
        : null;
      const focusMessage = this.viewingSent ? sentFocus ?? newestOutbound ?? newestMessage : newestMessage;
      this.expandedMessageIds = new Set(focusMessage ? [focusMessage.messageId] : []);
      this.openedMessageIds = new Set(focusMessage ? [focusMessage.messageId] : []);
      this.loadingThread = false;
      if (this.viewingSent && focusMessage) {
        this.scrollMessageIntoView(focusMessage.messageId);
      }
      this.markThreadsRead(markRead ? siblings : []);
    } catch (error) {
      if (requestId !== this.openThreadRequestId) {
        return;
      }
      this.loadingThread = false;
      if (this.threadNoLongerExists(error)) {
        this.selectedThreadId = null;
        this.selectedThread = null;
        this.clearSelectedMessages();
        this.syncThreadToUrl(null);
      } else {
        this.notify.error({title: "Open thread", message: (error as Error).message});
        this.logger.error("Failed to open thread:", error);
      }
    }
  }

  private markThreadsRead(threads: InboxThread[]): void {
    const unreadThreads = threads.filter(thread => thread.unread);
    if (unreadThreads.length > 0) {
      unreadThreads.forEach(thread => thread.unread = false);
      this.invalidateFilteredThreads();
      this.threadListUnreadCount = Math.max(0, this.threadListUnreadCount - 1);
      if (this.readFilter === InboxReadFilter.UNREAD) {
        this.threadListTotalCount = Math.max(0, this.threadListTotalCount - 1);
      }
      Promise.all(unreadThreads.map(thread => this.inboxService.markThreadRead(this.threadIdOf(thread))))
        .then(() => this.inboxNotificationService.resync())
        .catch(error => this.logger.error("mark-read failed:", error));
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
      this.markThreadsRead(this.siblingConversationThreads(this.selectedThread));
      if (options.replyAll) {
        reply.cc = this.replyAllRecipients(reply, target);
        reply.replyAll = true;
      }
      this.inboxReplyHandoff.queue(reply);
      this.logger.info(actionTitle, "queued, navigating to composer:", JSON.stringify({to: reply.to, cc: reply.cc, senderRoleType: reply.senderRoleType, threadId: reply.threadId, inboxMessageId: reply.inboxMessageId}));
      const maximised = this.route.snapshot.queryParams[StoredValue.MAXIMISE] === "true";
      await this.router.navigate(["/" + AdminPath.EMAIL_COMPOSER], {
        queryParams: {
          [StoredValue.BRANDING]: BrandingMode.UNBRANDED,
          [StoredValue.TAB]: EmailComposerStepKey.COMPOSE,
          [StoredValue.THREAD]: inboxThreadSlug(this.selectedThread),
          [StoredValue.MESSAGE]: target.messageId,
          ...(options.replyAll ? {[StoredValue.REPLY_ALL]: "true"} : {}),
          ...(options.forward ? {[StoredValue.FORWARD]: "true"} : {}),
          ...(maximised ? {[StoredValue.MAXIMISE]: "true"} : {})
        }
      });
    } catch (error) {
      this.notify.error({title: actionTitle, message: (error as Error).message});
      this.logger.error("Failed to prepare", actionTitle.toLowerCase(), ":", error);
    }
  }

  private replyAllRecipients(reply: InboxReplyComposeResponse, target: InboxMessage): InboxAddress[] {
    return replyAllRecipients(reply, target, this.aliases.flatMap(alias => aliasMailboxAddresses(alias)));
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

  hasOpenedMessage(message: InboxMessage): boolean {
    return this.openedMessageIds.has(message.messageId);
  }

  toggleMessage(message: InboxMessage): void {
    const nextExpanded = new Set(this.expandedMessageIds);
    if (nextExpanded.has(message.messageId)) {
      nextExpanded.delete(message.messageId);
    } else {
      nextExpanded.add(message.messageId);
      if (!this.openedMessageIds.has(message.messageId)) {
        this.openedMessageIds = new Set(this.openedMessageIds).add(message.messageId);
      }
    }
    this.expandedMessageIds = nextExpanded;
  }

  recipientSummary(message: InboxMessage): string {
    return [...(message.to ?? []), ...(message.cc ?? [])]
      .map(address => address.email?.trim())
      .filter(email => email)
      .join(", ");
  }

  outboundThreadRecipientLabel(): string {
    const recipients = this.outboundRecipientAddresses();
    return recipients.length > 0
      ? this.formatAddresses(recipients)
      : this.formatAddress(this.selectedThread?.externalAddress);
  }

  private outboundRecipientAddresses(): InboxAddress[] {
    return this.unionAddresses([], this.selectedMessages
      .filter(message => message.direction === InboxMessageDirection.OUTBOUND)
      .flatMap(message => [...(message.to ?? []), ...(message.cc ?? [])])
      .filter(address => address?.email));
  }

  private alignOutboundThreadCounterparty(): void {
    if (this.selectedThread && this.selectedThreadOutboundOnly()) {
      const recipients = this.outboundRecipientAddresses();
      if (recipients.length > 0) {
        const counterparty = recipients[0];
        this.selectedThread.externalAddress = counterparty;
        const listed = this.threads.find(thread => this.threadIdOf(thread) === this.threadIdOf(this.selectedThread));
        if (listed) {
          listed.externalAddress = counterparty;
        }
      }
    }
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
    return this.messagePreviewById.get(message.messageId) ?? this.buildMessagePreview(message);
  }

  private buildMessagePreview(message: InboxMessage): string {
    const raw = message.bodyHtml?.trim() ? message.bodyHtml : (message.bodyText ?? "");
    const cleaned = this.stringUtils.htmlToPlainText(raw)
      .replace(/[^{}]*\{[^{}]*:[^{}]*\}/g, " ");
    return cleaned.replace(/\s+/g, " ").trim().slice(0, 500);
  }

  recipientForThread(thread: InboxThread): string | null {
    const alias = this.aliases.find(candidate => candidate.roleType === thread.roleType);
    if (!alias || isInboxGeneralRoleType(alias.roleType)) {
      return null;
    } else {
      return thread.deliveredTo?.email || alias.roleEmail;
    }
  }

  roleLineForThread(thread: InboxThread): string | null {
    return inboxThreadRoleLine(thread, this.recipientForThread(thread));
  }

  threadRowFrom(thread: InboxThread): string | null {
    return inboxThreadRowFrom(thread, this.recipientForThread(thread));
  }

  sentFromLabel(thread: InboxThread): string {
    const senderEmail = (thread.sentFrom?.email || "").toLowerCase();
    const alias = this.aliases.find(candidate =>
      [candidate.roleEmail, ...(candidate.additionalEmails ?? [])].some(email => (email || "").toLowerCase() === senderEmail));
    if (alias) {
      return this.aliasDisplayLabel(alias);
    } else if (thread.roleType && !isInboxGeneralRoleType(thread.roleType)) {
      return this.stringUtils.asTitle(thread.roleType);
    } else {
      return thread.sentFrom?.name || thread.sentFrom?.email || "Unknown sender";
    }
  }

  threadRowTo(thread: InboxThread): string | null {
    return inboxThreadRowTo(thread, this.recipientForThread(thread));
  }

  selectedThreadOutboundOnly(): boolean {
    return this.selectedMessages.length > 0 && this.selectedMessages.every(message => message.direction === InboxMessageDirection.OUTBOUND);
  }

  threadFromLabel(): string | null {
    const from = inboxThreadHeaderFrom(this.displayMessages);
    return from ? this.formatAddress(from) || null : null;
  }

  threadToLabel(): string | null {
    const to = inboxThreadHeaderTo(this.displayMessages);
    return to.length ? this.formatAddresses(to) : null;
  }

  messageFromLabel(message: InboxMessage): string {
    return message.direction === InboxMessageDirection.OUTBOUND
      ? "Sent - " + this.formatAddress(message.from)
      : "From " + this.formatAddress(message.from);
  }

  messageToLabel(message: InboxMessage): string | null {
    return message.to?.length
      ? this.formatAddresses(message.to)
      : (this.recipientSummary(message) || null);
  }

  selectedThreadRecipient(): string | null {
    if (!this.selectedThread) {
      return null;
    }
    const firstInbound = this.selectedMessages.find(message => message.direction === InboxMessageDirection.INBOUND);
    const deliveredTo = firstInbound?.to?.length ? this.formatAddresses(firstInbound.to) : null;
    if (deliveredTo) {
      return deliveredTo;
    }
    const aliasEmail = this.recipientForThread(this.selectedThread);
    if (aliasEmail) {
      return aliasEmail;
    }
    if (isInboxGeneralRoleType(this.selectedThread.roleType)) {
      return "Other inbox mail";
    }
    return null;
  }

  renderableBody(message: InboxMessage): string {
    return this.renderableBodyById.get(message.messageId) ?? this.buildRenderableBody(message);
  }

  private buildRenderableBody(message: InboxMessage): string {
    if (message.bodyHtml) {
      return this.resolveInlineImages(message.bodyHtml, message.attachments);
    }
    if (message.bodyText) {
      return `<pre>${message.bodyText}</pre>`;
    }
    return "<em>(empty message body)</em>";
  }

  protected visibleAttachments(message: InboxMessage): InboxAttachment[] {
    return this.visibleAttachmentsById.get(message.messageId) ?? this.buildVisibleAttachments(message);
  }

  private buildVisibleAttachments(message: InboxMessage): InboxAttachment[] {
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
    await this.refresh(false);
  }
}
