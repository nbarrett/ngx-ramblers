import { Component, inject, Input } from "@angular/core";
import { Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faPersonWalking } from "@fortawesome/free-solid-svg-icons";
import { PageContent, PageContentRow } from "../../../models/content-text.model";
import { AppPath, RouteFollowQueryParam } from "../../../models/route-follow.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { RouteFollowPayloadService } from "../../../services/maps/route-follow-payload.service";
import { RouteFollowService } from "../../../services/maps/route-follow.service";
import { DynamicContentViewMap } from "./dynamic-content-view-map";

@Component({
  selector: "app-dynamic-content-view-route",
  template: `
    <div class="thumbnail-heading-frame mb-3">
      <div class="thumbnail-heading">{{ row.routeGuide?.title || "Route" }}</div>
      @if (row.routeGuide?.summary) {
        <p class="mb-2">{{ row.routeGuide.summary }}</p>
      }
      <p class="text-muted mb-3">
        @if (row.routeGuide?.distanceMiles) {
          {{ row.routeGuide.distanceMiles }} miles
        }
        @if (row.routeGuide?.durationMinutes) {
          @if (row.routeGuide?.distanceMiles) {
            ·
          }
          {{ followService.formatDuration(row.routeGuide.durationMinutes) }}
        }
        @if (row.routeGuide?.difficulty) {
          @if (row.routeGuide?.distanceMiles || row.routeGuide?.durationMinutes) {
            ·
          }
          {{ stringUtils.asTitle(row.routeGuide.difficulty) }}
        }
        @if (row.routeGuide?.startDescription) {
          @if (row.routeGuide?.distanceMiles || row.routeGuide?.durationMinutes || row.routeGuide?.difficulty) {
            ·
          }
          Start: {{ row.routeGuide.startDescription }}
        }
      </p>
      @if (payloadService.rowHasGpx(row)) {
        <button class="btn btn-primary app-follow-cta mb-3" type="button" (click)="follow()">
          <fa-icon [icon]="faPersonWalking" class="me-2"/>Follow this route
        </button>
      }
      <app-dynamic-content-view-map [row]="row" [pageContent]="pageContent"/>
      @if (guideWaypoints.length) {
        <div class="mt-3">
          <h3 class="h5">How to follow this route</h3>
          <ol class="ps-3">
            @for (marker of guideWaypoints; track $index) {
              <li class="mb-2">
                <strong>{{ marker.label || "Waypoint" }}</strong>
                @if (marker.instruction) {
                  <div>{{ marker.instruction }}</div>
                }
              </li>
            }
          </ol>
        </div>
      }
    </div>
  `,
  imports: [DynamicContentViewMap, FontAwesomeModule]
})
export class DynamicContentViewRoute {
  private router = inject(Router);
  protected actions = inject(PageContentActionsService);
  protected stringUtils = inject(StringUtilsService);
  protected payloadService = inject(RouteFollowPayloadService);
  protected followService = inject(RouteFollowService);
  protected readonly faPersonWalking = faPersonWalking;
  @Input() row!: PageContentRow;
  @Input() pageContent?: PageContent;

  get guideWaypoints() {
    return (this.row?.map?.markers || []).filter(marker => marker.instruction || marker.label);
  }

  follow(): void {
    const route = (this.row.map?.routes || []).find(item => this.payloadService.routeHasGpx(item));
    const queryParams: Record<string, string> = {};
    if (this.pageContent?.path) {
      queryParams[RouteFollowQueryParam.PATH] = this.pageContent.path;
    }
    if (route?.id) {
      queryParams[RouteFollowQueryParam.ROUTE_ID] = route.id;
    }
    void this.router.navigate(["/" + AppPath.ROOT, AppPath.FOLLOW], {queryParams});
  }
}
