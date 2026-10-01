import {EmailCompositionListComponent} from "../../../modules/common/email-compositions/email-composition-list.component";
import {InboxMessageComponent} from "./inbox-message.component";
import {InboxLayoutService} from "../../../services/inbox/inbox-layout.service";
import {InboxMessageRenderingService} from "../../../services/inbox/inbox-message-rendering.service";
import {InboxConversationsService} from "../../../services/inbox/inbox-conversations.service";
import { AfterViewInit, Component, ElementRef, HostBinding, HostListener, inject, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowDownWideShort, faArrowLeft, faArrowUpWideShort, faBan, faBars, faBell, faBellSlash, faChevronDown, faChevronLeft, faChevronRight, faCircleCheck, faCompress, faEnvelope, faEnvelopeOpen, faExpand, faFilter, faGripLines, faIdBadge, faInbox, faLayerGroup, faListCheck, faPaperPlane, faPenToSquare, faFileLines, faReply, faReplyAll, faRotateRight, faSearch, faShare, faSliders, faSpinner, faTableColumns, faTableList, faTrash, faTriangleExclamation, faUndo, faUser, faXmark } from "@fortawesome/free-solid-svg-icons";
import { AdminSettingsPath, AdminPath } from "../../../models/admin-route-paths.model";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { isUndefined, kebabCase, uniqBy, values } from "es-toolkit/compat";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { InboxService } from "../../../services/inbox/inbox.service";
import { InboxReplyHandoffService } from "../../../services/inbox/inbox-reply-handoff.service";
import { addressLabel, aliasMailboxAddresses, aliasMailboxExtraCaption, aliasMailboxHeading, aliasMailboxLabel, collapseInboxSends, formatInboxAddress, inboxThreadHeaderFrom, inboxThreadHeaderTo, inboxThreadId, inboxThreadRoleLine, inboxThreadRowFrom, inboxThreadRowPreview, inboxThreadRowTo, replyAllRecipients, validatedInboxColumnShare } from "../../../functions/inbox-thread";
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
  InboxColumnResizeEdge,
  hiddenInboxFolders,
  isInboxGeneralRoleType
} from "../../../models/inbox.model";
import { BrandingMode, MailSettingsTab } from "../../../models/mail.model";
import { EmailComposerStepKey, EmailCompositionStatus, EmailCompositionSummary } from "../../../models/email-composer.model";
import { EmailCompositionsService } from "../../../services/email-composer/email-compositions.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { StoredValue } from "../../../models/ui-actions";
import { DeviceSize } from "../../../models/page.model";
import { UrlService } from "../../../services/url.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { PageComponent } from "../../../page/page.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { InboxOrphanedThreadsComponent } from "./inbox-orphaned-threads.component";
import { CommitteeUnassignedRolesComponent } from "../system-settings/committee/committee-unassigned-roles";
import { ResizerComponent, ResizerOrientation, ResizerVariant } from "../../../modules/common/resizer/resizer";
import { MaximisablePanelComponent } from "../../../modules/common/maximisable-panel/maximisable-panel";
import { UIDateFormat } from "../../../models/date-format.model";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../../services/committee/committee-reference-data";
import { ThumbnailHeadingFrameComponent } from "../../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";

