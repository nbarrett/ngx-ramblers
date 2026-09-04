import { Component, inject, Input, ViewChild } from "@angular/core";
import { PageContent, PageContentRow } from "../../../models/content-text.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { RouteFollowService } from "../../../services/maps/route-follow.service";
import { FeaturesService } from "../../../services/features.service";
import { DynamicContentViewMap } from "./dynamic-content-view-map";
import { MarkdownComponent } from "ngx-markdown";
import { LocationLinksComponent } from "../location-links/location-links.component";
import { WalkFeaturesComponent } from "../../../pages/walks/walk-view/walk-features";
import { WRITTEN_DIRECTIONS_DEFAULT, WrittenDirectionsDisplay } from "../../../models/route-follow.model";
import { rowsWithin } from "../../../functions/map-location-markers";

@Component({
  selector: "app-dynamic-content-view-route",
  template: `
    <div class="mb-3">
      @if (showTitle) {
        <h2>{{ row.routeGuide.title }}</h2>
      }
      @if (row.routeGuide?.summary) {
        <div class="mb-2" markdown [data]="row.routeGuide.summary"></div>
      }
      @if (stats.length > 0) {
        <p class="text-muted mb-2">{{ stats.join(" · ") }}</p>
      }
      @if (row.routeGuide?.start_location) {
        <div class="mb-3">
          <app-location-links [location]="row.routeGuide.start_location" [inline]="true" [showDescription]="!!row.routeGuide.start_location.description"/>
        </div>
      }
      @if (hasFeatures) {
        <div class="mb-3">
          <app-walk-features [extendedGroupEvent]="asExtendedGroupEvent" [shaded]="false"/>
        </div>
      }
      <app-dynamic-content-view-map [row]="row" [pageContent]="pageContent"/>
      @if (showWrittenDirections) {
        <div class="thumbnail-heading-frame">
          <div class="thumbnail-heading">Written directions</div>
          <div markdown [data]="row.routeGuide.writtenDirections"></div>
        </div>
      }
    </div>
  `,
  imports: [DynamicContentViewMap, LocationLinksComponent, WalkFeaturesComponent, MarkdownComponent]
})
export class DynamicContentViewRoute {
  protected actions = inject(PageContentActionsService);
  protected followService = inject(RouteFollowService);
  private featuresService = inject(FeaturesService);
  @Input() row!: PageContentRow;
  @Input() pageContent?: PageContent;
  @ViewChild(DynamicContentViewMap) map?: DynamicContentViewMap;

  get showTitle(): boolean {
    const title = this.row?.routeGuide?.title?.trim();
    const headingLines = rowsWithin(this.pageContent?.rows).flatMap(row => (row.columns || []).flatMap(column => (column.contentText || "").split("\n").filter(line => line.startsWith("#"))));
    return !!title && !headingLines.some(line => line.replace(/^#+\s*/, "").trim() === title);
  }

  get showWrittenDirections(): boolean {
    const display = this.row?.routeGuide?.writtenDirectionsDisplay || WRITTEN_DIRECTIONS_DEFAULT;
    return !!this.row?.routeGuide?.writtenDirections && display !== WrittenDirectionsDisplay.NEVER
      && !(display === WrittenDirectionsDisplay.HIDE_WHEN_FOLLOWING && this.map?.guideOpen);
  }

  get stats(): string[] {
    const guide = this.row?.routeGuide;
    return [
      guide?.distance_miles ? `${guide.distance_miles} miles` : "",
      guide?.durationMinutes ? this.followService.formatDuration(guide.durationMinutes) : "",
      guide?.difficulty?.description || ""
    ].filter(item => !!item);
  }

  get asExtendedGroupEvent(): ExtendedGroupEvent {
    return {groupEvent: this.row?.routeGuide} as ExtendedGroupEvent;
  }

  get hasFeatures(): boolean {
    return this.featuresService.combinedFeatures(this.asExtendedGroupEvent.groupEvent).length > 0;
  }
}
