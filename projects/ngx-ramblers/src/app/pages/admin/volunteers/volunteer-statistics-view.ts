import { Component, inject, Input } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import { VolunteerAreaCoverageStat, VolunteerStatistics } from "../../../models/volunteer-management.model";
import { ClipboardService } from "../../../services/clipboard.service";

@Component({
  selector: "app-volunteer-statistics-view",
  imports: [FontAwesomeModule, NgTemplateOutlet],
  template: `
    @if (statistics) {
      <div class="stats-workspace">
        <div class="stats-headline">
          <div class="stat-tile neutral"><span>{{ statistics.totalParishes }}</span><small>Parishes</small></div>
          <div class="stat-tile neutral"><span>{{ statistics.eligibleParishes }}</span><small>Eligible parishes</small></div>
          <div class="stat-tile muted"><span>{{ statistics.noPublicRightsOfWay }}</span><small>No public rights of way</small></div>
          <div class="stat-tile success"><span>{{ statistics.activeAssignments }}</span><small>Active assignments</small></div>
          <div class="stat-tile temporary"><span>{{ statistics.temporaryAssignments }}</span><small>Temporary cover</small></div>
          <div class="stat-tile neutral"><span>{{ statistics.distinctVolunteers }}</span><small>Distinct volunteers</small></div>
        </div>

        <section class="stats-section">
          <div class="stats-section-header">
            <h2>Role coverage</h2>
            <button type="button" class="btn btn-quiet btn-sm" (click)="copyCoverage()"><fa-icon [icon]="faCopy"/> Copy</button>
          </div>
          <p class="stats-note">Across eligible parishes (those with public rights of way). A post is permanent, temporarily covered, or vacant.</p>
          <div class="stats-table-scroll">
            <table class="stats-table">
              <thead>
                <tr><th>Role</th><th class="num">Permanent</th><th class="num">Temporary cover</th><th class="num">Vacant</th><th class="num">Eligible parishes</th></tr>
              </thead>
              <tbody>
                @for (row of statistics.coverage; track row.roleType) {
                  <tr>
                    <td>{{ row.roleLabel }}</td>
                    <td class="num"><span class="pill permanent">{{ row.permanent }}</span></td>
                    <td class="num"><span class="pill temporary">{{ row.temporary }}</span></td>
                    <td class="num"><span class="pill vacant">{{ row.vacant }}</span></td>
                    <td class="num">{{ row.eligibleParishes }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="stats-section">
          <div class="stats-section-header"><h2>Role holders</h2></div>
          <p class="stats-note">Distinct volunteers currently holding each role.</p>
          <div class="stats-holders">
            <div class="stat-tile neutral"><span>{{ statistics.roleHolders.localFootpathOfficers }}</span><small>Local Footpath Officers</small></div>
            <div class="stat-tile neutral"><span>{{ statistics.roleHolders.parishFootpathObservers }}</span><small>Parish Footpath Observers</small></div>
            <div class="stat-tile success"><span>{{ statistics.roleHolders.bothRoles }}</span><small>Holding both roles</small></div>
            <div class="stat-tile neutral"><span>{{ statistics.roleHolders.groupCoordinators }}</span><small>Group coordinators</small></div>
            <div class="stat-tile warning"><span>{{ statistics.roleHolders.needingReconciliation }}</span><small>Needing reconciliation</small></div>
          </div>
        </section>

        <section class="stats-section">
          <div class="stats-section-header">
            <h2>Coverage by sector</h2>
            <button type="button" class="btn btn-quiet btn-sm" (click)="copyAreas(statistics.bySector, 'Sector')"><fa-icon [icon]="faCopy"/> Copy</button>
          </div>
          <ng-container [ngTemplateOutlet]="areaTable" [ngTemplateOutletContext]="{areas: statistics.bySector, heading: 'Sector'}"/>
        </section>

        <section class="stats-section">
          <div class="stats-section-header">
            <h2>Coverage by rights-of-way group</h2>
            <button type="button" class="btn btn-quiet btn-sm" (click)="copyAreas(statistics.byGroup, 'Rights-of-way group')"><fa-icon [icon]="faCopy"/> Copy</button>
          </div>
          <ng-container [ngTemplateOutlet]="areaTable" [ngTemplateOutletContext]="{areas: statistics.byGroup, heading: 'Rights-of-way group'}"/>
        </section>

        <ng-template #areaTable let-areas="areas" let-heading="heading">
          <div class="stats-table-scroll">
            <table class="stats-table">
              <thead>
                <tr><th>{{ heading }}</th><th class="num">Parishes</th><th class="num">LFO holders</th><th class="num">LFO vacancies</th><th class="num">PFO holders</th><th class="num">PFO vacancies</th></tr>
              </thead>
              <tbody>
                @for (area of areas; track area.key) {
                  <tr>
                    <td>{{ area.label }}</td>
                    <td class="num">{{ area.eligibleParishes }}</td>
                    <td class="num">{{ area.localFootpathOfficerHolders }}</td>
                    <td class="num" [class.has-vacancy]="area.localFootpathOfficerVacancies > 0">{{ area.localFootpathOfficerVacancies }}</td>
                    <td class="num">{{ area.parishFootpathObserverHolders }}</td>
                    <td class="num" [class.has-vacancy]="area.parishFootpathObserverVacancies > 0">{{ area.parishFootpathObserverVacancies }}</td>
                  </tr>
                }
                @if (areas.length === 0) {
                  <tr><td colspan="6" class="stats-empty">Nothing to report for the current data.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </ng-template>
      </div>
    }
  `,
  styles: [`
    :host
      display: block
      height: 100%
      overflow-y: auto
    .stats-workspace
      display: flex
      flex-direction: column
      gap: var(--space-6)
    .stats-headline,
    .stats-holders
      display: grid
      grid-template-columns: repeat(6, minmax(0, 1fr))
      gap: var(--space-3)
    .stats-holders
      grid-template-columns: repeat(5, minmax(0, 1fr))
    .stat-tile
      --tile-accent: #9ca3af
      padding: var(--space-4)
      background: var(--rsm-panel-bg)
      border: 1px solid var(--rsm-border)
      border-left: 8px solid var(--tile-accent)
      border-radius: var(--rsm-panel-radius)
    .stat-tile span
      display: block
      font-size: 1.9rem
      font-weight: 700
      line-height: 1
      margin-bottom: var(--space-2)
    .stat-tile small
      color: var(--rsm-muted)
      font-weight: 600
    .stat-tile.success
      --tile-accent: #9bc8ab
    .stat-tile.warning
      --tile-accent: #f9b104
    .stat-tile.temporary
      --tile-accent: #f6b09d
    .stat-tile.muted
      --tile-accent: #cbd2d9
    .stats-section
      display: flex
      flex-direction: column
      gap: var(--space-2)
    .stats-section-header
      display: flex
      align-items: center
      justify-content: space-between
      gap: var(--space-3)
    .stats-section-header h2
      margin: 0
      font-size: 1.25rem
      font-weight: 700
      color: var(--rsm-text)
    .stats-note
      margin: 0
      color: var(--rsm-muted)
    .stats-table-scroll
      overflow-x: auto
    .stats-table
      width: 100%
      border-collapse: collapse
      background: var(--rsm-panel-bg)
      border: 1px solid var(--rsm-border)
      border-radius: var(--rsm-panel-radius)
      overflow: hidden
    .stats-table th,
    .stats-table td
      padding: 10px 14px
      border-bottom: 1px solid var(--rsm-border)
      text-align: left
      white-space: nowrap
    .stats-table thead th
      background: var(--rsm-subtle-bg, rgba(0,0,0,0.03))
      font-weight: 600
      color: var(--rsm-text)
    .stats-table tbody tr:last-child td
      border-bottom: none
    .stats-table .num
      text-align: right
      font-variant-numeric: tabular-nums
    .stats-table td.has-vacancy
      color: #b42318
      font-weight: 700
    .stats-empty
      color: var(--rsm-muted)
      text-align: center
    .pill
      display: inline-block
      min-width: 34px
      padding: 2px 8px
      border-radius: 999px
      font-weight: 700
      text-align: center
    .pill.permanent
      background: rgba(155, 200, 171, 0.35)
      color: #1b5e34
    .pill.temporary
      background: rgba(246, 176, 157, 0.4)
      color: #a5432a
    .pill.vacant
      background: rgba(249, 177, 4, 0.25)
      color: #8a5a00
    @media (max-width: 991.98px)
      .stats-headline
        grid-template-columns: repeat(3, minmax(0, 1fr))
      .stats-holders
        grid-template-columns: repeat(2, minmax(0, 1fr))
    @media (max-width: 575.98px)
      .stats-headline
        grid-template-columns: repeat(2, minmax(0, 1fr))
  `]
})
export class VolunteerStatisticsView {
  private clipboard = inject(ClipboardService);
  protected readonly faCopy = faCopy;

  @Input() statistics: VolunteerStatistics;

  protected copyCoverage(): void {
    const header = ["Role", "Permanent", "Temporary cover", "Vacant", "Eligible parishes"];
    const rows = this.statistics.coverage.map(row => [row.roleLabel, row.permanent, row.temporary, row.vacant, row.eligibleParishes]);
    this.copyTable(header, rows);
  }

  protected copyAreas(areas: VolunteerAreaCoverageStat[], heading: string): void {
    const header = [heading, "Parishes", "LFO holders", "LFO vacancies", "PFO holders", "PFO vacancies"];
    const rows = areas.map(area => [area.label, area.eligibleParishes, area.localFootpathOfficerHolders, area.localFootpathOfficerVacancies, area.parishFootpathObserverHolders, area.parishFootpathObserverVacancies]);
    this.copyTable(header, rows);
  }

  private copyTable(header: (string | number)[], rows: (string | number)[][]): void {
    this.clipboard.copyToClipboard([header, ...rows].map(row => row.join("\t")).join("\n"));
  }
}
