import { Component, inject, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { PageContentRow } from "../../../models/content-text.model";
import { RouteDifficulty } from "../../../models/route-follow.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

@Component({
  selector: "app-dynamic-content-site-edit-route",
  template: `
    <div class="row mb-3 thumbnail-heading-frame">
      <div class="thumbnail-heading">Route details</div>
      <div class="col-md-8 mb-3">
        <label [for]="'route-title-' + id">Title</label>
        <input class="form-control" [id]="'route-title-' + id"
               [(ngModel)]="row.routeGuide.title"
               (ngModelChange)="changed()"
               placeholder="Barham and Four Churches">
      </div>
      <div class="col-md-4 mb-3">
        <label [for]="'route-difficulty-' + id">Difficulty</label>
        <select class="form-control" [id]="'route-difficulty-' + id"
                [(ngModel)]="row.routeGuide.difficulty"
                (ngModelChange)="changed()">
          <option [ngValue]="null">Not set</option>
          @for (item of difficulties; track item.value) {
            <option [ngValue]="item.value">{{ stringUtils.asTitle(item.value) }}</option>
          }
        </select>
      </div>
      <div class="col-md-4 mb-3">
        <label [for]="'route-distance-' + id">Distance (miles)</label>
        <input class="form-control" type="number" min="0" step="0.1"
               [id]="'route-distance-' + id"
               [(ngModel)]="row.routeGuide.distanceMiles"
               (ngModelChange)="changed()">
      </div>
      <div class="col-md-4 mb-3">
        <label [for]="'route-duration-' + id">Duration (minutes)</label>
        <input class="form-control" type="number" min="0" step="5"
               [id]="'route-duration-' + id"
               [(ngModel)]="row.routeGuide.durationMinutes"
               (ngModelChange)="changed()">
      </div>
      <div class="col-md-4 mb-3">
        <label [for]="'route-start-' + id">Start</label>
        <input class="form-control" [id]="'route-start-' + id"
               [(ngModel)]="row.routeGuide.startDescription"
               (ngModelChange)="changed()"
               placeholder="Village hall car park">
      </div>
      <div class="col-12">
        <label [for]="'route-summary-' + id">Summary</label>
        <textarea class="form-control" rows="3" [id]="'route-summary-' + id"
                  [(ngModel)]="row.routeGuide.summary"
                  (ngModelChange)="changed()"
                  placeholder="A short description of the walk"></textarea>
      </div>
    </div>
  `,
  imports: [FormsModule]
})
export class DynamicContentSiteEditRoute implements OnInit {
  private broadcastService = inject(BroadcastService);
  private actions = inject(PageContentActionsService);
  protected stringUtils = inject(StringUtilsService);
  protected difficulties: KeyValue<string>[] = enumKeyValues(RouteDifficulty);
  @Input() set row(value: PageContentRow) {
    this.routeRow = value;
    if (this.routeRow) {
      this.actions.ensureRouteGuide(this.routeRow);
    }
  }

  get row(): PageContentRow {
    return this.routeRow;
  }

  private routeRow: PageContentRow;

  get id(): string {
    return this.routeRow?.routeGuide?.title || "route";
  }

  ngOnInit(): void {
    if (this.routeRow) {
      this.actions.ensureRouteGuide(this.routeRow);
    }
  }

  changed(): void {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.row));
  }
}
