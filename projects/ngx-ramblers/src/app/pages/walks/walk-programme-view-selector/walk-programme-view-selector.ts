import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { faCalendarDays, faListCheck, faMap, faPersonHiking } from "@fortawesome/free-solid-svg-icons";
import { PROGRAMME_VIEWS, ProgrammeViewKey } from "../../../models/walk-programme.model";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { WALKS_LEADER_SEGMENT, walksAdminPath, walksLeaderPath, WalksAdminSegment } from "../../../models/walks-route-paths.model";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { UrlService } from "../../../services/url.service";
import { WalkDisplayService } from "../walk-display.service";

const PROGRAMME_VIEW_ICONS = {
  [ProgrammeViewKey.OVERVIEW]: faListCheck,
  [ProgrammeViewKey.CALENDAR]: faCalendarDays,
  [ProgrammeViewKey.MAP]: faMap,
  [ProgrammeViewKey.LEADER]: faPersonHiking
};

@Component({
  selector: "app-walk-programme-view-selector",
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [SectionToggle],
  template: `
    <app-section-toggle [tabs]="tabs" [selectedTab]="currentSegment()" (selectedTabChange)="openView($event)"/>
  `
})
export class WalkProgrammeViewSelector {

  private urlService = inject(UrlService);
  private router = inject(Router);
  private display = inject(WalkDisplayService);

  protected readonly tabs: SectionToggleTab[] = PROGRAMME_VIEWS.map(view => ({
    value: view.segment,
    label: view.label,
    icon: PROGRAMME_VIEW_ICONS[view.view]
  }));

  currentSegment(): string {
    return this.urlService.lastPathSegment();
  }

  openView(segment: string): Promise<boolean> {
    this.display.rememberReturnUrl();
    const area = this.display.walksArea();
    const path = segment === WALKS_LEADER_SEGMENT
      ? walksLeaderPath(area)
      : walksAdminPath(area, segment as WalksAdminSegment);
    return this.router.navigate(["/" + path], {queryParamsHandling: "preserve"});
  }
}
