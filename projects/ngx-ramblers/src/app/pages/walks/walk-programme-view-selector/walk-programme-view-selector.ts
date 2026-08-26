import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { faCalendarDays, faCloudArrowUp, faListCheck, faMap, faPersonHiking, faUserShield } from "@fortawesome/free-solid-svg-icons";
import { PROGRAMME_VIEWS, ProgrammeViewKey } from "../../../models/walk-programme.model";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { WALKS_ADMIN_SEGMENT, WALKS_LEADER_SEGMENT, walksAdminPath, walksLeaderPath, WalksAdminSegment } from "../../../models/walks-route-paths.model";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { UrlService } from "../../../services/url.service";
import { WalkDisplayService } from "../walk-display.service";
import { MemberLoginService } from "../../../services/member/member-login.service";

const PROGRAMME_VIEW_ICONS = {
  [ProgrammeViewKey.OVERVIEW]: faListCheck,
  [ProgrammeViewKey.CALENDAR]: faCalendarDays,
  [ProgrammeViewKey.MAP]: faMap,
  [ProgrammeViewKey.LEADER]: faPersonHiking,
  [ProgrammeViewKey.EXPORT]: faCloudArrowUp,
  [ProgrammeViewKey.ADMIN]: faUserShield
};

@Component({
  selector: "app-walk-programme-view-selector",
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [SectionToggle],
  template: `
    <div class="view-row">
      <app-section-toggle class="view-row-toggle" stackOnMobile [tabs]="tabs" [selectedTab]="currentSegment()"
                          (selectedTabChange)="openView($event)"/>
      <div class="view-row-end">
        <ng-content/>
      </div>
    </div>
  `,
  styles: [`
    :host
      display: block
      padding-bottom: var(--space-4)
    .view-row
      display: flex
      align-items: center
      gap: var(--space-3)
      flex-wrap: wrap
    .view-row-toggle
      flex: 0 0 auto
    .view-row-end
      margin-left: auto
      display: flex
      align-items: center
      gap: var(--space-3)
    .view-row-end:empty
      display: none
    @media (max-width: 768px)
      .view-row
        flex-direction: column
        align-items: stretch
      .view-row-toggle, .view-row-end
        width: 100%
      .view-row-end
        margin-left: 0
  `]
})
export class WalkProgrammeViewSelector {

  private urlService = inject(UrlService);
  private router = inject(Router);
  private display = inject(WalkDisplayService);
  private memberLoginService = inject(MemberLoginService);

  get tabs(): SectionToggleTab[] {
    return PROGRAMME_VIEWS
      .filter(view => {
        if (view.localPopulationOnly) {
          return this.localWalksAdmin();
        } else if (view.adminOnly) {
          return this.walkAdmin();
        } else {
          return true;
        }
      })
      .map(view => ({
        value: view.segment,
        label: view.label,
        icon: PROGRAMME_VIEW_ICONS[view.view]
      }));
  }

  private localWalksAdmin(): boolean {
    return this.display.walkPopulationLocal() && this.walkAdmin();
  }

  private walkAdmin(): boolean {
    return this.memberLoginService.allowWalkAdminEdits();
  }

  currentSegment(): string {
    return this.urlService.lastPathSegment();
  }

  openView(segment: string): Promise<boolean> {
    this.display.rememberReturnUrl();
    const area = this.display.walksArea();
    if (segment === WALKS_LEADER_SEGMENT) {
      return this.router.navigate(["/" + walksLeaderPath(area)], {queryParamsHandling: "preserve"});
    } else if (segment === WALKS_ADMIN_SEGMENT) {
      return this.router.navigate(["/" + walksAdminPath(area)], {queryParamsHandling: "preserve"});
    } else {
      return this.router.navigate(["/" + walksAdminPath(area, segment as WalksAdminSegment)], {queryParamsHandling: "preserve"});
    }
  }
}