@Component({
  selector: "app-inbox",
  providers: [InboxLayoutService, InboxMessageRenderingService, InboxConversationsService],
  imports: [EmailCompositionListComponent, InboxMessageComponent, CommonModule, FormsModule, FontAwesomeModule, PageComponent, DatePipe, TooltipDirective, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, ResizerComponent, RouterLink, MaximisablePanelComponent, InboxOrphanedThreadsComponent, CommitteeUnassignedRolesComponent, SectionToggle, ThumbnailHeadingFrameComponent],
  styleUrls: ["./inbox.component.sass"],
  template: `
    <app-page pageTitle="Mail" [showTitle]="false" [showBreadcrumb]="!layout.mobile">
      <app-maximisable-panel #panel="maximisablePanel" class="inbox-scroll-contained"
                             [showHeader]="!readingOnMobile || !layout.compactDetailHeader"
                             [showToggleButton]="false">
      <div panelControls class="d-flex gap-2 align-items-center flex-grow-1 inbox-toolbar">
          @if (!readingOnMobile) {
            <div class="d-flex align-items-center gap-2 flex-shrink-0 inbox-toolbar-brand">
              @if (layout.mobile) {
                <button class="inbox-nav-toggle flex-shrink-0" type="button" aria-label="Show folders" (click)="layout.mobileNavOpen = true">
                  <fa-icon [icon]="faBars"/>
                </button>
              }
              <fa-icon [icon]="faInbox" class="ramblers" size="lg"></fa-icon>
              @if (!layout.mobile) {
                <span class="inbox-toolbar-title">Mail</span>
              }
              @if (!layout.mobile) {
                <button class="inbox-nav-toggle flex-shrink-0" type="button" (click)="layout.toggleNavCollapsed()"
                        [class.active]="!layout.navCollapsed" [attr.aria-pressed]="!layout.navCollapsed"
                        [tooltip]="layout.navCollapsed ? 'Show folders' : 'Hide folders'">
                  <fa-icon [icon]="layout.navCollapsed ? faBars : faTableColumns"/>
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
              <option [ngValue]="InboxThreadFolder.DRAFTS">Drafts</option>
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
            @if (layout.mobile) {
              <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="layout.mobileFiltersOpen = !layout.mobileFiltersOpen">
                <fa-icon [icon]="faSliders"/>Filter and sort
              </button>
            }
          }
          @if (layout.mobile && layout.mobileShowDetail) {
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
          @if (threadListTotalCount > 0 && !layout.mobile) {
            <button type="button" class="btn btn-quiet inbox-filter-toggle d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" [class.active]="readFilter === InboxReadFilter.UNREAD"
                    (click)="toggleUnreadFilter()"
                    [tooltip]="readFilter === InboxReadFilter.UNREAD ? 'Showing unread only — click to show all' : 'Show unread only'">
              <fa-icon [icon]="faFilter"/>{{ readFilter === InboxReadFilter.UNREAD ? threadListUnreadCount + ' unread' : 'All' }}
            </button>
          }
          @if (threads.length > 0 && !layout.mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="toggleMessageSort()"
                    [tooltip]="messageSortDescending ? 'Showing newest first — click for oldest first' : 'Showing oldest first — click for newest first'">
              <fa-icon [icon]="messageSortDescending ? faArrowDownWideShort : faArrowUpWideShort"/>{{ messageSortDescending ? 'Newest' : 'Oldest' }}
            </button>
          }
          @if (!layout.mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="layout.toggleLayout()" [tooltip]="layout.stackedLayout ? 'Switch to side-by-side view' : 'Switch to stacked view'">
              <fa-icon [icon]="layout.stackedLayout ? faTableColumns : faTableList"/>
              {{ layout.stackedLayout ? 'Split' : 'Stacked' }}
            </button>
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="layout.toggleDensity()" [tooltip]="layout.compactList ? 'Switch to comfortable rows with subject and preview lines' : 'Switch to compact single-line rows'">
              <fa-icon [icon]="layout.compactList ? faTableList : faGripLines"/>
              {{ layout.compactList ? 'Roomy' : 'Compact' }}
            </button>
          }
          @if ((pushStatus$ | async); as pushStatus) {
            @if (pushStatus.supported && !layout.mobile) {
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
          @if (!layout.mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="syncAndRefresh()" [disabled]="busy" tooltip="Reload conversations and the open message, and fetch any new mail from connected mailboxes">
              <fa-icon [icon]="faRotateRight"/>Refresh
            </button>
          }
          @if (!layout.mobile) {
            <button class="btn btn-quiet d-flex align-items-center justify-content-center gap-1 text-nowrap flex-shrink-0" type="button" (click)="panel.toggle()" [tooltip]="panel.maximised ? panel.restoreTooltip : panel.maximiseTooltip">
              <fa-icon [icon]="panel.maximised ? faCompress : faExpand"/>{{ panel.maximised ? 'Restore' : 'Maximise' }}
            </button>
          }
          </div>
      </div>
      @if (layout.mobile && layout.mobileFiltersOpen && !layout.mobileShowDetail) {
        <div class="inbox-layout.mobile-filters">
          <button type="button" class="btn btn-quiet inbox-filter-toggle" [class.active]="readFilter === InboxReadFilter.UNREAD" (click)="toggleUnreadFilter()">
            <fa-icon [icon]="faFilter" class="me-1"/>{{readFilter === InboxReadFilter.UNREAD ? threadListUnreadCount + ' unread' : 'All'}}
          </button>
          <button type="button" class="btn btn-quiet" (click)="toggleMessageSort()">
            <fa-icon [icon]="messageSortDescending ? faArrowDownWideShort : faArrowUpWideShort" class="me-1"/>{{messageSortDescending ? 'Newest' : 'Oldest'}}
          </button>
          <button type="button" class="btn btn-quiet" (click)="layout.toggleDensity()">
            <fa-icon [icon]="layout.compactList ? faTableList : faGripLines" class="me-1"/>{{ layout.compactList ? 'Roomy' : 'Compact' }}
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
      <app-committee-unassigned-roles (reassigned)="refresh()"/>
      @if (!loadedOnce) {
        <div class="alert alert-warning inbox-alert d-flex align-items-center">
          <fa-icon [icon]="faRotateRight" [animation]="'spin'"/>
          <strong class="ms-2">Loading your inbox&hellip;</strong>
        </div>
      } @else if (aliases.length === 0) {
        <div class="alert alert-warning inbox-alert">
          <fa-icon [icon]="faTriangleExclamation"/>
          @if (configuredAliasCount > 0) {
            <strong class="ms-2">No mailboxes shared with you -</strong>
            <span class="ms-1">This site has {{ configuredAliasCount === 1 ? "a mailbox" : configuredAliasCount + " mailboxes" }} set up, but none is visible to you. You need to hold a committee role that receives mail, or have a mailbox shared with you under <a [routerLink]="['/' + committeeSettingsPath]">Committee Settings</a>. A role still pointing at a member who has since been deleted counts as unassigned.</span>
          } @else if (internalInbox) {
            <strong class="ms-2">No committee roles with addresses -</strong>
            <span class="ms-1">This site delivers mail straight to the inbox. Add committee roles with email addresses in <a [routerLink]="['/' + committeeSettingsPath]">Committee Settings</a> and they'll appear here automatically.</span>
          } @else {
            <strong class="ms-2">No role mailboxes connected -</strong>
            <span class="ms-1">An administrator can connect a mailbox in <a [routerLink]="['/' + mailSettingsPath]" [queryParams]="mailSettingsInboxQueryParams">Mail Settings &rarr; Inbox</a>, then point each committee role's Inbound Forwarding at it. Roles forwarding to a connected mailbox appear here automatically.</span>
          }
        </div>
      }
      <app-inbox-orphaned-threads (remapped)="refresh()"/>
      @if (selectedAlias(); as alias) {
        @if (loadedOnce && mailboxAlertVisible) {
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
        @if (!layout.mobile && !layout.navCollapsed && aliases.length > 0) {
          <app-thumbnail-heading-frame class="inbox-pane inbox-nav" heading="Folders" [fill]="true" [compact]="true" [style.flex]="'0 0 ' + layout.navSize + 'px'">
            <div class="inbox-nav-body">
            <ng-container [ngTemplateOutlet]="folderNavContent"/>
            </div>
          </app-thumbnail-heading-frame>
          <app-resizer [variant]="ResizerVariant.BAR"
                       [orientation]="ResizerOrientation.HORIZONTAL"
                       [size]="layout.navSize"
                       [minSize]="layout.minNavSize"
                       [maxSize]="layout.maxNavSize"
                       (sizeChange)="layout.onNavSizeChange($event)"
                       (resizeEnd)="layout.persistNavSize()"/>
        }
        @if (layout.mobile && layout.mobileNavOpen) {
          <div class="inbox-drawer-backdrop" (click)="layout.mobileNavOpen = false"></div>
          <div class="inbox-drawer" role="dialog" aria-label="Mail folders">
            <div class="inbox-drawer-header">
              <span class="inbox-toolbar-title">Mail</span>
              <button class="inbox-nav-toggle" type="button" aria-label="Close folders" (click)="layout.mobileNavOpen = false">
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
              <div class="inbox-nav-group">
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
                            [tooltip]="aliasLabel(alias)" placement="left" container="body" [adaptivePosition]="false"
                            (click)="selectMailboxView(alias.roleType)">
                      <fa-icon [icon]="faEnvelope" class="inbox-nav-node-icon"/>
                      <span class="inbox-nav-label">{{ aliasDisplayLabel(alias) }}</span>
                      @if (unreadForRole(alias.roleType) > 0) {
                        <span class="inbox-nav-count">{{ unreadForRole(alias.roleType) }}</span>
                      }
                    </button>
                  }
                }
              </div>
              <div class="inbox-nav-roots">
                <button class="inbox-nav-node" type="button" [class.active]="viewingSent"
                        (click)="selectMailboxView(InboxThreadFolder.SENT)">
                  <fa-icon [icon]="faPaperPlane" class="me-2"/><span class="inbox-nav-label">Sent</span>
                </button>
                <button class="inbox-nav-node" type="button" [class.active]="viewingDrafts"
                        (click)="selectMailboxView(InboxThreadFolder.DRAFTS)">
                  <fa-icon [icon]="faFileLines" class="me-2"/><span class="inbox-nav-label">Drafts</span>
                  @if (drafts.length > 0) {
                    <span class="inbox-nav-count">{{ drafts.length }}</span>
                  }
                </button>
                @if (canReadJunk) {
                  <button class="inbox-nav-node" type="button" [class.active]="viewingJunk"
                          (click)="selectMailboxView(InboxThreadFolder.JUNK)">
                    <fa-icon [icon]="faBan" class="me-2"/><span class="inbox-nav-label">Junk</span>
                  </button>
                }
                <button class="inbox-nav-node" type="button" [class.active]="viewingDeleted"
                        (click)="selectMailboxView(InboxThreadFolder.DELETED)">
                  <fa-icon [icon]="faTrash" class="me-2"/><span class="inbox-nav-label">Deleted</span>
                </button>
              </div>
            </div>
        </ng-template>
      <div #inboxLayout class="inbox-layout" [class.stacked]="layout.stackedLayout"
           [style.grid-template-columns]="viewingDrafts ? 'minmax(0, 1fr)' : layout.gridTemplateColumns"
           [style.grid-template-rows]="viewingDrafts ? 'minmax(0, 1fr)' : layout.gridTemplateRows">
        @if (!layout.mobile || !layout.mobileShowDetail) {
        <app-thumbnail-heading-frame class="inbox-pane" [heading]="conversationCountCaption" [fill]="true" [compact]="true" [class.inbox-list-flush]="layout.mobile">
          <div class="inbox-pane-body">
          <div class="p-2">
            <div class="d-flex align-items-center gap-2">
              <app-section-toggle small class="inbox-grouping-mode flex-shrink-0"
                [tabs]="groupingTabs"
                [selectedTab]="layout.groupingMode"
                [queryParamKey]="StoredValue.MAIL_GROUPING"
                (selectedTabChange)="onGroupingModeChange($event)"/>
              @if (!viewingDrafts && selectedConversationCount > 0) {
                <div class="btn-group flex-shrink-0" dropdown container="body" placement="bottom left" [isDisabled]="busy">
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
              }
              @if (threadListTotalCount > 0 || conversationSearchTerm) {
                <div class="input-group input-group-sm flex-grow-1 min-w-0">
                  <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                  <input type="text" class="form-control" [ngModel]="conversationSearchTerm"
                         (ngModelChange)="onConversationSearchChange($event)"
                         [disabled]="selectingAllConversations"
                         placeholder="Search conversations...">
                </div>
              }
            </div>
          </div>
          @if (!viewingDrafts && threads.length > 0 && !layout.compactList) {
            <div class="d-flex align-items-center gap-2 pe-2 pb-2 inbox-list-toolbar">
              <input type="checkbox" class="form-check-input mt-0"
                     aria-label="Select all visible conversations"
                     tooltip="Select all"
                     placement="top"
                     container="body"
                     [adaptivePosition]="false"
                     [checked]="allSelected()"
                     [indeterminate]="selectedConversationCount > 0 && !allSelected()"
                     (change)="toggleSelectAll()">
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
          <div class="inbox-thread-list" [class.inbox-list-compact]="layout.compactList" [class.inbox-list-drag-selecting]="dragSelectActive" tabindex="0" (keydown)="onThreadListKeydown($event)" (scroll)="rememberListPosition($event)"
               (mousedown)="onThreadListMouseDown($event)" (mousemove)="onThreadListMouseMove($event)" (mouseup)="onThreadListMouseUp()"
               [style.--inbox-from]="layout.columnShare.from + 'fr'"
               [style.--inbox-to]="layout.columnShare.to + 'fr'"
               [style.--inbox-subject]="layout.columnShare.subject + 'fr'"
               [style.--inbox-date]="layout.columnShare.date + 'fr'">
          @if (layout.compactList && !viewingDrafts) {
            <div class="inbox-column-head inbox-column-tracks">
              <input type="checkbox" class="form-check-input m-0"
                     aria-label="Select all visible conversations"
                     tooltip="Select all"
                     placement="top"
                     container="body"
                     [adaptivePosition]="false"
                     [checked]="allSelected()"
                     [indeterminate]="selectedConversationCount > 0 && !allSelected()"
                     (change)="toggleSelectAll()">
              <span class="inbox-column-label"><span class="inbox-column-text">From</span><button type="button" class="inbox-col-resize" aria-label="Resize From" (pointerdown)="layout.startColumnResize($event, InboxColumnResizeEdge.FROM)"></button></span>
              <span class="inbox-column-label"><span class="inbox-column-text">To</span><button type="button" class="inbox-col-resize" aria-label="Resize To" (pointerdown)="layout.startColumnResize($event, InboxColumnResizeEdge.TO)"></button></span>
              <span class="inbox-column-label"><span class="inbox-column-text">Subject</span><button type="button" class="inbox-col-resize" aria-label="Resize Subject" (pointerdown)="layout.startColumnResize($event, InboxColumnResizeEdge.SUBJECT)"></button></span>
              <span class="inbox-column-label">Date</span>
            </div>
          }
          @if (viewingDrafts) {
            <app-email-composition-list [showActions]="false" [embedded]="true" [records]="drafts" [searchTerm]="conversationSearchTerm" [busy]="busy"
                                        (open)="openDraft($event)" (deleted)="loadDrafts()"/>
          } @else if (threadListTotalCount === 0) {
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
          @for (thread of filteredThreads; track threadRowKey(thread); let threadIndex = $index) {
            <div class="inbox-thread-row"
                 [class.inbox-column-tracks]="layout.compactList"
                 [class.d-flex]="!layout.compactList"
                 [class.align-items-center]="!layout.compactList"
                 [class.gap-2]="!layout.compactList"
                 [class.active]="threadRowActive(thread)"
                 [class.unread]="conversationUnread(thread)"
                 [attr.data-thread-id]="threadRowKey(thread)"
                 [attr.data-thread-index]="threadIndex"
                 (touchstart)="startThreadSwipe($event)"
                 (touchend)="finishThreadSwipe($event, thread)"
                 (click)="selectThread(thread)">
              @if (layout.compactList) {
                <input type="checkbox" class="form-check-input m-0"
                       [checked]="conversationSelected(thread)"
                       (click)="$event.stopPropagation(); toggleThreadSelection(thread)">
                <div class="inbox-thread-from text-truncate">{{ viewingSent ? sentPartyLabel(thread, true) : (threadRowFrom(thread) || 'No external address') }}</div>
                <div class="inbox-thread-recipient text-truncate">{{ viewingSent ? sentPartyLabel(thread, false) : (threadRowTo(thread) || '') }}</div>
                <div class="inbox-thread-subject text-truncate">{{thread.subject || thread.normalisedSubject || "(no subject)"}}</div>
                <div class="inbox-thread-time">{{(viewingSent ? thread.lastOutboundAt || thread.lastSeenAt : thread.lastSeenAt) | date: UIDateFormat.MONTH_DAY_YEAR_ABBREVIATED_TIME_WITH_SECONDS}}</div>
              } @else {
                <input type="checkbox" class="form-check-input flex-shrink-0 m-0"
                       [checked]="conversationSelected(thread)"
                       (click)="$event.stopPropagation(); toggleThreadSelection(thread)">
                <div class="flex-grow-1 min-w-0">
                  <div class="d-flex align-items-center gap-2">
                    @if (conversationUnread(thread)) {
                      <span class="inbox-unread-dot flex-shrink-0" aria-label="Unread"></span>
                    }
                    <div class="inbox-thread-from flex-grow-1 text-truncate">{{ viewingSent ? sentPartyLabel(thread, true) : (threadRowFrom(thread) || 'No external address') }}</div>
                    <div class="inbox-thread-time flex-shrink-0">{{(viewingSent ? thread.lastOutboundAt || thread.lastSeenAt : thread.lastSeenAt) | date: UIDateFormat.MONTH_DAY_YEAR_ABBREVIATED_TIME_WITH_SECONDS}}</div>
                  </div>
                  <div class="inbox-thread-subject">{{thread.subject || thread.normalisedSubject || "(no subject)"}}</div>
                  <div class="inbox-thread-preview">{{inboxThreadRowPreview(thread)}} · Swipe right to {{conversationUnread(thread) ? 'mark read' : 'mark unread'}}, left to delete</div>
                  @if (viewingSent ? sentPartyLabel(thread, false) : threadRowTo(thread); as toLabel) {
                    <div class="inbox-thread-recipient text-truncate">to {{ toLabel }}</div>
                  }
                </div>
              }
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
        </app-thumbnail-heading-frame>
        }
        @if (!layout.mobile && !viewingDrafts) {
          <app-resizer [variant]="ResizerVariant.BAR"
                       [orientation]="layout.stackedLayout ? ResizerOrientation.VERTICAL : ResizerOrientation.HORIZONTAL"
                       [size]="layout.listSize"
                       [minSize]="layout.minListSize"
                       [maxSize]="layout.maxListSize"
                       (sizeChange)="layout.onListSizeChange($event)"
                       (resizeEnd)="layout.persistListSize()"/>
        }
        @if (!viewingDrafts && (!layout.mobile || layout.mobileShowDetail)) {
        <div class="thumbnail-heading-frame-compact inbox-pane inbox-pane-messages">
          @if (selectedThread) {
            <div class="d-flex align-items-start gap-2 mb-3 inbox-detail-header" [class.compact]="layout.compactDetailHeader">
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
          @if (viewingDrafts) {
            <div class="text-muted">Drafts open in the email composer. Choose one on the left to carry on where you left off.</div>
          } @else if (!selectedThread) {
            <div class="text-muted">Select a conversation to read it.</div>
          } @else if (loadingThread) {
            <div class="text-muted">Loading conversation...</div>
          } @else {
            @for (message of displayMessages; track message.messageId) {
              <app-inbox-message [message]="message" [busy]="busy" [initiallyExpanded]="message.messageId === initiallyExpandedMessageId"
                                 (reply)="prepareReply($event)" (replyAll)="prepareReplyAll($event)" (forward)="prepareForward($event)"/>
            }
          }
          </div>
          @if (layout.mobile && latestActionMessage(); as actionMessage) {
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
    </app-page>
  `
})
export class InboxComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly UIDateFormat = UIDateFormat;

  private logger: Logger = inject(LoggerFactory).createLogger("InboxComponent", NgxLoggerLevel.ERROR);
  protected layout = inject(InboxLayoutService);
  private inboxService = inject(InboxService);
  private messageRendering = inject(InboxMessageRenderingService);
  private conversations = inject(InboxConversationsService);
  private inboxReplyHandoff = inject(InboxReplyHandoffService);
  private pushSubscriptionService = inject(InboxPushSubscriptionService);
  private inboxNotificationService = inject(InboxNotificationService);
  protected readonly mailSettingsPath = AdminPath.MAIL_SETTINGS;
  protected readonly committeeSettingsPath = AdminSettingsPath.COMMITTEE_SETTINGS;
  protected readonly mailSettingsInboxQueryParams = {[StoredValue.TAB]: kebabCase(MailSettingsTab.GMAIL_INBOX)};
  protected configuredAliasCount = 0;
  protected readonly pushStatus$ = this.pushSubscriptionService.status$;
  protected readonly faBell = faBell;
  protected readonly faBellSlash = faBellSlash;
  private webSocketClientService = inject(WebSocketClientService);
  private systemConfigService = inject(SystemConfigService);
  private committeeConfigService = inject(CommitteeConfigService);
  private committeeReferenceData: CommitteeReferenceData | null = null;
  protected internalInbox = false;
  private notifierService = inject(NotifierService);
  protected stringUtils = inject(StringUtilsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private urlService = inject(UrlService);
  protected readonly faInbox = faInbox;
  protected readonly faBars = faBars;
  protected readonly faBan = faBan;
  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faFileLines = faFileLines;
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
  protected readonly InboxColumnResizeEdge = InboxColumnResizeEdge;
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
  private cachedFilteredThreads: InboxThread[] = [];
  private filteredThreadsDirty = true;

  private clearSelectedMessages(): void {
    this.selectedMessages = [];
    this.initiallyExpandedMessageId = null;
    this.rebuildDisplayMessages();
  }

  private rebuildDisplayMessages(): void {
    this.displayMessages = [...this.selectedMessages].sort((left, right) => {
      const leftAt = left.receivedAt ?? left.sentAt ?? 0;
      const rightAt = right.receivedAt ?? right.sentAt ?? 0;
      return this.messageSortDescending ? rightAt - leftAt : leftAt - rightAt;
    });
    this.messageRendering.prepare(this.displayMessages);
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
    return this.layout.mobile && this.layout.mobileShowDetail;
  }

  private matchingThread(threads: InboxThread[], slugOrId: string): InboxThread | null {
    return threads.find(thread => this.threadSlug(thread) === slugOrId || this.threadIdOf(thread) === slugOrId) ?? null;
  }

  private async threadRequestedInUrl(): Promise<InboxThread | null> {
    const requestedSlug = this.route.snapshot.queryParams[StoredValue.THREAD];
    if (!requestedSlug) {
      return null;
    } else {
      const alreadyLoaded = this.matchingThread(this.threads, requestedSlug);
      if (alreadyLoaded) {
        return alreadyLoaded;
      } else {
        try {
          const response = await this.inboxService.getThread(requestedSlug, this.aliases.find(alias => alias.roleType === this.selectedMailboxView)?.roleType ?? null);
          const requested = response.thread;
          if (!this.threadBelongsToCurrentView(requested) && this.route.snapshot.queryParams[StoredValue.MAILBOX_VIEW]) {
            return null;
          } else {
            if (!this.threadBelongsToCurrentView(requested)) {
              this.selectedMailboxView = this.viewForThread(requested);
              this.filteredThreadsDirty = true;
            }
            if (this.threadBelongsToCurrentView(requested) && !this.matchingThread(this.threads, this.threadIdOf(requested))) {
              this.threads = [requested, ...this.threads];
            }
            return this.threadBelongsToCurrentView(requested) ? requested : null;
          }
        } catch (error) {
          this.logger.error("Failed to open thread from URL:", error);
          return null;
        }
      }
    }
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

  private viewForThread(thread: InboxThread): string {
    const folder = thread?.folder;
    if (folder === InboxThreadFolder.DELETED || folder === InboxThreadFolder.JUNK || folder === InboxThreadFolder.SENT || folder === InboxThreadFolder.DRAFTS) {
      return folder;
    } else {
      const alias = this.aliases.find(candidate => candidate.roleType === thread.roleType);
      return alias ? alias.roleType : InboxViewScope.ALL_ACCESSIBLE;
    }
  }

  private threadBelongsToCurrentView(thread: InboxThread): boolean {
    const folder = thread?.folder;
    if (folder === InboxThreadFolder.DELETED) {
      return this.viewingDeleted;
    } else if (folder === InboxThreadFolder.JUNK) {
      return this.viewingJunk;
    } else if (folder === InboxThreadFolder.SENT) {
      return this.viewingSent;
    } else if (folder === InboxThreadFolder.DRAFTS) {
      return this.viewingDrafts;
    } else if (this.viewingDeleted || this.viewingJunk || this.viewingSent || this.viewingDrafts) {
      return false;
    } else {
      const roleType = this.selectedRoleType();
      if (roleType) {
        return thread.roleType === roleType;
      } else if (this.selectedMailboxView === InboxViewScope.ASSIGNED_ROLES) {
        return this.aliases.some(alias => alias.roleType === thread.roleType && !isInboxGeneralRoleType(alias.roleType));
      } else {
        return true;
      }
    }
  }

  get viewingSent(): boolean {
    return this.selectedMailboxView === InboxThreadFolder.SENT;
  }

  get viewingDrafts(): boolean {
    return this.selectedMailboxView === InboxThreadFolder.DRAFTS;
  }

  openDraft(draft: EmailCompositionSummary): void {
    void this.router.navigate(["/" + AdminPath.EMAIL_COMPOSER], {queryParams: {[StoredValue.DRAFT_ID]: draft.id}});
  }

  protected async loadDrafts(): Promise<void> {
    try {
      this.drafts = (await this.emailCompositionsService.listSummaries(EmailCompositionStatus.Draft)).sort((first, second) => second.savedAt - first.savedAt);
    } catch (error) {
      this.logger.warn("loadDrafts failed", error);
      this.drafts = [];
    }
  }

  get inboxNodeActive(): boolean {
    return this.selectedMailboxView === InboxViewScope.ALL_ACCESSIBLE;
  }

  selectMailboxView(view: string): void {
    if (view !== this.selectedMailboxView) {
      this.clearThreadSelection();
    }
    this.selectedMailboxView = view;
    this.layout.mobileNavOpen = false;
    if (this.layout.mobile) {
      this.layout.mobileShowDetail = false;
    }
    void this.roleMailboxChanged();
  }

  showMailboxAlert(): void {
    this.mailboxAlertVisible = true;
    if (this.mailboxAlertTimer) {
      clearTimeout(this.mailboxAlertTimer);
      this.mailboxAlertTimer = null;
    }
    if (this.layout.mobile) {
      this.mailboxAlertTimer = setTimeout(() => {
        this.mailboxAlertVisible = false;
        this.mailboxAlertTimer = null;
        this.layout.scheduleFitShellToWindow();
      }, 4000);
    }
    this.layout.scheduleFitShellToWindow();
  }

  dismissMailboxAlert(): void {
    this.mailboxAlertVisible = false;
    if (this.mailboxAlertTimer) {
      clearTimeout(this.mailboxAlertTimer);
      this.mailboxAlertTimer = null;
    }
    this.layout.scheduleFitShellToWindow();
  }

  public aliases: InboxAliasConfigView[] = [];
  public canReadJunk = false;
  private _threads: InboxThread[] = [];
  public get threads(): InboxThread[] {
    return this._threads;
  }
  public set threads(value: InboxThread[]) {
    this._threads = value ?? [];
    this.conversations.index(this._threads);
    this.invalidateFilteredThreads();
  }
  public conversationSearchTerm = "";
  public readFilter: InboxReadFilter = InboxReadFilter.ALL;
  public selectedThreadIds = new Set<string>();
  private keyboardSelectionAnchorIndex: number | null = null;
  public threadListUnreadCount = 0;
  public threadListTotalCount = 0;
  public drafts: EmailCompositionSummary[] = [];
  private emailCompositionsService = inject(EmailCompositionsService);
  private memberLoginService = inject(MemberLoginService);
  public selectedThread: InboxThread | null = null;
  public selectedThreadId: string | null = null;
  protected initiallyExpandedMessageId: string | null = null;
  public selectedMessages: InboxMessage[] = [];
  public loadingThread = false;
  public selectedMailboxView: string = InboxViewScope.ALL_ACCESSIBLE;
  public busy = false;
  public deletingSelected = false;
  public selectingAllConversations = false;
  public allAvailableSelected = false;
  public loadedOnce = false;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public pendingDelete: InboxPendingDelete | null = null;
  public mailboxLabelMode: InboxMailboxLabelMode = InboxMailboxLabelMode.ROLE;
  public mailboxAlertVisible = true;
  private mailboxAlertTimer: ReturnType<typeof setTimeout> | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  public sentFocusMessageId: string | null = null;
  public unreadTotal = 0;
  public unreadByRole = new Map<string, number>();
  public inboxNodeExpanded = true;
  @ViewChild("inboxLayout") set inboxLayout(ref: ElementRef<HTMLElement> | null) {
    this.layout.attachLayout(ref);
    this.layout.observeLayoutSize();
  }

  @ViewChild("inboxShell") set inboxShell(ref: ElementRef<HTMLElement> | null) {
    this.layout.attachShell(ref);
    this.layout.observeLayoutSize();
    this.layout.scheduleFitShellToWindow();
  }

  @ViewChild("panel") set panel(ref: MaximisablePanelComponent | null) {
    this.layout.panel = ref;
  }
  private static readonly DELETE_UNDO_MS = 6000;
  private static readonly THREAD_PAGE_SIZE = 50;
  private static readonly SWIPE_THRESHOLD_PX = 72;
  private listScrollTop = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private suppressThreadClick = false;
  private dragSelectAnchorIndex: number | null = null;
  protected dragSelectActive = false;
  private dragSelectStartY = 0;
  private dragSelectAdditive = false;
  private static readonly DRAG_SELECT_THRESHOLD_PX = 12;

  private subscriptions: Subscription[] = [];
  private openThreadRequestId = 0;
  private mailboxViewInitialised = false;

  @HostListener("window:resize")
  onResize(): void {
    this.layout.updateMobile();
    this.layout.fitShellToWindow();
  }

  @HostListener("window:keydown", ["$event"])
  onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.selectedThreadIds.size > 0) {
      event.preventDefault();
      this.clearThreadSelection();
    }
  }

  @HostListener("window:mouseup")
  onWindowMouseUp(): void {
    this.onThreadListMouseUp();
  }

  async ngOnInit(): Promise<void> {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(config =>
      this.internalInbox = config?.inbox?.provider === InboxReaderProvider.CLOUDFLARE_INGRESS));
    this.subscriptions.push(this.inboxNotificationService.total$.subscribe(total => this.unreadTotal = total));
    this.subscriptions.push(this.committeeConfigService.committeeReferenceDataEvents().subscribe(data => this.committeeReferenceData = data));
    this.subscriptions.push(this.inboxNotificationService.breakdown$.subscribe(rows =>
      this.unreadByRole = new Map(rows.map(row => [row.roleType, row.unreadCount]))));
    this.layout.updateMobile();
    this.layout.restoreLayout();
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

    if (this.mailboxAlertTimer) {
      clearTimeout(this.mailboxAlertTimer);
    }
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.dismissPendingDelete();
  }

  selectThread(thread: InboxThread): void {
    if (this.suppressThreadClick) {
      this.suppressThreadClick = false;
      return;
    }
    if (this.layout.mobile) {
      this.layout.mobileShowDetail = true;
      this.layout.mobileFiltersOpen = false;
      this.layout.compactDetailHeader = false;
    }
    this.selectedThreadIds.clear();
    this.allAvailableSelected = false;
    this.selectedThreadIds.add(this.threadRowKey(thread));
    this.keyboardSelectionAnchorIndex = this.filteredThreads.findIndex(candidate => this.threadRowKey(candidate) === this.threadRowKey(thread));
    void this.openThread(thread);
  }

  backToList(): void {
    this.layout.mobileShowDetail = false;
    this.layout.compactDetailHeader = false;
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
    this.layout.compactDetailHeader = this.layout.mobile && (event.target as HTMLElement).scrollTop > 32;
  }

  private currentConversationIndex(): number {
    return this.filteredThreads.findIndex(thread => this.threadRowActive(thread));
  }

  hasAdjacentConversation(offset: number): boolean {
    const index = this.currentConversationIndex();
    return index >= 0 && Boolean(this.filteredThreads[index + offset]);
  }

  openAdjacentConversation(offset: number): void {
    const thread = this.filteredThreads[this.currentConversationIndex() + offset];
    if (thread) {
      this.layout.compactDetailHeader = false;
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
      this.layout.compactDetailHeader = false;
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

  onThreadListMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (event.button === 0 && !target.closest("input, button, a")) {
      const index = this.threadIndexAtPoint(event.clientX, event.clientY);
      this.dragSelectAnchorIndex = index >= 0 ? index : null;
      this.dragSelectActive = false;
      this.dragSelectStartY = event.clientY;
      this.dragSelectAdditive = event.shiftKey;
    }
  }

  onThreadListMouseMove(event: MouseEvent): void {
    if (this.dragSelectAnchorIndex !== null && (event.buttons & 1) === 1) {
      const index = this.threadIndexAtPoint(event.clientX, event.clientY);
      if (!this.dragSelectActive
        && index >= 0
        && index !== this.dragSelectAnchorIndex
        && Math.abs(event.clientY - this.dragSelectStartY) >= InboxComponent.DRAG_SELECT_THRESHOLD_PX) {
        this.dragSelectActive = true;
        this.suppressThreadClick = true;
      }
      if (this.dragSelectActive && index >= 0) {
        this.keyboardSelectionAnchorIndex = this.dragSelectAnchorIndex;
        this.applyDragSelection(this.dragSelectAnchorIndex, index);
      }
    }
  }

  private threadIndexAtPoint(clientX: number, clientY: number): number {
    const hit = document.elementFromPoint(clientX, clientY);
    const row = hit instanceof Element ? hit.closest(".inbox-thread-row") : null;
    const raw = row?.getAttribute("data-thread-index");
    const index = raw ? Number(raw) : -1;
    return Number.isFinite(index) ? index : -1;
  }

  onThreadListMouseUp(): void {
    if (this.dragSelectActive) {
      setTimeout(() => this.suppressThreadClick = false, 0);
    }
    this.dragSelectAnchorIndex = null;
    this.dragSelectActive = false;
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

  ngAfterViewInit(): void {
    this.layout.observeLayoutSize();
    this.layout.scheduleFitShellToWindow();
  }

  async refresh(reloadAccess = true): Promise<void> {
    this.busy = true;
    try {
      if (reloadAccess || this.aliases.length === 0) {
        const [aliasSummary, canReadJunk] = await Promise.all([this.inboxService.aliasSummary(), this.inboxService.junkAccessible()]);
        this.aliases = aliasSummary.aliases;
        this.configuredAliasCount = aliasSummary.configuredAliasCount;
        this.canReadJunk = canReadJunk;
      }
      if (!this.mailboxViewInitialised) {
        this.applyMailboxViewFromUrl();
        this.applyReadFilterFromUrl();
        this.applyConversationSearchFromUrl();
        this.mailboxViewInitialised = true;
      }
      void this.loadDrafts();
      if (this.viewingDrafts) {
        this.threads = [];
        this.threadListUnreadCount = 0;
        this.threadListTotalCount = 0;
        this.selectedThread = null;
        this.selectedThreadId = null;
      } else if (this.viewingJunk && this.canReadJunk) {
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
          && this.selectedMailboxView !== InboxThreadFolder.DRAFTS
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
        const requestedThread = await this.threadRequestedInUrl();
        if (this.layout.mobile && !this.selectedThreadId && requestedThread) {
          this.layout.mobileShowDetail = true;
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
    const updated = selectedId ? this.matchingThread(this.threads, selectedId) : null;
    const fallbackInView = fallback && this.matchingThread(this.threads, this.threadIdOf(fallback))
      ? this.matchingThread(this.threads, this.threadIdOf(fallback))
      : null;
    if (updated) {
      await this.openThread(updated, false);
    } else if (fallbackInView) {
      await this.openThread(fallbackInView, false);
    } else if (this.threads.length > 0) {
      await this.openThread(this.threads[0], false);
    } else {
      this.selectedThread = null;
      this.selectedThreadId = null;
      this.clearSelectedMessages();
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
      return alias.assignedMemberName || this.roleLabel(alias.roleType);
    } else {
      return this.roleLabel(alias.roleType);
    }
  }

  private roleLabel(roleType: string): string {
    return this.committeeReferenceData?.description(roleType) || this.stringUtils.asTitle(roleType);
  }

  onMailboxLabelModeChange(mode: InboxMailboxLabelMode): void {
    this.mailboxLabelMode = mode;
  }

  onGroupingModeChange(mode: InboxGroupingMode): void {
    this.layout.changeGrouping(mode);
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
      queryParams: {
        [StoredValue.MAILBOX_VIEW]: this.mailboxViewParam(),
        [StoredValue.THREAD]: null
      },
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
    } else if (hiddenInboxFolders().concat(InboxThreadFolder.SENT, InboxThreadFolder.DRAFTS).includes(param as InboxThreadFolder)) {
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
    if (this.selectedThread) {
      return this.threadRowKey(thread) === this.threadRowKey(this.selectedThread);
    } else {
      return this.threadIdOf(thread) === this.selectedThreadId
        && (!this.viewingSent || (thread.sentMessageId ?? null) === this.sentFocusMessageId);
    }
  }

  siblingConversationThreads(thread: InboxThread): InboxThread[] {
    return this.conversations.siblingConversationThreads(thread);
  }



  private invalidateFilteredThreads(): void {
    this.filteredThreadsDirty = true;
  }

  private representativeThread(threads: InboxThread[]): InboxThread {
    return this.conversations.representativeThread(threads);
  }

  private conversationRepresentatives(threads: InboxThread[]): InboxThread[] {
    return this.conversations.conversationRepresentatives(threads, this.layout.groupingMode, this.viewingSent);
  }

  conversationUnread(thread: InboxThread): boolean {
    return this.siblingConversationThreads(thread).some(candidate => candidate.unread);
  }

  conversationSelected(thread: InboxThread): boolean {
    return this.selectedThreadIds.has(this.threadRowKey(thread));
  }

  get conversationCountCaption(): string {
    const shown = this.filteredThreads.length;
    const unreadOnly = this.readFilter === InboxReadFilter.UNREAD;
    const groupingNoun = this.layout.groupingMode === InboxGroupingMode.MESSAGES ? "message" : "conversation";
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
    const key = this.threadRowKey(thread);
    if (this.selectedThreadIds.has(key)) {
      this.selectedThreadIds.delete(key);
    } else {
      this.selectedThreadIds.add(key);
    }
  }

  allSelected(): boolean {
    return this.filteredThreads.length > 0 && this.filteredThreads.every(thread => this.conversationSelected(thread));
  }

  get selectedConversationCount(): number {
    return this.filteredThreads.filter(thread => this.conversationSelected(thread)).length;
  }

  private selectedActionIds(): string[] {
    return [...new Set(this.filteredThreads
      .filter(thread => this.selectedThreadIds.has(this.threadRowKey(thread)))
      .map(thread => this.threadIdOf(thread)))];
  }

  toggleSelectAll(): void {
    this.allAvailableSelected = false;
    const keys = this.filteredThreads.map(thread => this.threadRowKey(thread));
    if (this.allSelected()) {
      keys.forEach(key => this.selectedThreadIds.delete(key));
    } else {
      keys.forEach(key => this.selectedThreadIds.add(key));
    }
  }

  async selectAllAvailableConversations(): Promise<void> {
    this.selectingAllConversations = true;
    this.busy = true;
    try {
      await this.loadEveryRemainingConversation();
      this.filteredThreads
        .map(thread => this.threadRowKey(thread))
        .forEach(key => this.selectedThreadIds.add(key));
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
    const ids = this.selectedActionIds();
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
        this.syncThreadToUrl(null);
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
    const ids = this.selectedActionIds();
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
    const ids = this.selectedActionIds();
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
    const ids = this.selectedActionIds();
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
      this.layout.mobileShowDetail = false;
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
    this.dismissPendingDelete();
    const threadId = this.threadIdOf(thread);
    const list = this.filteredThreads;
    const currentIndex = this.currentConversationIndex();
    const nextThread = list[currentIndex + 1] ?? list[currentIndex - 1] ?? null;
    const insertionIndex = this.threads.findIndex(candidate => this.threadIdOf(candidate) === threadId);
    const removedThreads = this.threads.filter(candidate => this.threadIdOf(candidate) === threadId);
    const wasUnread = this.conversationUnread(thread);
    this.threads = this.threads.filter(candidate => this.threadIdOf(candidate) !== threadId);
    this.threadListTotalCount = Math.max(0, this.threadListTotalCount - 1);
    if (wasUnread) {
      this.threadListUnreadCount = Math.max(0, this.threadListUnreadCount - 1);
    }
    this.selectedThreadIds.delete(this.threadRowKey(thread));
    this.selectedThread = nextThread;
    this.selectedThreadId = nextThread ? this.threadIdOf(nextThread) : null;
    this.clearSelectedMessages();
    const permanent = this.viewingDeleted;
    try {
      await this.inboxService.deleteThread(threadId);
      if (permanent) {
        this.notify.success({title: "Inbox", message: "Conversation permanently deleted"});
      } else {
        this.pendingDelete = {
          threadId,
          removedThreads,
          insertionIndex,
          selectedThread: thread,
          timer: setTimeout(() => this.dismissPendingDelete(), InboxComponent.DELETE_UNDO_MS)
        };
      }
      if (nextThread) {
        await this.openThread(nextThread);
      } else {
        this.layout.mobileShowDetail = false;
        this.syncThreadToUrl(null);
      }
    } catch (error) {
      this.restoreRemovedThreads(removedThreads, insertionIndex, thread);
      this.notify.error({title: "Delete", message: (error as Error).message});
      this.logger.error("Failed to delete conversation:", error);
    }
  }

  private restoreRemovedThreads(removedThreads: InboxThread[], insertionIndex: number, selectedThread: InboxThread | null): void {
    const index = Math.max(0, insertionIndex);
    this.threads = [...this.threads.slice(0, index), ...removedThreads, ...this.threads.slice(index)];
    this.threadListTotalCount += 1;
    if (selectedThread && this.conversationUnread(selectedThread)) {
      this.threadListUnreadCount += 1;
    }
  }

  private dismissPendingDelete(): void {
    if (this.pendingDelete) {
      clearTimeout(this.pendingDelete.timer);
      this.pendingDelete = null;
    }
  }

  async undoPendingDelete(): Promise<void> {
    const pending = this.pendingDelete;
    if (!pending) {
      return;
    }
    this.dismissPendingDelete();
    try {
      await this.inboxService.restoreThread(pending.threadId);
      this.restoreRemovedThreads(pending.removedThreads, pending.insertionIndex, pending.selectedThread);
      if (pending.selectedThread) {
        this.layout.mobileShowDetail = this.layout.mobile;
        void this.openThread(pending.selectedThread, false);
      }
    } catch (error) {
      this.notify.error({title: "Undo", message: (error as Error).message});
      this.logger.error("Failed to restore conversation:", error);
    }
  }

  threadSlug(thread: InboxThread): string {
    const sanitised = (thread.normalisedSubject || "").replace(/\p{Extended_Pictographic}/gu, "");
    return kebabCase(sanitised) || String(thread.firstSeenAt ?? thread.lastSeenAt ?? "");
  }

  private syncThreadToUrl(thread: InboxThread | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.THREAD]: thread ? this.threadIdOf(thread) : null},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  onThreadListKeydown(event: KeyboardEvent): void {
    if (event.key === "Delete" || event.key === "Backspace") {
      if (this.selectedThreadIds.size > 0) {
        event.preventDefault();
        void this.deleteSelected();
      } else if (this.selectedThreadId) {
        event.preventDefault();
        void this.deleteFocusedThread(event.currentTarget as HTMLElement);
      }
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const list = this.filteredThreads;
      if (list.length > 0) {
        event.preventDefault();
        const currentIndex = this.currentConversationIndex();
        const nextIndex = currentIndex === -1
          ? (event.key === "ArrowDown" ? 0 : list.length - 1)
          : Math.min(list.length - 1, Math.max(0, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
        const nextThread = list[nextIndex];
        if (event.shiftKey) {
          const anchor = this.keyboardSelectionAnchorIndex ?? Math.max(0, currentIndex);
          this.keyboardSelectionAnchorIndex = anchor;
          this.selectThreadRange(anchor, nextIndex);
        } else {
          this.keyboardSelectionAnchorIndex = nextIndex;
        }
        if (nextThread && (currentIndex === -1 || this.threadRowKey(nextThread) !== this.threadRowKey(list[currentIndex]))) {
          const listElement = event.currentTarget as HTMLElement;
          void this.openThread(nextThread).then(() => this.scrollThreadRowIntoView(listElement, this.threadRowKey(nextThread)));
        }
      }
    }
  }

  private clearThreadSelection(): void {
    this.selectedThreadIds.clear();
    this.allAvailableSelected = false;
    this.keyboardSelectionAnchorIndex = this.currentConversationIndex();
  }

  private applyDragSelection(fromIndex: number, toIndex: number): void {
    if (!this.dragSelectAdditive) {
      this.selectedThreadIds.clear();
    }
    this.selectThreadRange(fromIndex, toIndex);
  }

  private selectThreadRange(fromIndex: number, toIndex: number): void {
    this.allAvailableSelected = false;
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    this.filteredThreads.slice(start, end + 1).forEach(thread => {
      this.selectedThreadIds.add(this.threadRowKey(thread));
    });
  }

  private scrollThreadRowIntoView(listElement: HTMLElement, threadId: string): void {
    listElement.querySelector(`[data-thread-id="${CSS.escape(threadId)}"]`)?.scrollIntoView({block: "nearest"});
  }

  private async deleteFocusedThread(listElement: HTMLElement): Promise<void> {
    const threadId = this.selectedThreadId;
    if (!threadId) {
      return;
    }
    const list = this.filteredThreads;
    const currentIndex = this.currentConversationIndex();
    const nextThread = list[currentIndex + 1] ?? list[currentIndex - 1] ?? null;
    const focused = this.selectedThread;
    this.busy = true;
    try {
      await this.inboxService.deleteThread(threadId);
      if (focused) {
        this.selectedThreadIds.delete(this.threadRowKey(focused));
      }
      this.selectedThreadId = nextThread ? this.threadIdOf(nextThread) : null;
      this.selectedThread = nextThread;
      this.clearSelectedMessages();
      this.syncThreadToUrl(nextThread);
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
    const keepOpenedRow = this.viewingSent || this.layout.groupingMode === InboxGroupingMode.MESSAGES;
    const representative = keepOpenedRow ? thread : this.representativeThread(siblings);
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
      this.initiallyExpandedMessageId = focusMessage?.messageId ?? null;
      this.loadingThread = false;
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
          [StoredValue.THREAD]: this.threadIdOf(this.selectedThread),
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
    return formatInboxAddress(address);
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



  recipientForThread(thread: InboxThread): InboxAddress | null {
    const alias = this.aliases.find(candidate => candidate.roleType === thread.roleType);
    if (alias && !isInboxGeneralRoleType(alias.roleType)) {
      return {
        name: thread.deliveredTo?.name || alias.assignedMemberName || this.roleLabel(alias.roleType),
        email: thread.deliveredTo?.email || alias.roleEmail
      };
    } else if (thread.deliveredTo?.email) {
      return thread.deliveredTo;
    } else {
      return null;
    }
  }

  roleLineForThread(thread: InboxThread): string | null {
    return inboxThreadRoleLine(thread, this.recipientForThread(thread));
  }

  threadRowFrom(thread: InboxThread): string | null {
    return inboxThreadRowFrom(thread);
  }

  inboxThreadRowPreview = inboxThreadRowPreview;

  sentPartyLabel(thread: InboxThread, from: boolean): string {
    const address = from ? thread.sentFrom : thread.externalAddress;
    return addressLabel(address) || (from ? this.sentFromLabel(thread) : "Unknown recipient");
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

  selectedThreadRecipient(): string | null {
    if (!this.selectedThread) {
      return null;
    }
    const firstInbound = this.selectedMessages.find(message => message.direction === InboxMessageDirection.INBOUND);
    const deliveredTo = firstInbound?.to?.length ? this.formatAddresses(firstInbound.to) : null;
    if (deliveredTo) {
      return deliveredTo;
    }
    const aliasAddress = this.recipientForThread(this.selectedThread);
    return aliasAddress
      ? this.formatAddress(aliasAddress)
      : isInboxGeneralRoleType(this.selectedThread.roleType) ? "Other inbox mail" : null;
  }



  private async handleNewMessageEvent(event: InboxNewMessageEvent): Promise<void> {
    this.logger.info("Inbox websocket event:", event);
    await this.refresh(false);
  }
}
