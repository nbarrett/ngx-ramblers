import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { faArrowsRotate, faAward, faChevronDown, faChevronUp, faCircleExclamation, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { forkJoin } from "rxjs";
import { uniq, values } from "es-toolkit/compat";
import { PageComponent } from "../../../page/page.component";
import { Member } from "../../../models/member.model";
import {
  VolunteerAssignment,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentEditorContext,
  VolunteerAssignmentEditorSave,
  VolunteerAssignmentStatusFilter,
  VolunteerManagementSnapshot,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerParishSortField,
  VolunteerParishTableRow,
  VolunteerRoleType,
  VolunteerSummaryFilter,
  VolunteerAssignmentBulkRequest,
  VolunteerSupporterRow,
  VolunteerSupporterSortField,
  VolunteerAudience,
  VolunteerAudienceCriteria,
  VolunteerAudienceLaunch,
  VolunteerAudienceType,
  VolunteerDirectoryColumn,
  VolunteerReport,
  VolunteerReportType,
  VolunteerStatistics,
  VolunteerWorkspaceView
} from "../../../models/volunteer-management.model";
import {
  filterVolunteerParishes,
  filterVolunteerSupporterRows,
  volunteerActiveAssignments,
  volunteerAssignmentsForParish,
  volunteerParishTableRows,
  volunteerSupporterRows
} from "../../../functions/volunteer-management";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { VolunteerManagementService } from "../../../services/volunteer-management.service";
import { SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { SortDirection } from "../../../models/sort.model";
import { StoredValue } from "../../../models/ui-actions";
import { kebabCase } from "es-toolkit/compat";
import { VOLUNTEER_NOTIFICATION_SUBJECT_TEXT } from "../../../models/mail.model";
import { UiActionsService } from "../../../services/ui-actions.service";
import { VolunteerAssignmentEditor } from "./volunteer-assignment-editor";
import { VolunteerParishEditor } from "./volunteer-parish-editor";
import { VolunteerParishView } from "./volunteer-parish-view";
import { VolunteerSupporterView } from "./volunteer-supporter-view";
import { VolunteerContactView } from "./volunteer-contact-view";
import { VolunteerReportView } from "./volunteer-report-view";
import { VolunteerStatisticsView } from "./volunteer-statistics-view";
import { VolunteerViewSwitch } from "./volunteer-view-switch";
import { volunteerStatistics } from "../../../functions/volunteer-statistics";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";
import { ResizerComponent } from "../../../modules/common/resizer/resizer";
import { VolunteerAudienceView } from "./volunteer-audience-view";
import { VolunteerImportView } from "./volunteer-import-view";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { volunteerAudience } from "../../../functions/volunteer-audiences";
import { ActivatedRoute, Router } from "@angular/router";
import { AdminPath } from "../../../models/admin-route-paths.model";
import { volunteerReport } from "../../../functions/volunteer-reports";
import { csvContentFrom, ConfigDefaults } from "../../../csv-export/csv-export";
import { downloadBlob } from "../../../functions/file-download";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UIDateFormat } from "../../../models/date-format.model";
import { VolunteerContactEditor } from "./volunteer-contact-editor";
import { ExternalRecipientService } from "../../../services/external-recipient/external-recipient.service";
import {
  CreateExternalRecipientRequest,
  ExternalContactRow,
  ExternalContactSortField,
  ExternalContactType,
  ExternalRecipient
} from "../../../models/external-recipient.model";
import { externalContactRows, externalContactTypeLabel, filterExternalContacts } from "../../../functions/external-contacts";

@Component({
  selector: "app-volunteer-management",
  imports: [FormsModule, FontAwesomeModule, PageComponent, VolunteerAssignmentEditor, VolunteerParishView, VolunteerSupporterView, VolunteerContactView, VolunteerContactEditor, VolunteerReportView, VolunteerStatisticsView, VolunteerAudienceView, VolunteerImportView, SectionToggle, VolunteerParishEditor, DynamicContentComponent, VolunteerViewSwitch, TooltipDirective, ResizerComponent],
  template: `
    <app-page>
      <div class="volunteer-workspace" [class.map-view]="view === VolunteerWorkspaceView.MAP" [class.editing]="editorOpen" [class.table-view]="isTableView">
        <div class="heading-row">
          <div>
            <h1>Volunteer management</h1>
            <p class="lead mb-0">Rights-of-way coverage, supporters and vacancies in one place.</p>
          </div>
          <div class="heading-actions">
            <app-volunteer-view-switch [adminView]="true">
              <span class="control-pill-divider"></span>
              @if (snapshot) {
                <button type="button" class="control-pill-btn control-pill-icon" (click)="toggleSummary()"
                        container="body" [tooltip]="summaryCollapsed ? 'Show summary' : 'Hide summary'">
                  <fa-icon [icon]="summaryCollapsed ? faChevronDown : faChevronUp"/>
                </button>
              }
              <button type="button" class="control-pill-btn control-pill-icon" (click)="load()" [disabled]="loading"
                      container="body" tooltip="Refresh">
                <fa-icon [icon]="faArrowsRotate" [animation]="loading ? 'spin' : null"/>
              </button>
            </app-volunteer-view-switch>
          </div>
        </div>

        <p class="volunteer-credit">
          <fa-icon [icon]="faAward" class="me-1"/>Modelled on a rights-of-way volunteer management system that Robert Peel has built and refined over many years. This work follows his design closely, with our thanks.
        </p>

        @if (errorMessage) {
          <div class="alert alert-danger d-flex align-items-start gap-3" role="alert">
            <fa-icon [icon]="faCircleExclamation"/>
            <div><strong>Volunteer data could not be loaded</strong><div>{{ errorMessage }}</div></div>
          </div>
        }

        @if (snapshot) {
          <div class="volunteer-results">
            @if (!summaryCollapsed) {
            <div class="summary-grid" aria-label="Volunteer coverage summary">
              <button type="button" class="summary-card neutral" [class.active]="summaryFilter === VolunteerSummaryFilter.ELIGIBLE_PARISHES" [attr.aria-pressed]="summaryFilter === VolunteerSummaryFilter.ELIGIBLE_PARISHES" (click)="applySummaryFilter(VolunteerSummaryFilter.ELIGIBLE_PARISHES)">
                <span>{{ snapshot.summary.eligibleParishCount }}</span><small>Eligible parishes</small>
              </button>
              <button type="button" class="summary-card success" [class.active]="summaryFilter === VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_COVERED" [attr.aria-pressed]="summaryFilter === VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_COVERED" (click)="applySummaryFilter(VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_COVERED)">
                <span>{{ coveredCount(VolunteerRoleType.LOCAL_FOOTPATH_OFFICER) }}</span><small>LFO covered</small>
              </button>
              <button type="button" class="summary-card warning" [class.active]="summaryFilter === VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_VACANT" [attr.aria-pressed]="summaryFilter === VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_VACANT" (click)="applySummaryFilter(VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_VACANT)">
                <span>{{ snapshot.summary.localFootpathOfficerVacancies }}</span><small>LFO vacancies</small>
              </button>
              <button type="button" class="summary-card success" [class.active]="summaryFilter === VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_COVERED" [attr.aria-pressed]="summaryFilter === VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_COVERED" (click)="applySummaryFilter(VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_COVERED)">
                <span>{{ coveredCount(VolunteerRoleType.PARISH_FOOTPATH_OBSERVER) }}</span><small>PFO covered</small>
              </button>
              <button type="button" class="summary-card warning" [class.active]="summaryFilter === VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_VACANT" [attr.aria-pressed]="summaryFilter === VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_VACANT" (click)="applySummaryFilter(VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_VACANT)">
                <span>{{ snapshot.summary.parishFootpathObserverVacancies }}</span><small>PFO vacancies</small>
              </button>
              <button type="button" class="summary-card temporary" [class.active]="summaryFilter === VolunteerSummaryFilter.TEMPORARY_ASSIGNMENTS" [attr.aria-pressed]="summaryFilter === VolunteerSummaryFilter.TEMPORARY_ASSIGNMENTS" (click)="applySummaryFilter(VolunteerSummaryFilter.TEMPORARY_ASSIGNMENTS)">
                <span>{{ snapshot.summary.temporaryAssignmentCount }}</span><small>Temporary assignments</small>
              </button>
              <button type="button" class="summary-card neutral" [class.active]="summaryFilter === VolunteerSummaryFilter.NEEDS_RECONCILIATION" [attr.aria-pressed]="summaryFilter === VolunteerSummaryFilter.NEEDS_RECONCILIATION" (click)="applySummaryFilter(VolunteerSummaryFilter.NEEDS_RECONCILIATION)">
                <span>{{ unresolvedAssignmentCount }}</span><small>Needs reconciliation</small>
              </button>
              <button type="button" class="summary-card neutral" [class.active]="summaryFilter === VolunteerSummaryFilter.ACTIVE_SUPPORTERS" [attr.aria-pressed]="summaryFilter === VolunteerSummaryFilter.ACTIVE_SUPPORTERS" (click)="applySummaryFilter(VolunteerSummaryFilter.ACTIVE_SUPPORTERS)">
                <span>{{ snapshot.summary.supporterCount }}</span><small>Active supporters</small>
              </button>
            </div>
            }

            <div class="volunteer-sticky-controls sticky-toolbar" [class.editing]="editorOpen">
              <app-section-toggle [tabs]="viewTabs"
                                  [selectedTab]="view"
                                  [fullWidth]="true"
                                  stackOnMobile
                                  (selectedTabChange)="selectView($event)"/>

              @if (view !== VolunteerWorkspaceView.IMPORT && view !== VolunteerWorkspaceView.MAP && view !== VolunteerWorkspaceView.STATISTICS) {
              <div class="toolbar">
                <label class="search-control">
                  <fa-icon [icon]="faMagnifyingGlass"/>
                  <input class="form-control" type="search" [ngModel]="searchText" (ngModelChange)="onSearchChange($event)"
                         [placeholder]="view === VolunteerWorkspaceView.VOLUNTEERS ? 'Search volunteers, emails, roles, parishes or groups' : 'Search parishes, supporters, authorities, sectors or groups'">
                </label>
                <div class="filter-controls">
                  @if (view !== VolunteerWorkspaceView.REPORTS && view !== VolunteerWorkspaceView.CONTACTS) {
                    <select class="form-select" [class.filter-active]="roleFilter" [ngModel]="roleFilter" (ngModelChange)="onRoleFilterChange($event)" aria-label="Filter by volunteer role">
                      <option [ngValue]="null">All roles</option>
                      <option [ngValue]="VolunteerRoleType.LOCAL_FOOTPATH_OFFICER">Local Footpath Officers</option>
                      <option [ngValue]="VolunteerRoleType.PARISH_FOOTPATH_OBSERVER">Parish Footpath Observers</option>
                      <option [ngValue]="VolunteerRoleType.GROUP_COORDINATOR">Group Coordinators</option>
                    </select>
                  }
                  @if (groupFilterAvailable && rightsOfWayGroupCodes.length > 0) {
                    <select class="form-select" [class.filter-active]="groupFilter" [ngModel]="groupFilter" (ngModelChange)="onGroupFilterChange($event)" aria-label="Filter by rights-of-way group">
                      <option [ngValue]="null">All rights-of-way groups</option>
                      @for (code of rightsOfWayGroupCodes; track code) {
                        <option [ngValue]="code">{{ code }}</option>
                      }
                    </select>
                  }
                  @if (view === VolunteerWorkspaceView.VOLUNTEERS) {
                    <select class="form-select" [class.filter-active]="statusFilter" [ngModel]="statusFilter" (ngModelChange)="onStatusFilterChange($event)" aria-label="Filter by assignment status">
                      <option [ngValue]="null">Any assignment status</option>
                      <option [ngValue]="VolunteerAssignmentStatusFilter.ACTIVE">Has active assignments</option>
                      <option [ngValue]="VolunteerAssignmentStatusFilter.NONE_ACTIVE">No active assignments</option>
                      <option [ngValue]="VolunteerAssignmentStatusFilter.ENDED">Has ended assignments</option>
                    </select>
                    <select class="form-select" [class.filter-active]="coverageFilter" [ngModel]="coverageFilter" (ngModelChange)="onCoverageFilterChange($event)" aria-label="Filter by cover type">
                      <option [ngValue]="null">Any cover</option>
                      <option [ngValue]="VolunteerAssignmentCoverage.PERMANENT">Permanent cover</option>
                      <option [ngValue]="VolunteerAssignmentCoverage.TEMPORARY">Temporary cover</option>
                    </select>
                  }
                  @if (view === VolunteerWorkspaceView.CONTACTS) {
                    <select class="form-select" [class.filter-active]="contactTypeFilter" [ngModel]="contactTypeFilter" (ngModelChange)="onContactTypeFilterChange($event)" aria-label="Filter by contact type">
                      <option [ngValue]="null">All contact types</option>
                      @for (contactType of contactTypes; track contactType) {
                        <option [ngValue]="contactType">{{ contactTypeLabel(contactType) }}</option>
                      }
                    </select>
                    <button type="button" class="btn btn-primary text-nowrap" (click)="beginContact()">Add contact</button>
                  }
                  @if (filtersActive) {
                    <button type="button" class="btn btn-quiet text-nowrap" (click)="clearFilters()">Clear filters</button>
                  }
                </div>
              </div>
              }

              @if (summaryFilterHeading) {
                <h2 class="summary-filter-heading">{{ summaryFilterHeading }}</h2>
              }
              @if (showResultCount) {
                <p class="results-count">{{ resultCount }} {{ resultNoun }} match{{ filtersActive ? " your filters" : "" }}</p>
              }

              @if (editorContext) {
                <app-volunteer-assignment-editor
                  [context]="editorContext"
                  [members]="members"
                  [activeAssignments]="activeAssignments"
                  [saving]="saving"
                  (save)="saveAssignment($event)"
                  (close)="closeEditor()"/>
              }

              @if (editingParishDetails) {
                <app-volunteer-parish-editor
                  [parish]="editingParishDetails"
                  [saving]="saving"
                  (save)="saveParish($event)"
                  (close)="closeParishEditor()"/>
              }

              @if (contactEditorVisible) {
                <app-volunteer-contact-editor
                  [editing]="editingContact"
                  [members]="members"
                  [parishes]="snapshot.parishes"
                  [existingContacts]="contacts"
                  [saving]="saving"
                  (save)="saveContact($event)"
                  (remove)="deleteContact($event)"
                  (close)="closeContactEditor()"/>
              }
            </div>

            @if (view === VolunteerWorkspaceView.PARISHES) {
              <app-volunteer-parish-view
                class="resizable-view" [style.height.px]="tableHeight"
                [rows]="parishRows"
                [sortField]="parishSortField"
                [sortDirection]="parishSortDirection"
                (sortChange)="onParishSortChange($event)"
                (parishSelect)="editParish($event)"
                (assignmentAdd)="beginAssignment($event)"
                (supporterSelect)="showSupporter($event)"
                (parishEdit)="editParishDetails($event)"
                (contactsSelect)="showContactsForParish($event)"/>
            } @else if (view === VolunteerWorkspaceView.VOLUNTEERS) {
              <app-volunteer-supporter-view
                class="resizable-view" [style.height.px]="tableHeight"
                [rows]="supporterRows"
                [members]="members"
                [saving]="saving"
                [groupCode]="groupCode"
                [sortField]="supporterSortField"
                [sortDirection]="supporterSortDirection"
                (sortChange)="onSupporterSortChange($event)"
                (assignmentEdit)="editAssignment($event)"
                (parishSelect)="showParish($event)"
                (bulkUpdate)="bulkUpdateAssignments($event)"/>
            } @else if (view === VolunteerWorkspaceView.CONTACTS) {
              <app-volunteer-contact-view
                class="resizable-view" [style.height.px]="tableHeight"
                [rows]="contactRows"
                [sortField]="contactSortField"
                [sortDirection]="contactSortDirection"
                (sortChange)="onContactSortChange($event)"
                (contactSelect)="editContact($event)"/>
            } @else if (view === VolunteerWorkspaceView.MAP) {
              <app-dynamic-content [anchor]="'map'" contentPathReadOnly preventRedirect/>
            } @else if (view === VolunteerWorkspaceView.STATISTICS) {
              <app-volunteer-statistics-view [statistics]="statistics" (groupSelected)="showGroupVolunteers($event)"/>
            } @else if (view === VolunteerWorkspaceView.REPORTS) {
              <app-volunteer-report-view
                [report]="report"
                [reportType]="reportType"
                [directoryColumns]="directoryColumns"
                [includeTemporaryAsVacant]="vacancyIncludeTemporary"
                [sortField]="reportSortField"
                [sortDirection]="reportSortDirection"
                (reportTypeChange)="onReportTypeChange($event)"
                (directoryColumnsChange)="onDirectoryColumnsChange($event)"
                (includeTemporaryAsVacantChange)="onIncludeTemporaryAsVacantChange($event)"
                (sortChange)="onReportSortChange($event)"
                (download)="downloadReport()"/>
            } @else if (view === VolunteerWorkspaceView.IMPORT) {
              <app-volunteer-import-view
                [groupCode]="groupCode"
                [members]="members"
                (applied)="load()"/>
            } @else {
              <app-volunteer-audience-view
                [audience]="audience"
                [criteria]="audienceCriteria"
                [parishes]="snapshot.parishes"
                (criteriaChange)="onAudienceCriteriaChange($event)"
                (launch)="launchEmailComposer($event)"
                (followUp)="followUpCorrespondence($event)"/>
            }
            @if (isTableView) {
              <app-resizer class="volunteer-table-resizer" orientation="vertical" variant="tab" compact
                           [size]="tableHeight" [minSize]="240" [maxSize]="1400"
                           (sizeChange)="onTableResize($event)"/>
            }
          </div>
        }
      </div>
    </app-page>
  `,
  styles: [`
    .volunteer-workspace
      display: flex
      flex-direction: column
      gap: var(--space-6)
      padding-bottom: var(--space-6)
    .heading-row
      position: relative
      display: flex
      align-items: end
      justify-content: space-between
      gap: var(--space-4)
    .heading-actions
      display: flex
      align-items: center
      justify-content: flex-end
      gap: var(--space-3)
      flex-wrap: wrap
    @media (min-width: 768px)
      .heading-actions
        position: absolute
        top: 0
        right: 0
    .volunteer-credit
      margin: 0
      font-size: 1.05rem
      line-height: 1.5
      color: var(--rsm-text)
    .volunteer-credit fa-icon
      color: var(--ramblers-colour-sunrise)
    .summary-filter-heading
      margin: 0
      font-size: 1.25rem
      font-weight: 700
      color: var(--rsm-text)
    .results-count
      margin: 0
      color: var(--rsm-muted)
      font-weight: 600
    .volunteer-results
      display: flex
      flex-direction: column
      gap: var(--space-3)
      flex: 1 1 auto
      min-height: 0
    .summary-grid
      display: grid
      grid-template-columns: repeat(4, minmax(0, 1fr))
      gap: var(--space-3)
    .summary-card
      --card-accent: #9ca3af
      min-height: 112px
      padding: var(--space-4)
      background: var(--rsm-panel-bg)
      border: 1px solid var(--rsm-border)
      border-left: 8px solid var(--card-accent)
      border-radius: var(--rsm-panel-radius)
      color: var(--rsm-text)
      text-align: left
    .summary-card span
      display: block
      font-size: 2rem
      font-weight: 700
      line-height: 1
      margin-bottom: var(--space-2)
    .summary-card small
      color: var(--rsm-muted)
      font-weight: 600
    .summary-card.success
      --card-accent: #9bc8ab
    .summary-card.warning
      --card-accent: #f9b104
    .summary-card.temporary
      --card-accent: #f6b09d
    .summary-card.active
      transform: translateY(2px)
      box-shadow: inset 0 0 0 3px var(--card-accent)
    .form-select.filter-active
      box-shadow: inset 0 0 0 2px var(--ramblers-colour-sunrise)
    .view-tabs
      display: flex
      gap: var(--space-2)
    .toolbar
      display: grid
      grid-template-columns: minmax(220px, 2fr) minmax(360px, 3fr)
      gap: var(--space-3)
      align-items: center
    .volunteer-sticky-controls
      display: grid
      gap: var(--space-3)
      flex: 0 0 auto
      padding-inline: var(--space-1)
    .filter-controls
      display: flex
      gap: var(--space-3)
      min-width: 0
    .filter-controls .form-select
      flex: 1 1 auto
      min-width: 0
    .search-control
      position: relative
    .search-control fa-icon
      position: absolute
      left: var(--space-3)
      top: 50%
      transform: translateY(-50%)
      color: var(--rsm-muted)
    .search-control input
      padding-left: 2.4rem
    @media (min-width: 768px)
      .volunteer-workspace
        height: calc(100vh - 200px)
        min-height: 520px
      .volunteer-workspace.map-view,
      .volunteer-workspace.editing,
      .volunteer-workspace.table-view
        height: auto
        min-height: 0
      .volunteer-results > .resizable-view
        flex: 0 0 auto
        min-height: 0
        overflow: hidden
      .volunteer-results > .volunteer-table-resizer
        margin-top: calc(var(--space-3) * -1)
      .volunteer-workspace.map-view .volunteer-results > app-area-map
        flex: 0 0 auto
        min-height: 0
      .volunteer-results > app-volunteer-parish-view,
      .volunteer-results > app-volunteer-supporter-view,
      .volunteer-results > app-volunteer-contact-view,
      .volunteer-results > app-volunteer-report-view,
      .volunteer-results > app-volunteer-statistics-view,
      .volunteer-results > app-volunteer-audience-view,
      .volunteer-results > app-area-map
        flex: 1 1 auto
        min-height: 0
      .volunteer-results > app-volunteer-import-view
        flex: 1 1 auto
        min-height: 0
        overflow-y: auto
      .volunteer-sticky-controls
        max-height: 62%
        overflow-y: auto
      .volunteer-sticky-controls.editing
        max-height: none
        overflow-y: visible
    @media (max-width: 991.98px)
      .summary-grid
        grid-template-columns: repeat(2, minmax(0, 1fr))
    @media (max-width: 767.98px)
      .heading-row
        align-items: stretch
        flex-direction: column
      .heading-row .btn
        width: 100%
      .view-tabs .btn
        flex: 1 1 0
      .toolbar
        grid-template-columns: 1fr
      .filter-controls
        flex-direction: column
      .filter-controls .btn
        width: 100%
      .summary-card
        min-height: 96px
  `]
})
export class VolunteerManagementComponent implements OnInit {
  private service = inject(VolunteerManagementService);
  private memberService = inject(MemberService);
  private systemConfigService = inject(SystemConfigService);
  private uiActions = inject(UiActionsService);
  private externalRecipientService = inject(ExternalRecipientService);
  private dateUtils = inject(DateUtilsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private logger: Logger = inject(LoggerFactory).createLogger("VolunteerManagementComponent", NgxLoggerLevel.ERROR);
  protected readonly VolunteerRoleType = VolunteerRoleType;
  protected readonly VolunteerSummaryFilter = VolunteerSummaryFilter;
  protected readonly VolunteerWorkspaceView = VolunteerWorkspaceView;
  protected readonly VolunteerAssignmentStatusFilter = VolunteerAssignmentStatusFilter;
  protected readonly VolunteerAssignmentCoverage = VolunteerAssignmentCoverage;
  protected readonly contactTypes = values(ExternalContactType);
  protected readonly viewTabs: SectionToggleTab[] = [
    {value: VolunteerWorkspaceView.PARISHES, label: "Parishes"},
    {value: VolunteerWorkspaceView.VOLUNTEERS, label: "Volunteers"},
    {value: VolunteerWorkspaceView.CONTACTS, label: "Contacts"},
    {value: VolunteerWorkspaceView.MAP, label: "Map"},
    {value: VolunteerWorkspaceView.STATISTICS, label: "Statistics"},
    {value: VolunteerWorkspaceView.REPORTS, label: "Reports"},
    {value: VolunteerWorkspaceView.EMAIL, label: "Email"},
    {value: VolunteerWorkspaceView.IMPORT, label: "Data management"}
  ];
  protected readonly faArrowsRotate = faArrowsRotate;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronUp = faChevronUp;
  protected readonly faAward = faAward;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faMagnifyingGlass = faMagnifyingGlass;

  snapshot: VolunteerManagementSnapshot | null = null;
  members: Member[] = [];
  groupCode = "";
  loading = false;
  saving = false;
  summaryCollapsed = this.uiActions.initialBooleanValueFor(StoredValue.VOLUNTEER_SUMMARY_COLLAPSED, false);
  tableHeight = Number(this.uiActions.initialValueFor(StoredValue.VOLUNTEER_TABLE_HEIGHT)) || 520;
  errorMessage = "";
  view = VolunteerWorkspaceView.PARISHES;
  searchText = "";
  roleFilter: VolunteerRoleType | null = null;
  groupFilter: string | null = null;
  statusFilter: VolunteerAssignmentStatusFilter | null = null;
  coverageFilter: VolunteerAssignmentCoverage | null = null;
  summaryFilter: VolunteerSummaryFilter | null = null;
  editorContext: VolunteerAssignmentEditorContext | null = null;
  contacts: ExternalRecipient[] = [];
  contactEditorVisible = false;
  editingParishDetails: VolunteerParish | null = null;
  editingContact: ExternalRecipient | null = null;
  contactTypeFilter: ExternalContactType | null = null;
  contactSortField: string = ExternalContactSortField.DISPLAY_NAME;
  contactSortDirection = ASCENDING;
  reportType = VolunteerReportType.VACANCIES;
  reportSortField: string = null;
  reportSortDirection = ASCENDING;
  directoryColumns: VolunteerDirectoryColumn[] = [VolunteerDirectoryColumn.EMAIL];
  vacancyIncludeTemporary = false;
  audienceCriteria: VolunteerAudienceCriteria = {audienceType: VolunteerAudienceType.ALL_ROLE_HOLDERS, localAuthorityCode: null, sectorCode: null, rightsOfWayGroupCode: null};
  parishSortField: string = VolunteerParishSortField.PARISH_NAME;
  parishSortDirection = ASCENDING;
  supporterSortField: string = VolunteerSupporterSortField.DISPLAY_NAME;
  supporterSortDirection = ASCENDING;
  activeAssignments: VolunteerAssignment[] = [];
  private allSupporterRows: VolunteerSupporterRow[] = [];

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.restoreFromUrl());
    this.load();
  }

  load(): void {
    this.groupCode = this.systemConfigService.systemConfig()?.group?.groupCode ?? "";
    this.loading = true;
    this.errorMessage = "";
    if (this.groupCode) {
      forkJoin({
        snapshot: this.service.snapshot(this.groupCode),
        members: this.memberService.all(this.memberService.publicFieldsDataQueryOptions),
        contacts: this.externalRecipientService.list()
      }).subscribe({
        next: result => {
          this.members = result.members;
          this.contacts = result.contacts;
          this.applySnapshot(result.snapshot);
          this.loading = false;
        },
        error: error => {
          this.logger.error("Failed to load volunteer workspace", error);
          this.errorMessage = this.messageFrom(error);
          this.loading = false;
        }
      });
    } else {
      this.errorMessage = "The site group code is not configured.";
      this.loading = false;
    }
  }

  get unresolvedAssignmentCount(): number {
    return this.allSupporterRows.filter(row => !row.supporterId).reduce((total, row) => total + row.activeAssignmentCount, 0);
  }

  get editorOpen(): boolean {
    return !!this.editorContext || !!this.editingParishDetails || this.contactEditorVisible;
  }

  get isTableView(): boolean {
    return this.view === VolunteerWorkspaceView.PARISHES
      || this.view === VolunteerWorkspaceView.VOLUNTEERS
      || this.view === VolunteerWorkspaceView.CONTACTS;
  }

  toggleSummary(): void {
    this.summaryCollapsed = !this.summaryCollapsed;
    this.uiActions.saveValueFor(StoredValue.VOLUNTEER_SUMMARY_COLLAPSED, this.summaryCollapsed);
  }

  onTableResize(size: number): void {
    this.tableHeight = size;
    this.uiActions.saveValueFor(StoredValue.VOLUNTEER_TABLE_HEIGHT, size);
  }

  get filtersActive(): boolean {
    return !!this.searchText || !!this.roleFilter || !!this.statusFilter || !!this.coverageFilter || !!this.summaryFilter || !!this.contactTypeFilter;
  }

  get summaryFilterHeading(): string | null {
    switch (this.summaryFilter) {
      case VolunteerSummaryFilter.ELIGIBLE_PARISHES: return "Eligible parishes";
      case VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_COVERED: return "Local Footpath Officer covered";
      case VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_VACANT: return "Local Footpath Officer vacancies";
      case VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_COVERED: return "Parish Footpath Observer covered";
      case VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_VACANT: return "Parish Footpath Observer vacancies";
      case VolunteerSummaryFilter.TEMPORARY_ASSIGNMENTS: return "Temporary assignments";
      case VolunteerSummaryFilter.NEEDS_RECONCILIATION: return "Needs reconciliation";
      case VolunteerSummaryFilter.ACTIVE_SUPPORTERS: return "Active supporters";
      default: return null;
    }
  }


  get showResultCount(): boolean {
    return this.view === VolunteerWorkspaceView.PARISHES
      || this.view === VolunteerWorkspaceView.VOLUNTEERS
      || this.view === VolunteerWorkspaceView.CONTACTS;
  }

  get resultCount(): number {
    switch (this.view) {
      case VolunteerWorkspaceView.PARISHES:
        return this.parishRows.length;
      case VolunteerWorkspaceView.VOLUNTEERS:
        return this.supporterRows.length;
      case VolunteerWorkspaceView.CONTACTS:
        return this.contactRows.length;
      default:
        return 0;
    }
  }

  get resultNoun(): string {
    switch (this.view) {
      case VolunteerWorkspaceView.PARISHES:
        return this.resultCount === 1 ? "parish" : "parishes";
      case VolunteerWorkspaceView.VOLUNTEERS:
        return this.resultCount === 1 ? "volunteer" : "volunteers";
      case VolunteerWorkspaceView.CONTACTS:
        return this.resultCount === 1 ? "contact" : "contacts";
      default:
        return "results";
    }
  }

  get contactRows(): ExternalContactRow[] {
    return filterExternalContacts(externalContactRows(this.contacts, this.snapshot?.parishes ?? [], this.members), {
      searchText: this.searchText,
      contactType: this.contactTypeFilter,
      parishCode: null
    });
  }

  contactTypeLabel(contactType: ExternalContactType): string {
    return externalContactTypeLabel(contactType);
  }

  get report(): VolunteerReport {
    const report = volunteerReport(this.reportType, {
      parishes: this.snapshot?.parishes ?? [],
      assignments: this.snapshot?.assignments ?? [],
      members: this.members,
      contacts: this.contacts,
      formatDate: value => this.dateUtils.displayDate(value),
      contactRetentionDays: this.systemConfigService.systemConfig()?.volunteers?.contactRetentionDays,
      now: this.dateUtils.nowAsValue(),
      directoryColumns: this.directoryColumns,
      includeTemporaryAsVacant: this.vacancyIncludeTemporary,
      rightsOfWayGroupCode: this.groupFilter
    });
    const searchText = this.searchText.trim().toLowerCase();
    return searchText ? {...report, rows: report.rows.filter(row => values(row).some(value => String(value).toLowerCase().includes(searchText)))} : report;
  }

  get statistics(): VolunteerStatistics {
    return volunteerStatistics(this.snapshot?.parishes ?? [], this.snapshot?.assignments ?? []);
  }

  get audience(): VolunteerAudience {
    return volunteerAudience(this.audienceCriteria, {
      parishes: this.snapshot?.parishes ?? [],
      assignments: this.snapshot?.assignments ?? [],
      members: this.members,
      contacts: this.contacts
    });
  }

  onAudienceCriteriaChange(criteria: VolunteerAudienceCriteria): void {
    this.audienceCriteria = criteria;
    this.syncQueryParameters();
  }

  launchEmailComposer(launch: VolunteerAudienceLaunch): void {
    this.router.navigate([AdminPath.EMAIL_COMPOSER], {
      queryParams: {
        [StoredValue.AUDIENCE]: launch.criteria.audienceType,
        [StoredValue.AUTHORITY]: launch.criteria.localAuthorityCode || null,
        [StoredValue.SECTOR]: launch.criteria.sectorCode || null,
        [StoredValue.GROUP]: launch.criteria.rightsOfWayGroupCode || null,
        [StoredValue.LETTER]: launch.letterType || null,
        [StoredValue.CONFIG_ID]: kebabCase(VOLUNTEER_NOTIFICATION_SUBJECT_TEXT)
      }
    });
  }

  followUpCorrespondence(compositionId: string): void {
    this.router.navigate([AdminPath.EMAIL_COMPOSER], {queryParams: {[StoredValue.COPY_OF]: compositionId}});
  }

  onReportTypeChange(reportType: VolunteerReportType): void {
    this.reportType = reportType;
    this.reportSortField = null;
    this.syncQueryParameters();
  }

  onDirectoryColumnsChange(directoryColumns: VolunteerDirectoryColumn[]): void {
    this.directoryColumns = directoryColumns;
  }

  onIncludeTemporaryAsVacantChange(includeTemporaryAsVacant: boolean): void {
    this.vacancyIncludeTemporary = includeTemporaryAsVacant;
  }

  onReportSortChange(sortState: SortableTableSortState): void {
    this.reportSortField = sortState.key;
    this.reportSortDirection = sortState.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.syncQueryParameters();
  }

  downloadReport(): void {
    const report = this.report;
    const content = csvContentFrom(report.rows, {
      ...ConfigDefaults,
      headers: report.columns.map(column => column.label),
      keys: report.columns.map(column => column.key)
    });
    const timestamp = this.dateUtils.asString(this.dateUtils.nowAsValue(), undefined, UIDateFormat.FILE_TIMESTAMP_COMPACT);
    const fileName = `${this.reportType}-${timestamp}.csv`;
    downloadBlob(new Blob([content], {type: "text/csv;charset=utf8;"}), fileName);
    this.service.recordExportAudit({groupCode: this.groupCode, reportType: this.reportType, fileName, rowCount: report.rows.length}).subscribe({
      error: error => this.logger.error("Failed to audit report export", error)
    });
  }

  get parishRows(): VolunteerParishTableRow[] {
    const parishes = filterVolunteerParishes(this.snapshot?.parishes ?? [], this.activeAssignments, this.members, {
      searchText: this.searchText,
      roleFilter: this.roleFilter,
      summaryFilter: this.summaryFilter,
      rightsOfWayGroupCode: this.groupFilter
    });
    return volunteerParishTableRows(parishes, this.activeAssignments, this.members);
  }

  get supporterRows(): VolunteerSupporterRow[] {
    return filterVolunteerSupporterRows(this.allSupporterRows, {
      searchText: this.searchText,
      roleFilter: this.roleFilter,
      statusFilter: this.statusFilter,
      coverageFilter: this.coverageFilter,
      rightsOfWayGroupCode: this.groupFilter
    });
  }

  coveredCount(roleType: VolunteerRoleType): number {
    const eligibleParishCodes = new Set((this.snapshot?.parishes ?? [])
      .filter(parish => parish.eligibility === VolunteerParishEligibility.ACTIVE)
      .map(parish => parish.parishCode));
    return new Set(this.activeAssignments
      .filter(assignment => assignment.roleType === roleType && eligibleParishCodes.has(assignment.parishCode))
      .map(assignment => assignment.parishCode)).size;
  }

  selectView(view: VolunteerWorkspaceView): void {
    this.view = view;
    this.closeEditor();
    this.closeContactEditor();
    this.closeParishEditor();
    this.syncQueryParameters();
  }

  get groupFilterAvailable(): boolean {
    return [VolunteerWorkspaceView.PARISHES, VolunteerWorkspaceView.VOLUNTEERS, VolunteerWorkspaceView.REPORTS].includes(this.view);
  }

  get rightsOfWayGroupCodes(): string[] {
    return uniq((this.snapshot?.parishes ?? []).map(parish => (parish.rightsOfWayGroupCode || "").trim()).filter(code => !!code)).sort();
  }

  onGroupFilterChange(groupFilter: string | null): void {
    this.groupFilter = groupFilter || null;
    this.syncQueryParameters();
  }

  showGroupVolunteers(groupCode: string): void {
    this.groupFilter = groupCode;
    this.searchText = "";
    this.roleFilter = null;
    this.statusFilter = null;
    this.coverageFilter = null;
    this.selectView(VolunteerWorkspaceView.VOLUNTEERS);
  }

  showSupporter(displayName: string): void {
    this.view = VolunteerWorkspaceView.VOLUNTEERS;
    this.searchText = displayName;
    this.summaryFilter = null;
    this.closeEditor();
    this.syncQueryParameters();
  }

  showParish(parishName: string): void {
    this.view = VolunteerWorkspaceView.PARISHES;
    this.searchText = parishName;
    this.statusFilter = null;
    this.coverageFilter = null;
    this.closeEditor();
    this.syncQueryParameters();
  }

  onSearchChange(searchText: string): void {
    this.searchText = searchText;
    this.syncQueryParameters();
  }

  onRoleFilterChange(roleFilter: VolunteerRoleType | null): void {
    this.roleFilter = roleFilter;
    this.syncQueryParameters();
  }

  onStatusFilterChange(statusFilter: VolunteerAssignmentStatusFilter | null): void {
    this.statusFilter = statusFilter;
    this.syncQueryParameters();
  }

  onCoverageFilterChange(coverageFilter: VolunteerAssignmentCoverage | null): void {
    this.coverageFilter = coverageFilter;
    this.syncQueryParameters();
  }

  onContactTypeFilterChange(contactTypeFilter: ExternalContactType | null): void {
    this.contactTypeFilter = contactTypeFilter;
    this.syncQueryParameters();
  }

  onContactSortChange(sortState: SortableTableSortState): void {
    this.contactSortField = values(ExternalContactSortField).find(value => value === sortState.key) || ExternalContactSortField.DISPLAY_NAME;
    this.contactSortDirection = sortState.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.syncQueryParameters();
  }

  beginContact(): void {
    this.editingContact = null;
    this.contactEditorVisible = true;
  }

  editContact(contact: ExternalRecipient): void {
    this.editingContact = this.contacts.find(candidate => candidate.id === contact.id) ?? null;
    this.contactEditorVisible = true;
  }

  closeContactEditor(): void {
    this.contactEditorVisible = false;
    this.editingContact = null;
    this.saving = false;
  }

  saveContact(request: CreateExternalRecipientRequest): void {
    const contactId = this.editingContact?.id;
    this.saving = true;
    const operation = contactId ? this.externalRecipientService.update(contactId, request) : this.externalRecipientService.create(request);
    operation.then(() => this.reloadContacts()).catch(error => {
      this.logger.error("Failed to save contact", error);
      this.errorMessage = this.messageFrom(error);
      this.saving = false;
    });
  }

  deleteContact(contactId: string): void {
    this.saving = true;
    this.externalRecipientService.delete(contactId).then(() => this.reloadContacts()).catch(error => {
      this.logger.error("Failed to delete contact", error);
      this.errorMessage = this.messageFrom(error);
      this.saving = false;
    });
  }

  private reloadContacts(): Promise<void> {
    return this.externalRecipientService.list().then(contacts => {
      this.contacts = contacts;
      this.closeContactEditor();
    });
  }

  applySummaryFilter(summaryFilter: VolunteerSummaryFilter): void {
    const toggledOff = this.summaryFilter === summaryFilter;
    const reconcile = !toggledOff && summaryFilter === VolunteerSummaryFilter.NEEDS_RECONCILIATION;
    this.searchText = "";
    this.roleFilter = null;
    this.statusFilter = null;
    this.coverageFilter = null;
    this.contactTypeFilter = null;
    this.summaryFilter = (toggledOff || reconcile) ? null : summaryFilter;
    if (reconcile) {
      this.view = VolunteerWorkspaceView.REPORTS;
      this.reportType = VolunteerReportType.UNRESOLVED_SUPPORTER_LINKS;
      this.reportSortField = null;
    } else {
      this.view = VolunteerWorkspaceView.PARISHES;
    }
    this.syncQueryParameters();
  }

  clearFilters(): void {
    this.searchText = "";
    this.roleFilter = null;
    this.statusFilter = null;
    this.coverageFilter = null;
    this.summaryFilter = null;
    this.contactTypeFilter = null;
    this.syncQueryParameters();
  }

  onParishSortChange(sortState: SortableTableSortState): void {
    this.parishSortField = values(VolunteerParishSortField).find(value => value === sortState.key) || VolunteerParishSortField.PARISH_NAME;
    this.parishSortDirection = sortState.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.syncQueryParameters();
  }

  onSupporterSortChange(sortState: SortableTableSortState): void {
    this.supporterSortField = values(VolunteerSupporterSortField).find(value => value === sortState.key) || VolunteerSupporterSortField.DISPLAY_NAME;
    this.supporterSortDirection = sortState.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.syncQueryParameters();
  }

  editParish(parish: VolunteerParish): void {
    const assignments = volunteerAssignmentsForParish(this.activeAssignments, parish.parishCode);
    this.editorContext = {parish, assignment: assignments[0] ?? null};
  }

  beginAssignment(parish: VolunteerParish): void {
    this.editorContext = {parish, assignment: null};
  }

  editAssignment(assignment: VolunteerAssignment): void {
    const parish = (this.snapshot?.parishes ?? []).find(candidate => candidate.parishCode === assignment.parishCode);
    if (parish) {
      this.view = VolunteerWorkspaceView.VOLUNTEERS;
      this.editorContext = {parish, assignment};
    } else {
      this.errorMessage = `No parish record was found for ${assignment.parishCode}.`;
    }
  }

  closeEditor(): void {
    this.editorContext = null;
    this.saving = false;
  }

  editParishDetails(parish: VolunteerParish): void {
    this.editorContext = null;
    this.editingParishDetails = (this.snapshot?.parishes ?? []).find(candidate => candidate.parishCode === parish.parishCode) ?? parish;
  }

  closeParishEditor(): void {
    this.editingParishDetails = null;
    this.saving = false;
  }

  saveParish(parish: VolunteerParish): void {
    this.saving = true;
    this.service.saveParish(parish).subscribe({
      next: () => {
        this.closeParishEditor();
        this.load();
      },
      error: error => {
        this.logger.error("Failed to save parish", error);
        this.errorMessage = this.messageFrom(error);
        this.saving = false;
      }
    });
  }

  showContactsForParish(parish: VolunteerParish): void {
    this.view = VolunteerWorkspaceView.CONTACTS;
    this.searchText = parish.parishName;
    this.contactTypeFilter = null;
    this.closeEditor();
    this.closeParishEditor();
    this.syncQueryParameters();
  }

  saveAssignment(payload: VolunteerAssignmentEditorSave): void {
    const operations = [
      ...payload.upserts.map(request => request.id ? this.service.updateAssignment(request) : this.service.createAssignment(request)),
      ...payload.endIds.map(assignmentId => this.service.endAssignment(assignmentId))
    ];
    if (operations.length === 0) {
      this.closeEditor();
    } else {
      this.saving = true;
      forkJoin(operations).subscribe({
        next: () => {
          this.saving = false;
          this.closeEditor();
          this.load();
        },
        error: error => {
          this.logger.error("Failed to save volunteer assignments", error);
          this.errorMessage = this.messageFrom(error);
          this.saving = false;
        }
      });
    }
  }

  bulkUpdateAssignments(request: VolunteerAssignmentBulkRequest): void {
    this.saving = true;
    this.service.bulkUpdateAssignments(request).subscribe({
      next: response => {
        this.logger.debug("applied", request.action, "to", response.updated, "assignments");
        this.saving = false;
        this.load();
      },
      error: error => {
        this.logger.error("Failed to update volunteer assignments", error);
        this.errorMessage = this.messageFrom(error);
        this.saving = false;
      }
    });
  }

  private applySnapshot(snapshot: VolunteerManagementSnapshot): void {
    this.snapshot = snapshot;
    this.activeAssignments = volunteerActiveAssignments(snapshot.assignments);
    this.allSupporterRows = volunteerSupporterRows(snapshot.assignments, snapshot.parishes, this.members);
  }

  private messageFrom(error: any): string {
    return error?.error?.error || error?.message || "Unknown error";
  }

  private syncQueryParameters(): void {
    const volunteersView = this.view === VolunteerWorkspaceView.VOLUNTEERS;
    const contactsView = this.view === VolunteerWorkspaceView.CONTACTS;
    const parishesView = this.view === VolunteerWorkspaceView.PARISHES;
    this.uiActions.updateQueryParameters({
      [StoredValue.TAB]: this.view,
      [StoredValue.SEARCH]: this.searchText || null,
      [StoredValue.GROUP]: this.groupFilterAvailable ? this.groupFilter : null,
      [StoredValue.ROLE]: contactsView ? null : this.roleFilter,
      [StoredValue.STATUS]: volunteersView ? this.statusFilter : null,
      [StoredValue.COVERAGE]: volunteersView ? this.coverageFilter : null,
      [StoredValue.CONTACT_TYPE]: contactsView ? this.contactTypeFilter : null,
      [StoredValue.REPORT]: this.view === VolunteerWorkspaceView.REPORTS ? this.reportType : null,
      [StoredValue.FILTER]: parishesView ? this.summaryFilter : null,
      [StoredValue.SORT]: this.uiActions.queryValueAliasFor(this.currentSortField),
      [StoredValue.SORT_ORDER]: this.currentSortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC
    });
  }

  private get currentSortField(): string {
    if (this.view === VolunteerWorkspaceView.VOLUNTEERS) {
      return this.supporterSortField;
    } else if (this.view === VolunteerWorkspaceView.CONTACTS) {
      return this.contactSortField;
    } else if (this.view === VolunteerWorkspaceView.REPORTS) {
      return this.reportSortField ?? "";
    } else {
      return this.parishSortField;
    }
  }

  private get currentSortDirection(): string {
    if (this.view === VolunteerWorkspaceView.VOLUNTEERS) {
      return this.supporterSortDirection;
    } else if (this.view === VolunteerWorkspaceView.CONTACTS) {
      return this.contactSortDirection;
    } else if (this.view === VolunteerWorkspaceView.REPORTS) {
      return this.reportSortDirection;
    } else {
      return this.parishSortDirection;
    }
  }

  private restoreFromUrl(): void {
    this.view = this.uiActions.queryValueForAlias(this.uiActions.queryParameter(StoredValue.TAB), values(VolunteerWorkspaceView)) as VolunteerWorkspaceView
      || VolunteerWorkspaceView.PARISHES;
    this.searchText = this.uiActions.queryParameter(StoredValue.SEARCH) ?? "";
    this.groupFilter = this.uiActions.queryParameter(StoredValue.GROUP) || null;
    this.roleFilter = this.uiActions.queryValueForAlias(this.uiActions.queryParameter(StoredValue.ROLE), values(VolunteerRoleType)) as VolunteerRoleType;
    this.statusFilter = this.uiActions.queryValueForAlias(this.uiActions.queryParameter(StoredValue.STATUS), values(VolunteerAssignmentStatusFilter)) as VolunteerAssignmentStatusFilter;
    this.coverageFilter = this.uiActions.queryValueForAlias(this.uiActions.queryParameter(StoredValue.COVERAGE), values(VolunteerAssignmentCoverage)) as VolunteerAssignmentCoverage;
    this.contactTypeFilter = this.uiActions.queryValueForAlias(this.uiActions.queryParameter(StoredValue.CONTACT_TYPE), values(ExternalContactType)) as ExternalContactType;
    this.summaryFilter = this.uiActions.queryValueForAlias(this.uiActions.queryParameter(StoredValue.FILTER), values(VolunteerSummaryFilter)) as VolunteerSummaryFilter;
    const sortAlias = this.uiActions.queryParameter(StoredValue.SORT);
    const descending = this.uiActions.queryParameter(StoredValue.SORT_ORDER) === SortDirection.DESC;
    if (this.view === VolunteerWorkspaceView.VOLUNTEERS) {
      this.supporterSortField = this.uiActions.queryValueForAlias(sortAlias, values(VolunteerSupporterSortField)) || VolunteerSupporterSortField.DISPLAY_NAME;
      this.supporterSortDirection = descending ? DESCENDING : ASCENDING;
    } else if (this.view === VolunteerWorkspaceView.CONTACTS) {
      this.contactSortField = this.uiActions.queryValueForAlias(sortAlias, values(ExternalContactSortField)) || ExternalContactSortField.DISPLAY_NAME;
      this.contactSortDirection = descending ? DESCENDING : ASCENDING;
    } else if (this.view === VolunteerWorkspaceView.REPORTS) {
      this.reportType = this.uiActions.queryValueForAlias(this.uiActions.queryParameter(StoredValue.REPORT), values(VolunteerReportType)) as VolunteerReportType || VolunteerReportType.VACANCIES;
      this.reportSortField = sortAlias;
      this.reportSortDirection = descending ? DESCENDING : ASCENDING;
    } else {
      this.parishSortField = this.uiActions.queryValueForAlias(sortAlias, values(VolunteerParishSortField)) || VolunteerParishSortField.PARISH_NAME;
      this.parishSortDirection = descending ? DESCENDING : ASCENDING;
    }
  }
}
